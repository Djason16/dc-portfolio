<!-- The call, over the whole screen: the other person large, ourselves small in a corner, the state of the call in words
(read by screen readers), reactions floating over the picture, the quality of the connection, picture-in-picture and full
screen in a corner, the buttons at the bottom; the chat or the background and devices in a side panel (over the picture on
small screens). The page behind is inert while it is open (keyboard and screen readers stay in the call). Styles: RoomCall.css -->
<template>
    <div ref="box" class="room-call" role="dialog" aria-modal="true" aria-labelledby="room-call-title" tabindex="-1">
        <h2 id="room-call-title" class="room-call__title">{{ title }}</h2>
        <div class="room-call__main">
            <div class="room-call__stage">
                <video v-show="remoteVisible" ref="remote" class="room-call__remote" autoplay playsinline :aria-label="t('roomRemoteVideo', { name })"></video>
                <div v-if="!remoteVisible" class="room-call__placeholder" aria-hidden="true">
                    <span class="room-call__initial text-display-m">{{ initial }}</span>
                </div>

                <p class="room-call__status text-body" :class="{ 'is-quiet text-body-s': status === 'connected' }" role="status" aria-live="polite">{{ statusText }}</p>
                <p v-if="status === 'connected' && !remoteState.audio" class="room-call__badge text-body-s">
                    <i class="fas fa-microphone-slash" aria-hidden="true"></i> {{ t('roomRemoteMuted', { name }) }}
                </p>

                <video v-show="selfVisible" ref="self" class="room-call__self" :class="{ 'is-mirrored': !media.sharing.value }" autoplay playsinline muted
                    :aria-label="t('roomSelfVideo')"></video>
                <RoomReactions :chat="chat" :name="name" />
                <RoomStageTools v-if="status === 'connected'" :quality="quality" :video="remote" :box="box" :has-video="remoteVisible" />
            </div>
            <RoomPanel v-if="panel" :id="panel" class="room-call__panel" :title="t(panel === 'chat' ? 'roomChat' : 'roomSettings')" @close="panel = ''">
                <RoomChat v-if="panel === 'chat'" :chat="chat" :name="name" :linked="linked" />
                <RoomSettings v-else :media="media" />
            </RoomPanel>
        </div>
        <p v-if="media.issue.value === 'roomShareFailed'" class="room-call__issue text-body-s" role="alert">{{ t('roomShareFailed') }}</p>
        <RoomControls class="room-call__controls" :media="media" :chat="chat" :panel="panel" share settings leave @panel="toggle" @leave="emit('leave')" />
    </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import RoomChat from './RoomChat.vue'
import RoomControls from './RoomControls.vue'
import RoomPanel from './RoomPanel.vue'
import RoomReactions from './RoomReactions.vue'
import RoomSettings from './RoomSettings.vue'
import RoomStageTools from './RoomStageTools.vue'
import { useCallQuality } from '@/composables/useCallQuality'
import { useLang } from '@/composables/useLang'
import type { LocalMedia } from '@/composables/useLocalMedia'
import type { CallStatus } from '@/composables/useRoomCall'
import type { RoomChat as Chat } from '@/composables/useRoomChat'

const props = defineProps({
    media: { type: Object as PropType<LocalMedia>, required: true },
    status: { type: String as PropType<CallStatus>, required: true },
    offline: { type: Boolean, default: false },
    remoteStream: { type: Object as PropType<MediaStream | null>, default: null },
    remoteState: { type: Object as PropType<{ audio: boolean, video: boolean }>, required: true },
    // Chat and reactions; the data channel is open; the connection (its statistics)
    chat: { type: Object as PropType<Chat>, required: true },
    linked: { type: Boolean, default: false },
    connection: { type: Function as PropType<() => RTCPeerConnection | null>, required: true },
    // Name of the other person, title of the appointment
    name: { type: String, required: true },
    title: { type: String, required: true },
})
const emit = defineEmits<{ leave: [] }>()
const t = useLang().getTranslation

const box = ref<HTMLElement | null>(null)
const remote = ref<HTMLVideoElement | null>(null)
const self = ref<HTMLVideoElement | null>(null)

const initial = computed(() => (props.name.trim()[0] ?? '?').toUpperCase())
const remoteVisible = computed(() => props.status === 'connected' && props.remoteState.video)
const selfVisible = computed(() => Boolean(props.media.stream.value?.getVideoTracks().length))
const quality = useCallQuality(props.connection, computed(() => props.status === 'connected'))

// One side panel at a time; the chat counts unread messages while closed
const panel = ref<'' | 'chat' | 'settings'>('')
const toggle = (name: 'chat' | 'settings') => { panel.value = panel.value === name ? '' : name }
watch(panel, (name) => { props.chat.open.value = name === 'chat' }, { immediate: true })

const STATUS_KEYS: Partial<Record<CallStatus, string>> = {
    joining: 'roomJoining', waiting: 'roomStatusWaiting', connecting: 'roomStatusConnecting', connected: 'roomStatusConnected',
    reconnecting: 'roomStatusReconnecting', left: 'roomStatusLeft', failed: 'roomStatusFailed',
}
const statusText = computed(() => {
    if (props.offline && props.status !== 'connected') return t('roomStatusOffline')
    if (props.status === 'connected' && !props.remoteState.video) return t('roomRemoteCameraOff', { name: props.name })
    const key = STATUS_KEYS[props.status]
    return key ? t(key, { name: props.name }) : ''
})

// The sound of the other person on the chosen speaker (where the browser allows it)
const applySpeaker = () => {
    const id = props.media.devices.chosen.value.speaker
    const video = remote.value as (HTMLVideoElement & { setSinkId?: (id: string) => Promise<void> }) | null
    if (id && video?.setSinkId) video.setSinkId(id).catch(() => undefined)
}
watch(() => props.media.devices.chosen.value.speaker, applySpeaker)

// The videos follow their streams; our own one stays muted (never our sound in our ears)
watch(() => props.remoteStream, (stream) => { if (remote.value) remote.value.srcObject = stream })
watch(() => props.media.stream.value, (stream) => { if (self.value) { self.value.muted = true; self.value.srcObject = stream } })

// While the call is open: the page behind is inert and does not scroll; the focus goes to the call
let page: HTMLElement | null = null
onMounted(() => {
    if (remote.value) remote.value.srcObject = props.remoteStream
    if (self.value) { self.value.muted = true; self.value.srcObject = props.media.stream.value }
    applySpeaker()
    page = document.getElementById('__nuxt')
    page?.setAttribute('inert', '')
    document.documentElement.classList.add('room-call-open')
    box.value?.focus({ preventScroll: true })
})
onBeforeUnmount(() => {
    page?.removeAttribute('inert')
    document.documentElement.classList.remove('room-call-open')
    props.chat.open.value = false
})
</script>

<style>
/* The page behind the call does not scroll */
html.room-call-open {
    overflow: hidden;
}
</style>

<style scoped src="./RoomCall.css"></style>
