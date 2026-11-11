<!-- Booking page (like Calendly): the visitor picks a kind of appointment, a day of the month, a free hour shown on his own clock,
then leaves his name and email; the confirmation comes by email with a cancel link (/book/?cancel=<token>: BookingCancel).
Free slots: server/helpers/BookingHelper.ts. Texts: plugins/translations/pages/book.ts -->
<template>
    <OtherSectionLayout pageTitleKey="bookTitle" pageSubtitleKey="bookPageIntro" :sections="sections" :dynamicData="{ email: site.email }">
        <template #custom-content>
            <BookingCancel v-if="cancelToken" :token="cancelToken" :zone="zone" />

            <div v-else v-reveal class="booking">
                <p v-if="!loaded" class="booking__note text-body" aria-live="polite">{{ t('bookLoadingTypes') }}</p>
                <p v-else-if="!open || !kinds.length" class="booking__note text-body-l">{{ t('bookClosed', { email: site.email }) }}</p>

                <Transition v-else name="swap" mode="out-in">
                    <BookingDone v-if="done" key="done" :booking="done" :email-sent="emailSent" :zone="zone" @again="reset" />

                    <div v-else key="steps" class="booking__steps">
                        <!-- 1. The kind of appointment -->
                        <BookingKinds v-model="kindId" :kinds="kinds" />

                        <!-- 2. The day, then the hour, on the clock of the visitor -->
                        <section v-if="kind" ref="slotStep" class="booking__step" aria-labelledby="book-step-when" tabindex="-1">
                            <h2 id="book-step-when" class="booking__title eyebrow">02 · {{ t('bookStepWhen') }}</h2>
                            <p class="booking__zone text-body-s">{{ t('bookTimezone', { zone }) }}</p>
                            <div class="booking__when">
                                <BookingCalendar :year="view.year" :month="view.month" :counts="counts" :selected="dayKey" :loading="loadingSlots"
                                    :can-prev="canPrev" :can-next="canNext" @select="pickDay" @move="moveMonth" />
                                <BookingTimes :day="dayKey" :slots="daySlots" :selected="slot" :zone="zone" :loading="loadingSlots"
                                    :month-empty="!loadingSlots && !Object.keys(counts).length" @select="pickSlot" />
                            </div>
                        </section>

                        <!-- 3. Who books -->
                        <section v-if="kind && slot" ref="formStep" class="booking__step" aria-labelledby="book-step-who" tabindex="-1">
                            <h2 id="book-step-who" class="booking__title eyebrow">03 · {{ t('bookStepWho') }}</h2>
                            <p class="booking__summary text-body">{{ summary }}</p>
                            <BookingForm :phone-required="kind.mode === 'phone'" :sending="sending" :message="translatedMessage" @submit="submit" />
                        </section>
                    </div>
                </Transition>
            </div>
        </template>
    </OtherSectionLayout>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import OtherSectionLayout from '@/components/ui/SectionLayout/OtherSectionLayout.vue'
import BookingCalendar from './BookingCalendar.vue'
import BookingCancel from './BookingCancel.vue'
import BookingDone from './BookingDone.vue'
import BookingForm from './BookingForm.vue'
import BookingKinds from './BookingKinds.vue'
import BookingTimes from './BookingTimes.vue'
import { useLang } from '@/composables/useLang'
import { useMessage } from '@/composables/useMessage'
import { useSite } from '@/composables/useSite'
import { api } from '@/utils/api'
import { type BookingKind, dayKeyOf, kindName, longDay, monthRange, timeOf, visitorZone } from '@/utils/booking'

const lang = useLang()
const t = lang.getTranslation
const site = useSite()
const route = useRoute()
const { translatedMessage, showMessage, clearMessage } = useMessage()

const cancelToken = computed(() => (typeof route.query.cancel === 'string' ? route.query.cancel : ''))

// The kinds and the rules of the page, read with the page (server side too: no jump when they appear)
const { data } = await useAsyncData('bookingKinds', () => api.get('/booking-types'))
const kinds = computed<BookingKind[]>(() => data.value?.types ?? [])
const open = computed(() => data.value?.settings?.enabled !== false)
const horizonDays = computed(() => Number(data.value?.settings?.horizonDays ?? 60))
const loaded = computed(() => Boolean(data.value))

// Zone of the visitor: known in the browser only (UTC on the server, never shown before the hours)
const zone = ref('UTC')
onMounted(() => { zone.value = visitorZone() })

const kindId = ref('')
const kind = computed(() => kinds.value.find(k => k.id === kindId.value) ?? null)
const today = new Date()
const view = reactive({ year: today.getFullYear(), month: today.getMonth() })
const slots = ref<string[]>([])
const loadingSlots = ref(false)
const dayKey = ref('')
const slot = ref('')
const sending = ref(false)
const done = ref<Record<string, any> | null>(null)
const emailSent = ref(true)
const slotStep = ref<HTMLElement | null>(null)
const formStep = ref<HTMLElement | null>(null)

