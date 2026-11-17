// dc-scaffold: adapted (shared/js-backup 1.9.0: key and MySQL settings read from runtimeConfig, like DatabaseHelper)
import { createHash, timingSafeEqual } from 'node:crypto'
import { createGzip } from 'node:zlib'
import mysql from 'mysql2'
import type { RowDataPacket } from 'mysql2'

/*
 * Backup of the whole database for DC Sentinel (private tool of Djason, GitHub Actions, once a week):
 *   curl -X POST -H "X-Backup-Key: <key>" https://djason-chery.dev/api/backup   -> SQL dump compressed with gzip
 * Route: server/api/backup.ts. The key itself is a secret of GitHub; the server only knows its SHA-256 (hex), in
 * BACKUP_KEY_SHA256 of the .env file (runtimeConfig.backupKeySha256, NUXT_BACKUP_KEY_SHA256 also works when the server
 * starts). Empty or missing: the backup is off, the route answers 404 to everything.
 * Read only (SELECT, SHOW CREATE TABLE), on its own connection with the MySQL settings of DatabaseHelper
 * (runtimeConfig.db), in one snapshot.
 *
 * The dump: header (database, UTC date), SET NAMES utf8mb4, foreign keys off, then for each table DROP TABLE IF EXISTS,
 * its CREATE TABLE and its rows in INSERTs of 200 rows; foreign keys back on, last line "-- End of dump".
 * Dates stay the text that is stored, TIMESTAMP columns in UTC (time_zone +00:00 when read and when imported again).
 */

// Rows per INSERT, and a size limit so that a table of images (dc_uploads) never gives one huge statement
const BATCH_ROWS = 200
const BATCH_BYTES = 4 * 1024 * 1024
// Last line of the dump: DC Sentinel checks it to know the file is complete
export const END_OF_DUMP = '-- End of dump'
// Columns written in hexadecimal (X'...'), byte for byte
const BINARY_TYPES = /^(binary|varbinary|tinyblob|blob|mediumblob|longblob|bit|geometry|point|linestring|polygon|multi\w+|geom\w*collection)$/

type Column = { name: string, type: string }
// What mysql2 gives for a value (dateStrings, bigNumberStrings: dates and big numbers as text)
type Value = string | number | bigint | Buffer | null | undefined
type Query = (sql: string, values?: unknown[]) => Promise<RowDataPacket[]>
type Connection = ReturnType<typeof mysql.createConnection>

// SHA-256 of the key of DC Sentinel (BACKUP_KEY_SHA256, read at build time or when the server starts), null when it is
// missing or not 64 hexadecimal characters: backup off
const keyHash = (): Buffer | null => {
    const hex = String(useRuntimeConfig().backupKeySha256 || process.env.BACKUP_KEY_SHA256 || '').trim().toLowerCase()
    return /^[0-9a-f]{64}$/.test(hex) ? Buffer.from(hex, 'hex') : null
}

// `name` of a table or column (a ` inside is doubled)
const id = (name: string) => mysql.escapeId(name)

// A value written in SQL: NULL, numbers as they are, binary in hex (read with HEX()), everything else escaped
const sqlValue = (value: Value, binary: boolean): string => {
    if (value === null || value === undefined) return 'NULL'
    if (Buffer.isBuffer(value)) return `X'${value.toString('hex')}'`
    // A BIT column can give an odd number of digits: X'...' needs whole bytes
    if (binary) return `X'${String(value).length % 2 ? '0' : ''}${String(value)}'`
    if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL'
    if (typeof value === 'bigint') return value.toString()
    return mysql.escape(value)
}

