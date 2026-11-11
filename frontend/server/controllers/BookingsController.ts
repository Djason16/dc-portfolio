import type { RouteArgs } from '../utils/RouteDiscovery'
import type { H3Event } from 'h3'
import type { BookingMail } from '../templates/BookingMails'
/*
 * Bookings of the page /book (a visitor books a slot of a kind of appointment, like Calendly):
 *   GET  /api/bookings/slots?type=&from=&to=   public: the free starts (ISO, UTC) of a kind between two moments
 *   POST /api/bookings                         public: { typeId, start, name, email, phone?, message?, language, timezone, website (trap) }
 *   GET  /api/bookings/cancel/{token}          public: the booking of a cancel link (what, when, still booked or not)
 *   POST /api/bookings/cancel/{token}          public: the visitor cancels his booking
 *   GET  /api/bookings                         admin: the bookings of the last 30 days and to come (with the links of their video room)
 *   POST /api/bookings/{id}/cancel             admin: cancels a booking (the visitor is told by email)
 * The emails go after the database: a booking is kept even when an email fails (the admin shows it).
 * A video kind without a fixed link gets the video room of the site (/room/<token>/, RoomsController.ts): one link for the visitor,
 * another one for the owner.
 */
const LIMIT = { max: 5, windowSeconds: 60 * 60, lockSeconds: 60 * 60 }
// One request of slots covers a month shown on the page at most (a few days more for the weeks cut by the month)
const MAX_RANGE_MS = 45 * 24 * 60 * 60 * 1000
const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
const isPhone = (value: string) => /^[+()\d\s.-]{6,32}$/.test(value)
const text = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max)

// Database row -> the booking used by the emails and sent to the site
const toBooking = (row: Record<string, any>): BookingMail & { status: string, typeId: string | null, createdAt: string } => ({
    id: row.id, typeId: row.type_id, typeName: row.type_name, mode: row.mode, location: row.location ?? '', start: BookingHelper.fromSqlUtc(row.start_at),
    end: BookingHelper.fromSqlUtc(row.end_at), name: row.name, email: row.email, phone: row.phone ?? '', message: row.message ?? '', language: row.language,
    timezone: BookingHelper.validZone(row.timezone) ?? 'Europe/Paris', cancelToken: row.cancel_token, roomToken: row.room_token ?? '', hostToken: row.host_token ?? '',
    status: row.status, createdAt: row.created_at,
})
// What the site shows of a booking (never its tokens: the admin list adds the room links itself)
const toJson = (b: ReturnType<typeof toBooking>) => ({ id: b.id, typeId: b.typeId, typeName: b.typeName, mode: b.mode, location: b.location,
    start: new Date(b.start).toISOString(), end: new Date(b.end).toISOString(), name: b.name, email: b.email, phone: b.phone, message: b.message,
    language: b.language, timezone: b.timezone, status: b.status, createdAt: b.createdAt })

// Zone of the owner (admin > Calendar), for his own emails
const ownerZone = async () => BookingHelper.validZone((await DatabaseHelper.fetchOne('SELECT timezone FROM dc_calendar_settings LIMIT 1'))?.timezone) ?? 'Europe/Paris'

// Sends emails one after the other; false when one failed (logged, the booking itself is kept)
const sendAll = async (mails: Parameters<typeof MailHelper.send>[0][]) => {
    try {
        for (const message of mails) await MailHelper.send(message)
        return true
    } catch (error) {
        console.error('Booking email failed:', (error as Error).message)
        return false
    }
}

export default class BookingsController extends Controller {
    static publicActions = ['slots', 'create', 'showByToken', 'cancelByToken']

    static routes = {
        slots: ['GET', '/slots'],
        showByToken: ['GET', '/cancel/{token}'],
        cancelByToken: ['POST', '/cancel/{token}'],
        cancel: ['POST', '/{id}/cancel'],
    }