// Free starts of the month shown, by day of the visitor: { '2026-11-20': ['...Z', ...] }
const byDay = computed(() => slots.value.reduce<Record<string, string[]>>((days, iso) => {
    (days[dayKeyOf(iso, zone.value)] ||= []).push(iso)
    return days
}, {}))
const counts = computed(() => Object.fromEntries(Object.entries(byDay.value).map(([key, list]) => [key, list.length])))
const daySlots = computed(() => byDay.value[dayKey.value] ?? [])

// Months that can be shown: from this one to the one of the horizon
const monthIndex = (year: number, month: number) => year * 12 + month
const lastMonth = computed(() => { const end = new Date(Date.now() + horizonDays.value * 86400000); return monthIndex(end.getFullYear(), end.getMonth()) })
const canPrev = computed(() => monthIndex(view.year, view.month) > monthIndex(today.getFullYear(), today.getMonth()))
const canNext = computed(() => monthIndex(view.year, view.month) < lastMonth.value)

// A request answered after a newer one is dropped (quick clicks on the months)
let request = 0
const loadSlots = async (skipEmpty = false): Promise<void> => {
    if (!kind.value) return
    const mine = ++request
    loadingSlots.value = true
    const { from, to } = monthRange(view.year, view.month)
    const res = await api.get(`/bookings/slots?type=${encodeURIComponent(kind.value.id)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
    if (mine !== request) return
    slots.value = res.success ? res.slots : []
    loadingSlots.value = false
    // The end of a month can be full: the next month is shown at once when this one has nothing left
    if (skipEmpty && !slots.value.length && canNext.value) return moveMonth(1)
    const first = Object.keys(byDay.value).sort()[0]
    if (!dayKey.value || !byDay.value[dayKey.value]) dayKey.value = first ?? ''
}

const moveMonth = (step: number): Promise<void> => {
    const next = new Date(view.year, view.month + step, 1)
    view.year = next.getFullYear()
    view.month = next.getMonth()
    dayKey.value = ''
    slot.value = ''
    return loadSlots()
}

// A new kind: back to this month, its first free day picked, the step brought into sight
watch(kindId, async () => {
    view.year = today.getFullYear()
    view.month = today.getMonth()
    dayKey.value = ''
    slot.value = ''
    clearMessage()
    if (!kind.value) return
    await nextTick()
    slotStep.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    loadSlots(true)
})

const pickDay = (key: string) => { dayKey.value = key; slot.value = '' }
const pickSlot = async (iso: string) => {
    slot.value = iso
    clearMessage()
    await nextTick()
    formStep.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// "Appel visio · jeudi 20 novembre · 10:30 (Europe/Paris)"
const summary = computed(() => kind.value && slot.value
    ? `${kindName(kind.value, lang.current.value)} · ${longDay(dayKeyOf(slot.value, zone.value), lang.current.value)} · ${timeOf(slot.value, lang.current.value, zone.value)} (${zone.value})`
    : '')

const submit = async (form: Record<string, string>) => {
    clearMessage()
    sending.value = true
    const res = await api.post('/bookings', { ...form, typeId: kindId.value, start: slot.value, language: lang.current.value, timezone: zone.value })
    sending.value = false
    if (!res.success) {
        showMessage('error', res.error || 'unknownError', 0)
        // Taken meanwhile by someone else: the free hours are read again
        if (res.error === 'bookingSlotTaken') { slot.value = ''; loadSlots() }
        return
    }
    emailSent.value = res.emailSent !== false
    done.value = res.booking ?? { typeName: kind.value ? kindName(kind.value, lang.current.value) : '', start: slot.value, email: form.email }
}

// Another booking: everything from the start
const reset = () => {
    done.value = null
    kindId.value = ''
    slots.value = []
}

const sections = Array.from({ length: 3 }, (_, i) => ({ titleKey: `bookSection${i + 1}Title`, contentKey: `bookSection${i + 1}Content` }))
</script>

<style scoped>
.booking {
    max-width: 60rem;
}

.booking__note {
    margin: 0;
    color: var(--fg-muted);
}

.booking__steps {
    display: flex;
    flex-direction: column;
    gap: 3.5rem;
}

.booking__step {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    scroll-margin-top: 7.5rem;
}

.booking__step:focus {
    outline: none;
}

.booking__title,
.booking__zone,
.booking__summary {
    margin: 0;
}

.booking__zone {
    color: var(--fg-muted);
}

.booking__summary {
    padding: 1rem 1.25rem;
    border-left: 2px solid var(--accent);
    background: var(--panel);
}

/* Calendar and hours side by side on a computer, one under the other on a tablet and a phone */
.booking__when {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
    gap: 2.5rem;
    align-items: start;
}

@media (max-width: 900px) {
    .booking__when {
        grid-template-columns: minmax(0, 1fr);
        gap: 2rem;
    }

    .booking__steps {
        gap: 2.75rem;
    }
}
</style>
