<template>
    <!-- Home page: the three DC tools made by the owner, as an editorial index (its own look on the home page): one full-width
         row per tool with its name very large; the whole row is a link to its page on tools.djason-chery.dev -->
    <section id="tools" class="tools-section" aria-labelledby="tools-title">
        <SectionHead id="tools-title" reveal="line" :label="t('toolsLabel')" :title="t('toolsTitle')" :text="t('toolsDescription')" />

        <ol class="tools-index">
            <li v-for="(tool, i) in TOOLS" :key="tool.id" v-reveal="'line'" class="tools-index__item" :style="{ '--reveal-delay': `calc(var(--reveal-stagger) * ${i})` }">
                <a class="tools-index__link" :href="toolUrl(tool.id)" target="_blank" rel="noopener" :title="t('toolsDiscover', { name: tool.name })">
                    <span class="tools-index__number eyebrow" aria-hidden="true">{{ padIndex(i) }}</span>
                    <span class="tools-index__name">
                        <span class="tools-index__brand eyebrow">DC</span>
                        <span class="tools-index__title text-display-l">{{ tool.title }}</span>
                    </span>
                    <span class="tools-index__text text-body">{{ t(`toolsText_${tool.id}`) }}</span>
                    <span class="tools-index__arrow" aria-hidden="true">→</span>
                </a>
            </li>
        </ol>

        <div v-reveal class="tools-section__all">
            <p class="tools-section__note text-body-l">{{ t('toolsNote') }}</p>
            <HeroButton primary iconClass="fas fa-arrow-right" :label="t('toolsAll')" :href="siteUrl" :title="t('toolsAllTitle')" target="_blank" rel="noopener" />
        </div>
    </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { padIndex } from '@/utils/display'
import SectionHead from '@/components/ui/SectionLayout/SectionHead.vue'
import HeroButton from '@/components/ui/Button/HeroButton.vue'
import { useLang } from '@/composables/useLang'

const lang = useLang()
const { getTranslation: t } = lang

const TOOLS = [
    { id: 'scaffold', name: 'DC Scaffold', title: 'Scaffold' },
    { id: 'prospect', name: 'DC Prospect', title: 'Prospect' },
    { id: 'sentinel', name: 'DC Sentinel', title: 'Sentinel' },
]
const code = computed(() => (lang.current.value === 'en' ? 'en' : 'fr'))
const siteUrl = computed(() => `https://tools.djason-chery.dev/${code.value}/`)
const toolUrl = (id: string) => `https://tools.djason-chery.dev/${code.value}/${id}/`
</script>
