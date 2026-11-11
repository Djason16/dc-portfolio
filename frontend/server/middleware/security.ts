// Security headers on every answer of the site and of the API, errors included (server/utils/SecurityHelper.js);
// the proxy of the host tells when it is HTTPS. This site adds stricter ones (recette T-028): never shown inside
// another site (DENY + frame-ancestors), camera, microphone and location never asked, HSTS for the subdomains too.
const STRICTER = {
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
    'Content-Security-Policy': "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
}
// Only exception: the video room of a booking (/room/<token>/) and the personal room (/room/), also inside the folder of a qualif, ask for the camera, the
// microphone and the screen to share, for this site only. The rule is read when the page is loaded: the links to a room
// are plain links (a full load), never a move inside the site from a page where the camera is closed
const ROOM_PAGE = /(^|\/)room(\/[^/]+)?\/?$/
const ROOM_PERMISSIONS = 'camera=(self), microphone=(self), display-capture=(self), geolocation=(), interest-cohort=()'
// Page of the link of a forgotten password: its address holds the token, never sent to another site
const RESET_PAGE = /(^|\/)reset-password\/?$/

export default defineEventHandler((event) => {
    const isHttps = getRequestProtocol(event, { xForwardedProto: true }) === 'https'
    const path = getRequestURL(event).pathname
    const isRoom = ROOM_PAGE.test(path)
    setResponseHeaders(event, { ...SecurityHelper.headers(isHttps), ...STRICTER, ...(isRoom ? { 'Permissions-Policy': ROOM_PERMISSIONS } : {}),
        ...(RESET_PAGE.test(path) ? { 'Referrer-Policy': 'no-referrer' } : {}) })
    if (isHttps) setResponseHeader(event, 'Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
})
