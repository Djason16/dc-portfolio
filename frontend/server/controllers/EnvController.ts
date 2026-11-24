import type { H3Event } from 'h3'
/*
 * Editor of the .env file of the current mode (admin only, see server/helpers/EnvHelper.js):
 *   GET /api/env   every KEY=value, secret values masked (•••• + last 4): { env, masked: [names of the masked keys] }
 *   PUT /api/env   { KEY: value, ... } updated or added; a secret sent back in its masked form stays unchanged;
 *                  SUPERPDP_API_URL only https://api.superpdp.tech (or empty), SUPERPDP_MOCK only true / false
 */
export default class EnvController extends Controller {
    static routes = { save: ['PUT', ''] }

    async getAll(event: H3Event) {
        try {
            return ResponseHelper.success(event, await EnvHelper.readMasked())
        } catch {
            return ResponseHelper.serverError(event, 'Failed to read env file')
        }
    }

    // PUT /api/env: updates or adds the given keys
    async save(event: H3Event) {
        const sent = await this.body(event)
        if (!Object.keys(sent).length) return ResponseHelper.validationError(event, 'Invalid request body')

        const invalid = EnvHelper.invalidKeys(sent)
        if (invalid.length) return ResponseHelper.validationError(event, `Invalid keys: ${invalid.join(', ')}`)
        const refused = EnvHelper.invalidValue(sent)
        if (refused) return ResponseHelper.validationError(event, refused)

        // Nothing really changed (same values, masked secrets sent back): the file is not touched, the server does not restart
        const updates = await EnvHelper.changesOnly(sent)
        if (!Object.keys(updates).length) return ResponseHelper.success(event, { message: 'Nothing changed', changed: false })

        // Written after the response: in development the file change restarts the server
        setImmediate(() => EnvHelper.write(updates).catch(error => console.error('Failed to update env file:', error)))
        return ResponseHelper.success(event, { message: 'Environment variables updated successfully', changed: true })
    }
}
