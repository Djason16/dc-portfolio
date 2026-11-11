import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { api } from '@/utils/api'

/*
 * Host's side of the personal room /room/ (the logged-in admin, server/controllers/LoungeController.ts): his page tells the
 * server he is there (every 2 s), and reads the visitors knocking. A new knock rings (a short sound made by the browser,
 * nothing downloaded), shows a notification of the system when allowed, and counts in the title of the tab.
 *
 *   const host = useLoungeHost({ onKnock })
 *   await host.load()          false: not logged in (the page is the visitor's one)
 *   host.knocks                [{ token, name, at }]; host.open; host.current (a call running)
 *   await host.accept(token)   { knock: { token, name }, iceServers } or null; await host.refuse(token)
 *   await host.setOpen(false)
 *   host.askNotifications()    the browser asks once (a button of the page)
 */
export type Knock = { token: string, name: string, at: string }
type Options = { onKnock?: (knock: Knock) => void }

const POLL_MS = 2000
const RETRY_MS = 5000
const ASKED_KEY = 'loungeNotifyAsked'

// Two short notes, like a door bell (WebAudio: works once the page was clicked, which the host does to come here)
let audio: AudioContext | null = null
const ring = () => {
    try {
        audio ??= new AudioContext()
        if (audio.state === 'suspended') audio.resume().catch(() => undefined)
        const start = audio.currentTime
        for (const [i, frequency] of [880, 660].entries()) {
            const osc = audio.createOscillator(), gain = audio.createGain()
            osc.frequency.value = frequency
            gain.gain.setValueAtTime(0.0001, start + i * 0.22)
            gain.gain.exponentialRampToValueAtTime(0.2, start + i * 0.22 + 0.02)
            gain.gain.exponentialRampToValueAtTime(0.0001, start + i * 0.22 + 0.2)
            osc.connect(gain).connect(audio.destination)
            osc.start(start + i * 0.22)
            osc.stop(start + i * 0.22 + 0.22)
        }
    } catch { /* no sound: the list and the title still tell */ }
}

const canNotify = () => typeof window !== 'undefined' && 'Notification' in window

export const useLoungeHost = ({ onKnock }: Options = {}) => {
    const knocks = ref<Knock[]>([])
    const open = ref(true)
    const current = ref<{ token: string, name: string } | null>(null)
    const iceServers = ref<RTCIceServer[]>([])
    const notify = ref<NotificationPermission | 'unsupported'>('unsupported')
    const asked = ref(false)
    const offline = ref(false)
    const seen = new Set<string>()
    let first = true
    let timer: ReturnType<typeof setTimeout> | undefined
    let stopped = false

    const read = async () => {
        const res = await api.get('/lounge/host')
        if (!res.success) return res
        offline.value = false
        const lounge = res.lounge
        open.value = lounge.open
        current.value = lounge.current
        iceServers.value = lounge.iceServers ?? []
        knocks.value = lounge.knocks
        // The knocks already there when the page opens do not ring; the new ones do
        for (const knock of lounge.knocks as Knock[]) {
            if (seen.has(knock.token)) continue
            seen.add(knock.token)
            if (!first) announce(knock)
        }
        first = false
        return res
    }

    const announce = (knock: Knock) => {
        ring()
        onKnock?.(knock)
        if (canNotify() && Notification.permission === 'granted') {
            try {
                const note = new Notification(document.title.replace(/^\(\d+\)\s*/, ''), { body: knock.name, tag: `lounge-${knock.token}` })
                note.onclick = () => { window.focus(); note.close() }
            } catch { /* some phones only allow notifications from a service worker */ }
        }
    }

    const loop = async () => {
        if (stopped) return
        const res = await read()
        if (!res.success && res.status !== 401) offline.value = true
        if (!stopped) timer = setTimeout(loop, res.success ? POLL_MS : RETRY_MS)
    }

    /** First reading: false when the session is not an admin one. */
    const load = async () => {
        const res = await read()
        if (!res.success) return false
        timer = setTimeout(loop, POLL_MS)
        return true
    }

    const accept = async (token: string) => {
        const res = await api.post(`/lounge/knocks/${token}/accept`)
        await read()
        return res.success ? { knock: res.knock as { token: string, name: string }, iceServers: res.iceServers as RTCIceServer[] } : { error: res.error as string }
    }

    const refuse = async (token: string) => {
        await api.post(`/lounge/knocks/${token}/refuse`)
        knocks.value = knocks.value.filter(knock => knock.token !== token)
    }

    const end = (token: string) => api.post(`/lounge/knocks/${token}/end`)

    const setOpen = async (value: boolean) => {
        const res = await api.put('/lounge/open', { open: value })
        if (res.success) open.value = res.open
        await read()
        return res.success
    }

    /** Asks the browser once for the notifications (on a click of the host). */
    const askNotifications = async () => {
        if (!canNotify()) return
        try { localStorage.setItem(ASKED_KEY, '1') } catch { /* private mode */ }
        asked.value = true
        notify.value = await Notification.requestPermission()
    }

    // Waiting visitors in the title of the tab: "(2) Video room | ..."
    const badge = computed(() => knocks.value.length)

    onMounted(() => {
        if (!canNotify()) return
        notify.value = Notification.permission
        try { asked.value = localStorage.getItem(ASKED_KEY) === '1' } catch { /* private mode */ }
    })
    onBeforeUnmount(() => {
        stopped = true
        clearTimeout(timer)
    })

    return { knocks, open, current, iceServers, notify, asked, offline, badge, load, accept, refuse, end, setOpen, askNotifications }
}
