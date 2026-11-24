<template>
    <!-- Zoomable map of the towns (city pages, zone page), drawn by the site: the countries of the world, France and its
         departments (public/map/*.json, loaded only when the map comes into view: no map service, no cookie), a dot per
         town (a link to its page; its name written where it fits, else on hover or focus), the current town in mint and
         the base town marked. Zoom: + / − buttons, Ctrl + wheel, two fingers; drag to move; the frame button comes back -->
    <figure ref="box" class="city-map">
        <div ref="stage" class="city-map__stage" :class="{ 'is-dragging': dragging }" @pointerdown="down" @pointermove="move" @pointerup="up"
            @pointercancel="up" @wheel="wheel">
            <svg v-if="size.width" class="city-map__svg" :viewBox="viewBoxOf(view, size.width, size.height)" preserveAspectRatio="none" aria-hidden="true">
                <path v-for="(d, i) in geo.world" :key="`w${i}`" :d="d" class="city-map__country" />
                <path v-if="geo.france" :d="geo.france.outline" class="city-map__france" />
                <template v-if="geo.france && showDepartments">
                    <path v-for="dep in geo.france.departments" :key="dep.code" :d="dep.path"
                        :class="['city-map__department', { 'is-shown': codes.has(dep.code) }]" />
                </template>
            </svg>

            <span v-for="dep in departmentLabels" :key="dep.code" class="city-map__department-name text-label" aria-hidden="true"
                :style="{ left: `${dep.x}px`, top: `${dep.y}px` }">{{ dep.label }}</span>

            <ul class="city-map__places" :aria-label="label">
                <li v-for="place in placed" :key="place.name" :style="{ left: `${place.x}px`, top: `${place.y}px` }"
                    :class="['city-map__place', `is-${place.side}`, { 'is-current': place.current, 'is-base': place.base, 'has-name': place.labelShown }]">
                    <NuxtLink v-if="place.slug && !place.current" :to="`/creation-site-internet/${place.slug}/`" :title="titleOf(place)" class="city-map__link">
                        <span class="city-map__dot" aria-hidden="true"></span><span class="city-map__name text-body-s">{{ place.name }}</span>
                    </NuxtLink>
                    <span v-else class="city-map__link" tabindex="0" :title="titleOf(place)">
                        <span class="city-map__dot" aria-hidden="true"></span><span class="city-map__name text-body-s">{{ place.name }}</span>
                    </span>
                </li>
            </ul>

            <div class="city-map__controls">
                <IconButton icon="plus" :label="t('cityMapZoomIn')" @click="zoomBy(1.8)" />
                <IconButton icon="minus" :label="t('cityMapZoomOut')" @click="zoomBy(1 / 1.8)" />
                <IconButton icon="fit" :label="t('cityMapReset')" @click="reset" />
            </div>
        </div>
        <figcaption class="city-map__caption text-body-s">
            <span>{{ t('cityMapHelp') }}</span>
            <span class="city-map__credit">{{ t('cityMapCredit') }}</span>
            <slot />
        </figcaption>
    </figure>
</template>

<script setup lang="ts">
import './city-map.css'
import type { PropType } from 'vue'
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import IconButton from '@/components/ui/Button/IconButton.vue'
import { useLang } from '@/composables/useLang'
import { fitView, placeDepartments, placeLabels, viewBoxOf, zoomAt, type MapPlace, type MapView } from '@/utils/cityMap'
import { loadMapData, type MapData } from '@/utils/cityMapData'

const props = defineProps({
    // Every town of the map; current: the town of the page; base: the town of the owner (settings)
    points: { type: Array as PropType<MapPlace[]>, required: true },
    // The towns the first view is fitted on (default: all of them)
    focus: { type: Array as PropType<string[]>, default: () => [] },
    label: { type: String, required: true },
})

const { getTranslation: t } = useLang()
const box = ref<HTMLElement | null>(null)
const stage = ref<HTMLElement | null>(null)
const size = reactive({ width: 0, height: 0 })
const view = ref<MapView>({ cx: 0, cy: 0, scale: 1 })
const geo = shallowRef<MapData>({ world: [], france: null })

const codes = computed(() => new Set(props.points.map(p => p.department_code).filter((code): code is string => Boolean(code))))
// The buttons in the top right corner stay free of names
const placed = computed(() => size.width ? placeLabels(props.points, view.value, size.width, size.height, [{ x1: size.width - 52, x2: size.width, y1: 0, y2: 128 }]) : [])
// Departments drawn once France is big enough on screen, their names once a department is
const showDepartments = computed(() => view.value.scale * 10_000 > size.width * 0.8)
const departmentLabels = computed(() => {
    if (!geo.value.france || view.value.scale < 0.15) return []
    // The names of the towns already written, and every dot, are kept free
    const taken = placed.value.flatMap(p => {
        const dot = { x1: p.x - 8, x2: p.x + 8, y1: p.y - 8, y2: p.y + 8 }
        if (!p.labelShown) return [dot]
        const w = p.name.length * 7.5 + 17
        return [dot, p.side === 'right' ? { x1: p.x, x2: p.x + w, y1: p.y - 10, y2: p.y + 10 } : { x1: p.x - w, x2: p.x, y1: p.y - 10, y2: p.y + 10 }]
    })
    return placeDepartments(geo.value.france.departments, codes.value, view.value, size.width, size.height, taken)
})
const titleOf = (place: MapPlace) => place.current ? place.name : place.base ? t('cityMapBase', { name: place.name }) : t('zoneCityLink', { name: place.name })

const initial = () => {
    const focused = props.focus.length ? props.points.filter(p => props.focus.includes(p.name)) : props.points
    return fitView(focused, size.width, size.height)
}

// Moves smoothly to a view (at once when motion is reduced)
let frame = 0
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const goTo = (target: MapView) => {
    cancelAnimationFrame(frame)
    if (reduced()) return void (view.value = target)
    const from = { ...view.value }
    const start = performance.now()
    const step = (now: number) => {
        const k = Math.min(1, (now - start) / 300)
        const e = 1 - (1 - k) ** 3
        const scale = from.scale * (target.scale / from.scale) ** e
        view.value = { scale, cx: from.cx + (target.cx - from.cx) * e, cy: from.cy + (target.cy - from.cy) * e }
        if (k < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
}
// Once the visitor moved or zoomed, a new size of the box keeps the view; before, the view follows the box
let touched = false
const zoomBy = (factor: number) => (touched = true, goTo(zoomAt(view.value, factor, size.width / 2, size.height / 2, size.width, size.height)))
const reset = () => (touched = false, goTo(initial()))

// Ctrl (or ⌘) + wheel: zoom where the mouse is; the wheel alone scrolls the page
const wheel = (event: WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey) return
    event.preventDefault()
    touched = true
    const rect = stage.value!.getBoundingClientRect()
    view.value = zoomAt(view.value, Math.exp(-event.deltaY * 0.0025), event.clientX - rect.left, event.clientY - rect.top, size.width, size.height)
}

// Drag to move, two fingers to zoom (pointer events; one finger up and down still scrolls the page: touch-action pan-y)
const pointers = new Map<number, { x: number, y: number }>()
const dragging = ref(false)
let pinch = 0
const down = (event: PointerEvent) => {
    if ((event.target as HTMLElement).closest('a, button, [tabindex]')) return
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    stage.value?.setPointerCapture(event.pointerId)
    touched = true
    dragging.value = true
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = Math.hypot(a!.x - b!.x, a!.y - b!.y) }
}
const move = (event: PointerEvent) => {
    const last = pointers.get(event.pointerId)
    if (!last) return
    if (pointers.size === 1) {
        view.value = { ...view.value, cx: view.value.cx - (event.clientX - last.x) / view.value.scale, cy: view.value.cy - (event.clientY - last.y) / view.value.scale }
    }
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.size === 2 && pinch) {
        const [a, b] = [...pointers.values()]
        const distance = Math.hypot(a!.x - b!.x, a!.y - b!.y)
        const rect = stage.value!.getBoundingClientRect()
        view.value = zoomAt(view.value, distance / pinch, (a!.x + b!.x) / 2 - rect.left, (a!.y + b!.y) / 2 - rect.top, size.width, size.height)
        pinch = distance
    }
}
const up = (event: PointerEvent) => {
    pointers.delete(event.pointerId)
    pinch = 0
    dragging.value = pointers.size > 0
}

// The size of the box (reserved by CSS: nothing moves), the first view, and the geography once the map is in view
let resizer: ResizeObserver | null = null
let watcher: IntersectionObserver | null = null
onMounted(() => {
    resizer = new ResizeObserver(([entry]) => {
        size.width = entry!.contentRect.width
        size.height = entry!.contentRect.height
        if (!touched) view.value = initial()
    })
    resizer.observe(stage.value!)
    watcher = new IntersectionObserver(entries => {
        if (!entries.some(entry => entry.isIntersecting)) return
        watcher?.disconnect()
        loadMapData().then(data => { geo.value = data }).catch(() => {})
    }, { rootMargin: '200px' })
    watcher.observe(box.value!)
})
onBeforeUnmount(() => { resizer?.disconnect(); watcher?.disconnect(); cancelAnimationFrame(frame) })
watch(() => props.points, () => { if (size.width) view.value = initial() })
</script>
