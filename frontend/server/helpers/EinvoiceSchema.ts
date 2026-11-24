import { DatabaseHelper } from '../utils/DatabaseHelper'

/*
 * Electronic invoicing (French reform, Factur-X + Super PDP: server/helpers/EinvoiceHelper.ts), added to the others by DatabaseSchema.ts.
 *
 * dc_einvoices: one row per invoice given to Super PDP (or to declare by hand), never needed before:
 *   flow        'b2b' (an e-invoice to a business with a SIREN) or 'b2c' (a consumer: e-reporting, not an e-invoice)
 *   status      'none' (not sent), 'sent', 'accepted', 'rejected'
 *   status_code last event of the platform (api:validated, fr:200 ... fr:213), message: its text or the error
 *   remote_id   id of the invoice at Super PDP (its events are read with it)
 *   env         'sandbox' or 'production': where it was sent
 *   payment_reported_at  the payment declared to the platform (status fr:212 "Encaissée", e-reporting of the payment)
 */
export const EINVOICE_TABLES = {
    dc_einvoices: `
        document_id VARCHAR(64) PRIMARY KEY,
        flow VARCHAR(8) NOT NULL DEFAULT 'b2b' CHECK(flow IN ('b2b', 'b2c')),
        status VARCHAR(16) NOT NULL DEFAULT 'none' CHECK(status IN ('none', 'sent', 'accepted', 'rejected')),
        status_code VARCHAR(32),
        message TEXT,
        remote_id VARCHAR(64),
        env VARCHAR(16),
        sent_at DATETIME,
        payment_reported_at DATETIME,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY(document_id) REFERENCES dc_documents(id) ON DELETE CASCADE`,
}

/*
 * Columns of dc_clients the e-invoices need (safe at every start):
 *   country           ISO 3166 code of the address (FR by default): mandatory in an e-invoice (BT-55)
 *   vat_number        intra-community VAT number of a business client (BT-48), optional
 *   einvoice_address  electronic invoicing address (BT-49) when it is not the SIREN (a suffix SIREN_XXX, or the sandbox address)
 */
const CLIENT_COLUMNS: [string, string][] = [
    ['country', "VARCHAR(2) NOT NULL DEFAULT 'FR' AFTER city"],
    ['vat_number', 'VARCHAR(32) AFTER siret'],
    ['einvoice_address', 'VARCHAR(64) AFTER vat_number'],
]

export const migrateEinvoices = async () => {
    for (const [column, definition] of CLIENT_COLUMNS) {
        const found = await DatabaseHelper.fetchOne('SELECT 1 AS found FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
            ['dc_clients', column])
        if (!found) await DatabaseHelper.execute(`ALTER TABLE dc_clients ADD COLUMN ${column} ${definition}`)
    }
}
