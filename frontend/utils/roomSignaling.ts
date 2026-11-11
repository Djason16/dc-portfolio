import { useRuntimeConfig } from '#imports'
import { api } from '@/utils/api'

/*
 * Signaling of the video room (server/controllers/RoomsController.ts): the few messages the two browsers exchange through the
 * site to find each other (offer, answer, network candidates, join, leave). Read by short polling: every second while the
 * call is being set up, every few seconds once it runs (the call itself then goes straight between the browsers).
 *
 *   const signaling = createSignaling(token, { onSignals, onOther, onReplaced, onClosed, onNetwork })
 *   (base: the routes of another room, e.g. /lounge/calls/<knock>/guest of the personal room /room/; default /rooms/<token>)
 *   await signaling.join()                              { success, other } (other: the browser on the other side, or null)
 *   signaling.send('offer', payload, otherPeer)        a message for the other side
 *   signaling.setFast(false)                           slower once connected
 *   signaling.leave(true)                              leaves (true: still sent while the page closes)
 */
export type Signal = { id: number, peer: string, kind: string, payload: any }
export type ClosedInfo = { state: string, opensAt?: string, closesAt?: string }
export type SignalingEvents = {
    onSignals: (signals: Signal[]) => void
    // The browser of the other side when it is there (it made a request lately), else null
    onOther: (peer: string | null) => void
    // Another tab or device of the same side took the place of this one
    onReplaced: () => void
    // The room closed meanwhile (time over, booking cancelled) or does not exist
    onClosed: (info: ClosedInfo) => void
    // false while the site does not answer (network down, server restarting)
    onNetwork: (ok: boolean) => void
}

const FAST_MS = 1000
const SLOW_MS = 4000
const RETRY_MS = 3000

// Id of this browser in the room (a new one each time the page opens): 16 random letters and figures
export const newPeerId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => '0123456789abcdefghijklmnopqrstuvwxyz'[byte % 36]).join('')

export const createSignaling = (token: string, events: SignalingEvents, base = `/rooms/${encodeURIComponent(token)}`) => {
    const peer = newPeerId()
    // Last message read: a browser that enters starts after the messages of earlier calls
    let cursor = -1
    let fast = true
    let running = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const schedule = (ms: number) => {
        clearTimeout(timer)
        if (running) timer = setTimeout(tick, ms)
    }

    // One request at a time: a poll asked while another one runs waits for its end (it schedules the next one)
    let polling = false
    const tick = async (): Promise<void> => {
        if (!running || polling) return
        polling = true
        try { await poll() } finally { polling = false }
    }

    const poll = async (): Promise<void> => {
        const res = await api.get(`${base}/signals?peer=${peer}&after=${Math.max(0, cursor)}`)
        if (!running) return
        if (!res.success) {
            if (res.error === 'roomClosed' || res.status === 404) {
                stop()
                return events.onClosed({ state: res.state ?? 'notFound', opensAt: res.opensAt, closesAt: res.closesAt })
            }
            // Network, restart of the server, too many requests: tried again a little later, the call itself goes on
            events.onNetwork(false)
            return schedule(res.retryAfter ? res.retryAfter * 1000 : RETRY_MS)
        }
        events.onNetwork(true)
        if (res.replaced) {
            stop()
            return events.onReplaced()
        }
        // Gone too long for the server (a tab asleep for a while): enters again, the other side is told
        if (res.rejoin) await join()
        else {
            const signals: Signal[] = res.signals ?? []
            if (signals.length) cursor = signals.at(-1)!.id
            if (signals.length) events.onSignals(signals)
            events.onOther(res.other ?? null)
        }
        schedule(fast ? FAST_MS : SLOW_MS)
    }

    const stop = () => {
        running = false
        clearTimeout(timer)
    }

    /** Enters the room (again: the other side is told and offers a new connection). */
    const join = async () => {
        const res = await api.post(`${base}/join`, { peer })
        if (!res.success) return res
        if (cursor < 0) cursor = Number(res.cursor) || 0
        if (!running) {
            running = true
            schedule(0)
        }
        return res
    }

    const send = (kind: string, payload: unknown = null, target: string | null = null) =>
        api.post(`${base}/signals`, { peer, kind, payload, target })

    /** Leaves the room; keepalive: the request still goes while the page is closing (pagehide). */
    const leave = (keepalive = false) => {
        stop()
        const body = JSON.stringify({ peer, kind: 'leave' })
        if (!keepalive) return send('leave')
        const url = `${useRuntimeConfig().app.baseURL.replace(/\/$/, '')}/api${base}/signals`
        return fetch(url, { method: 'POST', body, keepalive: true, credentials: 'include', headers: { 'Content-Type': 'application/json' } }).catch(() => undefined)
    }

    /** Polls every second (setting up the call) or every few seconds (call running); fast: one poll at once. */
    const setFast = (value: boolean) => {
        const changed = value !== fast
        fast = value
        if (changed && value && running) schedule(0)
    }

    return { peer, join, send, leave, stop, setFast }
}

export type Signaling = ReturnType<typeof createSignaling>
