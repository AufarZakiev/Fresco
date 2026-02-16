import { onMounted } from "vue";
import { useRouter } from "vue-router";

const STORAGE_KEY = "boinc-window-state";

interface WindowState {
  lastRoute: string;
}

function load(): WindowState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return { lastRoute: "/tasks" };
}

function save(state: WindowState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/**
 * Restores the last visited route on mount and saves route changes.
 * Call once in App.vue setup.
 */
export function useWindowState() {
  const router = useRouter();

  onMounted(() => {
    const state = load();
    if (state.lastRoute && state.lastRoute !== "/") {
      router.replace(state.lastRoute).catch(() => {});
    }
  });

  router.afterEach((to) => {
    if (to.path !== "/") {
      save({ lastRoute: to.path });
    }
  });
}
