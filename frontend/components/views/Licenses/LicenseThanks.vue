<!-- After the Stripe payment of a DC tools subscription (/licenses/thanks/?lang=&product=, the success_url of
server/helpers/LicenseStripe.ts): the key is on its way by e-mail (Stripe webhook), the three next steps, then download -->
<template>
    <OtherSectionLayout pageTitleKey="licenseThanksTitle" pageSubtitleKey="licenseThanksIntro" :sections="sections" :dynamicData="data">
        <template #custom-content>
            <div v-reveal>
                <ol class="license-cells">
                    <li v-for="(step, i) in STEPS" :key="step" class="license-cell">
                        <span class="eyebrow">{{ padIndex(i) }} · {{ t(`${step}Title`) }}</span>
                        <p class="license-cell__text text-body">{{ t(`${step}Text`) }}</p>
                    </li>
                </ol>
                <div class="license-buttons">
                    <HeroButton primary iconClass="fas fa-download" :label="t('licenseDownload')" :href="`${TOOLS_SITE}/${lang.current.value}/download/`" />
                    <HeroButton iconClass="fas fa-key" :label="t('licenseManageTitle')" :href="`/licenses/manage/?lang=${lang.current.value}`" />
                </div>
            </div>
        </template>
    </OtherSectionLayout>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import HeroButton from '@/components/ui/Button/HeroButton.vue'
import OtherSectionLayout from '@/components/ui/SectionLayout/OtherSectionLayout.vue'
import { useLang } from '@/composables/useLang'
import { useSite } from '@/composables/useSite'
import { padIndex } from '@/utils/display'
import { TOOLS_SITE, toolName } from '@/utils/licenses'

const lang = useLang()
const t = lang.getTranslation
const site = useSite()
const route = useRoute()

// The tool bought (product of the address), "DC" when missing; the e-mail of the owner for the help texts
// read once: the address is cleaned right after (composables/useLangQuery.ts)
const tool = toolName(route.query.product) || 'DC'
const data = computed(() => ({ tool, email: site.email }))

const STEPS = ['licenseStep1', 'licenseStep2', 'licenseStep3']

// No e-mail, the subscription
const sections = Array.from({ length: 2 }, (_, i) => ({ titleKey: `licenseThanksSection${i + 1}Title`, contentKey: `licenseThanksSection${i + 1}Content` }))
</script>

<style scoped src="./licenses.css"></style>
