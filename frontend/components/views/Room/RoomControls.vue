<!-- Buttons of the video room: microphone, camera, screen sharing (computers only), reactions, chat (with the number of
unread messages), background and devices, leave. Used under the preview (before joining: microphone, camera, settings) and
at the bottom of the call. Each one says what it does next (its label changes with its state), a muted microphone or a
camera off is shown light, an open panel in mint, the leave button red. -->
<template>
    <div ref="bar" class="room-controls" role="toolbar" :aria-label="t('roomControls')" @keydown.esc="picking = false">
        <button type="button" class="room-controls__btn" :class="{ 'is-off': !media.audioOn.value }" :disabled="!media.hasMic.value"
            :aria-label="t(media.audioOn.value ? 'roomMute' : 'roomUnmute')" :title="t(media.audioOn.value ? 'roomMute' : 'roomUnmute')" @click="media.toggleAudio()">
            <i :class="media.audioOn.value ? 'fas fa-microphone' : 'fas fa-microphone-slash'" aria-hidden="true"></i>
        </button>
        <button type="button" class="room-controls__btn" :class="{ 'is-off': !media.videoOn.value }" :disabled="!media.hasCamera.value"
            :aria-label="t(media.videoOn.value ? 'roomCameraOff' : 'roomCameraOn')" :title="t(media.videoOn.value ? 'roomCameraOff' : 'roomCameraOn')" @click="media.toggleVideo()">
            <i :class="media.videoOn.value ? 'fas fa-video' : 'fas fa-video-slash'" aria-hidden="true"></i>
        </button>
        <button v-if="share && canShare" type="button" class="room-controls__btn" :class="{ 'is-on': media.sharing.value }"
            :aria-label="t(media.sharing.value ? 'roomStopShare' : 'roomShare')" :title="t(media.sharing.value ? 'roomStopShare' : 'roomShare')"
            :aria-pressed="media.sharing.value" @click="media.toggleShare()">
            <i class="fas fa-desktop" aria-hidden="true"></i>
        </button>
        <template v-if="chat">
            <button type="button" class="room-controls__btn" :class="{ 'is-on': picking }" :aria-label="t('roomReactions')" :title="t('roomReactions')"
                :aria-expanded="picking" aria-controls="room-controls-reactions" @click="picking = !picking">
                <i class="fas fa-face-smile" aria-hidden="true"></i>
            </button>
            <div v-show="picking" id="room-controls-reactions" class="room-controls__reactions" role="group" :aria-label="t('roomReactions')">
                <button v-for="emoji in REACTIONS" :key="emoji" type="button" class="room-controls__emoji text-display-xs" :aria-label="t(reactionKey(emoji))"
                    :title="t(reactionKey(emoji))" @click="react(emoji)">{{ emoji }}</button>
            </div>
            <button type="button" class="room-controls__btn" :class="{ 'is-on': panel === 'chat' }" :aria-pressed="panel === 'chat'"
                :aria-label="chatLabel" :title="chatLabel" @click="emit('panel', 'chat')">
                <i class="fas fa-comment" aria-hidden="true"></i>
                <span v-if="chat.unread.value" class="room-controls__count text-body-s" aria-hidden="true">{{ chat.unread.value > 9 ? '9+' : chat.unread.value }}</span>
            </button>
        </template>
        <button v-if="settings" type="button" class="room-controls__btn" :class="{ 'is-on': panel === 'settings' }" :aria-pressed="panel === 'settings'"
            :aria-label="t('roomSettings')" :title="t('roomSettings')" @click="emit('panel', 'settings')">
            <i class="fas fa-sliders" aria-hidden="true"></i>
        </button>
        <button v-if="leave" type="button" class="room-controls__btn room-controls__btn--leave" :aria-label="t('roomLeave')" :title="t('roomLeave')" @click="emit('leave')">
            <i class="fas fa-phone-slash" aria-hidden="true"></i>
        </button>
    </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useLang } from '@/composables/useLang'
import type { LocalMedia } from '@/composables/useLocalMedia'
import { REACTIONS, type RoomChat } from '@/composables/useRoomChat'
import { reactionKey } from './reactionNames'

