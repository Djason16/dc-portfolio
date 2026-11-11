import { ref, shallowRef } from 'vue'
import type { LocalMedia } from './useLocalMedia'
import { type ClosedInfo, type Signal, createSignaling } from '@/utils/roomSignaling'

/*
 * The call of the video room: one WebRTC connection between the two browsers, set up through the signaling of the site
 * (utils/roomSignaling.ts). The owner (host) always makes the offer, the visitor (guest) answers: the two never offer at
 * the same moment. Each offer has its own number (gen): late messages of an older connection are ignored.
 * When the connection drops, a new one is set up (the host offers again, the guest asks for it by entering again).
 *
 *   const call = useRoomCall({ token, role, iceServers, media })
 *   await call.join()          status: waiting -> connecting -> connected (reconnecting, left, failed, replaced, closed)
 *   call.remoteStream          picture and sound of the other side; call.remoteState: { audio, video } of the other side
 *   call.send({ type, ... })   a message to the other side over the data channel (chat, reactions: useRoomChat); the other
 *                              messages of the channel go to onData; call.linked: the channel is open
 *   call.connection()          the RTCPeerConnection, for its statistics (useCallQuality)
 *   await call.leave()
 *   call.dispose()             forgets the call (stops listening to the devices and polling)
 */
export type CallStatus = 'idle' | 'joining' | 'waiting' | 'connecting' | 'connected' | 'reconnecting' | 'left' | 'failed' | 'replaced' | 'closed'
// base: routes of the signaling of another room (the personal room /room/: /lounge/calls/<knock>/<side>), default /rooms/<token>
type Options = { token: string, role: 'host' | 'guest', iceServers: RTCIceServer[], media: LocalMedia, onData?: (data: Record<string, unknown>) => void, base?: string }

// Connection set up but not working after this long: a new one is tried (after 3 tries: failed, the person can join again)
const CONNECT_TIMEOUT_MS = 25000
const RECONNECT_AFTER_MS = 6000
const MAX_TRIES = 3

