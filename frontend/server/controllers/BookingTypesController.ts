import type { RouteArgs } from '../utils/RouteDiscovery'
import type { H3Event } from 'h3'
/*
 * Kinds of appointment of the booking page (dc_booking_types):
 *   GET    /api/booking-types         public: the active kinds, in their order, with the rules the page needs (open, notice, horizon)
 *   GET    /api/booking-types/all     admin: every kind, the hidden ones too
 *   POST   /api/booking-types         admin: { nameFr, nameEn, descriptionFr?, descriptionEn?, duration, mode, location?, active?, sortOrder? }
 *   PUT    /api/booking-types/{id}    admin: the fields sent, the others kept
 *   DELETE /api/booking-types/{id}    admin: the bookings already made keep their copy of the kind
 */
const MODES = ['phone', 'video', 'meeting']
// Field of the site -> column of the table, and how its value is cleaned
const FIELDS: Record<string, [string, (value: unknown) => unknown]> = {
    nameFr: ['name_fr', v => String(v ?? '').trim().slice(0, 120)],
    nameEn: ['name_en', v => String(v ?? '').trim().slice(0, 120)],
    descriptionFr: ['description_fr', v => String(v ?? '').trim().slice(0, 500)],
    descriptionEn: ['description_en', v => String(v ?? '').trim().slice(0, 500)],
    duration: ['duration', v => Math.round(Number(v))],
    mode: ['mode', v => String(v)],
    location: ['location', v => String(v ?? '').trim().slice(0, 255)],
    active: ['active', v => v === true || v === 1 || v === '1' || v === 'true'],
    sortOrder: ['sort_order', v => Math.round(Number(v)) || 0],
}

// The cleaned values of the fields sent, or the key of the first wrong one
const clean = (body: Record<string, unknown>) => {
    const values: Record<string, unknown> = {}
    for (const [field, [column, tidy]] of Object.entries(FIELDS)) if (body[field] !== undefined) values[column] = tidy(body[field])
    if ('name_fr' in values && !values.name_fr) return { error: 'bookingTypeNameRequired' }
    if ('duration' in values && !(Number(values.duration) >= 5 && Number(values.duration) <= 480)) return { error: 'bookingTypeInvalidDuration' }
    if ('mode' in values && !MODES.includes(String(values.mode))) return { error: 'bookingTypeInvalidMode' }
    return { values }
}

export default class BookingTypesController extends Controller {
    static publicActions = ['getAll']

    static routes = { listAll: ['GET', '/all'] }

    async getAll(event: H3Event) {
        const rows = await this.fetchAll('SELECT * FROM dc_booking_types WHERE active = 1 ORDER BY sort_order ASC, created_at ASC')
        const { enabled, noticeHours, horizonDays } = await BookingHelper.settings()
        // Without the address of the meetings in person: given to the person who booked only (confirmation page and e-mail)
        const types = rows.map(BookingHelper.toBookingType).map(({ location: _location, ...type }) => type)
        return ResponseHelper.success(event, { types, settings: { enabled, noticeHours, horizonDays } })
    }

    async listAll(event: H3Event) {
        const rows = await this.fetchAll('SELECT * FROM dc_booking_types ORDER BY sort_order ASC, created_at ASC')
        return ResponseHelper.success(event, { types: rows.map(BookingHelper.toBookingType) })
    }

    async create(event: H3Event) {
        const body = await this.body(event)
        // The English name follows the French one when it is left empty
        const { values, error } = clean({ duration: 30, mode: 'phone', active: true, ...body, nameEn: body.nameEn || body.nameFr })
        if (error || !values) return ResponseHelper.validationError(event, error ?? 'bookingTypeNameRequired')
        if (!values.name_fr) return ResponseHelper.validationError(event, 'bookingTypeNameRequired')
        if (body.sortOrder === undefined)
            values.sort_order = Number((await this.fetchOne('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM dc_booking_types'))?.next ?? 0)

        const id = DatabaseHelper.newId()
        const columns = Object.keys(values)
        await this.insert(`INSERT INTO dc_booking_types (id, ${columns.join(', ')}) VALUES (?, ${columns.map(() => '?').join(', ')})`, [id, ...Object.values(values)])
        const row = await this.fetchOne('SELECT * FROM dc_booking_types WHERE id = ? LIMIT 1', [id])
        return ResponseHelper.success(event, { type: BookingHelper.toBookingType(row!) }, 201)
    }

    async update(event: H3Event, args: RouteArgs) {
        const { values, error } = clean(await this.body(event))
        if (error || !values) return ResponseHelper.validationError(event, error ?? 'saveFailed')
        if ('name_en' in values && !values.name_en) delete values.name_en
        const columns = Object.keys(values)
        if (!columns.length) return ResponseHelper.validationError(event, 'Nothing to update')
        const changed = await this.execute(`UPDATE dc_booking_types SET ${columns.map(column => `${column} = ?`).join(', ')} WHERE id = ?`,
            [...Object.values(values), args.id])
        return this.changed(event, changed, args.id, 'bookingTypeNotFound')
    }

    async delete(event: H3Event, args: RouteArgs) {
        return this.changed(event, await this.execute('DELETE FROM dc_booking_types WHERE id = ?', [args.id]), args.id, 'bookingTypeNotFound')
    }
}
