import { ref, shallowRef } from 'vue'
import { useCameraEffect } from './useCameraEffect'
import { type DeviceKind, useMediaDevices } from './useMediaDevices'

/*
 * Camera, microphone and shared screen of this browser, for the video room (components/views/Room).
 * The browser asks for permission at start(); without a camera the call is audio only, without anything the person
 * still sees and hears the other side. The camera is really stopped when turned off (its light goes out), the microphone
 * is only muted (it comes back at once).
 *
 *   const media = useLocalMedia()
 *   await media.start()                          preview: media.stream; problem: media.issue (a translation key)
 *   media.toggleAudio() / toggleVideo() / toggleShare()
 *   media.effects.choose('blurLight')            background effect of the camera (useCameraEffect)
 *   media.devices / media.setDevice('camera' | 'mic' | 'speaker', id)   choice of the devices (useMediaDevices)
 *   media.outgoing('audio' | 'video')            the track to send (the screen while it is shared)
 *   media.onChange(() => ...)                    told when the tracks to send change
 */
export type MediaIssue = '' | 'roomPermissionDenied' | 'roomNoCamera' | 'roomNoMic' | 'roomNoDevices' | 'roomUnsupported' | 'roomShareFailed'

const CAMERA: MediaTrackConstraints = { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }

// Errors of a refused permission (the others: no device, or a device already used by another app)
const isRefused = (error: unknown) => ['NotAllowedError', 'SecurityError'].includes((error as Error)?.name)

