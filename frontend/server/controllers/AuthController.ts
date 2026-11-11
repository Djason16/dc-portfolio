import type { H3Event } from 'h3'
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'

/*
 * Admin login in two steps: email + password, then a 6-digit code sent by email (valid 10 minutes).
 * Forgotten password: after the security answer, a link is emailed (/reset-password/?token=..., valid one hour, used once);
 * the new password chosen there closes every session, the next login is the usual one (password, then code).
 * Error messages are translation keys displayed by the login page (plugins/translations/pages/login.js).
 * Failed attempts are limited per account and per IP (server/helpers/RateLimitHelper.js).
 */
const OTP_LIFETIME = 10 * 60 * 1000
const RESET_LIFETIME = 60 * 60 * 1000
// Links sent per hour for the whole site, whatever the address asked (a mailbox never flooded)
const RESET_SENT = { max: 3, windowSeconds: 60 * 60, lockSeconds: 60 * 60 }
// Only the hash of a link is stored: a copy of the database does not give a working link
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

// Same comparison time whatever the input, so the code cannot be guessed digit by digit
const sameCode = (expected: string, given: string) => {
    const a = Buffer.from(String(expected))
    const b = Buffer.from(String(given).trim())
    return a.length === b.length && timingSafeEqual(a, b)
}

// The security answer is compared without case or spaces around
const lower = (value: unknown) => String(value || '').trim().toLowerCase()

export default class AuthController extends Controller {
    static publicActions = ['checkSession', 'login', 'verifyOtp', 'logout', 'requestPasswordReset', 'resetPassword']

    static routes = {
        checkSession: ['GET', '/check-session'],
        login: ['POST', '/login'],
        verifyOtp: ['POST', '/verify-otp'],
        logout: ['POST', '/logout'],
        requestPasswordReset: ['POST', '/request-password-reset'],
        resetPassword: ['POST', '/reset-password'],
        updatePassword: ['POST', '/update-password'],
    }

    // GET /api/auth/check-session
    async checkSession(event: H3Event) {
        const userId = await SessionHelper.userId(event)
        return ResponseHelper.success(event, { authenticated: Boolean(userId), userId: userId || null })
    }

    // POST /api/auth/login: checks the password, then sends the OTP code to the admin mailbox
    async login(event: H3Event) {
        const { email, password } = await this.body(event)
        if (!email || !password) return ResponseHelper.validationError(event, 'authErrorMissingFields')

        // Account + IP and IP: wrong passwords lock the one who types them, never the admin from his own connection
        // (a lock per account alone let anyone block the admin login); the OTP code by e-mail still guards the account
        const ip = RequestHelper.ip(event)
        const keys = [`login:${lower(email)}:${ip}`, `login-ip:${ip}`]
        const limit = await RateLimitHelper.check(keys)
        if (limit.locked) return ResponseHelper.tooManyRequests(event, 'tooManyAttempts', limit.retryAfter)

        const user = await this.fetchOne('SELECT id, password FROM dc_users WHERE email = ? LIMIT 1', [email])
        if (!user || !(await SessionHelper.verifyPassword(password, user.password))) {
            const locked = await RateLimitHelper.fail(keys, RateLimitHelper.LOGIN)
            return locked ? ResponseHelper.tooManyRequests(event, 'tooManyAttempts', RateLimitHelper.LOGIN.lockSeconds) : ResponseHelper.authError(event, 'invalidCredentials')
        }
        await RateLimitHelper.reset(keys)

        // One pending code per user
        const code = String(randomInt(100000, 1000000))
        await this.execute('DELETE FROM dc_otp WHERE user_id = ?', [user.id])
        await this.insert('INSERT INTO dc_otp (id, user_id, code, expires_at) VALUES (?, ?, ?, ?)',
            [DatabaseHelper.newId(), user.id, code, new Date(Date.now() + OTP_LIFETIME).toISOString()])

        const config = useRuntimeConfig()
        const adminName = (await SettingsHelper.all()).name
        try {
            await MailHelper.send({
                to: MailHelper.adminAddress(),
                subject: `${adminName} - Code de connexion`,
                text: `Votre code de connexion est : ${code}\nIl expire dans 10 minutes.`,
                html: MailTemplates.otp({ code, adminName, locale: 'fr', config }),
            })
        } catch (error) {
            console.error('[MAIL] Sending OTP failed:', error)
            return ResponseHelper.serverError(event, 'errorSendingOtp')
        }

        // Password checked, code sent: the session is created by verify-otp
        return ResponseHelper.success(event, { otpRequired: true, userId: user.id })
    }

