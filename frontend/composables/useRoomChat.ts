import { ref, watch } from 'vue'

/*
 * Text chat and reactions of the video room, over the data channel of the call (useRoomCall.send): straight from one browser
 * to the other, never stored by the site, gone when the page closes. Messages that come while the chat is closed are
 * counted (unread). A reaction is one of a few emoji, floating a few seconds on both sides.
 *
 *   const chat = useRoomChat()
 *   chat.bind(call.send)                 chat.receive is given to useRoomCall as onData
 *   chat.say('Hello')                    false when the other side cannot be reached
 *   chat.react('👍')
 *   chat.clear()                         before the call with another person
 */
export type ChatMessage = { id: number, mine: boolean, text: string, at: number }
export type FloatingReaction = { id: number, emoji: string, mine: boolean, left: number }

export const REACTIONS = ['👍', '👏', '😂', '❤️', '🎉', '🤔']
export const MAX_MESSAGE = 1000
const KEPT_MESSAGES = 200
const REACTION_MS = 3200
const MAX_FLOATING = 12

export const useRoomChat = () => {
    const messages = ref<ChatMessage[]>([])
    const unread = ref(0)
    const open = ref(false)
    const reactions = ref<FloatingReaction[]>([])
    // Last reaction of the other side, read by screen readers
    const lastReaction = ref('')
    let send: (data: Record<string, unknown>) => boolean = () => false
    let next = 0

    const bind = (sender: typeof send) => { send = sender }

    const push = (mine: boolean, text: string) => {
        messages.value = [...messages.value, { id: ++next, mine, text, at: Date.now() }].slice(-KEPT_MESSAGES)
        if (!mine && !open.value) unread.value++
    }

    const float = (emoji: string, mine: boolean) => {
        const reaction = { id: ++next, emoji, mine, left: 10 + Math.random() * 80 }
        reactions.value = [...reactions.value, reaction].slice(-MAX_FLOATING)
        setTimeout(() => { reactions.value = reactions.value.filter(item => item.id !== reaction.id) }, REACTION_MS)
    }

    const say = (text: string) => {
        const clean = text.trim().slice(0, MAX_MESSAGE)
        if (!clean || !send({ type: 'chat', text: clean })) return false
        push(true, clean)
        return true
    }

    const react = (emoji: string) => {
        if (!REACTIONS.includes(emoji)) return
        send({ type: 'reaction', emoji })
        float(emoji, true)
    }

    // A message of the other side: only these two kinds, checked (never trusted as HTML: shown as text)
    const receive = (data: Record<string, unknown>) => {
        if (data.type === 'chat' && typeof data.text === 'string' && data.text.trim()) push(false, data.text.trim().slice(0, MAX_MESSAGE))
        if (data.type === 'reaction' && typeof data.emoji === 'string' && REACTIONS.includes(data.emoji)) {
            float(data.emoji, false)
            lastReaction.value = data.emoji
        }
    }

    watch(open, (isOpen) => { if (isOpen) unread.value = 0 })

    // A new person (the personal room /room/ receives one visitor after the other): nothing of the call before
    const clear = () => {
        messages.value = []
        unread.value = 0
        open.value = false
    }

    return { messages, unread, open, reactions, lastReaction, bind, say, react, receive, clear }
}

export type RoomChat = ReturnType<typeof useRoomChat>
