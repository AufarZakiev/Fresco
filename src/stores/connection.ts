import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { ConnectionState } from "../types/boinc";
import {
  connectLocal,
  connect,
  disconnect as rpcDisconnect,
} from "../composables/useRpc";

interface ConnectionParams {
  mode: "local" | "remote";
  dataDir?: string;
  host?: string;
  port?: number;
  password?: string;
}

export const useConnectionStore = defineStore("connection", () => {
  const state = ref<ConnectionState>("Disconnected");
  const error = ref<string | null>(null);
  const reconnectAttempt = ref(0);
  const maxReconnectAttempts = 10;
  const lastParams = ref<ConnectionParams | null>(null);

  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnecting = false;

  const isReconnecting = computed(() => reconnectAttempt.value > 0);

  async function connectToLocal(dataDir: string) {
    state.value = "Connecting";
    error.value = null;
    lastParams.value = { mode: "local", dataDir };
    try {
      await connectLocal(dataDir);
      state.value = "Connected";
      reconnectAttempt.value = 0;
      reconnecting = false;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      error.value = msg;
      if (msg.includes("Authentication")) {
        state.value = "AuthError";
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
    state.value = "Connecting";
    error.value = null;
    lastParams.value = { mode: "remote", host, port, password };
    try {
      await connect(host, port, password);
      state.value = "Connected";
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
    state.value = "Disconnected";
    error.value = null;
  }

  function cancelReconnect() {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function handleConnectionError() {
    if (reconnecting || state.value !== "Connected" || !lastParams.value) return;
    reconnecting = true;
    reconnectAttempt.value = 1;
    state.value = "Reconnecting";
    scheduleReconnect();
  }

  function scheduleReconnect() {
    if (reconnectAttempt.value > maxReconnectAttempts || !lastParams.value) {
      reconnecting = false;
      reconnectAttempt.value = 0;
      state.value = "Disconnected";
      error.value = "Reconnection failed after multiple attempts";
      return;
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s, 30s...
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempt.value - 1), 30000);
    reconnectTimer = setTimeout(attemptReconnect, delay);
  }

  async function attemptReconnect() {
    reconnectTimer = null;
    if (!lastParams.value || !reconnecting) return;

    try {
      if (lastParams.value.mode === "local") {
        await connectLocal(lastParams.value.dataDir!);
      } else {
        await connect(
          lastParams.value.host!,
          lastParams.value.port!,
          lastParams.value.password!,
        );
      }
      // Success
      state.value = "Connected";
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
