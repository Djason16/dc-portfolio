<!-- Step 3 of the booking page: who books (name, email, phone, a message), then the button.
A field hidden from people (website) traps the robots: the server books nothing when it is filled. -->
<template>
    <form class="booking-form" novalidate @submit.prevent="submit">
        <div v-for="field in fields" :key="field.id" class="form-group text-label">
            <label :for="field.id">{{ t(field.labelKey) }}</label>
            <FormInput :id="field.id" v-model="form[field.model]" :type="field.type" :placeholder="t(field.placeholderKey)"
                :required="field.required" :autocomplete="field.autocomplete" :aria-required="field.required" />
        </div>
        <div class="form-group text-label">
            <label for="booking-message">{{ t('bookMessage') }}</label>
            <textarea id="booking-message" v-model="form.message" class="booking-form__message" rows="3" maxlength="2000"
                :placeholder="t('bookMessagePlaceholder')"></textarea>
        </div>
        <!-- Trap for robots: out of sight, out of the keyboard order, ignored by screen readers -->
        <div class="booking-form__trap" aria-hidden="true">
            <label for="booking-website">Website</label>
            <input id="booking-website" v-model="form.website" type="text" name="website" tabindex="-1" autocomplete="off" />
        </div>

        <HeroButton type="submit" primary iconClass="fas fa-calendar-check" :label="t(sending ? 'bookSending' : 'bookSubmit')" :disabled="sending" />
        <MessageBox :message="shown" />
    </form>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { computed, reactive, ref, watch } from 'vue'
import HeroButton from '@/components/ui/Button/HeroButton.vue'
import FormInput from '@/components/ui/Form/FormInput.vue'
import MessageBox from '@/components/ui/Message/MessageBox.vue'
import { useLang } from '@/composables/useLang'

const props = defineProps({
    // Phone call: the number is needed to be called
    phoneRequired: Boolean,
    sending: Boolean,
    // translatedMessage of the page (an error of the server)
    message: { type: Object as PropType<Record<string, any> | null>, default: null },
})
const emit = defineEmits<{ submit: [form: Record<string, string>] }>()

const { getTranslation: t } = useLang()

const fields = computed(() => [
    { id: 'booking-name', model: 'name', type: 'text', labelKey: 'bookName', placeholderKey: 'bookNamePlaceholder', required: true, autocomplete: 'name' },
    { id: 'booking-email', model: 'email', type: 'email', labelKey: 'bookEmail', placeholderKey: 'bookEmailPlaceholder', required: true, autocomplete: 'email' },
    { id: 'booking-phone', model: 'phone', type: 'tel', labelKey: props.phoneRequired ? 'bookPhoneRequired' : 'bookPhone', placeholderKey: 'bookPhonePlaceholder',
        required: props.phoneRequired, autocomplete: 'tel' },
])
const form = reactive<Record<string, string>>({ name: '', email: '', phone: '', message: '', website: '' })

// The error found here first, else the one of the server
const local = ref<{ type: string, key: string } | null>(null)
const shown = computed(() => (local.value ? { type: local.value.type, key: t(local.value.key) } : props.message))
watch(() => props.message, () => { local.value = null })

const submit = () => {
    local.value = null
    const error = form.name!.trim().length < 2 ? 'bookingNameRequired'
        : form.name!.trim().length > 255 ? 'bookingNameTooLong'
        : form.email!.trim().length > 255 ? 'invalidEmail'
        : form.message!.trim().length > 2000 ? 'bookingMessageTooLong'
        : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email!.trim()) ? 'invalidEmail'
        : props.phoneRequired && !form.phone!.trim() ? 'bookingPhoneRequired'
        : form.phone!.trim() && !/^[+()\d\s.-]{6,32}$/.test(form.phone!.trim()) ? 'bookingInvalidPhone' : ''
    if (error) return (local.value = { type: 'error', key: error })
    emit('submit', { ...form, name: form.name!.trim(), email: form.email!.trim(), phone: form.phone!.trim() })
}
</script>

<style scoped>
.booking-form {
    max-width: 32.5rem;
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
}

/* Long text: the same line under the text as the other fields */
.booking-form__message {
    width: 100%;
    padding: 0.6rem 0;
    box-sizing: border-box;
    border: none;
    border-bottom: 1px solid var(--field-line);
    background: transparent;
    color: var(--fg);
    font: inherit;
    font-size: var(--font-body);
    letter-spacing: normal;
    text-transform: none;
    resize: vertical;
}

.booking-form__message::placeholder {
    color: var(--fg-muted);
    opacity: 1;
}

/* Focus: like the other fields, the line turns mint and twice as thick */
.booking-form__message:focus {
    outline: none;
    border-bottom-color: var(--accent);
    box-shadow: 0 1px 0 0 var(--accent);
}

.booking-form__trap {
    position: absolute;
    left: -10000px;
    width: 1px;
    height: 1px;
    overflow: hidden;
}
</style>