// DROP, CREATE and the INSERTs of one table
const dumpTable = async (connection: Connection, all: Query, name: string, write: (text: string) => void) => {
    const table = id(name)
    const [create] = await all(`SHOW CREATE TABLE ${table}`)
    write(`-- Table ${table}\nDROP TABLE IF EXISTS ${table};\n${create?.['Create Table']};\n`)
    // Generated columns left out: MySQL computes them, an INSERT may not give them
    const rows = await all(`SELECT COLUMN_NAME AS name, DATA_TYPE AS type, EXTRA AS extra FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION`, [name])
    const columns: Column[] = rows.filter(column => !/\b(VIRTUAL|STORED) GENERATED\b/i.test(String(column.extra ?? '')))
        .map(column => ({ name: String(column.name), type: String(column.type).toLowerCase() }))
    if (columns.length) {
        // Binary columns read in hexadecimal, JSON columns as their text (mysql2 would turn them into objects)
        const binary = columns.map(column => BINARY_TYPES.test(column.type))
        const select = columns.map((column, i) => {
            const quoted = id(column.name)
            return binary[i] ? `HEX(${quoted})` : column.type === 'json' ? `CAST(${quoted} AS CHAR)` : quoted
        })
        const head = `INSERT INTO ${table} (${columns.map(column => id(column.name)).join(', ')}) VALUES\n`
        let batch: string[] = []
        let bytes = 0
        const flush = () => {
            if (batch.length) write(`${head}${batch.join(',\n')};\n`)
            batch = []
            bytes = 0
        }
        // Rows read one by one (a stream), never the whole table at once
        await new Promise<void>((resolve, reject) => {
            connection.query({ sql: `SELECT ${select.join(', ')} FROM ${table}`, rowsAsArray: true })
                .on('result', (row) => {
                    const tuple = `(${(row as unknown as Value[]).map((value, i) => sqlValue(value, binary[i] ?? false)).join(', ')})`
                    if (batch.length && (batch.length >= BATCH_ROWS || bytes + tuple.length > BATCH_BYTES)) flush()
                    batch.push(tuple)
                    bytes += tuple.length
                })
                .on('error', reject)
                .on('end', resolve)
        })
        flush()
    }
    write('\n')
}

export const BackupHelper = {
    /** True when the X-Backup-Key header is the key of DC Sentinel (its SHA-256 compared in constant time); always false when the backup is off. */
    isKey(key: unknown): boolean {
        const expected = keyHash()
        if (!expected || typeof key !== 'string' || !key) return false
        return timingSafeEqual(createHash('sha256').update(key, 'utf8').digest(), expected)
    },

    /** Headers of the answer: a gzip file named after the database and the day. */
    headers(database: string, length: number): Record<string, string> {
        const date = new Date().toISOString().slice(0, 10)
        return {
            'Content-Type': 'application/gzip',
            'Content-Disposition': `attachment; filename="${(database || 'database').replace(/[^\w.-]/g, '_')}-${date}.sql.gz"`,
            'Content-Length': String(length),
            'Cache-Control': 'no-store',
        }
    },

    /** Full SQL dump of the database, compressed with gzip (built in memory: the database of the site stays small). */
    async dumpGzip(): Promise<{ database: string, gzip: Buffer }> {
        const { db: settings } = useRuntimeConfig()
        if (!settings.host) throw new Error('MySQL is not configured: set DB_HOST, DB_NAME, DB_USER and DB_PASS in the .env file')
        const connection = mysql.createConnection({
            host: settings.host,
            port: Number(settings.port || 3306),
            user: settings.user,
            password: settings.pass,
            database: settings.name,
            charset: 'utf8mb4',
            dateStrings: true,
            supportBigNumbers: true,
            bigNumberStrings: true,
        })
        const db = connection.promise()
        const all: Query = async (sql, values = []) => {
            const [rows] = await db.query<RowDataPacket[]>(sql, values)
            return rows
        }
        const gzip = createGzip()
        const chunks: Buffer[] = []
        gzip.on('data', (chunk: Buffer) => chunks.push(chunk))
        const finished = new Promise<void>((resolve, reject) => gzip.on('end', resolve).on('error', reject))
        const write = (text: string) => {
            gzip.write(text)
        }
        try {
            // Every table as it was at the same moment, TIMESTAMP columns read in UTC
            await db.query("SET time_zone = '+00:00'")
            await db.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY')
            const [current] = await all('SELECT DATABASE() AS name')
            const database = String(current?.name ?? '')
            const tables = await all(`SELECT TABLE_NAME AS name FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME`)
            write(`-- Backup of the database ${id(database)} (DC Sentinel, POST /api/backup)\n-- Date (UTC): ${new Date().toISOString()}\n\n`
                + "SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS=0;\nSET time_zone = '+00:00';\nSET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';\n\n")
            for (const table of tables) await dumpTable(connection, all, String(table.name), write)
            await db.query('COMMIT')
            write(`SET FOREIGN_KEY_CHECKS=1;\n${END_OF_DUMP}\n`)
            gzip.end()
            await finished
            await db.end()
            return { database, gzip: Buffer.concat(chunks) }
        } catch (error) {
            gzip.destroy()
            connection.destroy()
            throw error
        }
    },
}
