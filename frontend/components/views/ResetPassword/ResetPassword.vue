<!-- Choice of a new password from the emailed link (/reset-password/?token=...): the password twice, then back to the login.
The link works one hour and only once (server/controllers/AuthController.ts resetPassword) -->
<template>
    <OtherSectionLayout pageTitleKey="resetTitle" pageSubtitleKey="resetSubtitle" :sections="sections">
        <template #custom-content>
            <form v-reveal class="reset-form" novalidate @submit.prevent="submit">
                <div v-for="f in FIELDS" :key="f.id" class="form-group text-label">
                    <label :for="f.id">{{ t(f.labelKey) }}</label>
                    <FormInput :id="f.id" v-model="form[f.model]" type="password" :placeholder="t(f.placeholderKey)" required
                        autocomplete="new-password" :aria-label="t(f.labelKey)" :title="t(f.labelKey)" />
                </div>
                <div class="reset-form__buttons">
                    <HeroButton type="submit" primary iconClass="fas fa-key" :label="t(loading || done ? 'saving' : 'resetSubmit')" :disabled="loading || done" />
                    <HeroButton :label="t('backToLogin')" iconClass="fas fa-arrow-left" :disabled="loading" @click="goToPage('/login')" />
                </div>
                <MessageBox :message="translatedMessage" />
            </form>
        </template>
    </OtherSectionLayout>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import HeroButton from '@/components/ui/Button/HeroButton.vue'
import FormInput from '@/components/ui/Form/FormInput.vue'
import MessageBox from '@/components/ui/Message/MessageBox.vue'
import OtherSectionLayout from '@/components/ui/SectionLayout/OtherSectionLayout.vue'
import { goToPage, useAuth } from '@/composables/useAuth'
import { useLang } from '@/composables/useLang'
import { useMessage } from '@/composables/useMessage'
import { afterMessage } from '@/utils/feedback'

const { getTranslation: t } = useLang()
const { resetPassword, loading } = useAuth()
const { translatedMessage, showMessage, clearMessage } = useMessage()
const route = useRoute()

// The new password, twice (rules of the admin password: 8 characters at least, the same twice)
const FIELDS = [
    { id: 'reset-password', model: 'password', labelKey: 'newPassword', placeholderKey: 'newPasswordPlaceholder' },
    { id: 'reset-confirm', model: 'confirm', labelKey: 'confirmPassword', placeholderKey: 'confirmPasswordPlaceholder' },
]
const form = reactive<Record<string, string>>({ password: '', confirm: '' })
const done = ref(false)

// Saved: the message is read, then the login page (password, then the code received by email)
const submit = async () => {
    clearMessage()
    const res = await resetPassword(String(route.query.token || ''), form.password!, form.confirm!)
    showMessage(res.success ? 'success' : 'error', res.success ? res.message! : res.error!, 0)
    if (!res.success) return
    done.value = true
    await afterMessage()
    goToPage('/login')
}

// Texts under the form (resetSection1Title... in plugins/translations/pages/login.ts)
const sections = Array.from({ length: 2 }, (_, i) => ({ titleKey: `resetSection${i + 1}Title`, contentKey: `resetSection${i + 1}Content` }))
</script>

<style scoped>
.reset-form {
    max-width: 480px;
    margin-top: 2rem;
}

/* Label above its field (FormInput), like the login page */
.form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
}

.reset-form__buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
}
</style>
