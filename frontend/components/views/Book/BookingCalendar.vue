<!-- Month of the booking page: the days with free slots can be picked (mint dot), the others are greyed.
Keyboard: Tab goes to the picked day, the arrows move by a day (left / right) or a week (up / down), Enter picks. -->
<template>
    <div class="booking-calendar" :aria-busy="loading">
        <div class="booking-calendar__head">
            <IconButton icon="chevron-left" :label="t('bookPrevMonth')" :disabled="!canPrev" @click="emit('move', -1)" />
            <p class="booking-calendar__month text-display-xs" aria-live="polite">{{ monthTitle(year, month, lang.current.value) }}</p>
            <IconButton icon="chevron-right" :label="t('bookNextMonth')" :disabled="!canNext" @click="emit('move', 1)" />
        </div>

        <div class="booking-calendar__grid" role="group" :aria-label="t('bookPickDay')" @keydown="onKey">
            <span v-for="name in weekDays(lang.current.value)" :key="name.long" class="booking-calendar__weekday text-label" aria-hidden="true">{{ name.short.slice(0, 2) }}</span>
            <template v-for="(cell, i) in cells" :key="cell.key">
                <span v-if="!cell.inMonth" class="booking-calendar__blank" aria-hidden="true"></span>
                <button v-else ref="dayButtons" type="button" class="booking-calendar__day text-body" :data-index="i"
                    :class="{ 'is-free': counts[cell.key], 'is-selected': cell.key === selected }" :disabled="!counts[cell.key]"
                    :tabindex="cell.key === focusKey ? 0 : -1" :aria-pressed="cell.key === selected"
                    :aria-label="`${longDay(cell.key, lang.current.value)}, ${counts[cell.key] ? t('bookFreeCount', { count: counts[cell.key] ?? 0 }) : t('bookNoFree')}`"
                    @click="emit('select', cell.key)">
                    {{ cell.day }}
                </button>
            </template>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { computed, nextTick, ref } from 'vue'
import IconButton from '@/components/ui/Button/IconButton.vue'
import { useLang } from '@/composables/useLang'
import { longDay, monthGrid, monthTitle, weekDays } from '@/utils/booking'

const props = defineProps({
    year: { type: Number, required: true },
    month: { type: Number, required: true },
    // Free slots per day: { '2026-11-20': 6 }
    counts: { type: Object as PropType<Record<string, number>>, required: true },
    selected: { type: String, default: '' },
    loading: Boolean,
    canPrev: Boolean,
    canNext: Boolean,
})
const emit = defineEmits<{ select: [key: string], move: [step: number] }>()

const lang = useLang()
const t = lang.getTranslation

const cells = computed(() => monthGrid(props.year, props.month))
// The day reached with Tab: the picked one, else the first free one
const focusKey = computed(() => (props.selected && props.counts[props.selected] ? props.selected : cells.value.find(c => c.inMonth && props.counts[c.key])?.key ?? ''))

// Arrows: the next free day in the direction asked (a day or a week), its button focused and picked
const dayButtons = ref<HTMLButtonElement[]>([])
const STEPS: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
const onKey = async (event: KeyboardEvent) => {
    const step = STEPS[event.key]
    const from = Number((event.target as HTMLElement).dataset.index)
    if (!step || Number.isNaN(from)) return
    event.preventDefault()
    for (let i = from + step; i >= 0 && i < cells.value.length; i += step) {
        const cell = cells.value[i]!
        if (!cell.inMonth || !props.counts[cell.key]) continue
        emit('select', cell.key)
        await nextTick()
        dayButtons.value.find(button => Number(button.dataset.index) === i)?.focus()
        return
    }
}
</script>

<style scoped>
.booking-calendar {
    min-width: 0;
}

.booking-calendar__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 1rem;
}

.booking-calendar__month {
    margin: 0;
    text-align: center;
}

/* Seven columns that shrink with the screen (320 px: about 40 px a day) */
.booking-calendar__grid {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 0.3rem;
}

.booking-calendar__weekday {
    padding-bottom: 0.4rem;
    color: var(--fg-muted);
    text-align: center;
    letter-spacing: 0.1em;
}

.booking-calendar__day {
    position: relative;
    display: grid;
    place-items: center;
    min-width: 0;
    aspect-ratio: 1;
    max-height: 3.25rem;
    width: 100%;
    padding: 0;
    border: 1px solid transparent;
    background: transparent;
    color: var(--fg-muted);
    opacity: 0.45;
    font-variant-numeric: tabular-nums;
    cursor: default;
    transition: background-color var(--motion-fast) var(--ease), border-color var(--motion-fast) var(--ease), color var(--motion-fast) var(--ease);
}

/* A day with free slots: light, with a mint dot under its number */
.booking-calendar__day.is-free {
    border-color: var(--line);
    background: var(--panel);
    color: var(--fg);
    opacity: 1;
    cursor: pointer;
}

.booking-calendar__day.is-free::after {
    content: "";
    position: absolute;
    bottom: 18%;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--accent);
}

.booking-calendar__day.is-selected {
    border-color: var(--accent);
    background: var(--accent);
    color: var(--ink-900);
    font-weight: 600;
}

.booking-calendar__day.is-selected::after {
    background: var(--ink-900);
}

.booking-calendar__day:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
}

@media (hover: hover) and (min-width: 1025px) {
    .booking-calendar__day.is-free:not(.is-selected):hover {
        border-color: var(--accent);
        color: var(--accent);
    }
}

/* Short screens (a phone turned): flatter days, the month fits in the height */
@media (max-height: 480px) {
    .booking-calendar__day {
        aspect-ratio: auto;
        height: 2.4rem;
    }
}
</style>
