<!-- Video room of a video booking (/room/<token>/, links of the booking emails and of admin > Bookings): the appointment,
whether the room is open (15 minutes before the start to 30 minutes after the end), the waiting screen, then the call over the
whole screen. WebRTC between the two browsers: composables/useRoomCall.ts; signaling: server/controllers/RoomsController.ts; chat and
reactions: composables/useRoomChat.ts; background effects and devices: composables/useLocalMedia.ts.
Texts: plugins/translations/pages/room.ts -->
<template>
    <OtherSectionLayout pageTitleKey="roomTitle" pageSubtitleKey="roomIntro" :sections="sections" :dynamicData="{ email: site.email }">
        <template #custom-content>
            <div class="room" aria-live="polite">
                <!-- While the room loads: the same blocks as the waiting screen (nothing moves when it comes) -->
                <template v-if="loading">
                    <div class="room__head">
                        <p class="eyebrow">{{ t('roomLabel') }}</p>
                        <p class="room__what text-display-s">{{ t('roomLoading') }}</p>
                        <p class="room__when text-body-l" aria-hidden="true">&nbsp;</p>
                        <p class="room__with text-body" aria-hidden="true">&nbsp;</p>
                    </div>
                    <RoomLobby :media="media" waiting />
                </template>
                <p v-else-if="!room" class="room__note text-body">{{ t('roomNotFound') }}</p>
                <template v-else>
                    <div class="room__head">
                        <p class="eyebrow">{{ t('roomLabel') }}</p>
                        <p class="room__what text-display-s">{{ room.typeName }}</p>
                        <p class="room__when text-body-l">{{ when }}</p>
                        <p v-if="room.otherName" class="room__with text-body">{{ t('roomWith', { name: room.otherName }) }}</p>
                    </div>

                    <p v-if="closedText" class="room__note text-body">{{ closedText }}</p>
                    <template v-else>
                        <p v-if="notice" class="room__notice text-body" role="status">{{ notice }}</p>
                        <HeroButton v-if="call?.status.value === 'replaced'" primary iconClass="fas fa-right-to-bracket" :label="t('roomTakeBack')" @click="join" />
                        <RoomLobby v-else :media="media" :joining="joining" :again="Boolean(call)" @join="join" />
                    </template>
                    <a v-if="closedText" :href="withTrailingSlash('/book')" :title="t('bookAnother')" class="room__link text-label">{{ t('bookAnother') }} →</a>
                </template>
            </div>
        </template>
    </OtherSectionLayout>

    <Teleport to="body">
        <RoomCall v-if="inCall && call && room" :media="media" :status="call.status.value" :offline="call.offline.value" :remote-stream="call.remoteStream.value"
            :remote-state="call.remoteState.value" :chat="chat" :linked="call.linked.value" :connection="call.connection"
            :name="room.otherName" :title="`${room.typeName} · ${when}`" @leave="leave" />
    </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import HeroButton from '@/components/ui/Button/HeroButton.vue'
import OtherSectionLayout from '@/components/ui/SectionLayout/OtherSectionLayout.vue'
import RoomCall from './RoomCall.vue'
import RoomLobby from './RoomLobby.vue'
import { useLang } from '@/composables/useLang'
import { useLocalMedia } from '@/composables/useLocalMedia'
import { useRoomCall } from '@/composables/useRoomCall'
import { useRoomChat } from '@/composables/useRoomChat'
import { useSite } from '@/composables/useSite'
import { api } from '@/utils/api'
import { dayKeyOf, longDay, timeOf, visitorZone } from '@/utils/booking'
import { withTrailingSlash } from '@/utils/pathHelpers'

const props = defineProps({ token: { type: String, required: true } })

const lang = useLang()
const t = lang.getTranslation
const site = useSite()
const media = useLocalMedia()
// Chat and reactions over the data channel of the call: kept while the page is open (rejoining keeps the messages)
const chat = useRoomChat()

type RoomInfo = { role: 'host' | 'guest', typeName: string, otherName: string, state: string, now: string, start: string, end: string,
    opensAt: string, closesAt: string, iceServers: RTCIceServer[] }
const room = ref<RoomInfo | null>(null)
const loading = ref(true)
const joining = ref(false)
const inCall = ref(false)
// Set when the room is open and the person joins (the ICE servers come with the room)
const call = shallowRef<ReturnType<typeof useRoomCall> | null>(null)
// State told by the call itself (the room closed meanwhile, the time is over)
const liveState = ref('')
const zone = ref('UTC')
let openTimer: ReturnType<typeof setTimeout> | undefined

