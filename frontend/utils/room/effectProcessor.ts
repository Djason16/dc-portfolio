import type { ImageSegmenter, MPMask } from '@mediapipe/tasks-vision'
import { type Effect, effectImageUrl } from './effects'

/*
 * Draws the camera again with its background changed, about 30 times a second, into a canvas whose video track is what the
 * preview shows and what the call sends (RTCRtpSender.replaceTrack: no new negotiation). On each frame: the mask of the
 * person (MediaPipe, 256 x 256, smoothed when enlarged), the person cut out of the frame, then the background behind
 * (the frame blurred, or an image). 640 px wide: light for the processor and enough for a call.
 * Too slow on this device (under about 15 frames a second for 3 seconds): onSlow is called, the caller goes back to the raw
 * camera.
 *
 *   const processor = await createEffectProcessor(cameraTrack, effect, segmenter, onSlow)
 *   processor.track            the track to show and send
 *   await processor.setEffect(other)
 *   processor.stop()
 */
export type EffectProcessor = { track: MediaStreamTrack, setEffect: (effect: Effect) => Promise<void>, stop: () => void }

const WIDTH = 640
const FRAME_MS = 1000 / 30
// Average time of one frame above which the device is too slow, measured over this many frames
const SLOW_MS = 66
const SLOW_FRAMES = 90

const loadImage = (url: string) => new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = url
})

// The beat of the frames from a small worker: the timers of a hidden tab are slowed to one a second, not the ones of a
// worker (the other person keeps a fluid picture while this tab is in the background); setTimeout where workers fail
const startBeat = (onBeat: () => void) => {
    try {
        const url = URL.createObjectURL(new Blob([`setInterval(() => postMessage(0), ${Math.round(FRAME_MS)})`], { type: 'text/javascript' }))
        const worker = new Worker(url)
        URL.revokeObjectURL(url)
        worker.onmessage = onBeat
        return () => worker.terminate()
    } catch {
        const timer = setInterval(onBeat, FRAME_MS)
        return () => clearInterval(timer)
    }
}

const canvas = (width: number, height: number) => {
    const element = document.createElement('canvas')
    element.width = width
    element.height = height
    return element
}

export const createEffectProcessor = async (camera: MediaStreamTrack, first: Effect, segmenter: ImageSegmenter, onSlow: () => void): Promise<EffectProcessor> => {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.srcObject = new MediaStream([camera])
    await video.play()
    const height = Math.round(WIDTH * (video.videoHeight || 480) / (video.videoWidth || 640) / 2) * 2

    const out = canvas(WIDTH, height)
    const ctx = out.getContext('2d')!
    const mask = canvas(256, 256)
    const maskCtx = mask.getContext('2d')!
    let maskData: ImageData | null = null
    // Blur without canvas filters (older Safari): the frame made very small then enlarged again
    const small = canvas(Math.round(WIDTH / 8), Math.round(height / 8))
    const smallCtx = small.getContext('2d')!
    const filters = typeof ctx.filter === 'string'

    let effect = first
    let image: HTMLImageElement | null = null
    const setEffect = async (next: Effect) => {
        image = next.image ? await loadImage(effectImageUrl(next.image)) : null
        effect = next
    }
    await setEffect(first)

    // The confidence of each point (0 to 1) becomes the transparency of the mask; a small band around 0.5 keeps the edge soft
    const drawMask = (result: MPMask) => {
        if (mask.width !== result.width || mask.height !== result.height || !maskData) {
            mask.width = result.width
            mask.height = result.height
            maskData = maskCtx.createImageData(result.width, result.height)
            maskData.data.fill(255)
        }
        const values = result.getAsFloat32Array(), pixels = maskData.data
        for (let i = 0; i < values.length; i++) pixels[i * 4 + 3] = Math.max(0, Math.min(255, (values[i]! - 0.25) * 510))
        maskCtx.putImageData(maskData, 0, 0)
    }

    const drawBackground = () => {
        if (image) {
            // Like object-fit: cover
            const scale = Math.max(WIDTH / image.width, height / image.height)
            const w = image.width * scale, h = image.height * scale
            return ctx.drawImage(image, (WIDTH - w) / 2, (height - h) / 2, w, h)
        }
        const blur = effect.blur ?? 0
        if (filters) {
            ctx.filter = `blur(${blur}px)`
            // A little larger than the canvas: the blur never shows dark borders
            ctx.drawImage(video, -blur * 2, -blur * 2, WIDTH + blur * 4, height + blur * 4)
            ctx.filter = 'none'
            return
        }
        smallCtx.drawImage(video, 0, 0, small.width, small.height)
        ctx.drawImage(small, 0, 0, WIDTH, height)
    }

    const compose = () => {
        ctx.globalCompositeOperation = 'copy'
        ctx.drawImage(mask, 0, 0, WIDTH, height)
        ctx.globalCompositeOperation = 'source-in'
        ctx.drawImage(video, 0, 0, WIDTH, height)
        ctx.globalCompositeOperation = 'destination-over'
        drawBackground()
        ctx.globalCompositeOperation = 'source-over'
    }

    let stopped = false
    let last = 0
    let spent = 0, frames = 0
    let drawing = false
    const tick = () => {
        // A frame not finished yet (slow device): this beat is skipped
        if (stopped || drawing) return
        drawing = true
        const started = performance.now()
        if (video.readyState >= 2 && video.videoWidth) {
            // The timestamps given to MediaPipe always grow
            last = Math.max(last + 1, started)
            try {
                segmenter.segmentForVideo(video, last, (result) => {
                    const confidence = result.confidenceMasks?.[0]
                    if (confidence) drawMask(confidence)
                    compose()
                })
            } catch (error) {
                console.warn('[room] effect', error)
            }
            spent += performance.now() - started
            if (++frames >= SLOW_FRAMES) {
                if (spent / frames > SLOW_MS) { stop(); return onSlow() }
                spent = frames = 0
            }
        }
        drawing = false
    }

    const track = out.captureStream(30).getVideoTracks()[0]!
    // The first frame is drawn before the track is used
    tick()
    const stopBeat = startBeat(tick)

    const stop = () => {
        stopped = true
        stopBeat()
        track.stop()
        video.pause()
        video.srcObject = null
    }

    return { track, setEffect, stop }
}
