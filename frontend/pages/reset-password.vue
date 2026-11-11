<!-- New password page, opened from the link of a forgotten password email (content: components/views/ResetPassword) -->
<template>
    <ResetPassword />
</template>

<script setup lang="ts">
import ResetPassword from '@/components/views/ResetPassword/ResetPassword.vue'
import { useSeo } from '@/composables/useSeo'

// Title and description, never indexed (utils/seo.ts: resetPassword)
useSeo('resetPassword')

// Already logged in: straight to /admin/
definePageMeta({ middleware: 'guest' })
</script>
