import { onMounted, onUnmounted } from "vue";

interface KeyboardOptions {
  onSelectAll?: () => void;
  onDeselect?: () => void;
  onDelete?: () => void;
}

export function useKeyboard(options: KeyboardOptions) {
  function handler(e: KeyboardEvent) {
    // Ignore if user is typing in an input/textarea
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

    if ((e.ctrlKey || e.metaKey) && e.key === "a") {
      e.preventDefault();
      options.onSelectAll?.();
    } else if (e.key === "Escape") {
      options.onDeselect?.();
    } else if (e.key === "Delete") {
      options.onDelete?.();
    }
  }

  onMounted(() => {
    document.addEventListener("keydown", handler);
  });

  onUnmounted(() => {
    document.removeEventListener("keydown", handler);
  });
}
