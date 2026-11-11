/**
 * Photo picked in the admin, made light before it is sent (recette T-024): at most MAX_SIDE pixels on its longest side,
 * saved in WebP. A GIF (maybe animated) or a file the browser can't read is sent as it is.
 *   const file = await compressImage(input.files[0])
 *   const thumb = await compressImage(input.files[0], THUMB_SIDE)   small copy for the cards of the grid
 */
const MAX_SIDE = 1920
export const THUMB_SIDE = 640
const QUALITY = 0.82

export const compressImage = async (file: File, maxSide = MAX_SIDE) => {
    if (!file || !/^image\/(jpeg|png|webp|avif)$/.test(file.type)) return file
    try {
        const bitmap = await createImageBitmap(file)
        const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(bitmap.width * scale)
        canvas.height = Math.round(bitmap.height * scale)
        canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
        bitmap.close?.()
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', QUALITY))
        // Kept only when it is lighter than the original
        if (!blob || blob.size >= file.size) return file
        return new File([blob], file.name.replace(/\.\w+$/, '') + '.webp', { type: 'image/webp' })
    } catch {
        return file
    }
}

/**
 * Square copy of a photo, cut in its middle like the cards of the home page grid (object-fit: cover), side x side pixels
 * in WebP. null when the browser can't read it (a GIF is kept as it is: no square copy).
 *   const small = await squareImage(file, 320)
 */
export const squareImage = async (file: Blob, side: number, name = 'image') => {
    if (!file || !/^image\/(jpeg|png|webp|avif)$/.test(file.type)) return null
    try {
        const bitmap = await createImageBitmap(file)
        const crop = Math.min(bitmap.width, bitmap.height)
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = Math.min(side, crop)
        canvas.getContext('2d')?.drawImage(bitmap, (bitmap.width - crop) / 2, (bitmap.height - crop) / 2, crop, crop, 0, 0, canvas.width, canvas.height)
        bitmap.close?.()
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', QUALITY))
        return blob ? new File([blob], `${name.replace(/\.\w+$/, '')}-${side}.webp`, { type: 'image/webp' }) : null
    } catch {
        return null
    }
}
