<!-- Top of the « fiche » pages (city pages and zone page): breadcrumb, a kicker line, the h1 on up to three lines (a small
     line, the name very large, a small line in mint), the lead with the buttons, then the ribbon of figures (an icon, a
     label, the figure counting up, a small line). Entrance: the lines rise one after the other, then the ribbon -->
<template>
    <header class="sheet__hero">
        <nav class="sheet__crumbs text-label" :aria-label="t('cityBreadcrumb')">
            <template v-for="(crumb, i) in crumbs" :key="crumb.label">
                <NuxtLink v-if="crumb.to" :to="crumb.to" :title="crumb.label">{{ crumb.label }}</NuxtLink>
                <span v-else aria-current="page">{{ crumb.label }}</span>
                <span v-if="i < crumbs.length - 1" class="sheet__crumb-sep" aria-hidden="true">/</span>
            </template>
        </nav>
        <p class="sheet__kicker eyebrow">{{ kicker }}</p>
        <h1 class="sheet__title" :lang="lang">
            <!-- Spaces kept between the lines: the title reads as one sentence -->
            <span v-if="title.before" class="sheet__before text-display-s">{{ title.before }}</span>{{ ' ' }}<span
                class="sheet__name" :class="long ? 'text-display-l' : 'text-display-xl'">{{ title.name }}</span>{{ ' ' }}<span v-if="title.after" class="sheet__after text-display-s">{{ title.after }}</span>
        </h1>
        <div class="sheet__intro">
            <p class="sheet__lead text-body-l" :lang="lang">{{ lead }}</p>
            <!-- A French page read in English: said once, the rest of the page stays French -->
            <p v-if="lang === 'fr' && current !== 'fr'" class="sheet__note text-body-s">{{ t('cityFrenchOnly') }}</p>
            <div class="sheet__actions"><slot name="actions" /></div>
        </div>
        <dl v-if="facts.length" class="sheet__ribbon" :aria-label="factsLabel">
            <div v-for="(fact, i) in facts" :key="fact.label" class="sheet__fact" :style="{ '--i': i }">
                <dt class="sheet__fact-label eyebrow"><i :class="[fact.icon, 'sheet__icon', 'text-normal']" aria-hidden="true"></i>{{ fact.label }}</dt>
                <dd class="text-display-m"><CityCounter :value="fact.value" /></dd>
                <dd class="sheet__note text-body-s">{{ fact.note }}</dd>
            </div>
        </dl>
    </header>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import CityCounter from './CityCounter.vue'
import { useLang } from '@/composables/useLang'

defineProps({
    crumbs: { type: Array as PropType<{ label: string, to?: string }[]>, required: true },
    kicker: { type: String, default: '' },
    title: { type: Object as PropType<{ before: string, name: string, after: string }>, required: true },
    lead: { type: String, default: '' },
    // Font Awesome icon, label, value (a number counts up), small line
    facts: { type: Array as PropType<{ icon: string, label: string, value: string, note: string }[]>, default: () => [] },
    factsLabel: { type: String, default: '' },
    // A long name (« Zone d'intervention »): one size smaller, so that no word is cut
    long: Boolean,
    // Language of the title and lead (French on the city pages)
    lang: { type: String, default: undefined },
})

const { getTranslation: t, current } = useLang()
</script>
