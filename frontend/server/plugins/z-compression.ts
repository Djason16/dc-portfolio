import { brotliCompressSync, constants, gzipSync } from 'node:zlib'

/*
 * Pages compressed before they leave the server (brotli, else gzip): the host (Infomaniak, Node.js) sends the pages
 * rendered by Nuxt as they are, about 60 KB for the home page instead of about 12 KB. The files of the build are
 * already compressed at build time (nitro.compressPublicAssets).
 * The "z-" of the name: Nitro loads its plugins in alphabetical order, this one must come after the ones that change
 * the text of the pages (qualif.ts, which moves the addresses into the folder of the qualif).
 * Error pages (404, 500) are left as text: Nuxt renders them on /__nuxt_error, reads that answer back as text and sends
 * it again with its headers, so compressed bytes would reach the browser broken. They are also kept out of search engines.
 */
// Smaller pages are not worth it
const MIN_BYTES = 1024

// Brotli (else gzip) of a text for the encodings the browser accepts, or null when it accepts neither
const compress = (text: string, accepted: string): { body: Buffer, encoding: string } | null => {
    if (/\bbr\b/.test(accepted)) return { body: brotliCompressSync(Buffer.from(text), { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } }), encoding: 'br' }
    if (/\bgzip\b/.test(accepted)) return { body: gzipSync(Buffer.from(text)), encoding: 'gzip' }
    return null
}

export default defineNitroPlugin((nitroApp) => {
    // JSON read by the pages (GET /api/projects, /api/skills...): compressed too, the host sends it as it is
    nitroApp.hooks.hook('beforeResponse', (event, response) => {
        if (event.method !== 'GET' || !event.path.startsWith('/api/') || event.node.res.headersSent) return
        const body = response.body
        if (body === null || body === undefined || Buffer.isBuffer(body) || typeof body !== 'object' || typeof (body as { pipe?: unknown }).pipe === 'function') return
        const text = JSON.stringify(body)
        if (text.length < MIN_BYTES) return
        const packed = compress(text, String(getRequestHeader(event, 'accept-encoding') ?? ''))
        if (!packed) return
        setResponseHeaders(event, { 'content-type': 'application/json; charset=utf-8', 'content-encoding': packed.encoding, vary: 'Accept-Encoding' })
        response.body = packed.body
    })


    nitroApp.hooks.hook('render:response', (response, { event }) => {
        if (event.path.includes('/__nuxt_error')) {
            response.headers = { ...response.headers, 'x-robots-tag': 'noindex, nofollow' }
            return
        }
        if (typeof response.body !== 'string' || response.body.length < MIN_BYTES) return
        const accepted = String(getRequestHeader(event, 'accept-encoding') ?? '')
        const body = Buffer.from(response.body)
        // Quality 5 of brotli: almost as small as the best, fast enough for each visit
        if (/\bbr\b/.test(accepted)) {
            response.body = brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } }) as unknown as string
            response.headers = { ...response.headers, 'content-encoding': 'br', vary: 'Accept-Encoding' }
        } else if (/\bgzip\b/.test(accepted)) {
            response.body = gzipSync(body) as unknown as string
            response.headers = { ...response.headers, 'content-encoding': 'gzip', vary: 'Accept-Encoding' }
        }
    })
})
