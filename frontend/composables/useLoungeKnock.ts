import { onBeforeUnmount, ref } from 'vue'
import { api } from '@/utils/api'

/*
 * Visitor's side of the personal room /room/ (server/controllers/LoungeController.ts): the state of the room, the knock
 * with his name, then the wait until the host lets him in or not. The secret of the knock stays in the tab (sessionStorage):
 * a reload of the page keeps waiting, or enters the call again.
 *
 *   const knock = useLoungeKnock()
 *   await knock.load()            lounge: { open, hostHere, busy, hostName }; phase: idle, or the phase of a knock of this tab
 *   await knock.knock('Jean')     phase: waiting -> accepted (knock.token, knock.iceServers) | refused | expired | closed
 *   await knock.cancel()          stops waiting
 *   knock.finish()                the call is over (phase ended)
 */
export type KnockPhase = 'idle' | 'sending' | 'waiting' | 'accepted' | 'refused' | 'cancelled' | 'expired' | 'closed' | 'ended'
export type LoungeState = { open: boolean, hostHere: boolean, busy: boolean, hostName: string }

const STORAGE_KEY = 'loungeKnock'
const WAIT_MS = 2000
const IDLE_MS = 15000
// Statuses of the server that end a knock: the visitor can knock again
const FINAL: KnockPhase[] = ['refused', 'cancelled', 'expired', 'closed', 'ended']

const stored = () => {
    try { return sessionStorage.getItem(STORAGE_KEY) || '' } catch { return '' }
}
const store = (token: string) => {
    try { if (token) sessionStorage.setItem(STORAGE_KEY, token); else sessionStorage.removeItem(STORAGE_KEY) } catch { /* private mode: kept in memory only */ }
}

export const useLoungeKnock = () => {
    const lounge = ref<LoungeState | null>(null)
    const phase = ref<KnockPhase>('idle')
    const error = ref('')
    const token = ref('')
    const iceServers = ref<RTCIceServer[]>([])
    let timer: ReturnType<typeof setTimeout> | undefined
    let stopped = false

    const schedule = (ms: number) => {
        clearTimeout(timer)
        if (!stopped) timer = setTimeout(tick, ms)
    }

    // The status of the room (no knock yet): who is there, open or closed
    const readLounge = async () => {
        const res = await api.get('/lounge')
        if (res.success) lounge.value = res.lounge
        return res.success
    }

    // The status of the knock of this tab
    const readKnock = async () => {
        const res = await api.get(`/lounge/knocks/${token.value}`)
        if (!res.success) {
            // Unknown knock (removed after a day): this tab knocks again
            if (res.status === 404) forget('expired')
            return
        }
        const { status, open, hostHere, busy, hostName } = res.knock
        lounge.value = { open, hostHere, busy, hostName }
        if (status === 'accepted') iceServers.value = res.knock.iceServers ?? []
        if (status === 'waiting' || status === 'accepted') phase.value = status
        else forget(status)
    }

    const tick = async () => {
        if (token.value && (phase.value === 'waiting' || phase.value === 'accepted')) {
            await readKnock()
            // Let in: the call polls by itself, this one only checks now and then the knock is still on
            schedule(phase.value === 'waiting' ? WAIT_MS : IDLE_MS)
        } else {
            await readLounge()
            schedule(IDLE_MS)
        }
    }

    // The knock is over (refused, expired...): the tab forgets its secret
    const forget = (status: string) => {
        store('')
        token.value = ''
        phase.value = (FINAL.includes(status as KnockPhase) ? status : 'ended') as KnockPhase
    }

    /** First reading: the room, and the knock of this tab when there is one (a reload). */
    const load = async () => {
        token.value = stored()
        if (token.value) {
            phase.value = 'waiting'
            await readKnock()
        }
        if (!lounge.value) await readLounge()
        schedule(phase.value === 'waiting' ? WAIT_MS : IDLE_MS)
        return Boolean(lounge.value)
    }

    /** Knocks with the visitor's name; false with knock.error when the server refused. */
    const knock = async (name: string) => {
        error.value = ''
        phase.value = 'sending'
        const res = await api.post('/lounge/knocks', { name })
        if (!res.success) {
            error.value = res.error || 'loungeKnockFailed'
            phase.value = 'idle'
            if (res.error === 'loungeClosed') await readLounge()
            return false
        }
        token.value = res.token
        store(res.token)
        phase.value = 'waiting'
        schedule(WAIT_MS)
        return true
    }

    /** Stops waiting. A closed tab is not cancelled: the host stops seeing it after 30 s (a reload keeps waiting). */
    const cancel = async () => {
        const current = token.value
        if (!current || phase.value !== 'waiting') return
        forget('cancelled')
        await api.post(`/lounge/knocks/${current}/cancel`)
        schedule(0)
    }

    /** The call is over: the server is told (when the visitor hangs up), the tab can knock again. */
    const finish = async (tellServer = true) => {
        const current = token.value
        forget('ended')
        if (current && tellServer) await api.post(`/lounge/knocks/${current}/end`)
        schedule(IDLE_MS)
    }

    /** Back to the form (after a refusal or the end of a call). */
    const reset = () => {
        error.value = ''
        if (!token.value) phase.value = 'idle'
    }

    onBeforeUnmount(() => {
        stopped = true
        clearTimeout(timer)
    })

    return { lounge, phase, error, token, iceServers, load, knock, cancel, finish, reset }
}
