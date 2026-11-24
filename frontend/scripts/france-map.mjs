// Writes public/map/france.json (the outline of metropolitan France and its departments) and public/map/world.json (the
// countries of the world, low resolution), simplified and projected for the maps of the city pages and the zone page
// (components/views/City/CityMap.vue), loaded only when a map comes into view: no map service is ever called.
// Sources: france-geojson (Grégoire David, https://github.com/gregoiredavid/france-geojson), from IGN Admin Express COG,
// Licence Ouverte (Etalab); Natural Earth 1:110m countries (https://www.naturalearthdata.com, public domain).
// Run once, again only to change the precision:
//   node scripts/france-map.mjs <departements-version-simplifiee.geojson> <metropole-version-simplifiee.geojson> <ne_110m_admin_0_countries.geojson>
// Projection (the same in CityMap.vue): x = longitude × cos(46.5°) × 1000, y = −latitude × 1000 (rounded to the unit, ~100 m)
import { readFileSync, writeFileSync } from 'node:fs'

const [departmentsFile, outlineFile, worldFile] = process.argv.slice(2)
if (!departmentsFile || !outlineFile) throw new Error('Usage: node scripts/france-map.mjs <departements.geojson> <metropole.geojson>')
const K = Math.cos(46.5 * Math.PI / 180)
const SCALE = 1000
// Douglas-Peucker tolerance in projected units (about 1 km), smaller rings than this left out
let TOLERANCE = 9
let MIN_RING = 25

const project = ([lng, lat]) => [Math.round(lng * K * SCALE), Math.round(-lat * SCALE)]

// Douglas-Peucker; a closed ring (first point = last point) is cut in two at its point farthest from the first one
const simplify = (points) => {
    if (points.length < 3) return points
    const [fx, fy] = points[0], [lx, ly] = points[points.length - 1]
    if (fx === lx && fy === ly) {
        let far = 0, index = 1
        points.forEach(([x, y], i) => { const d = Math.hypot(x - fx, y - fy); if (d > far) far = d, index = i })
        if (index > 0 && index < points.length - 1) return [...simplify(points.slice(0, index + 1)).slice(0, -1), ...simplify(points.slice(index))]
    }
    const keep = new Uint8Array(points.length)
    keep[0] = keep[points.length - 1] = 1
    const stack = [[0, points.length - 1]]
    while (stack.length) {
        const [a, b] = stack.pop()
        const [ax, ay] = points[a], [bx, by] = points[b]
        const length = Math.hypot(bx - ax, by - ay) || 1
        let far = -1, index = 0
        for (let i = a + 1; i < b; i++) {
            const [px, py] = points[i]
            const distance = Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / length
            if (distance > far) far = distance, index = i
        }
        if (far > TOLERANCE) keep[index] = 1, stack.push([a, index], [index, b])
    }
    return points.filter((_, i) => keep[i])
}

// A ring as an SVG path, in relative moves (smaller); null when it is too small to be seen
const ringPath = (ring) => {
    const points = simplify(ring.map(project))
    const xs = points.map((p) => p[0]), ys = points.map((p) => p[1])
    if (points.length < 4 || Math.max(...xs) - Math.min(...xs) + Math.max(...ys) - Math.min(...ys) < MIN_RING) return null
    let path = `M${points[0][0]} ${points[0][1]}`
    for (let i = 1; i < points.length; i++) path += `l${points[i][0] - points[i - 1][0]} ${points[i][1] - points[i - 1][1]}`
    return `${path}z`
}
const geometryPath = (geometry) => {
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
    return polygons.flatMap((polygon) => polygon.map(ringPath)).filter(Boolean).join('')
}
// Centre of a department (middle of its box, enough for a label)
const centreOf = (geometry) => {
    const points = (geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates).flat(2).map(project)
    const xs = points.map((p) => p[0]), ys = points.map((p) => p[1])
    return [Math.round((Math.min(...xs) + Math.max(...xs)) / 2), Math.round((Math.min(...ys) + Math.max(...ys)) / 2)]
}

const departments = JSON.parse(readFileSync(departmentsFile, 'utf8')).features
    .filter((feature) => !/^97/.test(feature.properties.code))
    .map((feature) => ({ code: feature.properties.code, name: feature.properties.nom, centre: centreOf(feature.geometry), path: geometryPath(feature.geometry) }))
const outlineData = JSON.parse(readFileSync(outlineFile, 'utf8'))
const outline = (outlineData.features ?? [outlineData]).map((feature) => geometryPath(feature.geometry)).join('')

const data = { source: 'IGN Admin Express COG via france-geojson (Grégoire David), Licence Ouverte (Etalab)', k: K, scale: SCALE, outline, departments }
writeFileSync('public/map/france.json', JSON.stringify(data))
console.log(`france-map: ${departments.length} departments, ${(JSON.stringify(data).length / 1024).toFixed(0)} KB -> public/map/france.json`)

// The world: much coarser (about 4 km, islands under ~30 km left out), metropolitan France drawn again from the file above
if (worldFile) {
    TOLERANCE = 40
    MIN_RING = 300
    const countries = JSON.parse(readFileSync(worldFile, 'utf8')).features
        .filter((feature) => feature.properties.ADM0_A3 !== 'ATA')
        .map((feature) => geometryPath(feature.geometry)).filter(Boolean)
    const world = { source: 'Natural Earth 1:110m (public domain)', k: K, scale: SCALE, countries }
    writeFileSync('public/map/world.json', JSON.stringify(world))
    console.log(`france-map: ${countries.length} countries, ${(JSON.stringify(world).length / 1024).toFixed(0)} KB -> public/map/world.json`)
}
