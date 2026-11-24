import type { H3Event } from 'h3'
/*
 * The DC tools of the home page (« Mes outils »), read from the sales site (server/helpers/ToolsCatalogHelper.ts):
 *   GET /api/tools   public, no parameter: { site: { fr, en }, tools: [{ id, name, title, accent, version, text, url }] }
 * Always answers a list (the last good one, else the built-in one), kept 5 minutes by the browsers.
 *   GET  /api/tools/sync   admin: the registered tools, the last sync (date, error, what it did)
 *   POST /api/tools/sync   admin: one sync now (ToolsSyncHelper.ts)
 */
export default class ToolsController extends Controller {
    static publicActions = ['getAll']
    static routes = { syncStatus: ['GET', '/sync'], syncNow: ['POST', '/sync'] }

    async syncStatus(event: H3Event) {
        return ResponseHelper.success(event, await ToolsSyncHelper.status())
    }

    async syncNow(event: H3Event) {
        const report = await ToolsSyncHelper.run()
        return ResponseHelper.success(event, { report, ...(await ToolsSyncHelper.status()) })
    }

    async getAll(event: H3Event) {
        setResponseHeader(event, 'Cache-Control', 'public, max-age=300')
        return ResponseHelper.success(event, { ...(await ToolsCatalogHelper.get()) })
    }
}
