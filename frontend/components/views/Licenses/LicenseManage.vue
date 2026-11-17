<!-- Manage a DC tools licence (/licenses/manage/?lang=): the key typed -> its tools, state, end of access and kind
(POST /api/licenses/status), then the Stripe customer portal of a bought key (POST /api/licenses/portal). Opened from the tools,
the e-mail of the key and the old address /api/licenses/manage (server/controllers/LicensesController.ts) -->
<template>
    <OtherSectionLayout pageTitleKey="licenseManageTitle" pageSubtitleKey="licenseManageIntro" :sections="sections" :dynamicData="contact">
        <template #custom-content>
            <Transition name="swap" mode="out-in">
                <!-- The key -->
                <form v-if="!license" key="form" v-reveal class="license-form" novalidate @submit.prevent="check">
                    <div class="license-form__group text-label">
                        <label for="license-key">{{ t('licenseKeyLabel') }}</label>
                        <FormInput id="license-key" v-model="key" type="text" :placeholder="t('licenseKeyPlaceholder')" required
                            autocomplete="off" spellcheck="false" autocapitalize="characters" :aria-label="t('licenseKeyLabel')"
                            :title="t('licenseKeyLabel')" />
                    </div>
                    <div class="license-buttons">
                        <HeroButton type="submit" primary iconClass="fas fa-key" :label="t(busy ? 'licenseChecking' : 'licenseCheck')" :disabled="busy" />
                        <HeroButton iconClass="fas fa-arrow-right" :label="t('licenseToolsSite')" :href="`${TOOLS_SITE}/${lang.current.value}/`" />
                    </div>
                    <MessageBox :message="translatedMessage" />
                </form>

                <!-- Its licence -->
                <div v-else key="result" class="license-result">
                    <div class="license-result__head">
                        <p class="eyebrow">{{ t('licenseYourLicense') }}</p>
                        <p class="license-result__key text-label">{{ t('licenseKeyShown', { end: license.keyEnd }) }}</p>
                    </div>
                    <dl class="license-cells">
                        <div v-for="(row, i) in rows" :key="row.labelKey" class="license-cell">
                            <dt class="eyebrow">{{ padIndex(i) }} · {{ t(row.labelKey) }}</dt>
                            <dd class="license-cell__value text-display-s" :class="row.className">{{ row.value }}</dd>
                        </div>
                    </dl>

                    <p v-if="!license.canManage" class="license-note text-body">{{ t('licenseNoPortal') }}</p>
                    <div class="license-buttons">
                        <HeroButton v-if="license.canManage" primary iconClass="fas fa-credit-card"
                            :label="t(busy ? 'licenseOpeningPortal' : 'licenseOpenPortal')" :disabled="busy" @click="openPortal" />
                        <HeroButton v-else primary iconClass="fas fa-arrow-right" :label="t('licenseToolsSite')" :href="`${TOOLS_SITE}/${lang.current.value}/`" />
                        <HeroButton iconClass="fas fa-download" :label="t('licenseDownload')" :href="`${TOOLS_SITE}/${lang.current.value}/download/`" />
                        <HeroButton iconClass="fas fa-arrow-left" :label="t('licenseOtherKey')" :disabled="busy" @click="reset" />
                    </div>
                    <MessageBox :message="translatedMessage" />
                </div>
            </Transition>
        </template>
    </OtherSectionLayout>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import HeroButton from '@/components/ui/Button/HeroButton.vue'
import FormInput from '@/components/ui/Form/FormInput.vue'
import MessageBox from '@/components/ui/Message/MessageBox.vue'
import OtherSectionLayout from '@/components/ui/SectionLayout/OtherSectionLayout.vue'
import { useLang } from '@/composables/useLang'
import { useMessage } from '@/composables/useMessage'
import { useSite } from '@/composables/useSite'
import { padIndex } from '@/utils/display'
import { api } from '@/utils/api'
import { TOOLS_SITE, toolNames } from '@/utils/licenses'

type License = {
    keyEnd: string, products: string[], status: string, expiresAt: string | null, kind: string, interval: string, canManage: boolean,
    renewsAt: string | null, cancelled: boolean,
}

const lang = useLang()
const t = lang.getTranslation
const site = useSite()
const { translatedMessage, showMessage, clearMessage } = useMessage()
const contact = computed(() => ({ email: site.email }))

const key = ref('')
const license = ref<License | null>(null)
const busy = ref(false)

// Same rule as the server (LicenseHelper.normalize): DC + 20 letters, dashes and spaces free
const looksLikeKey = (value: string) => /^(DC)?[0-9A-Z]{20}$/.test(value.toUpperCase().replace(/[\s-]/g, ''))

const check = async () => {
    clearMessage()
    if (!looksLikeKey(key.value)) return showMessage('error', 'licenseKeyInvalid', 0)
    busy.value = true
    const res = await api.post('/licenses/status', { key: key.value })
    busy.value = false
    if (!res.success) return showMessage('error', res.error || 'unknownError', 0)
    license.value = res.license
}

// The Stripe space opens in this tab (its return button leads to the tools site)
const openPortal = async () => {
    clearMessage()
    busy.value = true
    const res = await api.post('/licenses/portal', { key: key.value, lang: lang.current.value })
    if (res.success && res.url) return window.location.assign(res.url)
    busy.value = false
    showMessage('error', res.error || 'unknownError', 0)
}

const reset = () => {
    clearMessage()
    license.value = null
    key.value = ''
}

const formatDate = (iso: string) => new Date(iso).toLocaleDateString(lang.current.value === 'en' ? 'en-GB' : 'fr-FR', { dateStyle: 'long' })

// The facts of the key: tools, state, kind, then its renewal (subscription) or its end of access
const rows = computed(() => {
    const l = license.value
    if (!l) return []
    // A running subscription shows its next renewal (Stripe); else the end of access
    const renews = l.status === 'active' && !l.cancelled && l.renewsAt
    return [
        { labelKey: 'licenseRowTools', value: toolNames(l.products) },
        { labelKey: 'licenseRowStatus', value: t(`licenseState_${l.status}`), className: `license-state--${l.status}` },
        { labelKey: 'licenseRowKind', value: t(l.kind === 'paid' && l.interval ? `licenseType_${l.interval}` : `licenseType_${l.kind}`) },
        renews ? { labelKey: 'licenseRowRenewal', value: formatDate(l.renewsAt!) }
            : { labelKey: 'licenseRowEnd', value: l.expiresAt ? formatDate(l.expiresAt) : t('licenseNoEndDate') },
    ]
})

// Lost key, cancelling, invoices
const sections = Array.from({ length: 3 }, (_, i) => ({ titleKey: `licenseManageSection${i + 1}Title`, contentKey: `licenseManageSection${i + 1}Content` }))
</script>

<style scoped src="./licenses.css"></style>
