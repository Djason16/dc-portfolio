import { onBeforeUnmount, ref, watch, type Ref } from 'vue'

/*
 * Quality of the connection of the video room, read every 2 seconds from the statistics of the call (getStats): time of a
 * round trip and share of lost packets of what comes in. Good, medium or poor; shown small in a corner of the call.
 *
 *   const quality = useCallQuality(() => call.connection(), connected)
 *   quality.level     '' | 'good' | 'medium' | 'poor'
 *   quality.rtt / quality.loss   milliseconds, percent
 */
export type QualityLevel = '' | 'good' | 'medium' | 'poor'

const EVERY_MS = 2000

export const useCallQuality = (connection: () => RTCPeerConnection | null, active: Ref<boolean>) => {
    const level = ref<QualityLevel>('')
    const rtt = ref(0)
    const loss = ref(0)
    let timer: ReturnType<typeof setInterval> | undefined
    let before = { lost: 0, received: 0 }

    const read = async () => {
        const pc = connection()
        if (!pc) return
        const stats = await pc.getStats().catch(() => null)
        if (!stats) return
        let pairId = '', roundTrip: number | null = null, lost = 0, received = 0
        stats.forEach((report) => { if (report.type === 'transport' && report.selectedCandidatePairId) pairId = report.selectedCandidatePairId })
        stats.forEach((report) => {
            const selected = pairId ? report.id === pairId : report.nominated && report.state === 'succeeded'
            if (report.type === 'candidate-pair' && selected && typeof report.currentRoundTripTime === 'number') roundTrip = report.currentRoundTripTime
            if (report.type === 'inbound-rtp') { lost += report.packetsLost ?? 0; received += report.packetsReceived ?? 0 }
        })
        // Lost share since the last reading (not since the start of the call)
        const newLost = Math.max(0, lost - before.lost), newReceived = Math.max(0, received - before.received)
        before = { lost, received }
        const lossRate = newLost + newReceived ? newLost / (newLost + newReceived) : 0
        const seconds = roundTrip ?? 0
        rtt.value = Math.round(seconds * 1000)
        loss.value = Math.round(lossRate * 1000) / 10
        level.value = seconds > 0.5 || lossRate > 0.08 ? 'poor' : seconds > 0.25 || lossRate > 0.03 ? 'medium' : 'good'
    }

    const stop = () => {
        clearInterval(timer)
        timer = undefined
        level.value = ''
    }

    watch(active, (on) => {
        stop()
        if (!on) return
        before = { lost: 0, received: 0 }
        read()
        timer = setInterval(read, EVERY_MS)
    }, { immediate: true })
    onBeforeUnmount(stop)

    return { level, rtt, loss }
}
