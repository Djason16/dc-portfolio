import { randomBytes } from 'node:crypto'
import { DatabaseHelper } from '../utils/DatabaseHelper'
import { LOUNGE_SPACE } from './RoomHelper'

/*
 * Personal room of the owner (/room/ without a token, server/controllers/LoungeController.ts): always the same address,
 * the logged-in admin is the host; a visitor knocks with his name and waits until the host lets him in or not.
 * Like Whereby: one visitor in the call at a time, the others wait.
 *
 *   await LoungeHelper.state()           { open, hostHere, busy }
 *   await LoungeHelper.knock(token)      the knock of a visitor (its status kept up to date) or null
 *   await LoungeHelper.waiting()         knocks waiting now (their visitor still on the page)
 *   await LoungeHelper.current()         the knock in the call now, or null
 *
 * The signaling of a call: RoomHelper with LOUNGE_SPACE (the same messages as a booking room, per knock).
 */
export const LOUNGE = LOUNGE_SPACE
// A knock nobody answered after this long is over: the visitor can knock again
export const KNOCK_EXPIRES_MINUTES = 10
// The host's page asks every 2 s: after this long without any request he has left
const HOST_GONE_SECONDS = 20
// A visitor's page asks every 2 s (waiting) or more (in the call): after this long it was closed
const VISITOR_GONE_SECONDS = 30
// A call without any request of the visitor for this long is over (closed tab, lost network)
const CALL_GONE_SECONDS = 60
// Names typed by visitors: letters, figures, spaces and a few signs, nothing that can make a tag
export const MAX_NAME = 40

export type KnockStatus = 'waiting' | 'accepted' | 'refused' | 'cancelled' | 'expired' | 'closed' | 'ended'

const one = () => DatabaseHelper.fetchOne(`SELECT open, host_seen_at > UTC_TIMESTAMP() - INTERVAL ${HOST_GONE_SECONDS} SECOND AS host_here,
    mailed_at > UTC_TIMESTAMP() - INTERVAL ${KNOCK_EXPIRES_MINUTES} MINUTE AS mailed FROM dc_lounge WHERE id = 1`)

export const LoungeHelper = {
    /** "  Jean <b>Dupont</b>  " -> "Jean bDupont/b": a short name, without control or markup characters, or '' when nothing is left. */
    cleanName(value: unknown) {
        return String(value ?? '').normalize('NFC').replace(/[\u0000-\u001f\u007f-\u009f<>"'`\\{}[\]]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME).trim()
    },

    /** A new secret for a knock: 32 hexadecimal figures. */
    newToken: () => randomBytes(16).toString('hex'),
    isToken: (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{32}$/.test(value),

    /** Open or closed, whether the host's page is open, whether a visitor is in the call. */
    async state() {
        await LoungeHelper.cleanUp()
        const row = await one()
        return { open: Boolean(Number(row?.open ?? 1)), hostHere: Boolean(Number(row?.host_here ?? 0)), busy: Boolean(await LoungeHelper.current()),
            mailed: Boolean(Number(row?.mailed ?? 0)) }
    },

    /** Opens or closes the room; closing tells the waiting visitors at once. */
    async setOpen(open: boolean) {
        await DatabaseHelper.execute('UPDATE dc_lounge SET open = ? WHERE id = 1', [open ? 1 : 0])
        if (!open) await DatabaseHelper.execute("UPDATE dc_lounge_knocks SET status = 'closed', decided_at = UTC_TIMESTAMP() WHERE status = 'waiting'")
    },

    /** The host's page is open (each of its requests). */
    hostSeen: () => DatabaseHelper.execute('UPDATE dc_lounge SET host_seen_at = UTC_TIMESTAMP() WHERE id = 1'),
    /** An e-mail was sent for a knock (one per KNOCK_EXPIRES_MINUTES at most). */
    mailed: () => DatabaseHelper.execute('UPDATE dc_lounge SET mailed_at = UTC_TIMESTAMP() WHERE id = 1'),

    async knock(token: unknown) {
        if (!LoungeHelper.isToken(token)) return null
        await LoungeHelper.cleanUp()
        return DatabaseHelper.fetchOne('SELECT id, name, status, created_at, decided_at FROM dc_lounge_knocks WHERE id = ? LIMIT 1', [token])
    },

    /** The visitor of a knock is still on the page. */
    touch: (token: string) => DatabaseHelper.execute('UPDATE dc_lounge_knocks SET seen_at = UTC_TIMESTAMP() WHERE id = ?', [token]),

    /** Changes the status of a knock only from the given one; false when it was not in that status anymore. */
    async move(token: string, from: KnockStatus[], to: KnockStatus) {
        return Boolean(await DatabaseHelper.execute(`UPDATE dc_lounge_knocks SET status = ?, decided_at = UTC_TIMESTAMP()
            WHERE id = ? AND status IN (${from.map(() => '?').join(', ')})`, [to, token, ...from]))
    },

    async waiting() {
        const rows = await DatabaseHelper.fetchAll(`SELECT id, name, created_at FROM dc_lounge_knocks WHERE status = 'waiting'
            AND seen_at > UTC_TIMESTAMP() - INTERVAL ${VISITOR_GONE_SECONDS} SECOND ORDER BY created_at ASC LIMIT 20`)
        return rows.map(row => ({ token: String(row.id), name: String(row.name), at: `${String(row.created_at).replace(' ', 'T')}Z` }))
    },

    async current() {
        const row = await DatabaseHelper.fetchOne("SELECT id, name FROM dc_lounge_knocks WHERE status = 'accepted' ORDER BY decided_at DESC LIMIT 1")
        return row ? { token: String(row.id), name: String(row.name) } : null
    },

    /** Knocks of one address waiting now (a visitor knocks once, not twenty times). */
    async waitingFrom(ip: string) {
        return Number((await DatabaseHelper.fetchOne("SELECT COUNT(*) AS n FROM dc_lounge_knocks WHERE ip = ? AND status = 'waiting'", [ip]))?.n ?? 0)
    },

    /** Knocks unanswered for too long expire, calls without the visitor end, old knocks (and their messages) go away. */
    async cleanUp() {
        await DatabaseHelper.execute(`UPDATE dc_lounge_knocks SET status = 'expired', decided_at = UTC_TIMESTAMP() WHERE status = 'waiting'
            AND (created_at < UTC_TIMESTAMP() - INTERVAL ${KNOCK_EXPIRES_MINUTES} MINUTE OR seen_at < UTC_TIMESTAMP() - INTERVAL ${KNOCK_EXPIRES_MINUTES} MINUTE)`)
        await DatabaseHelper.execute(`UPDATE dc_lounge_knocks SET status = 'ended', decided_at = UTC_TIMESTAMP() WHERE status = 'accepted'
            AND seen_at < UTC_TIMESTAMP() - INTERVAL ${CALL_GONE_SECONDS} SECOND`)
        await DatabaseHelper.execute('DELETE FROM dc_lounge_knocks WHERE created_at < UTC_TIMESTAMP() - INTERVAL 1 DAY')
    },
}
