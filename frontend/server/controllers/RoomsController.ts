import type { H3Event } from 'h3'
import type { RouteArgs } from '../utils/RouteDiscovery'
import type { RoomRole } from '../helpers/RoomHelper'
/*
 * Video room of a video booking (/room/<token>/, components/views/Room): the call goes straight from one browser to the other
 * (WebRTC), these routes only pass the messages they need to find each other (signaling), read by short polling.
 * The token of the link tells the side: the visitor's one (room_token, in his confirmation) or the owner's one (host_token,
 * in his notice and in admin > Bookings). No WebSocket: plain requests work on any Node hosting, behind any proxy.
 *   GET  /api/rooms/{token}                    public: the appointment, whether the room is open, the ICE servers (open only)
 *   POST /api/rooms/{token}/join               public: { peer } this browser enters (takes the place of another tab of the same side)
 *   GET  /api/rooms/{token}/signals?peer=&after=   public: the messages of the other side after an id, and whether it is there
 *   POST /api/rooms/{token}/signals            public: { peer, kind: offer | answer | candidates | leave, payload, target }
 * Open from 15 minutes before the start to 30 minutes after the end (RoomHelper), never for a cancelled booking.
 */
// Wrong tokens: a few tries, then this address waits (a token is never guessed, the lock only stops a robot early)
const WRONG_TOKEN = { max: 20, windowSeconds: 10 * 60, lockSeconds: 15 * 60 }
// Requests of one address in one room per minute: polling every second and a few messages fit well under it
const REQUESTS_PER_MINUTE = 300
// Largest message: an offer with its description (SDP) is a few KB
const MAX_PAYLOAD = 50000
const SENDS: Record<RoomRole, string[]> = { host: ['offer', 'candidates', 'leave'], guest: ['answer', 'candidates', 'leave'] }
const isPeer = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9]{8,32}$/i.test(value)

// The room of the token, or the answer to send (too many requests, wrong token)
const roomOf = async (event: H3Event, token: string) => {
    const ip = RequestHelper.ip(event)
    if (SecurityHelper.tooMany(`room:${token.slice(0, 32)}`, ip, REQUESTS_PER_MINUTE, 60))
        return { ok: false as const, error: ResponseHelper.tooManyRequests(event, 'tooManyAttempts', 60) }
    const keys = [`room-ip:${ip}`]
    const limit = await RateLimitHelper.check(keys)
    if (limit.locked) return { ok: false as const, error: ResponseHelper.tooManyRequests(event, 'tooManyAttempts', limit.retryAfter) }
    const room = await RoomHelper.find(token)
    if (!room) {
        await RateLimitHelper.fail(keys, WRONG_TOKEN)
        return { ok: false as const, error: ResponseHelper.notFound(event, 'roomNotFound') }
    }
    return { ok: true as const, room, ...RoomHelper.state(room.booking) }
}

// Refusal of a room that is not open now: the page shows why, with the moments
const closed = (event: H3Event, info: { state: string, opensAt: number, closesAt: number }) =>
    ResponseHelper.error(event, 'roomClosed', 403, 'FORBIDDEN', { state: info.state, opensAt: new Date(info.opensAt).toISOString(), closesAt: new Date(info.closesAt).toISOString() })

export default class RoomsController extends Controller {
    static publicActions = ['show', 'join', 'poll', 'send']

    static routes = {
        show: ['GET', '/{token}'],
        join: ['POST', '/{token}/join'],
        poll: ['GET', '/{token}/signals'],
        send: ['POST', '/{token}/signals'],
    }

