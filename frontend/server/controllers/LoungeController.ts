import type { H3Event } from 'h3'
import type { RouteArgs } from '../utils/RouteDiscovery'
import type { RoomRole } from '../helpers/RoomHelper'
import { LOUNGE, LoungeHelper } from '../helpers/LoungeHelper'
/*
 * Personal room of the owner (/room/ without a token, components/views/Room/Lounge.vue), like Whereby: always the same address,
 * the logged-in admin is the host. A visitor knocks with his name, the host lets him in or not; one visitor in the call at a time.
 *   GET  /api/lounge                            public: open or closed, host there, a call running, the owner's name
 *   POST /api/lounge/knocks                     public: { name } knocks; { token } (kept by the visitor's tab)
 *   GET  /api/lounge/knocks/{token}             public: the status of the knock (the ICE servers once let in)
 *   POST /api/lounge/knocks/{token}/cancel      public: the visitor stops waiting
 *   POST /api/lounge/knocks/{token}/end         public: the call is over (either side hangs up)
 *   GET  /api/lounge/host                       admin: the host is there, the knocks waiting, the call running
 *   POST /api/lounge/knocks/{token}/accept      admin: lets the visitor in (only when nobody else is in the call)
 *   POST /api/lounge/knocks/{token}/refuse      admin
 *   PUT  /api/lounge/open                       admin: { open } visitors can knock or not
 *   POST /api/lounge/calls/{token}/{side}/join, GET|POST .../{side}/signals   signaling of the call (as RoomsController), only for
 *        a knock let in; side host needs the admin session, side guest the secret of the knock.
 */
// Knocks of one address: a few in 10 minutes (a refused visitor can try again, a robot cannot flood the host)
const KNOCKS = { max: 5, seconds: 10 * 60 }
// Knocks of one address waiting at the same time
const WAITING_PER_IP = 2
const REQUESTS_PER_MINUTE = 300
const MAX_PAYLOAD = 50000
const SENDS: Record<RoomRole, string[]> = { host: ['offer', 'candidates', 'leave'], guest: ['answer', 'candidates', 'leave'] }
const isPeer = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9]{8,32}$/i.test(value)

// Polling of one address on one knock: well under it while the call runs, too many requests answered 429
const tooFast = (event: H3Event, scope: string) => SecurityHelper.tooMany(`lounge:${scope}`, RequestHelper.ip(event), REQUESTS_PER_MINUTE, 60)
const slowDown = (event: H3Event) => ResponseHelper.tooManyRequests(event, 'tooManyAttempts', 60)
// The owner's first name: "Djason CHERY" -> "Djason" (what the visitor reads: "Djason will let you in")
const hostName = async () => String((await SettingsHelper.all()).name || '').trim().split(/\s+/)[0] || ''

// The knock of a call and the side asking, or the answer to send (not let in: the room is "closed" for this call)
const callOf = async (event: H3Event, args: RouteArgs) => {
    if (tooFast(event, `call:${String(args.token).slice(0, 32)}`)) return { ok: false as const, error: slowDown(event) }
    const side = String(args.side)
    if (side !== 'host' && side !== 'guest') return { ok: false as const, error: ResponseHelper.notFound(event, 'roomNotFound') }
    if (side === 'host' && !(await SessionHelper.userId(event))) return { ok: false as const, error: ResponseHelper.authError(event) }
    const knock = await LoungeHelper.knock(args.token)
    if (!knock) return { ok: false as const, error: ResponseHelper.notFound(event, 'roomNotFound') }
    if (side === 'guest') await LoungeHelper.touch(knock.id)
    else await LoungeHelper.hostSeen()
    return { ok: true as const, knock, role: side as RoomRole, open: knock.status === 'accepted' }
}
const ended = (event: H3Event) => ResponseHelper.error(event, 'roomClosed', 403, 'FORBIDDEN', { state: 'ended' })

export default class LoungeController extends Controller {
    static publicActions = ['status', 'knock', 'knockStatus', 'cancel', 'end', 'join', 'poll', 'send']

