<template>
    <!-- Home page: the DC tools made by the owner, as an editorial index (its own look and its own entrance, v-reveal
         'index' and 'wipe': the names uncovered like a curtain): one full-width
         row per tool with its name very large (the list of tools.djason-chery.dev/tools.json, GET /api/tools: a new tool shows up
         without building this site again); the whole row is a link to its page on tools.djason-chery.dev -->
    <section id="tools" class="tools-section" aria-labelledby="tools-title">
        <SectionHead id="tools-title" reveal="wipe" :label="t('toolsLabel')" :title="t('toolsTitle')" :text="t('toolsDescription')" />

        <ol class="tools-index">
            <!-- Texts of tools.json shown as plain text only; its colour only through a CSS variable (checked: #rrggbb) -->
            <li v-for="(tool, i) in tools" :key="tool.id" v-reveal="'index'" class="tools-index__item"
                :style="{ '--reveal-delay': `calc(var(--reveal-stagger) * ${i})`, ...(tool.accent ? { '--tool-accent': tool.accent } : {}) }">
                <a class="tools-index__link" :href="tool.url[code]" target="_blank" rel="noopener" :title="t('toolsDiscover', { name: tool.name })">
                    <span class="tools-index__number eyebrow" aria-hidden="true">{{ padIndex(i) }}</span>
                    <span class="tools-index__name">
                        <span class="tools-index__brand eyebrow">DC</span>
                        <span class="tools-index__title text-display-l">{{ tool.title }}</span>
                    </span>
                    <span class="tools-index__text text-body">{{ tool.text[code] }}</span>
                    <span class="tools-index__arrow text-xlarge" aria-hidden="true">→</span>
                </a>
            </li>
        </ol>

        <div v-reveal class="tools-section__all">
            <p class="tools-section__note text-body-l">{{ t('toolsNote') }}</p>
            <HeroButton primary iconClass="fas fa-arrow-right" :label="t('toolsAll')" :href="catalog.site[code]" :title="t('toolsAllTitle')" target="_blank" rel="noopener" />
        </div>
    </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { padIndex } from '@/utils/display'
import SectionHead from '@/components/ui/SectionLayout/SectionHead.vue'
import HeroButton from '@/components/ui/Button/HeroButton.vue'
import { useLang } from '@/composables/useLang'
import { api } from '@/utils/api'
import { BUILT_IN_CATALOG, checkCatalog, type ToolsCatalog } from '@/utils/toolsCatalog'

const lang = useLang()
const { getTranslation: t } = lang

// The tools, read on the server (in the HTML: no jump, search engines read them); any failure: the built-in list
const { data } = await useAsyncData('tools-catalog', () => api.get('/tools'))
const catalog = computed<ToolsCatalog>(() => (data.value?.success && checkCatalog({ schema: 1, ...data.value })) || BUILT_IN_CATALOG)
const tools = computed(() => catalog.value.tools)
const code = computed(() => (lang.current.value === 'en' ? 'en' : 'fr'))
</script>