    async show(event: H3Event, args: RouteArgs) {
        const found = await roomOf(event, String(args.token))
        if (!found.ok) return found.error
        const { booking, role } = found.room
        // The name of the other side: the visitor for the owner, the owner (admin > My info) for the visitor
        const otherName = role === 'host' ? booking.name : (await SettingsHelper.all()).name || ''
        return ResponseHelper.success(event, { room: {
            role, typeName: booking.type_name, otherName, state: found.state, now: new Date().toISOString(),
            start: new Date(found.start).toISOString(), end: new Date(found.end).toISOString(),
            opensAt: new Date(found.opensAt).toISOString(), closesAt: new Date(found.closesAt).toISOString(),
            // Given only while the room is open: a TURN account is never handed out for nothing
            iceServers: found.state === 'open' ? RoomHelper.iceServers() : [],
        } })
    }

    async join(event: H3Event, args: RouteArgs) {
        const found = await roomOf(event, String(args.token))
        if (!found.ok) return found.error
        if (found.state !== 'open') return closed(event, found)
        const { peer } = await this.body(event)
        if (!isPeer(peer)) return ResponseHelper.validationError(event, 'roomInvalidRequest')

        const { booking, role } = found.room
        await RoomHelper.cleanUp()
        const cursor = await RoomHelper.lastId(booking.id)
        await this.execute(`INSERT INTO dc_room_peers (booking_id, role, peer, seen_at) VALUES (?, ?, ?, UTC_TIMESTAMP())
            ON DUPLICATE KEY UPDATE peer = VALUES(peer), seen_at = VALUES(seen_at)`, [booking.id, role, peer])
        await RoomHelper.post(booking.id, role, peer, 'join')
        return ResponseHelper.success(event, { cursor, other: await RoomHelper.other(booking.id, role), closesAt: new Date(found.closesAt).toISOString() })
    }

    async poll(event: H3Event, args: RouteArgs) {
        const found = await roomOf(event, String(args.token))
        if (!found.ok) return found.error
        if (found.state !== 'open') return closed(event, found)
        const peer = RequestHelper.query(event, 'peer', '')
        const after = Math.max(0, Number(RequestHelper.query(event, 'after', 0)) || 0)
        if (!isPeer(peer)) return ResponseHelper.validationError(event, 'roomInvalidRequest')

        const { booking, role } = found.room
        // Another tab of the same side took the place (replaced), or this browser was gone too long (rejoin: it enters again)
        if (!(await RoomHelper.touch(booking.id, role, peer))) {
            const current = await this.fetchOne('SELECT peer FROM dc_room_peers WHERE booking_id = ? AND role = ? LIMIT 1', [booking.id, role])
            return ResponseHelper.success(event, current ? { replaced: true } : { rejoin: true })
        }
        return ResponseHelper.success(event, { signals: await RoomHelper.read(booking.id, role, peer, after), other: await RoomHelper.other(booking.id, role) })
    }

    async send(event: H3Event, args: RouteArgs) {
        const found = await roomOf(event, String(args.token))
        if (!found.ok) return found.error
        const { peer, kind, payload, target } = await this.body(event)
        const { booking, role } = found.room
        if (!isPeer(peer) || !SENDS[role].includes(String(kind)) || (target != null && !isPeer(target))) return ResponseHelper.validationError(event, 'roomInvalidRequest')

        // Leaving always works (the last seconds of the room, a closed tab); the rest only while the room is open
        if (kind === 'leave') {
            const left = await this.execute('DELETE FROM dc_room_peers WHERE booking_id = ? AND role = ? AND peer = ?', [booking.id, role, peer])
            if (left) await RoomHelper.post(booking.id, role, peer, 'leave')
            return ResponseHelper.success(event)
        }
        if (found.state !== 'open') return closed(event, found)
        if (JSON.stringify(payload ?? null).length > MAX_PAYLOAD) return ResponseHelper.validationError(event, 'roomInvalidRequest')
        if (!(await RoomHelper.touch(booking.id, role, peer))) return ResponseHelper.error(event, 'roomReplaced', 409, 'CONFLICT')

        const id = await RoomHelper.post(booking.id, role, peer, kind, payload ?? null, target ?? null)
        return ResponseHelper.success(event, { id })
    }
}
