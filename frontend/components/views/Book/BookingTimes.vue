<!-- Free hours of the picked day, on the clock of the visitor: one button per start, the picked one in mint -->
<template>
    <div class="booking-times" aria-live="polite">
        <p v-if="loading" class="booking-times__note text-body-s">{{ t('bookLoadingSlots') }}</p>
        <p v-else-if="monthEmpty" class="booking-times__note text-body-s">{{ t('bookNoSlotsMonth') }}</p>
        <template v-else-if="day">
            <p :id="labelId" class="booking-times__day text-display-xs">{{ longDay(day, lang.current.value) }}</p>
            <ul class="booking-times__list" :aria-labelledby="labelId">
                <li v-for="iso in slots" :key="iso">
                    <button type="button" class="booking-times__slot text-label" :class="{ 'is-selected': iso === selected }" :aria-pressed="iso === selected"
                        @click="emit('select', iso)">
                        {{ timeOf(iso, lang.current.value, zone) }}
                    </button>
                </li>
            </ul>
        </template>
        <p v-else class="booking-times__note text-body-s">{{ t('bookPickDay') }}</p>
    </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { useLang } from '@/composables/useLang'
import { longDay, timeOf } from '@/utils/booking'

defineProps({
    // 'YYYY-MM-DD' of the visitor, empty before a day is picked
    day: { type: String, default: '' },
    slots: { type: Array as PropType<string[]>, required: true },
    selected: { type: String, default: '' },
    zone: { type: String, required: true },
    loading: Boolean,
    monthEmpty: Boolean,
})
const emit = defineEmits<{ select: [iso: string] }>()

const lang = useLang()
const t = lang.getTranslation
const labelId = 'booking-times-day'
</script>

<style scoped>
.booking-times {
    min-width: 0;
}

.booking-times__note,
.booking-times__day {
    margin: 0 0 1rem;
}

.booking-times__note {
    color: var(--fg-muted);
}

/* As many hours per line as fit, never narrower than the text */
.booking-times__list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(5.5rem, 1fr));
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
}

.booking-times__slot {
    width: 100%;
    min-height: 2.75rem;
    padding: 0.5rem;
    border: 1px solid var(--line);
    background: var(--panel);
    color: var(--fg);
    letter-spacing: 0.12em;
    cursor: pointer;
    transition: background-color var(--motion-fast) var(--ease), border-color var(--motion-fast) var(--ease), color var(--motion-fast) var(--ease);
}

.booking-times__slot.is-selected {
    border-color: var(--accent);
    background: var(--accent);
    color: var(--ink-900);
}

.booking-times__slot:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
}

@media (hover: hover) and (min-width: 1025px) {
    .booking-times__slot:not(.is-selected):hover {
        border-color: var(--accent);
        color: var(--accent);
    }
}
</style>
