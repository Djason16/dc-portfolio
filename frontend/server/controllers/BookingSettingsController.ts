import type { H3Event } from 'h3'
/*
 * Rules of the booking page (one row in dc_booking_settings), edited from the admin (Bookings):
 *   GET /api/booking-settings   admin: { enabled, noticeHours, horizonDays, bufferMinutes, stepMinutes }
 *   PUT /api/booking-settings   admin: the fields sent, the others kept
 * The page itself reads what it needs with the kinds (GET /api/booking-types).
 */
// Field -> column, with the smallest and largest value accepted
const NUMBERS: Record<string, [string, number, number]> = {
    noticeHours: ['notice_hours', 0, 24 * 30],
    horizonDays: ['horizon_days', 1, 365],
    bufferMinutes: ['buffer_minutes', 0, 240],
    stepMinutes: ['step_minutes', 5, 240],
}

export default class BookingSettingsController extends Controller {
    static routes = { save: ['PUT', ''] }

    async getAll(event: H3Event) {
        return ResponseHelper.success(event, { settings: await BookingHelper.settings() })
    }

    async save(event: H3Event) {
        const body = await this.body(event)
        const values: Record<string, unknown> = {}
        if (body.enabled !== undefined) values.enabled = body.enabled === true || body.enabled === 1 || body.enabled === '1' || body.enabled === 'true'
        for (const [field, [column, min, max]] of Object.entries(NUMBERS)) {
            if (body[field] === undefined) continue
            const value = Math.round(Number(body[field]))
            if (!Number.isFinite(value) || value < min || value > max) return ResponseHelper.validationError(event, 'bookingInvalidSetting')
            values[column] = value
        }
        if (!Object.keys(values).length) return ResponseHelper.validationError(event, 'Nothing to update')

        // The row is made by the seed; made here too if it was removed by hand
        const current = await BookingHelper.settings()
        const id = current.id || DatabaseHelper.newId()
        if (!current.id) await this.insert('INSERT INTO dc_booking_settings (id) VALUES (?)', [id])
        await this.execute(`UPDATE dc_booking_settings SET ${Object.keys(values).map(column => `${column} = ?`).join(', ')} WHERE id = ?`, [...Object.values(values), id])
        return ResponseHelper.success(event, { settings: await BookingHelper.settings() })
    }
}