export const useRoomCall = ({ token, role, iceServers, media, onData, base }: Options) => {
    const status = ref<CallStatus>('idle')
    const offline = ref(false)
    const closedInfo = ref<ClosedInfo | null>(null)
    const remoteStream = shallowRef<MediaStream | null>(null)
    const remoteState = ref({ audio: true, video: true })
    const linked = ref(false)

    let pc: RTCPeerConnection | null = null
    let channel: RTCDataChannel | null = null
    let gen = 0
    let remotePeer: string | null = null
    let tries = 0
    let pending: RTCIceCandidateInit[] = []
    let outgoing: RTCIceCandidateInit[] = []
    let flushTimer: ReturnType<typeof setTimeout> | undefined
    let watchdog: ReturnType<typeof setTimeout> | undefined
    let queue: Promise<unknown> = Promise.resolve()

    const signaling = createSignaling(token, {
        // Handled one after the other, in their order: an answer never runs before its offer is set
        onSignals: signals => { queue = queue.then(() => signals.reduce((chain, s) => chain.then(() => handle(s)), Promise.resolve())).catch(e => console.warn('[room]', e)) },
        onOther: peer => {
            if (!peer && (status.value === 'connecting' || status.value === 'joining')) status.value = 'waiting'
            // The host waits and sees a visitor there with no connection yet (a join missed meanwhile): offers
            if (role === 'host' && peer && !pc && status.value === 'waiting') offer(peer)
        },
        onReplaced: () => { close(); status.value = 'replaced' },
        onClosed: info => { close(); closedInfo.value = info; status.value = 'closed' },
        onNetwork: ok => { offline.value = !ok },
    }, base)

    // Our state (micro, camera) told to the other side through the data channel of the call: shown at once
    const sendState = () => {
        if (channel?.readyState === 'open') channel.send(JSON.stringify({ type: 'state', audio: media.audioOn.value, video: Boolean(media.outgoing('video')) }))
    }
    const setupChannel = (dc: RTCDataChannel) => {
        channel = dc
        dc.onopen = () => { if (channel === dc) linked.value = true; sendState() }
        dc.onclose = () => { if (channel === dc) linked.value = false }
        dc.onmessage = (event) => {
            let data: Record<string, unknown>
            try { data = JSON.parse(String(event.data)) } catch { return }
            if (data?.type === 'state') remoteState.value = { audio: Boolean(data.audio), video: Boolean(data.video) }
            else if (data?.type === 'bye') otherLeft()
            else if (data && typeof data === 'object') onData?.(data)
        }
    }

    // Our tracks on the connection: the same slots all along, only their track changes (no new negotiation)
    const attachTracks = () => {
        for (const transceiver of pc?.getTransceivers() ?? []) {
            const kind = transceiver.receiver.track?.kind
            if (kind && transceiver.currentDirection !== 'stopped') transceiver.sender.replaceTrack(media.outgoing(kind)).catch(() => undefined)
        }
        sendState()
    }
    const offMedia = media.onChange(attachTracks)

    const clearTimers = () => { clearTimeout(watchdog); clearTimeout(flushTimer) }

    const close = () => {
        clearTimers()
        channel?.close()
        pc?.close()
        pc = channel = null
        linked.value = false
        remotePeer = null
        pending = []
        outgoing = []
        remoteStream.value = null
    }

    // The candidates found within 150 ms go in one request
    const queueCandidate = (candidate: RTCIceCandidateInit) => {
        outgoing.push(candidate)
        clearTimeout(flushTimer)
        const target = remotePeer, number = gen
        flushTimer = setTimeout(() => {
            const list = outgoing
            outgoing = []
            if (list.length && number === gen) signaling.send('candidates', { gen: number, list }, target)
        }, 150)
    }

    // A connection that does not come up in time is tried again
    const armWatchdog = (ms: number) => {
        clearTimeout(watchdog)
        watchdog = setTimeout(retry, ms)
    }

    const newConnection = (peer: string, number: number) => {
        close()
        remotePeer = peer
        gen = number
        remoteState.value = { audio: true, video: true }
        const connection = new RTCPeerConnection({ iceServers })
        pc = connection
        connection.onicecandidate = (event) => { if (event.candidate && connection === pc) queueCandidate(event.candidate.toJSON()) }
        connection.ontrack = () => { if (connection === pc) remoteStream.value = new MediaStream(connection.getReceivers().map(r => r.track)) }
        connection.ondatachannel = (event) => setupChannel(event.channel)
        connection.onconnectionstatechange = () => { if (connection === pc) onState(connection.connectionState) }
        if (status.value !== 'reconnecting') status.value = 'connecting'
        signaling.setFast(true)
        armWatchdog(CONNECT_TIMEOUT_MS)
        return connection
    }

    const onState = (state: RTCPeerConnectionState) => {
        if (state === 'connected') {
            tries = 0
            clearTimeout(watchdog)
            status.value = 'connected'
            signaling.setFast(false)
            sendState()
        } else if (state === 'disconnected') {
            // Often back by itself within a few seconds (a network change)
            status.value = 'reconnecting'
            signaling.setFast(true)
            armWatchdog(RECONNECT_AFTER_MS)
        } else if (state === 'failed') retry()
    }

    // A new connection: the host offers again, the guest enters again (the host then offers)
    const retry = () => {
        if (!remotePeer && role === 'host') return
        if (++tries > MAX_TRIES) {
            close()
            status.value = 'failed'
            return
        }
        status.value = status.value === 'connected' || status.value === 'reconnecting' ? 'reconnecting' : 'connecting'
        if (role === 'host') offer(remotePeer!)
        else { armWatchdog(CONNECT_TIMEOUT_MS); signaling.join() }
    }

    // Host: a new connection with its offer
    const offer = async (peer: string) => {
        const connection = newConnection(peer, Date.now())
        connection.addTransceiver('audio', { direction: 'sendrecv' })
        connection.addTransceiver('video', { direction: 'sendrecv' })
        remoteStream.value = new MediaStream(connection.getReceivers().map(r => r.track))
        setupChannel(connection.createDataChannel('control'))
        attachTracks()
        await connection.setLocalDescription(await connection.createOffer())
        if (connection === pc) await signaling.send('offer', { gen, sdp: connection.localDescription }, peer)
    }

    // Guest: answers the offer of the host
    const answer = async (signal: Signal) => {
        const connection = newConnection(signal.peer, Number(signal.payload?.gen))
        await connection.setRemoteDescription(signal.payload.sdp)
        for (const transceiver of connection.getTransceivers()) transceiver.direction = 'sendrecv'
        remoteStream.value = new MediaStream(connection.getReceivers().map(r => r.track))
        attachTracks()
        await connection.setLocalDescription(await connection.createAnswer())
        if (connection === pc) await signaling.send('answer', { gen, sdp: connection.localDescription }, signal.peer)
        await addPending()
    }

    const addPending = async () => {
        const list = pending
        pending = []
        for (const candidate of list) await pc?.addIceCandidate(candidate).catch(() => undefined)
    }

    const otherLeft = () => {
        close()
        tries = 0
        status.value = 'left'
        signaling.setFast(true)
    }

    // One message of the other side
    const handle = async (signal: Signal) => {
        const mine = signal.peer === remotePeer && Number(signal.payload?.gen) === gen
        // The visitor enters (again): a fresh connection, with its own tries
        if (signal.kind === 'join' && role === 'host') { tries = 0; return offer(signal.peer) }
        if (signal.kind === 'offer' && role === 'guest') return answer(signal)
        if (signal.kind === 'answer' && role === 'host' && mine && pc?.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(signal.payload.sdp)
            return addPending()
        }
        if (signal.kind === 'candidates' && mine) {
            pending.push(...(signal.payload?.list ?? []))
            if (pc?.remoteDescription) await addPending()
        }
        if (signal.kind === 'leave' && signal.peer === remotePeer) otherLeft()
    }

    /** Enters the room: the other side, when there, is reached at once. */
    const join = async () => {
        status.value = 'joining'
        closedInfo.value = null
        tries = 0
        signaling.setFast(true)
        const res = await signaling.join()
        if (!res.success) {
            if (res.error === 'roomClosed') { closedInfo.value = { state: res.state, opensAt: res.opensAt, closesAt: res.closesAt }; status.value = 'closed' }
            else status.value = 'failed'
            return res
        }
        status.value = res.other ? 'connecting' : 'waiting'
        if (role === 'host' && res.other) offer(res.other)
        return res
    }

    /** Leaves the call (the other side is told at once); keepalive while the page closes. */
    const leave = async (keepalive = false) => {
        if (channel?.readyState === 'open') channel.send(JSON.stringify({ type: 'bye' }))
        close()
        status.value = 'idle'
        await signaling.leave(keepalive)
    }

    /** A message to the other side; false when the data channel is not open. */
    const send = (data: Record<string, unknown>) => {
        if (channel?.readyState !== 'open') return false
        channel.send(JSON.stringify(data))
        return true
    }

    /** Forgets this call for good (the personal room makes a new one per visitor). */
    const dispose = () => {
        offMedia()
        close()
        signaling.stop()
    }

    return { status, offline, closedInfo, remoteStream, remoteState, linked, join, leave, send, dispose, connection: () => pc }
}
