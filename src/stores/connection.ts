import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { ConnectionState, ConnectionMode } from "../types/boinc";
import { CONNECTION_STATE, CONNECTION_MODE } from "../types/boinc";
import {
  connectLocal,
  connect,
  disconnect as rpcDisconnect,
} from "../composables/useRpc";

const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 30000;

interface ConnectionParams {
  mode: ConnectionMode;
  dataDir?: string;
  host?: string;
  port?: number;
  password?: string;
}

export const useConnectionStore = defineStore("connection", () => {
  const state = ref<ConnectionState>(CONNECTION_STATE.DISCONNECTED);
  const error = ref<string | null>(null);
  const reconnectAttempt = ref(0);
  const maxReconnectAttempts = 10;
  const lastParams = ref<ConnectionParams | null>(null);

  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnecting = false;

  const isReconnecting = computed(() => reconnectAttempt.value > 0);

  async function connectToLocal(dataDir: string) {
    state.value = CONNECTION_STATE.CONNECTING;
    error.value = null;
    lastParams.value = { mode: CONNECTION_MODE.LOCAL, dataDir };
    try {
      await connectLocal(dataDir);
      state.value = CONNECTION_STATE.CONNECTED;
      reconnectAttempt.value = 0;
      reconnecting = false;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      error.value = msg;
      if (msg.includes("Authentication")) {
        state.value = CONNECTION_STATE.AUTH_ERROR;
      } else {
        state.value = { Error: msg };
      }
    }
  }

  async function connectToRemote(
    host: string,
    port: number,
    password: string,
  ) {
    state.value = CONNECTION_STATE.CONNECTING;
    error.value = null;
    lastParams.value = { mode: CONNECTION_MODE.REMOTE, host, port, password };
    try {
      await connect(host, port, password);
      state.value = CONNECTION_STATE.CONNECTED;
      reconnectAttempt.value = 0;
      reconnecting = false;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      error.value = msg;
      state.value = { Error: msg };
    }
  }

  async function disconnect() {
    cancelReconnect();
    reconnecting = false;
    reconnectAttempt.value = 0;
    lastParams.value = null;
    await rpcDisconnect();
    state.value = CONNECTION_STATE.DISCONNECTED;
    error.value = null;
  }

  function cancelReconnect() {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function handleConnectionError() {
    if (reconnecting || state.value !== CONNECTION_STATE.CONNECTED || !lastParams.value) return;
    reconnecting = true;
    reconnectAttempt.value = 1;
    state.value = CONNECTION_STATE.RECONNECTING;
    scheduleReconnect();
  }

  function scheduleReconnect() {
    if (reconnectAttempt.value > maxReconnectAttempts || !lastParams.value) {
      reconnecting = false;
      reconnectAttempt.value = 0;
      state.value = CONNECTION_STATE.DISCONNECTED;
      error.value = "Reconnection failed after multiple attempts";
      return;
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s, 30s...
    const delay = Math.min(RECONNECT_BASE_DELAY_MS * Math.pow(2, reconnectAttempt.value - 1), RECONNECT_MAX_DELAY_MS);
    reconnectTimer = setTimeout(attemptReconnect, delay);
  }

  async function attemptReconnect() {
    reconnectTimer = null;
    if (!lastParams.value || !reconnecting) return;

    try {
      if (lastParams.value.mode === CONNECTION_MODE.LOCAL) {
        await connectLocal(lastParams.value.dataDir!);
      } else {
        await connect(
          lastParams.value.host!,
          lastParams.value.port!,
          lastParams.value.password!,
        );
      }
      // Success
      state.value = CONNECTION_STATE.CONNECTED;
      reconnectAttempt.value = 0;
      reconnecting = false;
    } catch {
      // Failed — try again
      reconnectAttempt.value++;
      scheduleReconnect();
    }
  }

  return {
    state,
    error,
    reconnectAttempt,
    maxReconnectAttempts,
    isReconnecting,
    lastParams,
    connectToLocal,
    connectToRemote,
    disconnect,
    handleConnectionError,
    cancelReconnect,
  };
});
