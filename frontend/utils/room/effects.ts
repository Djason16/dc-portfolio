import { useRuntimeConfig } from '#imports'

/*
 * Background effects of the video room (what is behind the person on the camera): none, blur, or an image. The person is
 * found on each frame by MediaPipe (segmenter.ts), the picture is drawn again by effectProcessor.ts. The choice and the
 * devices are remembered in this browser (localStorage, never sent anywhere).
 */
export type EffectId = 'none' | 'blurLight' | 'blurStrong' | 'imageStudio' | 'imageDusk' | 'imageLeaves'
export type Effect = { id: EffectId, labelKey: string, blur?: number, image?: string }

// Images made for the site (public/images/room/, 1280 x 720 WebP and a small one for the buttons)
export const EFFECTS: Effect[] = [
    { id: 'none', labelKey: 'roomEffectNone' },
    { id: 'blurLight', labelKey: 'roomEffectBlurLight', blur: 6 },
    { id: 'blurStrong', labelKey: 'roomEffectBlurStrong', blur: 16 },
    { id: 'imageStudio', labelKey: 'roomEffectStudio', image: 'studio' },
    { id: 'imageDusk', labelKey: 'roomEffectDusk', image: 'dusk' },
    { id: 'imageLeaves', labelKey: 'roomEffectLeaves', image: 'leaves' },
]

export const findEffect = (id: string) => EFFECTS.find(effect => effect.id === id) ?? EFFECTS[0]!

/** Address of a file of public/, also when the site is served from a folder (qualif). */
export const publicUrl = (path: string) => `${useRuntimeConfig().app.baseURL.replace(/\/$/, '')}${path}`

export const effectImageUrl = (name: string, small = false) => publicUrl(`/images/room/${name}${small ? '-thumb' : ''}.webp`)

// Remembered choices: effect, camera, mic, speaker (private mode or blocked storage: nothing is remembered)
export const readSetting = (key: string) => {
    try { return localStorage.getItem(`room.${key}`) ?? '' } catch { return '' }
}
export const writeSetting = (key: string, value: string) => {
    try { localStorage.setItem(`room.${key}`, value) } catch { /* not remembered */ }
}
