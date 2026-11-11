import type { ImageSegmenter } from '@mediapipe/tasks-vision'
import { publicUrl } from './effects'

/*
 * MediaPipe Image Segmenter with the "selfie segmenter" model (Apache 2.0): tells, for each point of a camera frame, how sure
 * it is that it belongs to the person. Everything is served by the site (public/mediapipe/, copied by scripts/mediapipe.mjs),
 * nothing goes to a CDN, and nothing is loaded before a person chooses an effect (a few MB, then kept by the browser).
 * Loaded once per page, shared by every camera.
 */
let loading: Promise<ImageSegmenter> | null = null

// The WebAssembly of MediaPipe writes its information lines ("INFO: Created TensorFlow Lite XNNPACK delegate for CPU.",
// "I0000 ...") through console.error: they are not errors, they are dropped; every other message goes through
const quietInfo = () => {
    const error = console.error
    console.error = (...args: unknown[]) => {
        if (typeof args[0] === 'string' && /^(INFO:|I\d{4} )/.test(args[0])) return
        error(...args)
    }
}

export const loadSegmenter = () => {
    loading ??= (async () => {
        quietInfo()
        const base = publicUrl('/mediapipe')
        const { FilesetResolver, ImageSegmenter } = await import('@mediapipe/tasks-vision')
        const fileset = await FilesetResolver.forVisionTasks(`${base}/wasm`)
        // On the processor: same result everywhere, and the mask is read at once (no copy back from the graphics card)
        return ImageSegmenter.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: `${base}/selfie_segmenter.tflite`, delegate: 'CPU' },
            runningMode: 'VIDEO',
            outputCategoryMask: false,
            outputConfidenceMasks: true,
        })
    })()
    // A failure (network, old browser) can be tried again later
    loading.catch(() => { loading = null })
    return loading
}

/** Whether this browser can draw the effects at all (canvas to a video track). */
export const effectsSupported = () => typeof document !== 'undefined' && typeof WebAssembly === 'object'
    && typeof HTMLCanvasElement !== 'undefined' && 'captureStream' in HTMLCanvasElement.prototype