export const useLocalMedia = () => {
    // What the preview shows: the microphone with the camera, or with the screen while it is shared
    const stream = shallowRef<MediaStream | null>(null)
    const started = ref(false)
    const asking = ref(false)
    const issue = ref<MediaIssue>('')
    const hasMic = ref(false)
    const hasCamera = ref(false)
    const audioOn = ref(false)
    const videoOn = ref(false)
    const sharing = ref(false)
    let mic: MediaStreamTrack | null = null
    let camera: MediaStreamTrack | null = null
    let screen: MediaStreamTrack | null = null
    const listeners = new Set<() => void>()
    const devices = useMediaDevices()
    const effects = useCameraEffect(() => refresh())
    let watching = false

    const supported = () => typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && typeof RTCPeerConnection !== 'undefined'
    // Screen sharing: computers only (phones and tablets have no getDisplayMedia)
    const canShare = () => typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getDisplayMedia === 'function'

    // The camera as shown and sent: with its effect, nothing while the effect starts
    const cameraOut = () => effects.output(camera)

    const refresh = () => {
        const tracks = [mic, sharing.value ? screen : cameraOut()].filter((track): track is MediaStreamTrack => Boolean(track))
        stream.value = tracks.length ? new MediaStream(tracks) : null
        listeners.forEach(listener => listener())
    }

    const ask = (constraints: MediaStreamConstraints) => navigator.mediaDevices.getUserMedia(constraints)
    const cameraConstraints = (exact = false): MediaTrackConstraints => ({ ...CAMERA, ...devices.constraint('camera', exact) })
    const micConstraints = (exact = false): MediaTrackConstraints | boolean => {
        const device = devices.constraint('mic', exact)
        return 'deviceId' in device ? device : true
    }

    // A new camera (or none): its effect starts, the preview and the call follow
    const useCamera = async (track: MediaStreamTrack | null) => {
        camera = track
        videoOn.value = Boolean(track)
        const starting = effects.attach(track)
        refresh()
        await starting
        refresh()
    }

    /** Asks for the camera and the microphone; falls back to one of them when the other is missing. */
    const start = async () => {
        if (asking.value) return
        if (!supported()) {
            issue.value = 'roomUnsupported'
            started.value = true
            return
        }
        asking.value = true
        issue.value = ''
        devices.restore()
        effects.restore()
        try {
            const both = await ask({ audio: micConstraints(), video: cameraConstraints() })
            mic = both.getAudioTracks()[0] ?? null
            camera = both.getVideoTracks()[0] ?? null
        } catch (error) {
            if (isRefused(error)) issue.value = 'roomPermissionDenied'
            else {
                // One of the two is missing or busy: each one alone
                mic = await ask({ audio: micConstraints() }).then(s => s.getAudioTracks()[0] ?? null, () => null)
                camera = await ask({ video: cameraConstraints() }).then(s => s.getVideoTracks()[0] ?? null, () => null)
                issue.value = mic && !camera ? 'roomNoCamera' : camera && !mic ? 'roomNoMic' : !mic && !camera ? 'roomNoDevices' : ''
            }
        }
        hasMic.value = Boolean(mic)
        hasCamera.value = Boolean(camera)
        audioOn.value = Boolean(mic)
        asking.value = false
        started.value = true
        await devices.update({ camera, mic })
        // A headset plugged in or removed: the lists follow
        if (!watching) navigator.mediaDevices.addEventListener?.('devicechange', () => devices.update())
        watching = true
        await useCamera(camera)
    }

    const toggleAudio = () => {
        if (!mic) return
        mic.enabled = !mic.enabled
        audioOn.value = mic.enabled
        listeners.forEach(listener => listener())
    }

    const toggleVideo = async () => {
        if (videoOn.value) {
            camera?.stop()
            return useCamera(null)
        }
        try {
            await useCamera((await ask({ video: cameraConstraints() })).getVideoTracks()[0] ?? null)
        } catch (error) {
            issue.value = isRefused(error) ? 'roomPermissionDenied' : 'roomNoCamera'
        }
    }

    /** Another camera, microphone or speaker (the speaker is used by the call: devices.chosen.speaker). */
    const setDevice = async (kind: DeviceKind, id: string) => {
        devices.remember(kind, id)
        if (kind === 'camera' && camera) {
            // The old one first: some phones cannot open two cameras at once
            camera.stop()
            try {
                await useCamera((await ask({ video: cameraConstraints(true) })).getVideoTracks()[0] ?? null)
            } catch {
                issue.value = 'roomNoCamera'
                await useCamera(null)
            }
        }
        if (kind === 'mic' && mic) {
            const next = await ask({ audio: micConstraints(true) }).then(s => s.getAudioTracks()[0] ?? null, () => null)
            if (!next) { issue.value = 'roomNoMic'; return }
            next.enabled = audioOn.value
            mic.stop()
            mic = next
            refresh()
        }
    }

    const stopShare = () => {
        screen?.stop()
        screen = null
        sharing.value = false
        refresh()
    }

    const toggleShare = async () => {
        if (sharing.value) return stopShare()
        try {
            screen = (await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })).getVideoTracks()[0] ?? null
            if (!screen) return
            // The "Stop sharing" bar of the browser ends it too
            screen.addEventListener('ended', stopShare)
            sharing.value = true
            refresh()
        } catch (error) {
            // Closing the picker of the browser is not an error
            if (!isRefused(error)) issue.value = 'roomShareFailed'
        }
    }

    /** The track to send for a kind, or null (camera off, no device). */
    const outgoing = (kind: string) => kind === 'audio' ? mic : sharing.value ? screen : cameraOut()

    const onChange = (listener: () => void) => {
        listeners.add(listener)
        return () => listeners.delete(listener)
    }

    /** Stops everything (the camera light goes out). */
    const stop = () => {
        for (const track of [mic, camera, screen]) track?.stop()
        mic = camera = screen = null
        effects.attach(null)
        hasMic.value = hasCamera.value = audioOn.value = videoOn.value = sharing.value = started.value = false
        stream.value = null
    }

    return { stream, started, asking, issue, hasMic, hasCamera, audioOn, videoOn, sharing, supported, canShare, start, toggleAudio, toggleVideo,
        toggleShare, outgoing, onChange, stop, devices, effects, setDevice }
}

export type LocalMedia = ReturnType<typeof useLocalMedia>
