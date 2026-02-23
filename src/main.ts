import { createApp } from "vue";
import { createPinia } from "pinia";
import router from "./router";

async function bootstrap() {
  // In a regular browser (no Tauri runtime), install IPC mocks
  // so that all invoke() calls return realistic data.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof (window as any).__TAURI_INTERNALS__ === "undefined") {
    const { installMocks } = await import("./mocks/setupMocks");
    installMocks();
  }

  // Dynamic import: App.vue (and its transitive deps like useUpdateCheck)
  // must load AFTER mocks are installed, because useUpdateCheck calls
  // invoke("get_build_time") at module level.
  const { default: App } = await import("./App.vue");

  const app = createApp(App);
  app.use(createPinia());
  app.use(router);
  app.mount("#app");
}

bootstrap();
