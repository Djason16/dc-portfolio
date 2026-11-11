import { DatabaseHelper } from '../utils/DatabaseHelper'
import { LOUNGE_TABLES, ROOM_TABLES } from './RoomSchema'

/*
 * Tables of the booking page (/book, server/controllers/Bookings*Controller.ts), added to the others by DatabaseSchema.ts.
 * Moments of a booking (start_at, end_at) are written in UTC as 'YYYY-MM-DD HH:MM:SS': the visitor and the owner
 * can be in different zones, each one sees them in his own.
 */
export const BOOKING_TABLES = {
    // Kinds of appointment offered on the page (phone call, video call, meeting...), in the order of sort_order
    // mode: phone (the owner calls the number given), video (a link is sent), meeting (in person: location, empty = to agree)
    dc_booking_types: `
        id VARCHAR(64) PRIMARY KEY,
        name_fr VARCHAR(120) NOT NULL,
        name_en VARCHAR(120) NOT NULL,
        description_fr TEXT,
        description_en TEXT,
        duration INT NOT NULL DEFAULT 30,
        mode VARCHAR(16) NOT NULL DEFAULT 'phone' CHECK(mode IN ('phone', 'video', 'meeting')),
        location VARCHAR(255),
        active TINYINT NOT NULL DEFAULT 1,
        sort_order INT NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP`,
    // Bookings made by visitors. The kind is copied (name, mode, duration): a kind changed or deleted later never changes a booking.
    // cancel_token: secret of the cancel link sent by email (no account needed)
    // room_token / host_token: secrets of the video room of a video kind without a fixed link (/room/<token>/, RoomsController.ts):
    // the visitor's link and the owner's link, two different secrets so each side is known without an account
    dc_bookings: `
        id VARCHAR(64) PRIMARY KEY,
        type_id VARCHAR(64),
        type_name VARCHAR(255) NOT NULL,
        mode VARCHAR(16) NOT NULL,
        location VARCHAR(255),
        start_at DATETIME NOT NULL,
        end_at DATETIME NOT NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(64),
        message TEXT,
        language VARCHAR(8) NOT NULL DEFAULT 'fr',
        timezone VARCHAR(64),
        status VARCHAR(16) NOT NULL DEFAULT 'booked' CHECK(status IN ('booked', 'cancelled')),
        cancel_token VARCHAR(64) NOT NULL UNIQUE,
        room_token VARCHAR(64) UNIQUE,
        host_token VARCHAR(64) UNIQUE,
        ip VARCHAR(64),
        cancelled_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_bookings_start (start_at),
        FOREIGN KEY(type_id) REFERENCES dc_booking_types(id) ON DELETE SET NULL`,
    // Rules of the page (one row): open or closed, notice before a slot (hours), how far ahead (days),
    // free time kept between two appointments and time between two offered starts (minutes)
    dc_booking_settings: `
        id VARCHAR(64) PRIMARY KEY,
        enabled TINYINT NOT NULL DEFAULT 1,
        notice_hours INT NOT NULL DEFAULT 12,
        horizon_days INT NOT NULL DEFAULT 60,
        buffer_minutes INT NOT NULL DEFAULT 15,
        step_minutes INT NOT NULL DEFAULT 30,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
    // Video room of the video bookings (after dc_bookings: their foreign keys point to it)
    ...ROOM_TABLES,
    // Personal room /room/ (visitors knock, the admin lets them in)
    ...LOUNGE_TABLES,
}

// Default rows, inserted only when their table is empty: three kinds to start with, changed from the admin (Bookings)
export const BOOKING_SEEDS = {
    dc_booking_types: async () => {
        const types = [
            { fr: 'Appel téléphonique', en: 'Phone call', descFr: 'Un premier échange rapide sur votre projet.', descEn: 'A quick first talk about your project.', duration: 30, mode: 'phone' },
            { fr: 'Appel visio', en: 'Video call', descFr: 'On regarde votre projet ensemble, écran partagé.', descEn: 'We look at your project together, screen shared.', duration: 45, mode: 'video' },
            { fr: 'Rendez-vous', en: 'Meeting', descFr: 'Une rencontre en personne, lieu à convenir.', descEn: 'A meeting in person, place to agree on.', duration: 60, mode: 'meeting' },
        ]
        for (const [i, type] of types.entries())
            await DatabaseHelper.insert(`INSERT INTO dc_booking_types (id, name_fr, name_en, description_fr, description_en, duration, mode, sort_order)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [DatabaseHelper.newId(), type.fr, type.en, type.descFr, type.descEn, type.duration, type.mode, i])
    },
    dc_booking_settings: () => DatabaseHelper.insert('INSERT INTO dc_booking_settings (id) VALUES (?)', [DatabaseHelper.newId()]),
    // Personal room: open from the start (admin > My video room closes it)
    dc_lounge: () => DatabaseHelper.insert('INSERT INTO dc_lounge (id, open) VALUES (1, 1)'),
}

// Columns added after the first version of dc_bookings (a database made before the video room); safe at every start
export const migrateBookings = async () => {
    for (const column of ['room_token', 'host_token']) {
        const found = await DatabaseHelper.fetchOne('SELECT 1 AS found FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
            ['dc_bookings', column])
        if (!found) await DatabaseHelper.execute(`ALTER TABLE dc_bookings ADD COLUMN ${column} VARCHAR(64) UNIQUE AFTER cancel_token`)
    }
}
