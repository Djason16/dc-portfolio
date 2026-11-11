/*
 * Tables of the video room (/room/<token>/, server/controllers/RoomsController.ts), added after dc_bookings by BookingSchema.ts.
 * The call itself goes straight from one browser to the other (WebRTC): the site only passes the few messages the two browsers
 * need to find each other (signaling). Kept in the database rather than in memory: a restart of the server during the
 * call loses nothing, and the hosting can run more than one process.
 * Moments written by MySQL itself (UTC_TIMESTAMP()), compared by MySQL: no gap between the clock of Node and the one of the database.
 */
export const ROOM_TABLES = {
    // Who is in the room now: one browser per side (host = the owner, guest = the visitor); a second tab of the same side
    // takes the place of the first one. seen_at: last request of that browser (gone after a few seconds without any)
    dc_room_peers: `
        booking_id VARCHAR(64) NOT NULL,
        role VARCHAR(8) NOT NULL CHECK(role IN ('host', 'guest')),
        peer VARCHAR(32) NOT NULL,
        seen_at DATETIME NOT NULL,
        PRIMARY KEY (booking_id, role),
        FOREIGN KEY(booking_id) REFERENCES dc_bookings(id) ON DELETE CASCADE`,
    // Messages between the two browsers, read in order (id): join, offer, answer, candidates, leave.
    // target: the browser it is meant for (NULL: whoever is on the other side). Removed after a few hours (RoomHelper.cleanUp)
    dc_room_signals: `
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        booking_id VARCHAR(64) NOT NULL,
        sender VARCHAR(8) NOT NULL,
        peer VARCHAR(32) NOT NULL,
        target VARCHAR(32),
        kind VARCHAR(16) NOT NULL,
        payload MEDIUMTEXT,
        created_at DATETIME NOT NULL,
        INDEX idx_room_signals_booking (booking_id, id),
        FOREIGN KEY(booking_id) REFERENCES dc_bookings(id) ON DELETE CASCADE`,
}

/*
 * Tables of the personal room (/room/ without a token, server/controllers/LoungeController.ts): always there, its host is the
 * logged-in admin; a visitor knocks with his name and waits until the host lets him in (or not). One visitor in the call at a time.
 * The signaling of a call is kept per knock (the same messages as a booking room, RoomHelper with LOUNGE_SPACE).
 */
export const LOUNGE_TABLES = {
    // One row (id 1): open (visitors can knock) or closed, last request of the host's page (he is there), last e-mail of a knock
    dc_lounge: `
        id TINYINT PRIMARY KEY,
        open TINYINT NOT NULL DEFAULT 1,
        host_seen_at DATETIME,
        mailed_at DATETIME`,
    // Knocks of the visitors: id = the secret of the visitor's browser (sessionStorage), the name he typed, what the host answered.
    // waiting -> accepted (in the call) -> ended, or refused, cancelled (by the visitor), expired (10 minutes), closed (room closed)
    dc_lounge_knocks: `
        id VARCHAR(32) PRIMARY KEY,
        name VARCHAR(60) NOT NULL,
        ip VARCHAR(64),
        status VARCHAR(12) NOT NULL DEFAULT 'waiting' CHECK(status IN ('waiting', 'accepted', 'refused', 'cancelled', 'expired', 'closed', 'ended')),
        created_at DATETIME NOT NULL,
        seen_at DATETIME NOT NULL,
        decided_at DATETIME,
        INDEX idx_lounge_knocks_status (status, created_at)`,
    // Same as dc_room_peers and dc_room_signals, per knock
    dc_lounge_peers: `
        knock_id VARCHAR(32) NOT NULL,
        role VARCHAR(8) NOT NULL CHECK(role IN ('host', 'guest')),
        peer VARCHAR(32) NOT NULL,
        seen_at DATETIME NOT NULL,
        PRIMARY KEY (knock_id, role),
        FOREIGN KEY(knock_id) REFERENCES dc_lounge_knocks(id) ON DELETE CASCADE`,
    dc_lounge_signals: `
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        knock_id VARCHAR(32) NOT NULL,
        sender VARCHAR(8) NOT NULL,
        peer VARCHAR(32) NOT NULL,
        target VARCHAR(32),
        kind VARCHAR(16) NOT NULL,
        payload MEDIUMTEXT,
        created_at DATETIME NOT NULL,
        INDEX idx_lounge_signals_knock (knock_id, id),
        FOREIGN KEY(knock_id) REFERENCES dc_lounge_knocks(id) ON DELETE CASCADE`,
}