    // POST /api/auth/verify-otp: checks the code and opens the session
    async verifyOtp(event: H3Event) {
        const { userId, code } = await this.body(event)
        if (!userId || !code) return ResponseHelper.validationError(event, 'missingFields')

        // Counted per account: a new login, a new session or another browser does not reset it
        const keys = [`otp:${userId}`, `otp-ip:${RequestHelper.ip(event)}`]
        const limit = await RateLimitHelper.check(keys)
        if (limit.locked) return ResponseHelper.tooManyRequests(event, 'tooManyAttempts', limit.retryAfter)

        const otp = await this.fetchOne('SELECT code, expires_at FROM dc_otp WHERE user_id = ? LIMIT 1', [userId])

        if (otp && new Date(otp.expires_at) < new Date()) {
            await this.execute('DELETE FROM dc_otp WHERE user_id = ?', [userId])
            return ResponseHelper.authError(event, 'otpExpired')
        }

        if (!otp || !sameCode(otp.code, code)) {
            const locked = await RateLimitHelper.fail(keys, RateLimitHelper.OTP)
            if (!locked) return ResponseHelper.authError(event, 'invalidOtp')
            // Too many wrong codes: this code can no longer be used
            await this.execute('DELETE FROM dc_otp WHERE user_id = ?', [userId])
            return ResponseHelper.tooManyRequests(event, 'tooManyAttempts', RateLimitHelper.OTP.lockSeconds)
        }

        await this.execute('DELETE FROM dc_otp WHERE user_id = ?', [userId])
        await RateLimitHelper.reset(keys)
        await SessionHelper.create(event, userId)
        return ResponseHelper.success(event, { message: 'loginSuccess' })
    }

    // POST /api/auth/logout
    async logout(event: H3Event) {
        await SessionHelper.destroy(event)
        return ResponseHelper.success(event, { message: 'logoutSuccess' })
    }

    // POST /api/auth/request-password-reset: after the right security answer, a link to choose a new password is emailed.
    // Same answer whether the address has an account or not
    async requestPasswordReset(event: H3Event) {
        const { email, securityAnswer, locale = 'fr' } = await this.body(event)
        if (!email || !securityAnswer) return ResponseHelper.validationError(event, 'missingFields')

        const config = useRuntimeConfig()
        if (!config.securityAnswer) return ResponseHelper.serverError(event, 'securityQuestionNotConfigured')

        // The answer is the same for every account: limited per IP and for the whole site
        const keys = [`reset-ip:${RequestHelper.ip(event)}`, 'reset:all']
        const limit = await RateLimitHelper.check([...keys, 'reset-sent:all'])
        if (limit.locked) return ResponseHelper.tooManyRequests(event, 'tooManyAttempts', limit.retryAfter)

        if (lower(securityAnswer) !== lower(config.securityAnswer)) {
            const locked = await RateLimitHelper.fail(keys, RateLimitHelper.SECURITY_ANSWER)
            return locked ? ResponseHelper.tooManyRequests(event, 'tooManyAttempts', RateLimitHelper.SECURITY_ANSWER.lockSeconds) : ResponseHelper.authError(event, 'incorrectSecurityAnswer')
        }
        await RateLimitHelper.reset(keys)
        await RateLimitHelper.fail(['reset-sent:all'], RESET_SENT)

        const user = await this.fetchOne('SELECT id, email FROM dc_users WHERE email = ? LIMIT 1', [String(email).trim()])
        if (!user) return ResponseHelper.success(event, { message: 'passwordResetSent' })

        // One link per account: a new request makes the previous link useless
        const token = randomBytes(32).toString('base64url')
        await this.execute('DELETE FROM dc_password_resets WHERE user_id = ? OR expires_at < ?', [user.id, new Date().toISOString()])
        await this.insert('INSERT INTO dc_password_resets (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
            [DatabaseHelper.newId(), user.id, hashToken(token), new Date(Date.now() + RESET_LIFETIME).toISOString()])

        const site = String(config.public.frontendDomain || '').replace(/\/$/, '')
        const link = `${site}/reset-password/?token=${token}`
        const adminName = (await SettingsHelper.all()).name
        const en = locale === 'en'
        try {
            await MailHelper.send({
                to: MailHelper.adminAddress(),
                subject: en ? `${adminName} - New password` : `${adminName} - Nouveau mot de passe`,
                text: en
                    ? `Account: ${user.email}\nChoose a new password (link valid for one hour, works once):\n${link}\nYou did not ask for it? Ignore this email.`
                    : `Compte : ${user.email}\nChoisis un nouveau mot de passe (lien valable une heure, une seule fois) :\n${link}\nTu n'as rien demandé ? Ignore cet e-mail.`,
                html: MailTemplates.passwordReset({ userEmail: user.email, link, adminName, locale, config }),
            })
        } catch (error) {
            console.error('[MAIL] Sending password reset link failed:', error)
            await this.execute('DELETE FROM dc_password_resets WHERE user_id = ?', [user.id])
            return ResponseHelper.serverError(event, 'errorSendingResetLink')
        }
        return ResponseHelper.success(event, { message: 'passwordResetSent' })
    }

