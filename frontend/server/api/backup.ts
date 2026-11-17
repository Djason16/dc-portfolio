// POST /api/backup: SQL dump of the database (gzip) for DC Sentinel, only with the right X-Backup-Key header
// (server/helpers/BackupHelper.ts). Any other method, a missing or wrong key: 404 with no body, like an address that
// does not exist. Outside the API of the controllers ([...path].ts): no admin session asked, the key is the access.
// The key is never written in a log.
export default defineEventHandler(async (event) => {
    if (event.method !== 'POST' || !BackupHelper.isKey(getRequestHeader(event, 'x-backup-key'))) return sendNoContent(event, 404)

    try {
        const { database, gzip } = await BackupHelper.dumpGzip()
        setResponseHeaders(event, BackupHelper.headers(database, gzip.length))
        return gzip
    } catch (error) {
        console.error('[backup]', error instanceof Error ? error.message : error)
        return sendNoContent(event, 500)
    }
})
