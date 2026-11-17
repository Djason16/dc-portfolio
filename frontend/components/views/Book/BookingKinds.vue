<!-- Step 1 of the booking page: the kinds of appointment as cards to pick (a group of radio buttons: arrows and Tab work) -->
<template>
    <fieldset class="booking-kinds">
        <legend class="booking-kinds__title eyebrow">01 · {{ t('bookStepKind') }}</legend>
        <div class="booking-kinds__list">
            <label v-for="kind in kinds" :key="kind.id" class="booking-kind" :class="{ 'is-selected': model === kind.id }">
                <input v-model="model" class="booking-kind__radio" type="radio" name="booking-kind" :value="kind.id" />
                <span class="booking-kind__icon" aria-hidden="true"><i :class="MODE_ICONS[kind.mode]"></i></span>
                <span class="booking-kind__body">
                    <span class="booking-kind__name text-display-xs">{{ kindName(kind, lang.current.value) }}</span>
                    <span class="booking-kind__meta text-label">{{ t('bookMinutes', { minutes: kind.duration }) }} · {{ t(MODE_KEYS[kind.mode] ?? '') }}</span>
                    <span v-if="kindDescription(kind, lang.current.value)" class="booking-kind__text text-body-s">{{ kindDescription(kind, lang.current.value) }}</span>
                </span>
            </label>
        </div>
    </fieldset>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { useLang } from '@/composables/useLang'
import { type BookingKind, MODE_ICONS, MODE_KEYS, kindDescription, kindName } from '@/utils/booking'

defineProps({ kinds: { type: Array as PropType<BookingKind[]>, required: true } })
const model = defineModel<string>({ default: '' })

const lang = useLang()
const t = lang.getTranslation
</script>

<style scoped>
.booking-kinds {
    min-width: 0;
    margin: 0;
    padding: 0;
    border: none;
}

.booking-kinds__title {
    margin-bottom: 1.25rem;
    padding: 0;
}

.booking-kinds__list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 1fr));
    gap: 1rem;
}

/* A card: its icon, its name, how long and how; the picked one with a mint line */
.booking-kind {
    position: relative;
    display: flex;
    gap: 1rem;
    min-width: 0;
    padding: 1.25rem;
    border: 1px solid var(--line);
    background: var(--panel);
    cursor: pointer;
    transition: border-color var(--motion-fast) var(--ease), background-color var(--motion-fast) var(--ease);
}

.booking-kind.is-selected {
    border-color: var(--accent);
    background: rgba(126, 230, 168, 0.08);
}

/* The real radio button stays for the keyboard and screen readers, drawn by the card */
.booking-kind__radio {
    position: absolute;
    opacity: 0;
    width: 1px;
    height: 1px;
}

.booking-kind:has(.booking-kind__radio:focus-visible) {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
}

.booking-kind__icon {
    flex: none;
    display: grid;
    place-items: center;
    width: 2.5rem;
    height: 2.5rem;
    border: 1px solid var(--line);
    color: var(--accent);
}

.booking-kind__body {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    min-width: 0;
}

.booking-kind__meta {
    color: var(--accent);
}

.booking-kind__text {
    color: var(--fg-muted);
}

@media (hover: hover) and (pointer: fine) {
    .booking-kind:hover {
        border-color: rgba(126, 230, 168, 0.5);
    }
}

/* Very narrow phones: the icon above the name, the card keeps its whole width for the text */
@media (max-width: 360px) {
    .booking-kind {
        flex-direction: column;
        gap: 0.75rem;
        padding: 1rem;
    }
}
</style>
