<!-- Host's view of the personal room /room/ (the logged-in admin, composables/useLoungeHost.ts): open or closed, the address
to share, the visitors knocking (let in or refuse), a call left running (take it back or end it), the preview of the camera -->
<template>
    <div class="lounge-panel">
        <p v-if="notice" class="lounge__notice text-body" role="status">{{ t(notice, { name: '' }) }}</p>
        <p v-if="host.offline.value" class="lounge__notice text-body" role="status">{{ t('roomStatusOffline') }}</p>

        <div class="lounge-host__bar">
            <button type="button" role="switch" class="lounge-host__switch text-label" :aria-checked="host.open.value" :title="t('loungeOpenSwitch')"
                :disabled="saving" @click="toggleOpen">
                <i class="text-display-s" :class="host.open.value ? 'fas fa-toggle-on' : 'fas fa-toggle-off'" aria-hidden="true"></i>
                {{ t(host.open.value ? 'loungeIsOpen' : 'loungeIsClosed') }}
            </button>
            <HeroButton v-if="canAsk" iconClass="fas fa-bell" :label="t('loungeNotifyAsk')" @click="host.askNotifications()" />
        </div>

        <div class="lounge-host__share">
            <label class="text-label" for="lounge-url">{{ t('loungeShareLabel') }}</label>
            <div class="lounge-host__url">
                <input id="lounge-url" class="lounge-host__input text-body" type="text" readonly :value="url" :title="url" @focus="($event.target as HTMLInputElement).select()" />
                <HeroButton iconClass="fas fa-copy" :label="t(copied ? 'loungeCopied' : 'loungeCopy')" @click="copy" />
            </div>
        </div>

        <div v-if="host.current.value && !busy" class="lounge__notice lounge-host__current">
            <p class="text-body">{{ t('loungeStillInCall', { name: host.current.value.name }) }}</p>
            <div class="lounge__actions">
                <HeroButton primary iconClass="fas fa-video" :label="t('loungeTakeBack')" @click="emit('rejoin')" />
                <HeroButton iconClass="fas fa-xmark" :label="t('loungeEndCall')" @click="host.end(host.current.value.token)" />
            </div>
        </div>

        <section class="lounge-host__knocks" :aria-label="t('loungeKnocksTitle')">
            <p class="eyebrow">{{ t('loungeKnocksTitle') }} · {{ host.knocks.value.length }}</p>
            <p v-if="!host.knocks.value.length" class="lounge__muted text-body">{{ t(host.open.value ? 'loungeNoKnock' : 'loungeNoKnockClosed') }}</p>
            <ul v-else class="lounge-host__list">
                <li v-for="item in host.knocks.value" :key="item.token" class="lounge-host__knock">
                    <p class="lounge-host__who">
                        <span class="text-body-l">{{ item.name }}</span>
                        <span class="lounge__muted text-body-s">{{ t('loungeKnockedAt', { time: timeOf(item.at) }) }}</span>
                    </p>
                    <div class="lounge__actions">
                        <HeroButton primary iconClass="fas fa-door-open" :label="t('loungeLetIn')" :disabled="busy || Boolean(host.current.value) || deciding === item.token"
                            @click="letIn(item.token)" />
                        <HeroButton iconClass="fas fa-xmark" :label="t('loungeRefuse')" :disabled="deciding === item.token" @click="refuse(item.token)" />
                    </div>
                </li>
            </ul>
        </section>

        <p class="lounge__muted text-body-s">{{ t('loungeHostPreview') }}</p>
        <RoomLobby :media="media" no-join />
    </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { computed, ref } from 'vue'
import HeroButton from '@/components/ui/Button/HeroButton.vue'
import RoomLobby from './RoomLobby.vue'
import { useLang } from '@/composables/useLang'
import type { LocalMedia } from '@/composables/useLocalMedia'
import type { useLoungeHost } from '@/composables/useLoungeHost'
import { withTrailingSlash } from '@/utils/pathHelpers'

const props = defineProps({
    host: { type: Object as PropType<ReturnType<typeof useLoungeHost>>, required: true },
    media: { type: Object as PropType<LocalMedia>, required: true },
    notice: { type: String, default: '' },
    // A call is running on this page
    busy: { type: Boolean, default: false },
})
const emit = defineEmits<{ accept: [token: string], rejoin: [] }>()
const lang = useLang()
const t = lang.getTranslation

const url = computed(() => (import.meta.client ? `${window.location.origin}${withTrailingSlash('/room')}` : ''))
const copied = ref(false)
const saving = ref(false)
const deciding = ref('')
const canAsk = computed(() => props.host.notify.value === 'default' && !props.host.asked.value)

const timeOf = (iso: string) => new Intl.DateTimeFormat(lang.current.value === 'en' ? 'en-GB' : 'fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso))

const copy = async () => {
    try {
        await navigator.clipboard.writeText(url.value)
        copied.value = true
        setTimeout(() => { copied.value = false }, 2000)
    } catch { /* the address stays selectable in the field */ }
}

const toggleOpen = async () => {
    saving.value = true
    await props.host.setOpen(!props.host.open.value)
    saving.value = false
}

const letIn = (token: string) => {
    deciding.value = token
    emit('accept', token)
    setTimeout(() => { deciding.value = '' }, 1500)
}

const refuse = async (token: string) => {
    deciding.value = token
    await props.host.refuse(token)
    deciding.value = ''
}
</script>
