<template>
    <!-- Prices and offers of the DC tools, made simple: one card per offer (its two prices to change, its running reduction),
         then the running offers as plain lines with "Stop"; written in Stripe, the sales site and the checkout follow (5 minutes) -->
    <TableModal :show="show" :title="t('licensePricingTitle')" max-width="1100px" @close="emit('close')">
        <!-- Everything scrolls inside the modal (TableModal only scrolls a table by itself) -->
        <div class="pricing-body">
        <p class="pricing-note text-body-s">{{ t('licensePricingNote') }}</p>

        <ul class="pricing-cards">
            <li v-for="(row, i) in pricing.prices" :key="row.offer" class="pricing-card">
                <span class="eyebrow pricing-card__label">{{ padIndex(i) }} · {{ offerName(row.offer) }}</span>
                <div class="pricing-card__fields">
                    <label class="pricing-field" :for="`price-${row.offer}-month`">
                        <span class="text-label">{{ t('licensePerMonth') }}</span>
                        <span class="pricing-field__input"><input :id="`price-${row.offer}-month`" v-model.number="draft[row.offer]!.month" type="number" min="1" step="0.5" :title="t('licensePriceMonth')" /> €</span>
                    </label>
                    <label class="pricing-field" :for="`price-${row.offer}-year`">
                        <span class="text-label">{{ t('licensePerYear') }}</span>
                        <span class="pricing-field__input"><input :id="`price-${row.offer}-year`" v-model.number="draft[row.offer]!.year" type="number" min="1" step="1" :title="t('licensePriceYear')" /> €</span>
                    </label>
                </div>
                <p v-if="offerFor(row.offer)" class="pricing-card__offer text-body-s">{{ offerText(offerFor(row.offer)!) }}</p>
                <HeroButton iconClass="fas fa-check" :label="t('save')" :disabled="!changed(row)" @click="save(row)" />
            </li>
        </ul>

        <p class="pricing-label eyebrow">{{ t('licenseOffersTitle') }}</p>
        <p v-if="!pricing.offers.length" class="text-body-s pricing-empty">{{ t('licenseNoOffer') }}</p>
        <ul v-else class="pricing-offers">
            <li v-for="offer in pricing.offers" :key="offer.id" class="pricing-offer">
                <span class="pricing-offer__text text-body">{{ offerText(offer) }}</span>
                <IconButton icon="close" variant="danger" :label="t('licenseOfferStop')" @click="stopOffer(offer)" />
            </li>
        </ul>
        </div>

        <template #actions>
            <HeroButton primary iconClass="fas fa-plus" :label="t('licenseNewOffer')" @click="emit('open', 'offer')" />
        </template>
    </TableModal>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'
import TableModal from '@/components/ui/Modal/TableModal.vue'
import HeroButton from '@/components/ui/Button/HeroButton.vue'
import IconButton from '@/components/ui/Button/IconButton.vue'
import { padIndex } from '@/utils/display'
import { useLang } from '@/composables/useLang'
import { useModalData } from '@/composables/useLiveData'
import { useLicenses } from '@/composables/useLicenses'
import { showConfirm, showFailure, showSuccess } from '@/utils/dialog'

const props = defineProps({ show: Boolean })
const emit = defineEmits(['close', 'open'])
const { getTranslation: t } = useLang()
const { pricing, fetchPricing, setPrice, deleteOffer, productNames, fetchProducts } = useLicenses()
fetchProducts()

const offerName = (id: string) => id === 'all' ? t('licenseAllOffers') : id === 'bundle' ? 'DC complet' : productNames.value[id] ?? id
// The prices being typed, one pair per offer (reset each time the prices are read)
const draft = reactive<Record<string, { month: number, year: number }>>({})
watch(() => pricing.value.prices, rows => rows.forEach(r => { draft[r.offer] = { month: r.month, year: r.year } }), { immediate: true })
const changed = (row: Record<string, any>) => draft[row.offer] && (draft[row.offer]!.month !== row.month || draft[row.offer]!.year !== row.year)

// An offer in plain words: "-30 % for life · 49 places left · until 31/12/2026 · Launch: -30 % for life"
// On a card: the offer the checkout applies (the highest reduction of the tool or of "all", LicenseOffers.best)
const offerFor = (id: string) => pricing.value.offers.filter(o => o.product === id || o.product === 'all')
    .sort((a, b) => (b.percentOff ?? 0) - (a.percentOff ?? 0))[0]
const offerText = (o: Record<string, any>) => [
    `${offerName(o.product)} : -${o.percentOff} % ${o.duration === 'repeating' ? t('licenseOfferMonths', { months: o.months }) : t(`licenseOffer_${o.duration}`).toLowerCase()}`,
    o.remaining !== null && t('licenseOfferPlaces', { count: o.remaining }),
    o.endsAt && t('licenseUntil', { date: new Date(o.endsAt).toLocaleDateString() }).replace(/^\S+\s/, ''),
    o.labelFr && `« ${o.labelFr} »`,
].filter(Boolean).join(' · ')

const save = async (row: Record<string, any>) => {
    const next = draft[row.offer]!
    for (const interval of ['month', 'year'] as const) {
        if (next[interval] === row[interval]) continue
        const res = await setPrice(row.offer, interval, Number(next[interval]))
        if (!res.success) return showFailure(t(res.error || 'saveFailed'))
    }
    showSuccess(t('licensePriceSaved'))
}

const stopOffer = async (offer: Record<string, any>) => {
    if (!(await showConfirm(t('licenseOfferStopConfirm', { name: offer.labelFr || offerName(offer.product) })))) return
    const res = await deleteOffer(offer.id)
    res.success ? showSuccess(t('licenseOfferStopped')) : showFailure(t(res.error || 'saveFailed'))
}

useModalData(() => props.show, fetchPricing, [])
</script>

<style scoped>
.pricing-body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    padding-right: 0.5rem;
}

.pricing-note,
.pricing-empty {
    margin: 0 0 1.25rem;
    color: var(--fg-muted);
}

/* One card per offer, in the panels of the site: label, the two prices, its running offer, save */
.pricing-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 1fr));
    gap: 1px;
    margin: 0;
    padding: 0;
    list-style: none;
    background: var(--line);
    border: 1px solid var(--line);
}

.pricing-card {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-width: 0;
    padding: 1.25rem;
    background: var(--ink-900);
}

.pricing-card__label,
.pricing-label {
    color: var(--accent);
}

.pricing-card__fields {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.pricing-field {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    color: var(--fg-muted);
}

.pricing-field__input {
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
    color: var(--fg);
    /* Archivo in its normal width and weight (the variable font): Archivo Expanded only has the semi bold of the titles */
    font-family: "Archivo Variable", var(--font-display);
    font-size: var(--font-display-s);
}

.pricing-field__input input {
    width: 100%;
    min-width: 0;
    font: inherit;
}

.pricing-card__offer {
    margin: 0;
    color: var(--fg-muted);
    overflow-wrap: anywhere;
}

.pricing-card :deep(.custom-button) {
    margin-top: auto;
}

.pricing-label {
    margin: 2.25rem 0 0.75rem;
}

.pricing-offers {
    margin: 0;
    padding: 0;
    list-style: none;
    border-top: 1px solid var(--line);
}

.pricing-offer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.9rem 0;
    border-bottom: 1px solid var(--line);
}

.pricing-offer__text {
    min-width: 0;
    overflow-wrap: anywhere;
}
</style>
