use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::sync::Mutex;

use super::auth;
use super::types::ConnectionState;

const END_MARKER: u8 = 0x03;
const DEFAULT_PORT: u16 = 31416;
const READ_BUF_SIZE: usize = 8192;

/// Low-level RPC connection to a BOINC client over TCP.
pub struct RpcClient {
    stream: Arc<Mutex<Option<TcpStream>>>,
    host: String,
    port: u16,
    state: Arc<Mutex<ConnectionState>>,
}

impl RpcClient {
    pub fn new(host: &str, port: u16) -> Self {
        Self {
            stream: Arc::new(Mutex::new(None)),
            host: host.to_string(),
            port: if port == 0 { DEFAULT_PORT } else { port },
            state: Arc::new(Mutex::new(ConnectionState::Disconnected)),
        }
    }

    pub fn localhost() -> Self {
        Self::new("127.0.0.1", DEFAULT_PORT)
    }

    pub async fn connection_state(&self) -> ConnectionState {
        self.state.lock().await.clone()
    }

    /// Connect to the BOINC client and authenticate.
    pub async fn connect(&self, password: &str) -> Result<(), String> {
        {
            let mut state = self.state.lock().await;
            *state = ConnectionState::Connecting;
        }

        let addr = format!("{}:{}", self.host, self.port);
        let tcp = TcpStream::connect(&addr)
            .await
            .map_err(|e| format!("Failed to connect to {}: {}", addr, e))?;

        {
            let mut stream = self.stream.lock().await;
            *stream = Some(tcp);
        }

        // Authenticate
        if !password.is_empty() {
            let nonce = self.rpc_call("<auth1/>").await?;
            let nonce_val = auth::extract_nonce(&nonce)
                .ok_or_else(|| "Failed to parse nonce from auth1 response".to_string())?;
            let hash = auth::compute_auth_hash(&nonce_val, password);
            let auth2_req = format!("<auth2>\n<nonce_hash>{}</nonce_hash>\n</auth2>", hash);
            let auth_response = self.rpc_call(&auth2_req).await?;
            if !auth_response.contains("<authorized/>") {
                let mut state = self.state.lock().await;
                *state = ConnectionState::AuthError;
                return Err("Authentication failed".to_string());
            }
        }

        {
            let mut state = self.state.lock().await;
            *state = ConnectionState::Connected;
        }
        Ok(())
    }

    /// Send an RPC request and receive the response.
    /// The request should be the inner XML (without the wrapper tags).
    pub async fn rpc_call(&self, request: &str) -> Result<String, String> {
        let mut stream_guard = self.stream.lock().await;
        let tcp = stream_guard
            .as_mut()
            .ok_or_else(|| "Not connected".to_string())?;

        // Send: wrap in <boinc_gui_rpc_request> and append 0x03
        let msg = format!(
            "<boinc_gui_rpc_request>\n{}\n</boinc_gui_rpc_request>\n",
            request
        );
        let mut data = msg.into_bytes();
        data.push(END_MARKER);

        tcp.write_all(&data)
            .await
            .map_err(|e| format!("Send failed: {}", e))?;

        // Receive until 0x03
        let mut response = Vec::new();
        let mut buf = [0u8; READ_BUF_SIZE];
        loop {
            let n = tcp
                .read(&mut buf)
                .await
                .map_err(|e| format!("Receive failed: {}", e))?;
            if n == 0 {
                return Err("Connection closed by BOINC client".to_string());
            }
            // Check for end marker
            if let Some(pos) = buf[..n].iter().position(|&b| b == END_MARKER) {
                response.extend_from_slice(&buf[..pos]);
                break;
            }
            response.extend_from_slice(&buf[..n]);
        }

        String::from_utf8(response).map_err(|e| format!("Invalid UTF-8 in response: {}", e))
    }

    pub async fn disconnect(&self) {
        let mut stream = self.stream.lock().await;
        *stream = None;
        let mut state = self.state.lock().await;
        *state = ConnectionState::Disconnected;
    }
}
