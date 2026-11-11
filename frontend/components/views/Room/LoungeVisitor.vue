<!-- Visitor's view of the personal room /room/ (composables/useLoungeKnock.ts): closed, or his name, the preview of the camera
and "Knock"; then the wait (cancel), or why he is not in (refused, nobody answered, room closed, call over) -->
<template>
    <div class="lounge-panel">
        <p v-if="!open" class="lounge__muted text-body">{{ t('loungeClosedText', { name: hostName }) }}</p>
        <template v-else>
            <p v-if="message" class="lounge__notice text-body" role="status">{{ message }}</p>
            <a v-if="knock.phase.value === 'refused' || knock.phase.value === 'expired'" class="lounge__link text-label" :href="withTrailingSlash('/book')"
                :title="t('loungeBookInstead')">{{ t('loungeBookInstead') }} →</a>

            <div v-if="waiting" class="lounge-visitor__wait">
                <p class="text-body-l">{{ waitText }}</p>
                <p class="lounge__muted text-body-s">{{ t('loungeWaitHint') }}</p>
                <HeroButton iconClass="fas fa-xmark" :label="t('loungeCancel')" @click="knock.cancel()" />
            </div>
            <div v-else class="form-group text-label lounge-visitor__name">
                <label for="lounge-name">{{ t('loungeName') }}</label>
                <FormInput id="lounge-name" v-model="name" type="text" maxlength="40" autocomplete="name" required aria-required="true"
                    :placeholder="t('loungeNamePlaceholder')" :aria-invalid="Boolean(error)" @enter="send" />
            </div>
            <p v-if="error" class="lounge__error text-body-s" role="alert">{{ error }}</p>

            <RoomLobby :media="media" :no-join="waiting || busy" join-key="loungeKnock" joining-key="loungeKnocking" join-icon="fas fa-hand"
                :joining="knock.phase.value === 'sending'" @join="send" />
        </template>
    </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { computed, onMounted, ref } from 'vue'
import HeroButton from '@/components/ui/Button/HeroButton.vue'
import FormInput from '@/components/ui/Form/FormInput.vue'
import RoomLobby from './RoomLobby.vue'
import { useLang } from '@/composables/useLang'
import type { LocalMedia } from '@/composables/useLocalMedia'
import type { useLoungeKnock } from '@/composables/useLoungeKnock'
import { withTrailingSlash } from '@/utils/pathHelpers'

const props = defineProps({
    knock: { type: Object as PropType<ReturnType<typeof useLoungeKnock>>, required: true },
    media: { type: Object as PropType<LocalMedia>, required: true },
    notice: { type: String, default: '' },
    busy: { type: Boolean, default: false },
    hostName: { type: String, default: '' },
})
const emit = defineEmits<{ knocked: [] }>()
const t = useLang().getTranslation

const NAME_KEY = 'loungeName'
const name = ref('')
// The name typed before in this tab (a second knock)
onMounted(() => { try { name.value = sessionStorage.getItem(NAME_KEY) || '' } catch { /* private mode */ } })
const typed = ref('')

const open = computed(() => props.knock.lounge.value?.open ?? true)
const waiting = computed(() => props.knock.phase.value === 'waiting' || props.knock.phase.value === 'accepted')
const error = computed(() => typed.value || (props.knock.error.value ? t(props.knock.error.value) : ''))

const waitText = computed(() => {
    const lounge = props.knock.lounge.value, values = { name: props.hostName }
    if (props.knock.phase.value === 'accepted') return t('loungeLetInNow', values)
    return lounge?.busy ? t('loungeWaitBusy', values) : lounge?.hostHere ? t('loungeWaitHere', values) : t('loungeWaitAway', values)
})

// After a knock or a call: why the visitor is not in (the end of a call first)
const PHASES: Record<string, string> = { refused: 'loungeRefused', expired: 'loungeExpired', closed: 'loungeClosedWhileWaiting', cancelled: 'loungeCancelled', ended: 'loungeCallEnded' }
const message = computed(() => {
    if (props.notice) return t(props.notice, { name: props.hostName })
    const key = PHASES[props.knock.phase.value]
    return key ? t(key, { name: props.hostName }) : ''
})

const send = async () => {
    typed.value = ''
    const clean = name.value.replace(/\s+/g, ' ').trim()
    if (!clean) {
        typed.value = t('loungeNameRequired')
        document.getElementById('lounge-name')?.focus()
        return
    }
    try { sessionStorage.setItem(NAME_KEY, clean) } catch { /* private mode */ }
    emit('knocked')
    // The camera and the microphone asked now if not done on the preview (the host sees and hears the visitor at once)
    if (!props.media.started.value) await props.media.start()
    await props.knock.knock(clean)
}
</script>
