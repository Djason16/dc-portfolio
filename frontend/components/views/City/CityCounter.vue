<template>
    <!-- A figure that counts up from 0 when it comes on screen (the final value is in the HTML: search engines and screen
         readers read it, nothing moves when motion is reduced). Text that is not a number is shown as it is -->
    <!-- The final value keeps its place (hidden, in the same cell): the text never changes width while it counts -->
    <span ref="el" class="city-counter"><span class="city-counter__size" aria-hidden="true">{{ value }}</span><span class="city-counter__live">{{ shown }}</span></span>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { motionMs } from '@/utils/motion'
import { formatNumber } from '@/utils/cities/cityText'

const props = defineProps({ value: { type: String, required: true } })

// "+ 11 064" -> prefix "+ ", number 11064, suffix ""; "13 km" -> "", 13, " km"; "Oise (60)" -> no number
const parts = computed(() => {
    const match = props.value.match(/^([^\d]*)(\d[\d\s]*)(.*)$/)
    return match ? { prefix: match[1] ?? '', number: Number((match[2] ?? '').replace(/\s/g, '')), suffix: match[3] ?? '' } : null
})
const current = ref<number | null>(null)
const shown = computed(() => parts.value && current.value !== null ? `${parts.value.prefix}${formatNumber(current.value)}${parts.value.suffix}` : props.value)

const el = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null
let frame = 0

const run = () => {
    const target = parts.value?.number ?? 0
    const duration = motionMs('slow') * 2
    const start = performance.now()
    const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration)
        current.value = Math.round(target * (1 - (1 - t) ** 3))
        if (t < 1) frame = requestAnimationFrame(step)
        else current.value = null
    }
    current.value = 0
    frame = requestAnimationFrame(step)
}

onMounted(() => {
    if (!parts.value || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !el.value) return
    observer = new IntersectionObserver(entries => {
        if (!entries.some(entry => entry.isIntersecting)) return
        observer?.disconnect()
        run()
    }, { threshold: 0.6 })
    observer.observe(el.value)
})
onBeforeUnmount(() => { observer?.disconnect(); cancelAnimationFrame(frame) })
</script>

<style scoped>
/* Figures of the same width while they count: the text does not jump */
.city-counter {
    display: inline-grid;
    font-variant-numeric: tabular-nums;
}

.city-counter__size,
.city-counter__live {
    grid-area: 1 / 1;
}

.city-counter__size {
    visibility: hidden;
}
</style>