// Read in the browser only: the hours need the zone of the person, the room never goes in a cache
const load = async () => {
    const res = await api.get(`/rooms/${encodeURIComponent(props.token)}`)
    room.value = res.success ? res.room : null
    loading.value = false
    liveState.value = ''
    // Not open yet: the page opens by itself at the time (the clock of the server counts, not the one of this device)
    clearTimeout(openTimer)
    if (room.value?.state === 'early') {
        const wait = Date.parse(room.value.opensAt) - Date.parse(room.value.now)
        if (wait < 24 * 3600 * 1000) openTimer = setTimeout(load, Math.max(1000, wait + 1000))
    }
}
onMounted(() => {
    zone.value = visitorZone()
    load()
})

const at = (iso: string) => ({ day: longDay(dayKeyOf(iso, zone.value), lang.current.value), time: timeOf(iso, lang.current.value, zone.value) })
const when = computed(() => {
    if (!room.value) return ''
    const { start, end } = room.value, locale = lang.current.value
    return `${longDay(dayKeyOf(start, zone.value), locale, true)} · ${timeOf(start, locale, zone.value)} - ${timeOf(end, locale, zone.value)} (${zone.value})`
})

// Why the room cannot be used now, or nothing when it is open
const closedText = computed(() => {
    const state = liveState.value || room.value?.state
    if (!room.value || !state || state === 'open') return ''
    if (state === 'cancelled') return t('roomCancelled')
    if (state === 'early') return t('roomEarly', at(room.value.opensAt))
    if (state === 'ended' && liveState.value) return t('roomClosedLive')
    if (state === 'ended') return t('roomEnded', at(room.value.closesAt))
    return t('roomNotFound')
})

// Shown above the waiting screen after a call: left, opened elsewhere, could not connect
const notice = computed(() => {
    const status = call.value?.status.value
    if (inCall.value || !status) return ''
    return status === 'replaced' ? t('roomReplaced') : status === 'failed' ? t('roomStatusFailed') : status === 'idle' ? t('roomLeft') : ''
})

const join = async () => {
    if (!room.value || joining.value) return
    joining.value = true
    // The browser asks for the camera and the microphone now if it was not done on the preview; the call goes on without them
    if (!media.started.value) await media.start()
    if (!call.value) {
        call.value = useRoomCall({ token: props.token, role: room.value.role, iceServers: room.value.iceServers, media, onData: chat.receive })
        chat.bind(call.value.send)
    }
    const res = await call.value.join()
    joining.value = false
    inCall.value = res.success
}

const leave = async () => {
    inCall.value = false
    await call.value?.leave()
}

// The call ends by itself: the room closed (time over, booking cancelled), or another tab took it; the camera goes off
watch(() => call.value?.status.value, (status) => {
    if (status === 'closed') liveState.value = call.value?.closedInfo.value?.state || 'ended'
    if (status === 'closed' || status === 'replaced') {
        inCall.value = false
        media.stop()
    }
})

// Closing the tab or leaving the page: the other side is told at once (a request that still goes while the page closes)
const onPageHide = () => { if (inCall.value) call.value?.leave(true) }
onMounted(() => window.addEventListener('pagehide', onPageHide))
onBeforeUnmount(() => {
    window.removeEventListener('pagehide', onPageHide)
    clearTimeout(openTimer)
    if (inCall.value) call.value?.leave(true)
    media.stop()
})

const sections = Array.from({ length: 3 }, (_, i) => ({ titleKey: `roomSection${i + 1}Title`, contentKey: `roomSection${i + 1}Content` }))
</script>

<style scoped>
.room {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1.75rem;
    max-width: 40rem;
}

.room__head {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
    padding: 1.5rem 1.75rem;
    border-left: 2px solid var(--accent);
    background: var(--panel);
}

.room__head p,
.room__note,
.room__notice {
    margin: 0;
}

.room__when {
    color: var(--accent);
}

.room__note,
.room__with {
    color: var(--fg-muted);
}

.room__notice {
    padding: 0.75rem 1rem;
    border-left: 2px solid var(--accent-yellow);
    background: var(--panel);
}

.room__link {
    color: var(--fg-muted);
}

@media (max-width: 600px) {
    .room__head {
        padding: 1.25rem;
    }
}
</style>
