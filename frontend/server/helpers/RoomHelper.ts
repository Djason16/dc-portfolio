import { createHmac } from 'node:crypto'
import { DatabaseHelper } from '../utils/DatabaseHelper'
import { BookingHelper } from './BookingHelper'

/*
 * Video room of a video booking (/room/<token>/, server/controllers/RoomsController.ts): who opens it, when it is open,
 * how the two browsers reach each other.
 *
 *   const room = await RoomHelper.find(token)     { booking, role: 'host' | 'guest' } or null
 *   RoomHelper.state(room.booking)                { state: 'open' | 'early' | 'ended' | 'cancelled', opensAt, closesAt }
 *   RoomHelper.iceServers()                       STUN (and TURN when set in the .env) given to the two browsers
 *     With TURN_SECRET (shared secret of the relay), the TURN access is made for this call and expires after TURN_TTL_HOURS:
 *     a visitor who kept it cannot use the relay later. Without it, TURN_USERNAME / TURN_CREDENTIAL (permanent) are given.
 *
 * Open from 15 minutes before the start to 30 minutes after the end, never for a cancelled booking.
 */
// Life of a TURN access made with TURN_SECRET (a call never lasts longer)
const TURN_TTL_HOURS = 3

export type RoomRole = 'host' | 'guest'
export type RoomState = 'open' | 'early' | 'ended' | 'cancelled'
// One entry of the iceServers of RTCPeerConnection
export type IceServer = { urls: string[], username?: string, credential?: string }

const MINUTE = 60 * 1000
export const ROOM_OPENS_BEFORE = 15 * MINUTE
export const ROOM_CLOSES_AFTER = 30 * MINUTE
// A browser without any request for this long has left (closed tab, lost network): polling is every 1 to 4 s,
// a tab in the background can be slowed down by the browser
export const PEER_GONE_SECONDS = 45

// Public STUN servers used when STUN_URLS is empty: they only tell each browser its public address (they see the IP
// addresses, like for any video call), nothing of the call goes through them
const DEFAULT_STUN = ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478']

// Tables of the signaling: the rooms of the bookings (per booking) or the personal room /room/ (per knock, LoungeHelper)
export type SignalSpace = { peers: string, signals: string, key: string }
export const BOOKING_SPACE: SignalSpace = { peers: 'dc_room_peers', signals: 'dc_room_signals', key: 'booking_id' }
export const LOUNGE_SPACE: SignalSpace = { peers: 'dc_lounge_peers', signals: 'dc_lounge_signals', key: 'knock_id' }

// "a, b ,c" -> ['a', 'b', 'c']
const list = (value: unknown) => String(value ?? '').split(',').map(part => part.trim()).filter(Boolean)

