<!-- Waiting screen of the video room: the preview of the camera (the browser asks for permission on "Turn on camera and
microphone" or on "Join"), the microphone and camera buttons, the background and devices (opened under the preview, the
preview shows the effect), what went wrong with the devices, then the join button -->
<template>
    <div class="room-lobby">
        <div class="room-lobby__preview">
            <video v-show="hasVideo" ref="preview" class="room-lobby__video" :class="{ 'is-mirrored': !media.sharing.value }" autoplay playsinline muted
                :aria-label="t('roomSelfVideo')"></video>
            <p v-if="!hasVideo" class="room-lobby__placeholder text-body-s">
                <i class="fas fa-video-slash" aria-hidden="true"></i>
                <span>{{ t(media.effects.busy.value ? 'roomEffectLoading' : media.started.value ? 'roomPreviewNoVideo' : 'roomPreviewOff') }}</span>
            </p>
        </div>

        <RoomControls v-if="media.started.value" :media="media" settings :panel="panel" @panel="panel = panel ? '' : 'settings'" />
        <RoomSettings v-if="panel" class="room-lobby__settings" :media="media" />
        <p v-if="media.issue.value" class="room-lobby__issue text-body-s" role="alert">{{ t(media.issue.value) }}</p>

        <div class="room-lobby__actions">
            <HeroButton v-if="!media.started.value || media.issue.value === 'roomPermissionDenied'" iconClass="fas fa-video"
                :label="t(media.asking.value ? 'roomAsking' : 'roomEnableMedia')" :disabled="media.asking.value" @click="media.start()" />
            <HeroButton v-if="!noJoin" primary :iconClass="joinIcon" :label="t(joining ? joiningKey : again ? 'roomRejoin' : joinKey)"
                :disabled="waiting || joining || media.asking.value || media.issue.value === 'roomUnsupported'" @click="emit('join')" />
        </div>
    </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { computed, onMounted, ref, watch } from 'vue'
import HeroButton from '@/components/ui/Button/HeroButton.vue'
import RoomControls from './RoomControls.vue'
import RoomSettings from './RoomSettings.vue'
import { useLang } from '@/composables/useLang'
import type { LocalMedia } from '@/composables/useLocalMedia'

const props = defineProps({
    media: { type: Object as PropType<LocalMedia>, required: true },
    joining: { type: Boolean, default: false },
    // After a call: "Join again"
    again: { type: Boolean, default: false },
    // The room is still loading: same screen, join not possible yet
    waiting: { type: Boolean, default: false },
    // Text and icon of the main button (the personal room /room/: "Knock"), or no button (its host enters by letting someone in)
    joinKey: { type: String, default: 'roomJoin' },
    joiningKey: { type: String, default: 'roomJoining' },
    joinIcon: { type: String, default: 'fas fa-right-to-bracket' },
    noJoin: { type: Boolean, default: false },
})
const emit = defineEmits<{ join: [] }>()
const t = useLang().getTranslation

const preview = ref<HTMLVideoElement | null>(null)
const panel = ref<'' | 'settings'>('')
const hasVideo = computed(() => Boolean(props.media.stream.value?.getVideoTracks().length))

// The preview follows the tracks (camera turned off or on, screen shared); muted: never our own sound in our ears
const show = () => {
    if (!preview.value) return
    preview.value.muted = true
    preview.value.srcObject = props.media.stream.value
}
watch(() => props.media.stream.value, show)
onMounted(show)
</script>

<style scoped>
.room-lobby {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1.25rem;
    max-width: 40rem;
}

.room-lobby__preview {
    box-sizing: border-box;
    position: relative;
    width: 100%;
    max-height: 60vh;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    border: 1px solid var(--line);
    background: var(--ink-900);
}

.room-lobby__video {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

/* Like a mirror: the person sees himself as he is used to (the other side sees him the right way) */
.room-lobby__video.is-mirrored {
    transform: scaleX(-1);
}

.room-lobby__placeholder {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    margin: 0;
    padding: 1rem;
    color: var(--fg-muted);
    text-align: center;
}

.room-lobby__placeholder i {
    font-size: 1.5rem;
}

.room-lobby__settings {
    box-sizing: border-box;
    width: 100%;
    border: 1px solid var(--line);
    background: var(--panel);
}

.room-lobby__issue {
    margin: 0;
    padding: 0.75rem 1rem;
    border-left: 2px solid var(--accent-yellow);
    background: var(--panel);
}

.room-lobby__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
}
</style>