const props = defineProps({
    media: { type: Object as PropType<LocalMedia>, required: true },
    // The screen sharing button (during the call), the leave button, the background and devices button
    share: { type: Boolean, default: false },
    leave: { type: Boolean, default: false },
    settings: { type: Boolean, default: false },
    // During the call: reactions and chat
    chat: { type: Object as PropType<RoomChat | null>, default: null },
    // Panel open now: '', 'chat' or 'settings'
    panel: { type: String, default: '' },
})
const emit = defineEmits<{ leave: [], panel: [name: 'chat' | 'settings'] }>()
const t = useLang().getTranslation

const chatLabel = computed(() => props.chat?.unread.value ? t('roomChatUnread', { count: props.chat.unread.value }) : t('roomChat'))

// The row of reactions: one click sends and closes it; Escape or a click elsewhere closes it
const picking = ref(false)
const bar = ref<HTMLElement | null>(null)
const react = (emoji: string) => {
    props.chat?.react(emoji)
    picking.value = false
}
const outside = (event: PointerEvent) => { if (picking.value && !bar.value?.contains(event.target as Node)) picking.value = false }

// Known in the browser only
const canShare = ref(false)
onMounted(() => {
    canShare.value = props.media.canShare()
    document.addEventListener('pointerdown', outside)
})
onBeforeUnmount(() => document.removeEventListener('pointerdown', outside))
</script>

<style scoped>
.room-controls {
    position: relative;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.75rem;
}

/* Round buttons of 48 px: easy to hit with a finger */
.room-controls__btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 3rem;
    height: 3rem;
    padding: 0;
    border: 1px solid var(--line);
    border-radius: 50%;
    background: var(--ink-700);
    color: var(--fg);
    font-size: 1.1rem;
    cursor: pointer;
    transition: background-color var(--motion-fast) var(--ease), color var(--motion-fast) var(--ease), border-color var(--motion-fast) var(--ease);
}

.room-controls__btn:hover:not(:disabled) {
    border-color: var(--accent);
}

.room-controls__btn:focus-visible,
.room-controls__emoji:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
}

.room-controls__btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

.room-controls__btn.is-off {
    background: var(--paper);
    color: var(--ink-900);
}

.room-controls__btn.is-on {
    background: var(--accent);
    color: var(--ink-900);
}

.room-controls__btn--leave {
    border-color: transparent;
    background: var(--accent-red);
    color: var(--zero-color);
}

.room-controls__btn--leave:hover:not(:disabled) {
    border-color: var(--zero-color);
}

/* Unread messages, on the corner of the chat button */
.room-controls__count {
    position: absolute;
    top: -0.3rem;
    right: -0.3rem;
    min-width: 1.25rem;
    padding: 0 0.25rem;
    border-radius: 0.625rem;
    background: var(--accent-red);
    color: var(--zero-color);
    line-height: 1.25rem;
    text-align: center;
}

/* Row of reactions over the bar, centred, never wider than the screen */
.room-controls__reactions {
    position: absolute;
    bottom: calc(100% + 0.75rem);
    left: 50%;
    z-index: 3;
    display: flex;
    justify-content: center;
    gap: 0.15rem;
    max-width: calc(100vw - 1rem);
    padding: 0.3rem;
    border: 1px solid var(--line);
    background: var(--ink-800);
    transform: translateX(-50%);
}

.room-controls__emoji {
    display: inline-flex;
    flex: 0 1 auto;
    align-items: center;
    justify-content: center;
    width: 2.6rem;
    height: 2.6rem;
    padding: 0;
    border: 1px solid transparent;
    background: none;
    line-height: 1;
    cursor: pointer;
}

.room-controls__emoji:hover {
    border-color: var(--accent);
}

/* Small phones: seven buttons on one line */
@media (max-width: 420px) {
    .room-controls {
        gap: 0.3rem;
    }

    .room-controls__btn {
        width: 2.25rem;
        height: 2.25rem;
    }

    .room-controls__emoji {
        width: 2.25rem;
        height: 2.25rem;
    }
}
</style>
