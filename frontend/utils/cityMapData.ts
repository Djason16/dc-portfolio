/*
 * Geography of the maps (components/views/City/CityMap.vue): public/map/world.json (countries, Natural Earth 1:110m,
 * public domain) and public/map/france.json (France and its departments, IGN Admin Express via france-geojson, Licence
 * Ouverte), served by the site itself, read once per visit when a map comes into view. Paths already projected
 * (utils/cityMap.ts, scripts/france-map.mjs).
 */
export type MapData = {
    world: string[]
    france: { outline: string, departments: { code: string, name: string, centre: [number, number], path: string }[] } | null
}

let loading: Promise<MapData> | null = null

export const loadMapData = () => loading ??= Promise.all([
    fetch('/map/world.json').then(res => res.ok ? res.json() : { countries: [] }),
    fetch('/map/france.json').then(res => res.ok ? res.json() : null),
]).then(([world, france]) => ({ world: Array.isArray(world?.countries) ? world.countries : [], france: france?.outline ? france : null }))