    async slots(event: H3Event) {
        const type = await this.fetchOne('SELECT duration FROM dc_booking_types WHERE id = ? AND active = 1 LIMIT 1', [String(RequestHelper.query(event, 'type', ''))])
        if (!type) return ResponseHelper.notFound(event, 'bookingTypeNotFound')
        const from = Date.parse(String(RequestHelper.query(event, 'from', ''))), to = Date.parse(String(RequestHelper.query(event, 'to', '')))
        if (Number.isNaN(from) || Number.isNaN(to) || to <= from) return ResponseHelper.validationError(event, 'bookingInvalidRange')

        const settings = await BookingHelper.settings()
        const slots = await BookingHelper.freeSlots(Number(type.duration), from, Math.min(to, from + MAX_RANGE_MS), settings)
        return ResponseHelper.success(event, { slots, enabled: settings.enabled })
    }

    async create(event: H3Event) {
        const keys = [`booking-ip:${RequestHelper.ip(event)}`]
        const limit = await RateLimitHelper.check(keys)
        if (limit.locked) return ResponseHelper.tooManyRequests(event, 'tooManyAttempts', limit.retryAfter)

        const body = (await this.body(event)) || {}
        // Trap for robots: a field hidden from people; filled, the answer looks the same but nothing is booked nor sent
        if (text(body.website, 255)) return ResponseHelper.success(event, { booking: null, emailSent: true })

        // A text too long is refused (400), never cut: the same limits as the form (BookingForm.vue)
        const form = {
            name: text(body.name, Infinity), email: text(body.email, Infinity), phone: text(body.phone, 64), message: text(body.message, Infinity),
            language: body.language === 'en' ? 'en' : 'fr', timezone: BookingHelper.validZone(body.timezone) ?? (await ownerZone()),
        }
        if (form.name.length < 2) return ResponseHelper.validationError(event, 'bookingNameRequired')
        if (form.name.length > 255) return ResponseHelper.validationError(event, 'bookingNameTooLong')
        if (form.email.length > 255 || !isEmail(form.email)) return ResponseHelper.validationError(event, 'invalidEmail')
        if (form.message.length > 2000) return ResponseHelper.validationError(event, 'bookingMessageTooLong')
        if (form.phone && !isPhone(form.phone)) return ResponseHelper.validationError(event, 'bookingInvalidPhone')
        // Also a few bookings per hour for one address, whatever the IP
        keys.push(`booking-email:${form.email.toLowerCase()}`)
        const byEmail = await RateLimitHelper.check(keys)
        if (byEmail.locked) return ResponseHelper.tooManyRequests(event, 'tooManyAttempts', byEmail.retryAfter)

        const typeRow = await this.fetchOne('SELECT * FROM dc_booking_types WHERE id = ? AND active = 1 LIMIT 1', [text(body.typeId, 64)])
        if (!typeRow) return ResponseHelper.notFound(event, 'bookingTypeNotFound')
        const type = BookingHelper.toBookingType(typeRow)
        if (type.mode === 'phone' && !form.phone) return ResponseHelper.validationError(event, 'bookingPhoneRequired')
        const start = Date.parse(text(body.start, 40))
        if (Number.isNaN(start)) return ResponseHelper.validationError(event, 'bookingSlotTaken')

        // Checked again and written alone: two visitors on the same slot at the same moment, only the first one gets it
        const booking = await BookingHelper.exclusive(async () => {
            const end = start + type.duration * 60 * 1000
            const free = await BookingHelper.freeSlots(type.duration, start, start + 1)
            if (!free.includes(new Date(start).toISOString())) return null
            // The video room of the site, unless the kind has its own fixed link (that one wins)
            const room = type.mode === 'video' && !type.location
            const row = { id: DatabaseHelper.newId(), token: BookingHelper.token(), room: room ? BookingHelper.token() : null, host: room ? BookingHelper.token() : null }
            await this.insert(`INSERT INTO dc_bookings (id, type_id, type_name, mode, location, start_at, end_at, name, email, phone, message, language, timezone,
                cancel_token, room_token, host_token, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [row.id, type.id,
                form.language === 'en' ? type.nameEn : type.nameFr, type.mode, type.location, BookingHelper.toSqlUtc(start), BookingHelper.toSqlUtc(end), form.name,
                form.email, form.phone || null, form.message, form.language, form.timezone, row.token, row.room, row.host, RequestHelper.ip(event)])
            return toBooking((await this.fetchOne('SELECT * FROM dc_bookings WHERE id = ? LIMIT 1', [row.id]))!)
        })
        if (!booking) return ResponseHelper.error(event, 'bookingSlotTaken', 409, 'CONFLICT')

        // Counted even when it works: a few bookings per hour and per address at most
        await RateLimitHelper.fail(keys, LIMIT)
        const settings = await SettingsHelper.all()
        const emailSent = await sendAll([
            { to: booking.email, ...BookingMails.confirmation(booking, settings) },
            { to: settings.email || MailHelper.adminAddress(), ...BookingMails.notice(booking, settings, await ownerZone()) },
        ])
        // The visitor's room link only (never the owner's one): shown on the last screen of the page
        return ResponseHelper.success(event, { booking: { ...toJson(booking), roomToken: booking.roomToken }, emailSent }, 201)
    }

    async showByToken(event: H3Event, args: RouteArgs) {
        const row = await this.fetchOne('SELECT * FROM dc_bookings WHERE cancel_token = ? LIMIT 1', [String(args.token)])
        if (!row) return ResponseHelper.notFound(event, 'bookingNotFound')
        const b = toBooking(row)
        return ResponseHelper.success(event, { booking: { typeName: b.typeName, mode: b.mode, start: new Date(b.start).toISOString(),
            end: new Date(b.end).toISOString(), status: b.status, past: b.start <= Date.now() } })
    }

    async cancelByToken(event: H3Event, args: RouteArgs) {
        const row = await this.fetchOne('SELECT * FROM dc_bookings WHERE cancel_token = ? LIMIT 1', [String(args.token)])
        if (!row) return ResponseHelper.notFound(event, 'bookingNotFound')
        const booking = toBooking(row)
        if (booking.status === 'cancelled') return ResponseHelper.success(event, { status: 'cancelled', emailSent: true })
        if (booking.start <= Date.now()) return ResponseHelper.validationError(event, 'bookingPast')

        await this.execute("UPDATE dc_bookings SET status = 'cancelled', cancelled_at = UTC_TIMESTAMP() WHERE id = ?", [booking.id])
        const settings = await SettingsHelper.all()
        const emailSent = await sendAll([
            { to: booking.email, ...BookingMails.cancelled(booking, settings, false) },
            { to: settings.email || MailHelper.adminAddress(), ...BookingMails.cancelNotice(booking, settings, await ownerZone()) },
        ])
        return ResponseHelper.success(event, { status: 'cancelled', emailSent })
    }

    async getAll(event: H3Event) {
        const since = BookingHelper.toSqlUtc(Date.now() - 30 * 24 * 60 * 60 * 1000)
        const rows = await this.fetchAll('SELECT * FROM dc_bookings WHERE end_at >= ? ORDER BY start_at ASC', [since])
        return ResponseHelper.success(event, { bookings: rows.map(row => { const b = toBooking(row); return { ...toJson(b), roomToken: b.roomToken, hostToken: b.hostToken } }) })
    }

    async cancel(event: H3Event, args: RouteArgs) {
        const row = await this.fetchOne("SELECT * FROM dc_bookings WHERE id = ? AND status = 'booked' LIMIT 1", [args.id])
        if (!row) return ResponseHelper.notFound(event, 'bookingNotFound')
        const booking = toBooking(row)
        await this.execute("UPDATE dc_bookings SET status = 'cancelled', cancelled_at = UTC_TIMESTAMP() WHERE id = ?", [booking.id])
        // A booking already past is only marked: nobody to warn
        const emailSent = booking.start > Date.now() ? await sendAll([{ to: booking.email, ...BookingMails.cancelled(booking, await SettingsHelper.all(), true) }]) : true
        return ResponseHelper.success(event, { id: booking.id, emailSent })
    }
}
