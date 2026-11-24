// The DC tools released on tools.djason-chery.dev put on sale by themselves (server/helpers/ToolsSyncHelper.ts): 2 minutes
// after the start, then every hour. Not while building the site (prerender)
const FIRST_MS = 2 * 60 * 1000
const EVERY_MS = 60 * 60 * 1000

export default defineNitroPlugin(nitroApp => {
    if (import.meta.prerender) return
    const run = () => ToolsSyncHelper.run().catch(error => console.error('Tools sync failed:', error.message))
    const first = setTimeout(run, FIRST_MS)
    const timer = setInterval(run, EVERY_MS)
    nitroApp.hooks.hook('close', () => { clearTimeout(first); clearInterval(timer) })
})
