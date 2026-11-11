<!-- Text chat of the call (composables/useRoomChat.ts): the messages, ours on the right, and the field to write one
(Enter sends, Shift + Enter goes to a new line). Messages go over the data channel of the call, never through the site. -->
<template>
    <div class="room-chat">
        <ol ref="list" class="room-chat__list" role="log" aria-live="polite" :aria-label="t('roomChat')">
            <li v-if="!chat.messages.value.length" class="room-chat__empty text-body-s">{{ t('roomChatEmpty', { name }) }}</li>
            <li v-for="message in chat.messages.value" :key="message.id" class="room-chat__message" :class="{ 'is-mine': message.mine }">
                <span class="room-chat__who text-body-s">{{ message.mine ? t('roomChatYou') : name }} · {{ timeOf(message.at) }}</span>
                <span class="room-chat__text text-body">{{ message.text }}</span>
            </li>
        </ol>
        <form class="room-chat__form" @submit.prevent="send">
            <p v-if="!linked" class="room-chat__offline text-body-s">{{ t('roomChatOffline', { name }) }}</p>
            <div class="room-chat__row">
                <textarea ref="field" v-model="draft" class="room-chat__field text-body" rows="1" :maxlength="MAX_MESSAGE" :placeholder="t('roomChatPlaceholder')"
                    :aria-label="t('roomChatLabel', { name })" @keydown.enter.exact.prevent="send"></textarea>
                <button type="submit" class="room-chat__send" :disabled="!linked || !draft.trim()" :aria-label="t('roomChatSend')" :title="t('roomChatSend')">
                    <i class="fas fa-paper-plane" aria-hidden="true"></i>
                </button>
            </div>
        </form>
    </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { nextTick, onMounted, ref, watch } from 'vue'
import { useLang } from '@/composables/useLang'
import { MAX_MESSAGE, type RoomChat } from '@/composables/useRoomChat'

const props = defineProps({
    chat: { type: Object as PropType<RoomChat>, required: true },
    // Name of the other person; the data channel is open
    name: { type: String, required: true },
    linked: { type: Boolean, default: false },
})
const lang = useLang()
const t = lang.getTranslation

const list = ref<HTMLElement | null>(null)
const field = ref<HTMLTextAreaElement | null>(null)
const draft = ref('')

const timeOf = (at: number) => new Date(at).toLocaleTimeString(lang.current.value, { hour: '2-digit', minute: '2-digit' })

const send = () => {
    if (props.chat.say(draft.value)) draft.value = ''
}

// The last message always in view
const toBottom = () => nextTick(() => { if (list.value) list.value.scrollTop = list.value.scrollHeight })
watch(() => props.chat.messages.value.length, toBottom)
onMounted(() => {
    toBottom()
    field.value?.focus({ preventScroll: true })
})
</script>

<style scoped>
.room-chat {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-height: 0;
}

.room-chat__list {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    gap: 0.75rem;
    min-height: 3rem;
    margin: 0;
    padding: 1rem;
    overflow-y: auto;
    list-style: none;
}

.room-chat__empty {
    color: var(--fg-muted);
}

.room-chat__message {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.2rem;
    max-width: 85%;
}

.room-chat__message.is-mine {
    align-self: flex-end;
    align-items: flex-end;
}

.room-chat__who {
    color: var(--fg-muted);
}

.room-chat__text {
    padding: 0.45rem 0.7rem;
    border: 1px solid var(--line);
    background: var(--ink-700);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
}

.room-chat__message.is-mine .room-chat__text {
    border-color: transparent;
    background: var(--accent);
    color: var(--ink-900);
}

.room-chat__form {
    flex: 0 0 auto;
    padding: 0.5rem;
    border-top: 1px solid var(--line);
}

.room-chat__offline {
    margin: 0 0 0.5rem;
    color: var(--fg-muted);
}

.room-chat__row {
    display: flex;
    align-items: flex-end;
    gap: 0.5rem;
}

.room-chat__field {
    box-sizing: border-box;
    flex: 1 1 auto;
    min-width: 0;
    min-height: 2.75rem;
    max-height: 6rem;
    padding: 0.55rem 0.7rem;
    border: 1px solid var(--field-line);
    border-radius: 0;
    background: var(--ink-900);
    color: var(--fg);
    resize: none;
    field-sizing: content;
}

/* Placeholder readable on the ink (WCAG 4.5:1), like the other fields */
.room-chat__field::placeholder {
    color: var(--fg-muted);
    opacity: 1;
}

.room-chat__field:focus-visible,
.room-chat__send:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
}

.room-chat__send {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    width: 2.75rem;
    height: 2.75rem;
    padding: 0;
    border: 0;
    background: var(--accent);
    color: var(--ink-900);
    cursor: pointer;
}

.room-chat__send:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}
</style>
