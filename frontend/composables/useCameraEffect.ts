import { ref } from 'vue'
import { type EffectId, EFFECTS, findEffect, readSetting, writeSetting } from '@/utils/room/effects'
import { type EffectProcessor, createEffectProcessor } from '@/utils/room/effectProcessor'
import { effectsSupported, loadSegmenter } from '@/utils/room/segmenter'

/*
 * The background effect of the camera (useLocalMedia): the choice of the person (remembered), and the processed track while
 * an effect is on. While the effect starts, nothing of the camera is sent nor shown (the background the person wanted to
 * hide never shows); if it cannot start, the raw camera comes back with a message.
 *
 *   const effects = useCameraEffect(onUpdate)     onUpdate: the track to send changed
 *   await effects.attach(cameraTrack | null)       a new camera (or none)
 *   effects.output(cameraTrack)                    the track to show and send for this camera (null while starting)
 *   await effects.choose('blurLight')
 */
export type EffectIssue = '' | 'roomEffectFailed' | 'roomEffectSlow' | 'roomEffectUnsupported'

export const useCameraEffect = (onUpdate: () => void) => {
    const effect = ref<EffectId>('none')
    const busy = ref(false)
    const issue = ref<EffectIssue>('')
    let processor: EffectProcessor | null = null
    let source: MediaStreamTrack | null = null
    let run = 0

    /** Reads the remembered choice (in the browser only). */
    const restore = () => {
        const stored = readSetting('effect')
        if (EFFECTS.some(item => item.id === stored)) effect.value = stored as EffectId
    }

    // The device cannot keep up: back to the raw camera (the choice stays remembered for a faster device)
    const onSlow = () => {
        processor = null
        effect.value = 'none'
        issue.value = 'roomEffectSlow'
        onUpdate()
    }

    /** Puts the chosen effect on a camera (null: the camera is off). */
    const attach = async (camera: MediaStreamTrack | null) => {
        const number = ++run
        processor?.stop()
        processor = null
        source = camera
        busy.value = false
        const chosen = findEffect(effect.value)
        if (!camera || chosen.id === 'none') return
        if (!effectsSupported()) { issue.value = 'roomEffectUnsupported'; return }
        busy.value = true
        issue.value = ''
        try {
            const made = await createEffectProcessor(camera, chosen, await loadSegmenter(), onSlow)
            if (number !== run) return made.stop()
            processor = made
        } catch (error) {
            console.warn('[room] effect', error)
            if (number === run) issue.value = 'roomEffectFailed'
        } finally {
            if (number === run) busy.value = false
        }
    }

    /** What to show and send for this camera: the processed track, nothing while it starts, or the camera itself. */
    const output = (camera: MediaStreamTrack | null) => {
        if (!camera) return null
        if (processor) return processor.track
        return busy.value ? null : camera
    }

    /** A new choice: changed on the running effect when there is one, else the effect starts or stops. */
    const choose = async (id: EffectId) => {
        effect.value = id
        writeSetting('effect', id)
        issue.value = ''
        if (processor && id !== 'none') return processor.setEffect(findEffect(id)).catch(() => { issue.value = 'roomEffectFailed' })
        const pending = attach(source)
        onUpdate()
        await pending
        onUpdate()
    }

    return { effect, busy, issue, restore, attach, output, choose }
}

export type CameraEffect = ReturnType<typeof useCameraEffect>
