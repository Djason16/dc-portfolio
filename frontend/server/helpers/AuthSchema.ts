/*
 * Tables of the admin login, created at startup with the others (DatabaseSchema.ts, right after dc_users they refer to).
 * Moments written by the code (expiry) are ISO texts (VARCHAR(32)), like in DatabaseSchema.ts.
 */
export const AUTH_TABLES = {
    // Code of the second step of the login, sent by email (10 minutes)
    dc_otp: `
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        code VARCHAR(16) NOT NULL,
        expires_at VARCHAR(32) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES dc_users(id) ON DELETE CASCADE`,
    // Forgotten password links: only the SHA-256 of the token is kept, valid one hour, removed once used (AuthController)
    dc_password_resets: `
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        token_hash CHAR(64) NOT NULL UNIQUE,
        expires_at VARCHAR(32) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES dc_users(id) ON DELETE CASCADE`,
    // Sessions of the admin (cookie sid, SessionHelper.ts)
    dc_sessions: `
        id VARCHAR(128) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at VARCHAR(32) NOT NULL`,
}
