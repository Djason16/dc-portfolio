/*
 * Maths of the zoomable map of the city pages and the zone page (components/views/City/CityMap.vue): the projection
 * (the same as public/map/*.json, scripts/france-map.mjs), the view (centre and scale), and the names that fit.
 *   x = longitude × cos(46.5°) × 1000, y = −latitude × 1000 (map units); screen = (unit − centre) × scale + half the box
 */
export const K = Math.cos(46.5 * Math.PI / 180)
export const UNITS = 1000

export type MapPlace = { name: string, slug?: string, lat: number | null, lng: number | null, population?: number | null, department_code?: string, current?: boolean, base?: boolean }
export type MapView = { cx: number, cy: number, scale: number }
export type PlacedLabel = MapPlace & { x: number, y: number, labelShown: boolean, side: 'right' | 'left' | 'below' }

export const project = (lng: number, lat: number): [number, number] => [lng * K * UNITS, -lat * UNITS]

// The whole world fits in the box at the smallest scale; the biggest separates two towns 1 km apart by about 40 px
export const minScale = (width: number) => width / (360 * K * UNITS)
export const MAX_SCALE = 6

export const clampScale = (scale: number, width: number) => Math.min(MAX_SCALE, Math.max(minScale(width), scale))

/** The view that shows these places (with a margin), never closer than about 10 km across. */
export const fitView = (places: MapPlace[], width: number, height: number): MapView => {
    const points = places.filter(p => p.lat !== null && p.lng !== null).map(p => project(p.lng!, p.lat!))
    if (!points.length) return { cx: 2.35 * K * UNITS, cy: -46.6 * UNITS, scale: width / (12 * K * UNITS) }
    const xs = points.map(p => p[0]), ys = points.map(p => p[1])
    const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
    const spanX = Math.max(maxX - minX, 90), spanY = Math.max(maxY - minY, 90)
    // Room for the names on the sides and above/below
    const scale = Math.min((width - 160) / spanX, (height - 80) / spanY)
    return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, scale: clampScale(Math.max(scale, minScale(width)), width) }
}

export const toScreen = (view: MapView, width: number, height: number, [x, y]: [number, number]) =>
    [(x - view.cx) * view.scale + width / 2, (y - view.cy) * view.scale + height / 2] as const

/** viewBox of the SVG for a view. */
export const viewBoxOf = (view: MapView, width: number, height: number) =>
    `${view.cx - width / 2 / view.scale} ${view.cy - height / 2 / view.scale} ${width / view.scale} ${height / view.scale}`

/** A view zoomed by a factor around a point of the box (px), staying within the scales. */
export const zoomAt = (view: MapView, factor: number, px: number, py: number, width: number, height: number): MapView => {
    const scale = clampScale(view.scale * factor, width)
    // The map point under (px, py) stays under it
    const mx = view.cx + (px - width / 2) / view.scale
    const my = view.cy + (py - height / 2) / view.scale
    return { scale, cx: mx - (px - width / 2) / scale, cy: my - (py - height / 2) / scale }
}

// Width of a name on screen (text-body-s of the site, about 7.5 px a letter) and height of its line
const LETTER = 7.5
const LINE = 20
export type Box = { x1: number, x2: number, y1: number, y2: number }
const overlaps = (a: Box, b: Box) => a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2

/**
 * Every place on screen, and whether its name is written: the current town and the base first, then the biggest towns;
 * a name is written only where it touches no other name nor dot, on the right of its dot, else on its left, else under it.
 */
export const placeLabels = (places: MapPlace[], view: MapView, width: number, height: number, reserved: Box[] = []): PlacedLabel[] => {
    const shown = places.filter(p => p.lat !== null && p.lng !== null)
        .map(p => { const [x, y] = toScreen(view, width, height, project(p.lng!, p.lat!)); return { ...p, x, y } })
        .filter(p => p.x > -20 && p.x < width + 20 && p.y > -20 && p.y < height + 20)
    const rank = (p: MapPlace) => (p.current ? 2e9 : 0) + (p.base ? 1e9 : 0) + (p.population ?? 0)
    const ordered = [...shown].sort((a, b) => rank(b) - rank(a))
    const taken: Box[] = [...reserved, ...shown.map(p => ({ x1: p.x - 6, x2: p.x + 6, y1: p.y - 6, y2: p.y + 6 }))]
    return ordered.map(p => {
        const w = p.name.length * LETTER + 8
        const right: Box = { x1: p.x + 9, x2: p.x + 9 + w, y1: p.y - LINE / 2, y2: p.y + LINE / 2 }
        const left: Box = { x1: p.x - 9 - w, x2: p.x - 9, y1: p.y - LINE / 2, y2: p.y + LINE / 2 }
        const inside = (b: Box) => b.x1 >= 2 && b.x2 <= width - 2 && b.y1 >= 2 && b.y2 <= height - 2
        const free = (b: Box) => inside(b) && !taken.some(t => overlaps(t, b))
        const below: Box = { x1: p.x - w / 2, x2: p.x + w / 2, y1: p.y + 8, y2: p.y + 8 + LINE }
        const side = free(right) ? 'right' : free(left) ? 'left' : free(below) ? 'below' : null
        if (side) taken.push(side === 'right' ? right : side === 'left' ? left : below)
        return { ...p, labelShown: Boolean(side), side: side ?? 'right' }
    })
}

/** Names of the departments that fit, at their centre (only the departments of the places, once zoomed near). */
export const placeDepartments = (departments: { code: string, name: string, centre: [number, number] }[], codes: Set<string>,
    view: MapView, width: number, height: number, taken: Box[] = []) => departments
    .filter(d => codes.has(d.code))
    .map(d => { const [x, y] = toScreen(view, width, height, d.centre); return { ...d, x, y, label: `${d.name} (${d.code})` } })
    .filter(d => {
        const w = d.label.length * LETTER
        const box: Box = { x1: d.x - w / 2, x2: d.x + w / 2, y1: d.y - LINE / 2, y2: d.y + LINE / 2 }
        if (box.x1 < 2 || box.x2 > width - 2 || box.y1 < 2 || box.y2 > height - 2 || taken.some(t => overlaps(t, box))) return false
        taken.push(box)
        return true
    })

/** The towns of a map with the base town marked (added when it has no page of its own). */
export const withBase = (places: MapPlace[], base: { name: string, lat: number, lng: number } | null | undefined): MapPlace[] => {
    if (!base) return places
    const marked = places.map(p => p.name === base.name ? { ...p, base: true } : p)
    return marked.some(p => p.base) ? marked : [...marked, { name: base.name, lat: base.lat, lng: base.lng, base: true }]
}
