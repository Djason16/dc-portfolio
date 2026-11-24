import type { H3Event } from 'h3'
import { checkSocialLinks } from '~/utils/socialNetworks'
/*
 * Information about the site owner (server/helpers/SettingsHelper.js):
 *   GET    /api/settings         every setting for the admin; the public: the age instead of the birth date, no numbering
 *   PUT    /api/settings         { phone: '...', ... } saved (admin only); socialLinks: [{ network, url, label? }] checked
 *                                 (known network, https, host of the network: utils/socialNetworks.ts), 400 with the wrong index
 *   POST   /api/settings/photo   multipart form: image, the photo of "About me" (replaces the previous one, admin only)
 *   DELETE /api/settings/photo   back to the photo of the site (public/images/about-me.webp, admin only)
 *   GET    /api/settings/area?address=Paris, France   the area shown for this address (Île-de-France, France), admin only
 * The photo is stored by server/helpers/UploadHelper.js, its path saved in the aboutPhoto setting.
 */
export default class SettingsController extends Controller {
    static publicActions = ['getAll']
    static routes = { save: ['PUT', ''], uploadPhoto: ['POST', '/photo'], resetPhoto: ['DELETE', '/photo'], area: ['GET', '/area'] }

    async getAll(event: H3Event) {
        const settings: Record<string, unknown> = await SettingsHelper.all()
        // The public never gets the exact birth date (the site shows the age) nor the numbering of the documents (admin only);
        // the billing address stays: the quotes, invoices and the withdrawal form show it to the clients (legal mentions)
        if (!(await SessionHelper.userId(event))) {
            const birth = new Date(String(settings.birthDate))
            const today = new Date()
            settings.age = Number.isNaN(birth.getTime()) ? ''
                : today.getFullYear() - birth.getFullYear() - (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0)
            delete settings.birthDate
            delete settings.numbering
        }
        return ResponseHelper.success(event, { settings })
    }

    // The area of an address while it is typed in the admin (shown in the form before it is saved)
    async area(event: H3Event) {
        // null: no service answered, the form keeps what it shows
        return ResponseHelper.success(event, { area: await AreaHelper.of(String(RequestHelper.query(event, 'address') ?? '')) })
    }

    async save(event: H3Event) {
        const body = await this.body(event)
        // The photo only changes through /photo (an uploaded image)
        const { aboutPhoto, ...changes } = body && typeof body === 'object' ? body : {}
        // Social links: a list of known networks with the address of their own site, saved as JSON
        if ('socialLinks' in changes) {
            const checked = checkSocialLinks(changes.socialLinks)
            if ('error' in checked) return ResponseHelper.validationError(event, `Invalid social link (${checked.error}, index ${checked.index})`)
            changes.socialLinks = JSON.stringify(checked.links)
        }
        const saved = await SettingsHelper.save(changes)
        if (!saved.length) return ResponseHelper.validationError(event, 'Nothing to save')
        return ResponseHelper.success(event, { settings: await SettingsHelper.all() })
    }

    async uploadPhoto(event: H3Event) {
        const { files } = await RequestHelper.multipart(event)
        if (!files.image) return ResponseHelper.validationError(event, 'No image provided')
        if (!UploadHelper.isAcceptedImage(files.image))
            return ResponseHelper.validationError(event, 'Image must be a JPG, PNG, GIF, WEBP or AVIF file')

        const previous = (await SettingsHelper.all()).aboutPhoto
        const imagePath = await UploadHelper.saveImage(files.image)
        await SettingsHelper.save({ aboutPhoto: imagePath })
        await UploadHelper.removeImage(previous ?? '')
        return ResponseHelper.success(event, { settings: await SettingsHelper.all() })
    }

    async resetPhoto(event: H3Event) {
        const previous = (await SettingsHelper.all()).aboutPhoto
        await SettingsHelper.save({ aboutPhoto: '' })
        await UploadHelper.removeImage(previous ?? '')
        return ResponseHelper.success(event, { settings: await SettingsHelper.all() })
    }
}
