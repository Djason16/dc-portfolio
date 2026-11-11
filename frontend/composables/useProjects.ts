import type { ApiResult } from '@/utils/api'
import { computed } from 'vue'
import { useLang } from './useLang'
import { projects as staticProjects } from '@/data/projects'
import { api } from '@/utils/api'
import { compressImage, squareImage, THUMB_SIDE } from '@/utils/compressImage'
import { todayIso } from '@/utils/display'

// Widths of the square copies of a project photo (server/helpers/UploadHelper.ts SQUARE_SIZES)
const SQUARE_SIDES = [320, 640]

/*
 * Projects of the home page: static ones (data/projects.js) and the ones added from the admin page (/api/projects).
 * The list of the API is shared by every component (useState): the home page loads it on the server (pre-rendered HTML)
 * and again in the browser (LastProject.vue), the admin loads it when its modal opens.
 */
export const useProjects = () => {
    const lang = useLang()
    // Projects of the API, as the API sends them
    const apiProjects = useState<Record<string, any>[]>('apiProjects', () => [])

    // Same shape for both kinds; images of the API are served by /api/upload
    const normalize = (p: Record<string, any>, fromApi: boolean) => ({
        id: p.id ?? p.name,
        name: p.name || '',
        img: fromApi && p.img ? `api${p.img}` : p.img || '',
        // Small copy for the grid (640 px); none for the static projects and the photos sent before it existed
        thumb: fromApi && p.thumb ? `api${p.thumb}` : null,
        // Square copies cut like the cards ("<path> 320w, <path> 640w"), the browser takes the one of the size of the card
        srcset: srcsetOf(p.squares, fromApi ? 'api' : ''),
        link: p.link || null,
        skills: Array.isArray(p.skills) ? p.skills : [],
        date: p.date || todayIso(),
        short_fr: fromApi ? p.short_fr : null,
        short_en: fromApi ? p.short_en : null,
        // Short description in the current language (static projects: a translation key)
        short: fromApi ? (lang.current.value === 'en' ? p.short_en : p.short_fr) : lang.getTranslation(p.short || ''),
    })

    // Square copies { 320: path, 640: path } -> srcset of the card (static projects: their paths in data/projects.ts)
    const srcsetOf = (squares: Record<string, string> | null | undefined, prefix: string) =>
        squares ? Object.entries(squares).map(([width, path]) => `${prefix}${path} ${width}w`).join(', ') : undefined

    // Every project, most recent first
    const projects = computed(() => [
        ...staticProjects.map(p => normalize(p, false)),
        ...apiProjects.value.map(p => normalize(p, true)),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()))

    // Projects of the API (the static ones stay when the API cannot be reached)
    const fetchProjects = async () => {
        const res = await api.get('/projects')
        if (res.success) apiProjects.value = res.projects
        else console.warn('Projects of the API not loaded:', res.error)
    }

    // Project -> form data sent to the API, with its photo made light (1920 px) and its thumbnail (640 px).
    // No thumbnail when the browser can't make it lighter than the photo itself (a GIF, a small image)
    const createFormData = async (project: Record<string, any>, imageFile = null) => {
        const fd = new FormData()
        ;['id', 'name', 'short_fr', 'short_en', 'link', 'date'].forEach(k => project[k] && fd.append(k, project[k]))
        if (project.skills) fd.append('skills', Array.isArray(project.skills) ? JSON.stringify(project.skills) : project.skills)
        if (imageFile) {
            const [image, thumb] = await Promise.all([compressImage(imageFile), compressImage(imageFile, THUMB_SIDE)])
            fd.append('image', image)
            if (thumb !== imageFile && thumb.size < image.size) fd.append('thumb', thumb)
            await appendSquares(fd, imageFile)
        }
        return fd
    }

    // Square copies of a photo (320 and 640 px) added to a form; none when the browser can't make them (a GIF)
    const appendSquares = async (fd: FormData, file: Blob) => {
        const squares = await Promise.all(SQUARE_SIDES.map(side => squareImage(file, side)))
        if (squares.every(Boolean)) squares.forEach((square, i) => fd.append(`thumb${SQUARE_SIDES[i]}`, square!))
        return squares.every(Boolean)
    }

    // Photos sent before the square copies existed: made once by the admin's browser from the photo on the server
    // (called when the list of the admin opens; the home page uses the plain thumbnail until then)
    const completeSquares = async () => {
        for (const project of apiProjects.value.filter(p => p.img && !p.squares)) {
            const photo = await fetch(`${useRuntimeConfig().app.baseURL}api${project.img}`).then(res => (res.ok ? res.blob() : null)).catch(() => null)
            const fd = new FormData()
            if (!photo || !(await appendSquares(fd, photo))) continue
            const res = await api.post(`/projects/${project.id}/thumbs`, fd)
            if (res.success) patch(project.id, { squares: res.squares })
        }
    }

    // Changes a project of the local list (no new request)
    const patch = (id: string, changes: Record<string, unknown>) => {
        apiProjects.value = apiProjects.value.map(p => p.id === id ? { ...p, ...changes } : p)
    }

    // Adds a project from the admin page
    const addProject = async (project: Record<string, any>, imageFile = null) => {
        const res = await api.post('/projects', await createFormData(project, imageFile))
        if (res.success) apiProjects.value = [...apiProjects.value, { ...project, id: res.id, img: res.imagePath || project.img, thumb: res.thumbPath, squares: res.squares }]
        else console.error('Project creation failed', res.error)
        return res
    }

    // Saves a new image and / or changed fields of a project
    const updateProject = async (id: string, updates = {}, imageFile = null) => {
        let res: ApiResult = { success: false, error: 'Nothing to update' }
        if (imageFile) {
            res = await api.post(`/projects/${id}/image`, await createFormData({}, imageFile))
            if (res.success) patch(id, { img: res.imagePath, thumb: res.thumbPath, squares: res.squares })
        }
        if (Object.keys(updates).length) {
            res = await api.put(`/projects/${id}`, updates)
            if (res.success) patch(id, updates)
        }
        if (!res.success) console.error('Project update failed', res.error)
        return res
    }

    // Deletes a project
    const removeProject = async (id: string) => {
        const res = await api.delete(`/projects/${id}`)
        if (res.success) apiProjects.value = apiProjects.value.filter(p => p.id !== id)
        else console.error('Project deletion failed', res.error)
        return res
    }

    // Fields of the creation form
    const projectFields = [
        { id: 'name', labelKey: 'projectName', placeholderKey: 'enterProjectName', type: 'text', required: true },
        { id: 'short_fr', labelKey: 'projectShortFr', placeholderKey: 'enterShortDescriptionFr', type: 'text', required: true },
        { id: 'short_en', labelKey: 'projectShortEn', placeholderKey: 'enterShortDescriptionEn', type: 'text', required: true },
        { id: 'img', labelKey: 'projectImage', placeholderKey: 'selectImage', type: 'file', accept: '.jpg,.jpeg,.png,.gif,.webp,.avif' },
        { id: 'link', labelKey: 'projectLink', placeholderKey: 'enterLink', type: 'text' },
        { id: 'skills', labelKey: 'projectSkills', placeholderKey: 'enterSkills', type: 'text' },
        { id: 'date', labelKey: 'projectDate', placeholderKey: 'enterDate', type: 'date' },
    ]

    return { projects, fetchProjects, completeSquares, addProject, updateProject, removeProject, projectFields }
}
