<template>
    <!-- Questions and answers as an accordion: a full-width row per question (its button, a « + » turning into « × »), the
         answer opening in height and opacity. One open at a time, all closed at first. Every answer stays in the HTML
         (closed by CSS only): search engines and the FAQPage JSON-LD read them. Rows rise one after the other (v-reveal). -->
    <ol class="faq-list">
        <li v-for="(item, i) in items" :key="i" v-reveal class="faq-list__item" :class="{ 'is-open': open === i }"
            :style="{ '--reveal-delay': `calc(var(--reveal-stagger) * ${i % 8})` }">
            <component :is="headingTag" class="faq-list__heading">
                <button :id="`${idPrefix}-q${i}`" type="button" class="faq-list__button" :aria-expanded="open === i"
                    :aria-controls="`${idPrefix}-a${i}`" @click="toggle(i)">
                    <span class="faq-list__number eyebrow" aria-hidden="true">{{ padIndex(i) }}</span>
                    <span class="faq-list__question text-display-s">{{ item.q }}</span>
                    <span class="faq-list__icon" aria-hidden="true"></span>
                </button>
            </component>
            <div :id="`${idPrefix}-a${i}`" class="faq-list__panel" role="region" :aria-labelledby="`${idPrefix}-q${i}`">
                <div class="faq-list__inner">
                    <p class="faq-list__answer text-body">{{ item.a }}</p>
                </div>
            </div>
        </li>
    </ol>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { ref } from 'vue'
import { padIndex } from '@/utils/display'

defineProps({
    // [{ q: 'Question ?', a: 'Answer.' }]
    items: { type: Array as PropType<{ q: string, a: string }[]>, required: true },
    // Tag around each question (h3 under the h2 of its section)
    headingTag: { type: String, default: 'h3' },
    // Start of the ids of the buttons and answers (unique on the page)
    idPrefix: { type: String, default: 'faq' },
})

// The open question (-1: none); a click on the open one closes it
const open = ref(-1)
const toggle = (index: number) => { open.value = open.value === index ? -1 : index }
</script>

<style scoped>
.faq-list {
    margin: 0;
    padding: 0;
    list-style: none;
    border-top: 1px solid var(--line);
}

.faq-list__item {
    border-bottom: 1px solid var(--line);
}

.faq-list__heading {
    margin: 0;
}

/* The whole row is the button: number, question, icon */
.faq-list__button {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 1.25rem;
    width: 100%;
    min-height: 44px;
    padding: 1.4rem 0.25rem;
    border: none;
    background: none;
    color: var(--fg);
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition: color var(--motion-fast) var(--ease);
}

.faq-list__button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
}

.faq-list__number {
    color: var(--fg-muted);
    transition: color var(--motion-fast) var(--ease);
}

.faq-list__question {
    text-wrap: pretty;
}

/* « + » drawn with two lines: turns into « × » when open */
.faq-list__icon {
    position: relative;
    width: 1.25rem;
    height: 1.25rem;
    color: var(--accent);
    transition: transform var(--motion-base) var(--ease);
}

.faq-list__icon::before,
.faq-list__icon::after {
    content: "";
    position: absolute;
    top: 50%;
    left: 0;
    width: 100%;
    height: 2px;
    margin-top: -1px;
    background: currentColor;
}

.faq-list__icon::after {
    transform: rotate(90deg);
}

.is-open .faq-list__icon {
    transform: rotate(135deg);
}

.is-open .faq-list__number,
.is-open .faq-list__question {
    color: var(--accent);
}

/* The answer opens in height (grid 0fr -> 1fr) and in opacity; closed, it stays in the page but hidden */
.faq-list__panel {
    display: grid;
    grid-template-rows: 0fr;
    opacity: 0;
    visibility: hidden;
    transition: grid-template-rows var(--motion-base) var(--ease), opacity var(--motion-base) var(--ease), visibility 0s linear var(--motion-base);
}

.is-open .faq-list__panel {
    grid-template-rows: 1fr;
    opacity: 1;
    visibility: visible;
    transition-delay: 0s;
}

.faq-list__inner {
    min-height: 0;
    overflow: hidden;
}

.faq-list__answer {
    max-width: 75ch;
    margin: 0;
    padding: 0 2.75rem 1.6rem calc(1.25rem + 2ch);
    color: var(--fg-muted);
}

@media (hover: hover) and (pointer: fine) {
    .faq-list__button:hover,
    .faq-list__button:hover .faq-list__number {
        color: var(--accent);
    }
}

@media (max-width: 600px) {
    .faq-list__button {
        gap: 0.9rem;
        padding: 1.1rem 0;
    }

    .faq-list__answer {
        padding: 0 0 1.3rem;
    }
}

@media (prefers-reduced-motion: reduce) {
    .faq-list__panel,
    .faq-list__icon,
    .faq-list__button {
        transition: none;
    }
}
</style>
