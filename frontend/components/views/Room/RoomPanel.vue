<!-- Side panel of the call (chat, background and devices): beside the picture on large screens, over it on small ones.
Its content scrolls inside, the title and the close button stay visible. -->
<template>
    <section class="room-panel" :aria-labelledby="`room-panel-${id}`">
        <header class="room-panel__head">
            <h3 :id="`room-panel-${id}`" class="room-panel__title text-label">{{ title }}</h3>
            <button type="button" class="room-panel__close" :aria-label="t('roomClose')" :title="t('roomClose')" @click="emit('close')">
                <i class="fas fa-xmark" aria-hidden="true"></i>
            </button>
        </header>
        <div class="room-panel__body">
            <slot />
        </div>
    </section>
</template>

<script setup lang="ts">
import { useLang } from '@/composables/useLang'

defineProps({
    id: { type: String, required: true },
    title: { type: String, required: true },
})
const emit = defineEmits<{ close: [] }>()
const t = useLang().getTranslation
</script>

<style scoped>
.room-panel {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: var(--ink-800);
    border-left: 1px solid var(--line);
}

.room-panel__head {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.35rem 0.35rem 0.35rem 1rem;
    border-bottom: 1px solid var(--line);
}

.room-panel__title {
    margin: 0;
    color: var(--fg-muted);
}

.room-panel__close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    padding: 0;
    border: 1px solid transparent;
    border-radius: 50%;
    background: none;
    color: var(--fg);
    cursor: pointer;
}

@media (hover: hover) and (pointer: fine) {
    .room-panel__close:hover {
        border-color: var(--accent);
    }
}

.room-panel__close:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
}

.room-panel__body {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
}
</style>
