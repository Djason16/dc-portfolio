import { ref } from 'vue'
import { api } from '@/utils/api'

// Variables of the .env file in the admin page: read and update (GET / PUT /api/env), then reload once the server restarted.
// Secret values come masked (•••• + last 4 characters, names in masked): sent back as they are, the server keeps them unchanged
export const useEnv = () => {
    const envVars = ref<Record<string, string> | null>(null)
    const masked = ref(new Set<string>())

    // Every KEY=value of the .env file (a failure is thrown for the modal)
    const fetchEnvVars = async () => {
        const res = await api.get('/env')
        if (!res.success) throw new Error(res.error)
        envVars.value = res.env
        masked.value = new Set(res.masked ?? [])
        return res.env
    }

    // Saves the changed values, then reloads the page once the server has restarted (development); onSaved = shown meanwhile
    const updateEnvVars = async (updates: Record<string, unknown>, onSaved: () => void) => {
        const res = await api.put('/env', updates)

        // A 4xx is a refused update; a network failure means the server is already restarting
        if (!res.success && (res.status ?? 0) >= 400 && (res.status ?? 0) < 500) throw new Error(res.error)
        // Nothing really changed: no restart, no reload
        if (res.success && res.changed === false) return res
        onSaved?.()

        await new Promise(resolve => setTimeout(resolve, 3000))
        window.location.reload()
        return res
    }

    return { envVars, masked, fetchEnvVars, updateEnvVars }
}
