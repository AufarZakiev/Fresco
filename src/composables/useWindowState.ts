import { onMounted } from "vue";
import { useLocalStorage } from "@vueuse/core";
import { useRouter } from "vue-router";

const STORAGE_KEY = "boinc-window-state";

interface WindowState {
  lastRoute: string;
}

/**
 * Restores the last visited route on mount and saves route changes.
 * Call once in App.vue setup.
 */
export function useWindowState() {
  const router = useRouter();
  const state = useLocalStorage<WindowState>(
    STORAGE_KEY,
    { lastRoute: "/tasks" },
    { flush: "sync", writeDefaults: false },
  );

  onMounted(() => {
    if (state.value.lastRoute && state.value.lastRoute !== "/") {
      router.replace(state.value.lastRoute).catch(() => {});
    }
  });

  router.afterEach((to) => {
    if (to.path !== "/") {
      state.value = { lastRoute: to.path };
    }
  });
}
