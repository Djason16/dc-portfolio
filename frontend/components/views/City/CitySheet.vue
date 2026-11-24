<!-- City page « fiche de ville » (direction A, chosen by Djason on 2026-11-24): an editorial sheet. The town name very large
     and the ribbon of figures (CitySheetHero), then a magazine grid: each part has its number, icon and label in a narrow
     column that stays in sight, its text in a wide one; the questions, the call to action. Entrance: the lines of the title
     rise one after the other, the figures count up, each part slides in -->
<template>
    <article class="sheet" lang="fr">
        <CitySheetHero :crumbs="crumbs" :kicker="`${t('dirSheet')} · ${eyebrow}`" :title="title" :lead="page.lead" lang="fr" :facts="facts"
            :facts-label="t('cityFactsLabel', { name: city.name })">
            <template #actions><slot name="actions" /></template>
        </CitySheetHero>

        <section v-for="(section, s) in page.sections" :key="section.id" v-reveal class="sheet__part" :aria-labelledby="`sheet-${section.id}`">
            <div class="sheet__side">
                <span class="sheet__number text-numeral" aria-hidden="true">{{ padIndex(s) }}</span>
                <span class="eyebrow"><i :class="[sectionIcon(section.id), 'sheet__icon', 'text-normal']" aria-hidden="true"></i>{{ t(`citySection_${section.id}`) }}</span>
            </div>
            <div class="sheet__body">
                <h2 :id="`sheet-${section.id}`" class="text-display-m">{{ section.title }}</h2>
                <p v-for="(paragraph, i) in section.paragraphs" :key="i" class="sheet__text text-body-l">{{ paragraph }}</p>
                <ul v-if="section.items?.length" class="sheet__items">
                    <li v-for="(item, i) in section.items" :key="i" class="sheet__item">
                        <i :class="[item.icon || STEP_ICONS[i % STEP_ICONS.length], 'sheet__item-icon', 'text-large']" aria-hidden="true"></i>
                        <div>
                            <h3 v-if="item.title" class="text-display-xs">{{ item.title }}</h3>
                            <p v-else class="sheet__step eyebrow">{{ t('citySheetStep', { n: i + 1 }) }}</p>
                            <p class="sheet__item-text text-body">{{ item.text }}</p>
                        </div>
                    </li>
                </ul>
                <ul v-if="section.links?.length" class="sheet__links">
                    <li v-for="link in section.links" :key="link.label">
                        <a v-if="link.external" :href="link.to" :title="link.title" target="_blank" rel="noopener noreferrer" class="sheet__link text-label"><i class="fa-solid fa-folder-open sheet__icon" aria-hidden="true"></i>{{ link.label }} ↗</a>
                        <NuxtLink v-else-if="link.to" :to="link.to" :title="link.title" class="sheet__link text-label"><i class="fa-solid fa-location-dot sheet__icon" aria-hidden="true"></i>{{ link.label }}<span v-if="link.meta" class="sheet__meta"> · {{ link.meta }}</span> →</NuxtLink>
                        <span v-else class="sheet__link text-label">{{ link.label }}</span>
                    </li>
                </ul>
                <slot v-if="section.id === 'nearby'" name="map" />
            </div>
        </section>

        <section v-reveal class="sheet__part" aria-labelledby="sheet-faq">
            <div class="sheet__side">
                <span class="sheet__number text-numeral" aria-hidden="true">?</span>
                <span class="eyebrow"><i class="fa-solid fa-circle-question sheet__icon text-normal" aria-hidden="true"></i>{{ t('citySection_faq') }}</span>
            </div>
            <div class="sheet__body">
                <h2 id="sheet-faq" class="text-display-m">{{ page.faqTitle }}</h2>
                <FaqList :items="page.faq" id-prefix="sheet-faq" />
            </div>
        </section>

        <section v-reveal class="sheet__cta" aria-labelledby="sheet-cta">
            <h2 id="sheet-cta" class="text-display-l">{{ page.ctaTitle }}</h2>
            <p class="text-body-l">{{ page.ctaText }}</p>
            <div class="sheet__actions"><slot name="actions" /></div>
        </section>
    </article>
</template>

<script setup lang="ts">
import './city-sheet.css'
import type { PropType } from 'vue'
import FaqList from '@/components/ui/Faq/FaqList.vue'
import CitySheetHero from './CitySheetHero.vue'
import { useLang } from '@/composables/useLang'
import { padIndex } from '@/utils/display'
import { isBase, meetsInPerson } from '@/utils/cities/cityText'
import type { City, CityPage } from '@/utils/cities/cityTypes'

const props = defineProps({
    city: { type: Object as PropType<City>, required: true },
    page: { type: Object as PropType<CityPage>, required: true },
    title: { type: Object as PropType<{ before: string, name: string, after: string }>, required: true },
    eyebrow: { type: String, default: '' },
    crumbs: { type: Array as PropType<{ label: string, to?: string }[]>, required: true },
    facts: { type: Array as PropType<{ icon: string, label: string, value: string, note: string }[]>, default: () => [] },
})

const { getTranslation: t } = useLang()

// Icon of each part (meetings: a car when Djason comes on site, a camera when it is done by video)
const SECTION_ICONS: Record<string, string> = {
    economy: 'fa-solid fa-chart-column', sectors: 'fa-solid fa-briefcase', offer: 'fa-solid fa-laptop-code', method: 'fa-solid fa-list-check',
    seo: 'fa-solid fa-magnifying-glass', manual: 'fa-solid fa-pen-nib', projects: 'fa-solid fa-folder-open', nearby: 'fa-solid fa-map-location-dot',
}
const sectionIcon = (id: string) => id === 'travel'
    ? (isBase(props.city) || (props.city.department_code !== '75' && meetsInPerson(props.city)) ? 'fa-solid fa-car' : 'fa-solid fa-video')
    : SECTION_ICONS[id] ?? 'fa-solid fa-circle'

// Icons of the steps of the method, in order: talk, design, build, put online
const STEP_ICONS = ['fa-solid fa-comments', 'fa-solid fa-pen-ruler', 'fa-solid fa-code', 'fa-solid fa-rocket']
</script>
