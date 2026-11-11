import { ref } from 'vue'
import { readSetting, writeSetting } from '@/utils/room/effects'

/*
 * Cameras, microphones and speakers of this browser for the video room (useLocalMedia), and the ones the person chose
 * (remembered in this browser). The names are known once the browser has the permission; before, "Camera 1"...
 * A speaker can be chosen only where the browser allows it (setSinkId: Chrome, Edge, Firefox; not Safari).
 */
export type DeviceOption = { id: string, label: string }
export type DeviceKind = 'camera' | 'mic' | 'speaker'

const KINDS: Record<MediaDeviceKind, DeviceKind> = { videoinput: 'camera', audioinput: 'mic', audiooutput: 'speaker' }

export const useMediaDevices = () => {
    const lists = ref<Record<DeviceKind, DeviceOption[]>>({ camera: [], mic: [], speaker: [] })
    const chosen = ref<Record<DeviceKind, string>>({ camera: '', mic: '', speaker: '' })

    const canPickSpeaker = () => typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype

    /** Reads the remembered devices (in the browser only). */
    const restore = () => {
        for (const kind of ['camera', 'mic', 'speaker'] as DeviceKind[]) chosen.value[kind] = readSetting(kind)
    }

    /** The devices of the browser now; the ones in use become the chosen ones. */
    const update = async (inUse: Partial<Record<DeviceKind, MediaStreamTrack | null>> = {}) => {
        if (!navigator.mediaDevices?.enumerateDevices) return
        const next: Record<DeviceKind, DeviceOption[]> = { camera: [], mic: [], speaker: [] }
        for (const device of await navigator.mediaDevices.enumerateDevices().catch(() => [])) {
            const kind = KINDS[device.kind]
            if (!kind || !device.deviceId) continue
            if (kind === 'speaker' && !canPickSpeaker()) continue
            next[kind].push({ id: device.deviceId, label: device.label })
        }
        lists.value = next
        for (const [kind, track] of Object.entries(inUse) as [DeviceKind, MediaStreamTrack | null][]) {
            const id = track?.getSettings().deviceId
            if (id) chosen.value[kind] = id
        }
    }

    const remember = (kind: DeviceKind, id: string) => {
        chosen.value[kind] = id
        writeSetting(kind, id)
    }

    /** Constraint of the remembered device: preferred (another one is taken if it is gone), or required after a choice. */
    const constraint = (kind: DeviceKind, exact = false) => {
        const id = chosen.value[kind]
        return id ? { deviceId: exact ? { exact: id } : { ideal: id } } : {}
    }

    return { lists, chosen, canPickSpeaker, restore, update, remember, constraint }
}

export type MediaDevices = ReturnType<typeof useMediaDevices>
