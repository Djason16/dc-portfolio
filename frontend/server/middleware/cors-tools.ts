// The sales site of the DC tools (tools.djason-chery.dev) posts its trial and help forms to this API and reads who can buy
// (server/controllers/LicenseRequestsController.ts): only these three addresses answer another site, and only that one
// (plus its local preview while it is built). Every other route stays same-site only.
const OPEN_PATHS = new Set(['/api/licenses/trial', '/api/licenses/support', '/api/licenses/sales'])
const ORIGINS = new Set(['https://tools.djason-chery.dev', 'http://localhost:4321'])

export default defineEventHandler((event) => {
    const path = getRequestURL(event).pathname.replace(/\/$/, '')
    if (!OPEN_PATHS.has(path)) return
    const origin = getRequestHeader(event, 'origin') || ''
    if (!ORIGINS.has(origin)) return
    setResponseHeaders(event, {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
        Vary: 'Origin',
    })
    if (event.method === 'OPTIONS') {
        setResponseStatus(event, 204)
        return ''
    }
})
