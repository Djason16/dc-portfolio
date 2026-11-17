<!-- Background of the camera: none, light or strong blur, or an image (utils/room/effects.ts). The person is cut out on this
device (MediaPipe, loaded only when an effect is chosen); the choice is remembered in this browser. -->
<template>
    <fieldset class="room-effects">
        <legend class="room-effects__legend text-label">{{ t('roomBackground') }}</legend>
        <div class="room-effects__grid">
            <button v-for="effect in EFFECTS" :key="effect.id" type="button" class="room-effects__tile" :class="{ 'is-on': current === effect.id }"
                :aria-pressed="current === effect.id" :aria-label="t(effect.labelKey)" :title="t(effect.labelKey)" :disabled="!media.hasCamera.value"
                @click="media.effects.choose(effect.id)">
                <img v-if="effect.image" class="room-effects__thumb" :src="effectImageUrl(effect.image, true)" :alt="t(effect.labelKey)" :title="t(effect.labelKey)"
                    width="192" height="108" loading="lazy" decoding="async">
                <span v-else class="room-effects__icon" :class="{ 'is-blur': effect.blur }" aria-hidden="true">
                    <i :class="effect.blur ? 'fas fa-droplet' : 'fas fa-ban'"></i>
                    <i v-if="effect.blur && effect.blur > 10" class="fas fa-droplet"></i>
                </span>
                <span class="room-effects__name text-body-s">{{ t(effect.labelKey) }}</span>
            </button>
        </div>
        <p v-if="media.effects.busy.value" class="room-effects__note text-body-s" role="status">{{ t('roomEffectLoading') }}</p>
        <p v-else-if="media.effects.issue.value" class="room-effects__issue text-body-s" role="alert">{{ t(media.effects.issue.value) }}</p>
        <p v-else class="room-effects__note text-body-s">{{ t('roomEffectNote') }}</p>
    </fieldset>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { computed } from 'vue'
import { useLang } from '@/composables/useLang'
import type { LocalMedia } from '@/composables/useLocalMedia'
import { EFFECTS, effectImageUrl } from '@/utils/room/effects'

const props = defineProps({ media: { type: Object as PropType<LocalMedia>, required: true } })
const t = useLang().getTranslation
const current = computed(() => props.media.effects.effect.value)
</script>

<style scoped>
.room-effects {
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
}

.room-effects__legend {
    margin-bottom: 0.75rem;
    padding: 0;
    color: var(--fg-muted);
}

.room-effects__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(5.25rem, 1fr));
    gap: 0.5rem;
}

.room-effects__tile {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.35rem;
    min-width: 0;
    padding: 0.35rem;
    border: 1px solid var(--line);
    background: var(--ink-700);
    color: var(--fg);
    cursor: pointer;
    transition: border-color var(--motion-fast) var(--ease);
}

.room-effects__tile.is-on {
    border-color: var(--accent);
}

@media (hover: hover) and (pointer: fine) {
    .room-effects__tile:hover:not(:disabled) {
        border-color: var(--accent);
    }
}

.room-effects__tile.is-on {
    box-shadow: inset 0 0 0 1px var(--accent);
}

.room-effects__tile:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
}

.room-effects__tile:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

.room-effects__thumb,
.room-effects__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.15rem;
    width: 100%;
    height: auto;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    background: var(--ink-900);
    color: var(--fg-muted);
}

.room-effects__icon.is-blur {
    color: var(--accent);
}

.room-effects__name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.room-effects__note,
.room-effects__issue {
    margin: 0.75rem 0 0;
    color: var(--fg-muted);
}

.room-effects__issue {
    padding-left: 0.75rem;
    border-left: 2px solid var(--accent-yellow);
    color: var(--fg);
}
</style>
