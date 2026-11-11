<!-- Choice of the camera, the microphone and the speaker (the speaker only where the browser allows it), remembered in this
browser (composables/useMediaDevices.ts). The names are known once the camera and the microphone are allowed. -->
<template>
    <fieldset class="room-devices">
        <legend class="room-devices__legend text-label">{{ t('roomDevices') }}</legend>
        <p v-if="!media.started.value" class="room-devices__note text-body-s">{{ t('roomDevicesLater') }}</p>
        <template v-else>
            <label v-for="field in fields" :key="field.kind" class="room-devices__field">
                <span class="room-devices__label text-body-s"><i :class="field.icon" aria-hidden="true"></i> {{ t(field.labelKey) }}</span>
                <select class="room-devices__select text-body" :value="media.devices.chosen.value[field.kind] || field.options[0]?.id" :disabled="field.options.length < 2"
                    @change="pick(field.kind, $event)">
                    <option v-if="!field.options.length" value="">-</option>
                    <option v-for="(option, i) in field.options" :key="option.id" :value="option.id">{{ option.label || t(`${field.labelKey}N`, { n: i + 1 }) }}</option>
                </select>
            </label>
        </template>
    </fieldset>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { computed } from 'vue'
import { useLang } from '@/composables/useLang'
import type { LocalMedia } from '@/composables/useLocalMedia'
import type { DeviceKind } from '@/composables/useMediaDevices'

const props = defineProps({ media: { type: Object as PropType<LocalMedia>, required: true } })
const t = useLang().getTranslation

const fields = computed(() => {
    const lists = props.media.devices.lists.value
    const all = [
        { kind: 'camera' as DeviceKind, labelKey: 'roomCamera', icon: 'fas fa-camera', options: lists.camera },
        { kind: 'mic' as DeviceKind, labelKey: 'roomMicrophone', icon: 'fas fa-microphone', options: lists.mic },
        { kind: 'speaker' as DeviceKind, labelKey: 'roomSpeaker', icon: 'fas fa-volume-high', options: lists.speaker },
    ]
    // No speaker list where the browser cannot choose it (Safari)
    return all.filter(field => field.kind !== 'speaker' || field.options.length)
})

const pick = (kind: DeviceKind, event: Event) => props.media.setDevice(kind, (event.target as HTMLSelectElement).value)
</script>

<style scoped>
.room-devices {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
}

.room-devices__legend {
    margin-bottom: 0.75rem;
    padding: 0;
    color: var(--fg-muted);
}

.room-devices__note {
    margin: 0;
    color: var(--fg-muted);
}

.room-devices__field {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    min-width: 0;
}

.room-devices__label {
    color: var(--fg-muted);
}

.room-devices__select {
    box-sizing: border-box;
    width: 100%;
    min-height: 2.75rem;
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--field-line);
    border-radius: 0;
    background: var(--ink-700);
    color: var(--fg);
    text-overflow: ellipsis;
}

.room-devices__select:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
}
</style>
