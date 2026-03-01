<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted, useId } from "vue";

const props = withDefaults(
  defineProps<{
    text: string;
    placement?: "top" | "bottom";
    delay?: number;
    disabled?: boolean;
  }>(),
  { placement: "top", delay: 400, disabled: false },
);

const MARGIN = 8;

const tooltipId = useId();
const visible = ref(false);
const bubbleStyle = ref<Record<string, string>>({});
const wrapperRef = ref<HTMLElement | null>(null);
const bubbleRef = ref<HTMLElement | null>(null);
let showTimer: ReturnType<typeof setTimeout> | null = null;

function getTrigger(): HTMLElement | null {
  return wrapperRef.value?.firstElementChild as HTMLElement | null;
}

function bindTriggerAria() {
  const trigger = getTrigger();
  if (trigger && props.text) {
    trigger.setAttribute("aria-describedby", tooltipId);
  }
}

function unbindTriggerAria() {
  const trigger = getTrigger();
  if (trigger) {
    trigger.removeAttribute("aria-describedby");
  }
}

onMounted(bindTriggerAria);
onUnmounted(unbindTriggerAria);

async function show() {
  if (props.disabled || !props.text) return;
  if (showTimer !== null) clearTimeout(showTimer);
  showTimer = setTimeout(async () => {
    const trigger = getTrigger();
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;

    // Render invisible first so we can measure actual bubble width
    bubbleStyle.value = {
      position: "fixed",
      left: `${centerX}px`,
      top: props.placement === "top" ? `${rect.top - 6}px` : `${rect.bottom + 6}px`,
      transform: props.placement === "top" ? "translateX(-50%) translateY(-100%)" : "translateX(-50%)",
      zIndex: "9000",
      visibility: "hidden",
    };
    visible.value = true;

    // After render — clamp to viewport
    await nextTick();
    const bubble = bubbleRef.value;
    if (!bubble) {
      bubbleStyle.value = { ...bubbleStyle.value, visibility: "visible" };
      return;
    }

    const br = bubble.getBoundingClientRect();

    // Vertical flip: if clipped at top → show below, if clipped at bottom → show above
    let top = props.placement === "top" ? rect.top - 6 : rect.bottom + 6;
    let transform = props.placement === "top" ? "translateX(-50%) translateY(-100%)" : "translateX(-50%)";

    if (props.placement === "top" && br.top < MARGIN) {
      top = rect.bottom + 6;
      transform = "translateX(-50%)";
    } else if (props.placement === "bottom" && br.bottom > window.innerHeight - MARGIN) {
      top = rect.top - 6;
      transform = "translateX(-50%) translateY(-100%)";
    }

    // Horizontal clamp
    let left = centerX;
    if (br.left < MARGIN) {
      left = centerX + (MARGIN - br.left);
    } else if (br.right > window.innerWidth - MARGIN) {
      left = centerX - (br.right - (window.innerWidth - MARGIN));
    }

    bubbleStyle.value = {
      ...bubbleStyle.value,
      left: `${left}px`,
      top: `${top}px`,
      transform,
      visibility: "visible",
    };
  }, props.delay);
}

function hide() {
  if (showTimer !== null) {
    clearTimeout(showTimer);
    showTimer = null;
  }
  visible.value = false;
}

onUnmounted(() => {
  if (showTimer !== null) clearTimeout(showTimer);
});
</script>

<template>
  <div
    ref="wrapperRef"
    class="tooltip-wrapper"
    @mouseenter="show"
    @mouseleave="hide"
    @focusin="show"
    @focusout="hide"
  >
    <slot />
    <Teleport to="body">
      <div
        v-if="visible && text"
        :id="tooltipId"
        ref="bubbleRef"
        role="tooltip"
        class="tooltip-bubble"
        :style="bubbleStyle"
      >
        {{ text }}
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.tooltip-wrapper {
  display: contents;
}
</style>

<style>
/* Unscoped — bubble is teleported outside component subtree */
.tooltip-bubble {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
  font-size: var(--font-size-xs);
  font-weight: 400;
  line-height: 1.4;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  white-space: nowrap;
  pointer-events: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  animation: tooltip-in 0.12s ease forwards;
}

@keyframes tooltip-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
</style>
