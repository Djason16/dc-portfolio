<!-- Personal room of the owner (/room/ without a token), like Whereby: always the same address. The logged-in admin is the host
(LoungeHost: the knocks, let in or refuse, open or closed); anyone else is a visitor (LoungeVisitor: his name, the preview, "Knock",
the wait). Once let in, the same call as the booking rooms (RoomCall, composables/useRoomCall.ts), one visitor at a time.
Server: server/controllers/LoungeController.ts. Texts: plugins/translations/pages/lounge.ts and pages/admin/lounge.ts -->
<template>
    <OtherSectionLayout pageTitleKey="loungeTitle" pageSubtitleKey="loungeIntro" :sections="sections" :dynamicData="{ email: site.email }">
        <template #custom-content>
            <div class="lounge" aria-live="polite">
                <div class="lounge__head">
                    <p class="eyebrow">{{ t(mode === 'host' ? 'loungeHostLabel' : 'loungeLabel') }}</p>
                    <p class="lounge__what text-display-s">{{ mode ? t('loungeWhat', { name: site.name || ownerName }) : t('roomLoading') }}</p>
                    <p class="lounge__state text-body-l" :class="{ 'is-off': !isOpen }">{{ stateText || ' ' }}</p>
                </div>

                <RoomLobby v-if="!mode" :media="media" waiting />
                <LoungeHost v-else-if="mode === 'host'" :host="host" :media="media" :notice="notice" :busy="inCall" @accept="letIn" @rejoin="rejoin" />
                <LoungeVisitor v-else :knock="knock" :media="media" :notice="notice" :busy="inCall" :host-name="ownerName" @knocked="notice = ''" />

                <!-- The call over the whole page (inside the page: one root, Nuxt moves between pages cleanly) -->
                <Teleport to="body">
                    <RoomCall v-if="inCall && call && peer" :media="media" :status="call.status.value" :offline="call.offline.value" :remote-stream="call.remoteStream.value"
                        :remote-state="call.remoteState.value" :chat="chat" :linked="call.linked.value" :connection="call.connection"
                        :name="peer.name" :title="t('loungeWhat', { name: site.name || ownerName })" @leave="hangUp" />
                </Teleport>
            </div>
        </template>
    </OtherSectionLayout>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import OtherSectionLayout from '@/components/ui/SectionLayout/OtherSectionLayout.vue'
import LoungeHost from './LoungeHost.vue'
import LoungeVisitor from './LoungeVisitor.vue'
import RoomCall from './RoomCall.vue'
import RoomLobby from './RoomLobby.vue'
import { useLang } from '@/composables/useLang'
import { useLocalMedia } from '@/composables/useLocalMedia'
import { useLoungeHost } from '@/composables/useLoungeHost'
import { useLoungeKnock } from '@/composables/useLoungeKnock'
import { useRoomCall } from '@/composables/useRoomCall'
import { useRoomChat } from '@/composables/useRoomChat'
import { useSite } from '@/composables/useSite'

const lang = useLang()
const t = lang.getTranslation
const site = useSite()
const media = useLocalMedia()
const chat = useRoomChat()
const host = useLoungeHost()
const knock = useLoungeKnock()

// '' while loading, then host (admin session) or visitor
const mode = ref<'' | 'host' | 'visitor'>('')
const call = shallowRef<ReturnType<typeof useRoomCall> | null>(null)
const peer = ref<{ token: string, role: 'host' | 'guest', name: string } | null>(null)
const inCall = ref(false)
// Shown after a call: ended, left, could not connect (a key of the texts)
const notice = ref('')

const ownerName = computed(() => knock.lounge.value?.hostName || String(site.name || '').split(' ')[0] || '')
const isOpen = computed(() => (mode.value === 'host' ? host.open.value : knock.lounge.value?.open ?? true))
const stateText = computed(() => {
    if (!mode.value) return ''
    if (!isOpen.value) return t('loungeClosedState')
    if (mode.value === 'host') return t(inCall.value ? 'loungeHostInCall' : 'loungeHostOpen')
    const lounge = knock.lounge.value
    return lounge?.busy ? t('loungeBusyState', { name: ownerName.value }) : lounge?.hostHere ? t('loungeHereState', { name: ownerName.value })
        : t('loungeAwayState', { name: ownerName.value })
})

onMounted(async () => {
    mode.value = (await host.load()) ? 'host' : 'visitor'
    if (mode.value === 'visitor') await knock.load()
})

// Waiting visitors counted in the title of the tab of the host: "(2) Video room | ..." (after the title of the language is set)
const showBadge = () => setTimeout(() => {
    const title = document.title.replace(/^\(\d+\)\s*/, ''), count = mode.value === 'host' ? host.badge.value : 0
    document.title = count ? `(${count}) ${title}` : title
}, 50)
watch([() => host.badge.value, mode, () => lang.current.value], showBadge)

// The call with one person (a new one for each visitor: nothing of the call before)
const start = async (token: string, role: 'host' | 'guest', iceServers: RTCIceServer[], name: string) => {
    notice.value = ''
    if (!media.started.value) await media.start()
    call.value?.dispose()
    chat.clear()
    call.value = useRoomCall({ token, role, iceServers, media, onData: chat.receive, base: `/lounge/calls/${token}/${role}` })
    chat.bind(call.value.send)
    peer.value = { token, role, name }
    const res = await call.value.join()
    inCall.value = res.success
    if (!res.success) await stop('roomStatusFailed', false)
}

// Host: "Let in" on a knock
const letIn = async (token: string) => {
    const res = await host.accept(token)
    if ('error' in res) return (notice.value = res.error || 'loungeKnockGone')
    await start(res.knock.token, 'host', res.iceServers, res.knock.name)
}

// Host: back into a call left running (a reload of the page)
const rejoin = () => {
    const current = host.current.value
    if (current) start(current.token, 'host', host.iceServers.value, current.name)
}

// Visitor: let in by the host (also after a reload of the page while let in)
watch(() => knock.phase.value, (phase) => {
    if (phase === 'accepted' && !inCall.value && knock.token.value)
        start(knock.token.value, 'guest', knock.iceServers.value, ownerName.value)
})

// The end of a call: tellServer when this side hangs up (the other side is then told by the server)
const stop = async (key: string, tellServer: boolean) => {
    const ended = peer.value, current = call.value
    inCall.value = false
    peer.value = null
    call.value = null
    notice.value = key
    await current?.leave()
    current?.dispose()
    media.stop()
    if (!ended) return
    if (ended.role === 'host' && tellServer) await host.end(ended.token)
    if (ended.role === 'guest') await knock.finish(tellServer)
}
const hangUp = () => stop('loungeYouLeft', true)

// The other side hung up (the server closes the call), or this call was opened in another tab
watch(() => call.value?.status.value, (status) => {
    if (status === 'closed') stop('loungeCallEnded', false)
    if (status === 'replaced') stop('roomReplaced', false)
})

// Closing the tab: the other side is told at once (the call stays open a minute on the server, a reload enters again)
const onPageHide = () => { if (inCall.value) call.value?.leave(true) }
onMounted(() => window.addEventListener('pagehide', onPageHide))
onBeforeUnmount(() => {
    window.removeEventListener('pagehide', onPageHide)
    if (inCall.value) call.value?.leave(true)
    call.value?.dispose()
    media.stop()
})

const sections = Array.from({ length: 3 }, (_, i) => ({ titleKey: `loungeSection${i + 1}Title`, contentKey: `loungeSection${i + 1}Content` }))
</script>

<style src="./Lounge.css"></style>
