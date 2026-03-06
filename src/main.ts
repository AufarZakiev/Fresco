import { createApp } from "vue";
import { createPinia } from "pinia";
import router from "./router";
import i18n, { applyStoredLocale } from "./i18n";

async function bootstrap() {
  // In a regular browser (no Tauri runtime), install IPC mocks
  // so that all invoke() calls return realistic data.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!import.meta.env.PROD && typeof (window as any).__TAURI_INTERNALS__ === "undefined") {
    const { installMocks } = await import("./mocks/setupMocks");
    installMocks();
  }

  // Dynamic import: App.vue (and its transitive deps like useUpdateCheck)
  // must load AFTER mocks are installed, because useUpdateCheck calls
  // invoke("get_build_time") at module level.
  const { default: App } = await import("./App.vue");

  const pinia = createPinia();
  const app = createApp(App);
  app.use(pinia);
  app.use(router);
  app.use(i18n);

  // Apply saved language before first render
  const { useManagerSettingsStore } = await import("./stores/managerSettings");
  const managerSettings = useManagerSettingsStore();
  await applyStoredLocale(managerSettings.settings.language);

  app.mount("#app");
}

bootstrap().catch((error: unknown) => {
  console.error("[Fresco] bootstrap failed:", error);

  const container = document.getElementById("app");
  if (!container) return;

  let message: string;
  if (error instanceof Error) {
    message = error.stack ?? error.message ?? "Unknown startup error";
  } else {
    try {
      message = String(error);
    } catch {
      message = "Unknown startup error";
    }
  }

  // Build fallback error screen using safe DOM methods (no innerHTML)
  // Zero body margin so the overlay fills the viewport without a visible border
  // (global CSS reset from App.vue won't be loaded if bootstrap fails early)
  if (document.body) {
    document.body.style.margin = "0";
  }

  const wrapper = document.createElement("div");
  Object.assign(wrapper.style, {
    position: "fixed",
    inset: "0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#1a1a2e",
    color: "#e0e0e0",
    fontFamily: "system-ui, sans-serif",
    padding: "2rem",
    overflow: "auto",
  });

  const card = document.createElement("div");
  Object.assign(card.style, { maxWidth: "480px", textAlign: "center" });

  const heading = document.createElement("h1");
  Object.assign(heading.style, {
    margin: "0 0 1rem",
    fontSize: "1.5rem",
    color: "#ff6b6b",
  });
  heading.textContent = "Failed to start Fresco";

  const description = document.createElement("p");
  Object.assign(description.style, { margin: "0 0 1.5rem", lineHeight: "1.6" });
  description.textContent =
    "The application could not initialize. Please try restarting. If the problem persists, report an issue on GitHub.";

  const details = document.createElement("details");
  Object.assign(details.style, {
    textAlign: "left",
    background: "#12121f",
    borderRadius: "8px",
    padding: "1rem",
  });

  const summary = document.createElement("summary");
  Object.assign(summary.style, { cursor: "pointer", marginBottom: "0.5rem" });
  summary.textContent = "Error details";

  const pre = document.createElement("pre");
  Object.assign(pre.style, {
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    wordBreak: "break-all",
    margin: "0",
    fontSize: "0.85rem",
    color: "#ccc",
  });
  pre.textContent = message;

  details.append(summary, pre);
  card.append(heading, description, details);
  wrapper.append(card);

  container.replaceChildren(wrapper);
});
