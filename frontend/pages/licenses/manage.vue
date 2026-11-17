<!-- Manage a DC tools licence: the key, its state, the Stripe space (content: components/views/Licenses/LicenseManage.vue) -->
<template>
    <LicenseManage />
</template>

<script setup lang="ts">
import LicenseManage from '@/components/views/Licenses/LicenseManage.vue'
import { useLangQuery } from '@/composables/useLangQuery'
import { useSeo } from '@/composables/useSeo'

// ?lang=en from the tools and the e-mails, then the <head> (never indexed: utils/seo.ts licenseManage)
useLangQuery()
useSeo('licenseManage')
</script>