    // POST /api/auth/reset-password: the token of the link and the new password; the link is used up, every session closed
    async resetPassword(event: H3Event) {
        const { token, password } = await this.body(event)
        if (!token || !password) return ResponseHelper.validationError(event, 'missingFields')

        const keys = [`reset-token-ip:${RequestHelper.ip(event)}`]
        const limit = await RateLimitHelper.check(keys)
        if (limit.locked) return ResponseHelper.tooManyRequests(event, 'tooManyAttempts', limit.retryAfter)

        const reset = await this.fetchOne('SELECT id, user_id, expires_at FROM dc_password_resets WHERE token_hash = ? LIMIT 1', [hashToken(String(token))])
        if (!reset || new Date(reset.expires_at) < new Date()) {
            if (reset) await this.execute('DELETE FROM dc_password_resets WHERE id = ?', [reset.id])
            const locked = await RateLimitHelper.fail(keys, RateLimitHelper.OTP)
            return locked ? ResponseHelper.tooManyRequests(event, 'tooManyAttempts', RateLimitHelper.OTP.lockSeconds) : ResponseHelper.authError(event, 'resetLinkInvalid')
        }
        // Same rule as the change of password of the admin (updatePassword)
        if (String(password).length < 8) return ResponseHelper.validationError(event, 'passwordTooShort')

        await this.execute('DELETE FROM dc_password_resets WHERE user_id = ?', [reset.user_id])
        await this.execute('UPDATE dc_users SET password = ? WHERE id = ?', [await SessionHelper.hashPassword(String(password)), reset.user_id])
        await this.execute('DELETE FROM dc_otp WHERE user_id = ?', [reset.user_id])
        await SessionHelper.destroyAll(reset.user_id)
        await RateLimitHelper.reset(keys)
        return ResponseHelper.success(event, { message: 'passwordResetDone' })
    }

    // POST /api/auth/update-password (admin session)
    async updatePassword(event: H3Event) {
        const { oldPassword, newPassword } = await this.body(event)
        if (!oldPassword || !newPassword) return ResponseHelper.validationError(event, 'missingFields')
        if (newPassword.length < 8) return ResponseHelper.validationError(event, 'passwordTooShort')

        const userId = event.context.userId
        const user = await this.fetchOne('SELECT password FROM dc_users WHERE id = ? LIMIT 1', [userId])
        if (!user) return ResponseHelper.notFound(event, 'userNotFound')
        if (!(await SessionHelper.verifyPassword(oldPassword, user.password))) return ResponseHelper.authError(event, 'invalidOldPassword')

        await this.execute('UPDATE dc_users SET password = ? WHERE id = ?', [await SessionHelper.hashPassword(newPassword), userId])
        return ResponseHelper.success(event, { message: 'passwordUpdated' })
    }
}
