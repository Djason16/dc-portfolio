<!-- Small tools in the bottom right corner of the picture: the quality of the connection (composables/useCallQuality.ts,
details on hover and for screen readers), picture-in-picture of the other person (the call stays in view over other windows)
and full screen. Each button only where the browser has it (no full screen on iPhone). -->
<template>
    <div class="room-tools">
        <span v-if="quality.level.value" class="room-tools__quality" :class="`is-${quality.level.value}`" role="img" :aria-label="qualityText" :title="qualityText">
            <span v-for="bar in 3" :key="bar" class="room-tools__bar" :class="{ 'is-lit': bar <= lit }"></span>
        </span>
        <button v-if="canPip && hasVideo" type="button" class="room-tools__btn" :class="{ 'is-on': inPip }" :aria-pressed="inPip"
            :aria-label="t(inPip ? 'roomPipExit' : 'roomPip')" :title="t(inPip ? 'roomPipExit' : 'roomPip')" @click="togglePip">
            <i class="fas fa-window-restore" aria-hidden="true"></i>
        </button>
        <button v-if="canFullscreen" type="button" class="room-tools__btn" :aria-pressed="full" :aria-label="t(full ? 'roomFullscreenExit' : 'roomFullscreen')"
            :title="t(full ? 'roomFullscreenExit' : 'roomFullscreen')" @click="toggleFullscreen">
            <i :class="full ? 'fas fa-compress' : 'fas fa-expand'" aria-hidden="true"></i>
        </button>
    </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useLang } from '@/composables/useLang'
import type { useCallQuality } from '@/composables/useCallQuality'

const props = defineProps({
    quality: { type: Object as PropType<ReturnType<typeof useCallQuality>>, required: true },
    // The video of the other person (picture-in-picture) and the whole call (full screen)
    video: { type: Object as PropType<HTMLVideoElement | null>, default: null },
    box: { type: Object as PropType<HTMLElement | null>, default: null },
    hasVideo: { type: Boolean, default: false },
})
const t = useLang().getTranslation

const LEVEL_KEYS = { good: 'roomQualityGood', medium: 'roomQualityMedium', poor: 'roomQualityPoor' } as const
const lit = computed(() => ({ good: 3, medium: 2, poor: 1, '': 0 })[props.quality.level.value])
const qualityText = computed(() => {
    const level = props.quality.level.value
    if (!level) return ''
    return t('roomQualityDetail', { level: t(LEVEL_KEYS[level]), rtt: props.quality.rtt.value, loss: props.quality.loss.value })
})

// Known in the browser only
const canPip = ref(false)
const canFullscreen = ref(false)
const inPip = ref(false)
const full = ref(false)

const togglePip = async () => {
    try {
        if (document.pictureInPictureElement) await document.exitPictureInPicture()
        else await props.video?.requestPictureInPicture()
    } catch { /* refused by the browser */ }
}

const toggleFullscreen = async () => {
    try {
        if (document.fullscreenElement) await document.exitFullscreen()
        else await props.box?.requestFullscreen()
    } catch { /* refused by the browser */ }
}

const onFullscreen = () => { full.value = Boolean(document.fullscreenElement) }
const onPip = () => { inPip.value = Boolean(document.pictureInPictureElement) }
onMounted(() => {
    canPip.value = Boolean(document.pictureInPictureEnabled)
    canFullscreen.value = Boolean(document.fullscreenEnabled)
    document.addEventListener('fullscreenchange', onFullscreen)
    // These events bubble up from the video
    document.addEventListener('enterpictureinpicture', onPip)
    document.addEventListener('leavepictureinpicture', onPip)
})
onBeforeUnmount(() => {
    document.removeEventListener('fullscreenchange', onFullscreen)
    document.removeEventListener('enterpictureinpicture', onPip)
    document.removeEventListener('leavepictureinpicture', onPip)
    // The call closes: nothing stays in a small window nor in full screen
    if (document.pictureInPictureElement) document.exitPictureInPicture().catch(() => undefined)
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined)
})
</script>

<style scoped>
.room-tools {
    position: absolute;
    right: 0.75rem;
    bottom: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.4rem;
}

.room-tools__quality {
    display: inline-flex;
    align-items: flex-end;
    gap: 2px;
    height: 2.25rem;
    padding: 0 0.55rem 0.6rem;
    background: rgba(17, 20, 23, 0.85);
}

.room-tools__bar {
    width: 4px;
    height: 0.5rem;
    background: var(--line);
}

.room-tools__bar:nth-child(2) {
    height: 0.8rem;
}

.room-tools__bar:nth-child(3) {
    height: 1.1rem;
}

.room-tools__quality.is-good .is-lit {
    background: var(--accent);
}

.room-tools__quality.is-medium .is-lit {
    background: var(--accent-yellow);
}

.room-tools__quality.is-poor .is-lit {
    background: var(--accent-red);
}

.room-tools__btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.25rem;
    height: 2.25rem;
    padding: 0;
    border: 1px solid var(--line);
    background: rgba(17, 20, 23, 0.85);
    color: var(--fg);
    cursor: pointer;
}

.room-tools__btn:hover,
.room-tools__btn.is-on {
    border-color: var(--accent);
}

.room-tools__btn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
}
</style>