export const RoomHelper = {
    /** The booking of a room link and the side it opens: the visitor's token (guest) or the owner's one (host). */
    async find(token: unknown) {
        const value = String(token ?? '')
        if (!/^[0-9a-f]{32}$/.test(value)) return null
        const booking = await DatabaseHelper.fetchOne("SELECT * FROM dc_bookings WHERE mode = 'video' AND (room_token = ? OR host_token = ?) LIMIT 1", [value, value])
        if (!booking) return null
        return { booking, role: (booking.host_token === value ? 'host' : 'guest') as RoomRole }
    },

    /** Whether the room can be used now, with the moments it opens and closes (UTC ms). */
    state(booking: Record<string, any>, now = Date.now()) {
        const start = BookingHelper.fromSqlUtc(booking.start_at), end = BookingHelper.fromSqlUtc(booking.end_at)
        const opensAt = start - ROOM_OPENS_BEFORE, closesAt = end + ROOM_CLOSES_AFTER
        const state: RoomState = booking.status === 'cancelled' ? 'cancelled' : now < opensAt ? 'early' : now > closesAt ? 'ended' : 'open'
        return { state, start, end, opensAt, closesAt }
    },

    /** ICE servers of the .env (STUN_URLS, TURN_URLS, TURN_USERNAME, TURN_CREDENTIAL), in the format of RTCPeerConnection. */
    iceServers(): IceServer[] {
        const config = useRuntimeConfig()
        const stun = list(config.stunUrls)
        const servers: IceServer[] = [{ urls: stun.length ? stun : DEFAULT_STUN }]
        const turn = list(config.turnUrls)
        if (!turn.length) return servers
        const secret = String(config.turnSecret || '')
        if (secret) {
            // "<expiry>:<name>", the relay checks the HMAC-SHA1 of this name with the same secret and refuses it once expired
            const username = `${Math.floor(Date.now() / 1000) + TURN_TTL_HOURS * 3600}:djason-chery`
            servers.push({ urls: turn, username, credential: createHmac('sha1', secret).update(username).digest('base64') })
        } else {
            servers.push({ urls: turn, username: String(config.turnUsername || ''), credential: String(config.turnCredential || '') })
        }
        return servers
    },

    /** Marks a browser as still there; false when another browser of the same side took its place. */
    async touch(bookingId: string, role: RoomRole, peer: string, space = BOOKING_SPACE) {
        return Boolean(await DatabaseHelper.execute(`UPDATE ${space.peers} SET seen_at = UTC_TIMESTAMP() WHERE ${space.key} = ? AND role = ? AND peer = ?`,
            [bookingId, role, peer]))
    },

    /** The browser on the other side, when it made a request lately. */
    async other(bookingId: string, role: RoomRole, space = BOOKING_SPACE) {
        const row = await DatabaseHelper.fetchOne(`SELECT peer FROM ${space.peers} WHERE ${space.key} = ? AND role = ?
            AND seen_at > UTC_TIMESTAMP() - INTERVAL ${PEER_GONE_SECONDS} SECOND LIMIT 1`, [bookingId, role === 'host' ? 'guest' : 'host'])
        return row ? String(row.peer) : null
    },

    /** Adds a message for the other side; returns its id. */
    async post(bookingId: string, role: RoomRole, peer: string, kind: string, payload: unknown = null, target: string | null = null, space = BOOKING_SPACE) {
        return DatabaseHelper.insert(`INSERT INTO ${space.signals} (${space.key}, sender, peer, target, kind, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
            [bookingId, role, peer, target, kind, payload === null ? null : JSON.stringify(payload)])
    },

    /** Messages of the other side after a given id, meant for this browser or for anyone. */
    async read(bookingId: string, role: RoomRole, peer: string, after: number, space = BOOKING_SPACE) {
        const rows = await DatabaseHelper.fetchAll(`SELECT id, peer, kind, payload FROM ${space.signals} WHERE ${space.key} = ? AND id > ? AND sender <> ?
            AND (target IS NULL OR target = ?) ORDER BY id ASC LIMIT 200`, [bookingId, after, role, peer])
        return rows.map(row => ({ id: Number(row.id), peer: String(row.peer), kind: String(row.kind), payload: row.payload ? JSON.parse(row.payload) : null }))
    },

    /** Last message id of a room (a browser that joins starts reading after it: older messages were meant for an earlier call). */
    async lastId(bookingId: string, space = BOOKING_SPACE) {
        return Number((await DatabaseHelper.fetchOne(`SELECT MAX(id) AS last FROM ${space.signals} WHERE ${space.key} = ?`, [bookingId]))?.last ?? 0)
    },

    /** Removes the messages older than 3 hours and the browsers gone for an hour: the tables stay small. */
    async cleanUp() {
        await DatabaseHelper.execute('DELETE FROM dc_room_signals WHERE created_at < UTC_TIMESTAMP() - INTERVAL 3 HOUR')
        await DatabaseHelper.execute('DELETE FROM dc_room_peers WHERE seen_at < UTC_TIMESTAMP() - INTERVAL 1 HOUR')
    },
}
