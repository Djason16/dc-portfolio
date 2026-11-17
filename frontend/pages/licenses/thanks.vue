<!-- After the Stripe payment of a DC tools subscription (content: components/views/Licenses/LicenseThanks.vue) -->
<template>
    <LicenseThanks />
</template>

<script setup lang="ts">
import LicenseThanks from '@/components/views/Licenses/LicenseThanks.vue'
import { useLangQuery } from '@/composables/useLangQuery'
import { useSeo } from '@/composables/useSeo'

// ?lang=en from Stripe, then the <head> (never indexed: utils/seo.ts licenseThanks)
useLangQuery()
useSeo('licenseThanks')
</script>