    static routes = {
        status: ['GET', ''],
        knock: ['POST', '/knocks'],
        knockStatus: ['GET', '/knocks/{token}'],
        cancel: ['POST', '/knocks/{token}/cancel'],
        end: ['POST', '/knocks/{token}/end'],
        host: ['GET', '/host'],
        accept: ['POST', '/knocks/{token}/accept'],
        refuse: ['POST', '/knocks/{token}/refuse'],
        setOpen: ['PUT', '/open'],
        join: ['POST', '/calls/{token}/{side}/join'],
        poll: ['GET', '/calls/{token}/{side}/signals'],
        send: ['POST', '/calls/{token}/{side}/signals'],
    }

    async status(event: H3Event) {
        if (tooFast(event, 'status')) return slowDown(event)
        const { open, hostHere, busy } = await LoungeHelper.state()
        return ResponseHelper.success(event, { lounge: { open, hostHere, busy, hostName: await hostName() } })
    }

    async knock(event: H3Event) {
        const ip = RequestHelper.ip(event)
        const state = await LoungeHelper.state()
        if (!state.open) return ResponseHelper.error(event, 'loungeClosed', 403, 'FORBIDDEN')
        const name = LoungeHelper.cleanName((await this.body(event)).name)
        if (!name) return ResponseHelper.validationError(event, 'loungeNameRequired')
        if (SecurityHelper.tooMany('lounge-knock', ip, KNOCKS.max, KNOCKS.seconds) || (await LoungeHelper.waitingFrom(ip)) >= WAITING_PER_IP)
            return ResponseHelper.tooManyRequests(event, 'loungeTooManyKnocks', 60)

        const token = LoungeHelper.newToken()
        await this.execute(`INSERT INTO dc_lounge_knocks (id, name, ip, status, created_at, seen_at) VALUES (?, ?, ?, 'waiting', UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
            [token, name, ip])
        // The host is not on the page: an e-mail tells him (one every 10 minutes at most, never blocks the knock)
        if (!state.hostHere && !state.mailed) {
            await LoungeHelper.mailed()
            const settings = await SettingsHelper.all()
            MailHelper.send({ to: settings.email || MailHelper.adminAddress(), ...LoungeMails.knock(name, settings) })
                .catch(error => console.error('Lounge knock e-mail failed:', (error as Error).message))
        }
        return ResponseHelper.success(event, { token }, 201)
    }

    async knockStatus(event: H3Event, args: RouteArgs) {
        if (tooFast(event, `knock:${String(args.token).slice(0, 32)}`)) return slowDown(event)
        const knock = await LoungeHelper.knock(args.token)
        if (!knock) return ResponseHelper.notFound(event, 'roomNotFound')
        if (knock.status === 'waiting' || knock.status === 'accepted') await LoungeHelper.touch(knock.id)
        const { open, hostHere, busy } = await LoungeHelper.state()
        return ResponseHelper.success(event, { knock: { status: knock.status, name: knock.name, open, hostHere, busy: busy && knock.status === 'waiting',
            hostName: await hostName(), iceServers: knock.status === 'accepted' ? RoomHelper.iceServers() : [] } })
    }

    async cancel(event: H3Event, args: RouteArgs) {
        if (!LoungeHelper.isToken(args.token)) return ResponseHelper.notFound(event, 'roomNotFound')
        await LoungeHelper.move(args.token, ['waiting'], 'cancelled')
        return ResponseHelper.success(event)
    }

    async end(event: H3Event, args: RouteArgs) {
        if (!LoungeHelper.isToken(args.token)) return ResponseHelper.notFound(event, 'roomNotFound')
        await LoungeHelper.move(args.token, ['accepted'], 'ended')
        return ResponseHelper.success(event)
    }

    async host(event: H3Event) {
        await LoungeHelper.hostSeen()
        const { open } = await LoungeHelper.state()
        return ResponseHelper.success(event, { lounge: { open, knocks: await LoungeHelper.waiting(), current: await LoungeHelper.current(),
            hostName: await hostName(), iceServers: RoomHelper.iceServers() } })
    }

    async accept(event: H3Event, args: RouteArgs) {
        const knock = await LoungeHelper.knock(args.token)
        if (!knock || knock.status !== 'waiting') return ResponseHelper.error(event, 'loungeKnockGone', 409, 'CONFLICT')
        const current = await LoungeHelper.current()
        if (current && current.token !== knock.id) return ResponseHelper.error(event, 'loungeBusy', 409, 'CONFLICT')
        if (!(await LoungeHelper.move(knock.id, ['waiting'], 'accepted'))) return ResponseHelper.error(event, 'loungeKnockGone', 409, 'CONFLICT')
        // The visitor is counted as there from now (his page polls every 2 s)
        await LoungeHelper.touch(knock.id)
        return ResponseHelper.success(event, { knock: { token: knock.id, name: knock.name }, iceServers: RoomHelper.iceServers() })
    }

    async refuse(event: H3Event, args: RouteArgs) {
        if (!LoungeHelper.isToken(args.token)) return ResponseHelper.notFound(event, 'roomNotFound')
        await LoungeHelper.move(args.token, ['waiting'], 'refused')
        return ResponseHelper.success(event)
    }

    async setOpen(event: H3Event) {
        const { open } = await this.body(event)
        await LoungeHelper.setOpen(open === true || open === 'true' || open === 1)
        return ResponseHelper.success(event, { open: (await LoungeHelper.state()).open })
    }

    async join(event: H3Event, args: RouteArgs) {
        const found = await callOf(event, args)
        if (!found.ok) return found.error
        if (!found.open) return ended(event)
        const { peer } = await this.body(event)
        if (!isPeer(peer)) return ResponseHelper.validationError(event, 'roomInvalidRequest')
        const { knock, role } = found
        const cursor = await RoomHelper.lastId(knock.id, LOUNGE)
        await this.execute(`INSERT INTO dc_lounge_peers (knock_id, role, peer, seen_at) VALUES (?, ?, ?, UTC_TIMESTAMP())
            ON DUPLICATE KEY UPDATE peer = VALUES(peer), seen_at = VALUES(seen_at)`, [knock.id, role, peer])
        await RoomHelper.post(knock.id, role, peer, 'join', null, null, LOUNGE)
        return ResponseHelper.success(event, { cursor, other: await RoomHelper.other(knock.id, role, LOUNGE) })
    }

    async poll(event: H3Event, args: RouteArgs) {
        const found = await callOf(event, args)
        if (!found.ok) return found.error
        if (!found.open) return ended(event)
        const peer = RequestHelper.query(event, 'peer', '')
        const after = Math.max(0, Number(RequestHelper.query(event, 'after', 0)) || 0)
        if (!isPeer(peer)) return ResponseHelper.validationError(event, 'roomInvalidRequest')
        const { knock, role } = found
        if (!(await RoomHelper.touch(knock.id, role, peer, LOUNGE))) {
            const current = await this.fetchOne('SELECT peer FROM dc_lounge_peers WHERE knock_id = ? AND role = ? LIMIT 1', [knock.id, role])
            return ResponseHelper.success(event, current ? { replaced: true } : { rejoin: true })
        }
        return ResponseHelper.success(event, { signals: await RoomHelper.read(knock.id, role, peer, after, LOUNGE), other: await RoomHelper.other(knock.id, role, LOUNGE) })
    }

    async send(event: H3Event, args: RouteArgs) {
        const found = await callOf(event, args)
        if (!found.ok) return found.error
        const { peer, kind, payload, target } = await this.body(event)
        const { knock, role } = found
        if (!isPeer(peer) || !SENDS[role].includes(String(kind)) || (target != null && !isPeer(target))) return ResponseHelper.validationError(event, 'roomInvalidRequest')
        if (kind === 'leave') {
            const left = await this.execute('DELETE FROM dc_lounge_peers WHERE knock_id = ? AND role = ? AND peer = ?', [knock.id, role, peer])
            if (left) await RoomHelper.post(knock.id, role, peer, 'leave', null, null, LOUNGE)
            return ResponseHelper.success(event)
        }
        if (!found.open) return ended(event)
        if (JSON.stringify(payload ?? null).length > MAX_PAYLOAD) return ResponseHelper.validationError(event, 'roomInvalidRequest')
        if (!(await RoomHelper.touch(knock.id, role, peer, LOUNGE))) return ResponseHelper.error(event, 'roomReplaced', 409, 'CONFLICT')
        const id = await RoomHelper.post(knock.id, role, peer, kind, payload ?? null, target ?? null, LOUNGE)
        return ResponseHelper.success(event, { id })
    }
}
