// lib/supabase.ts
import { createClient } from "@supabase/supabase-js"

const get = (key: string) =>
  new Promise<string | null>((resolve) => {
    chrome.storage.local.get(key, (res) => resolve(res[key] ?? null))
  })

const set = (key: string, value: string) =>
  new Promise<void>((resolve) => {
    chrome.storage.local.set({ [key]: value }, () => resolve())
  })

const remove = (key: string) =>
  new Promise<void>((resolve) => {
    chrome.storage.local.remove(key, () => resolve())
  })

const chromeStorageAdapter = { getItem: get, setItem: set, removeItem: remove }

export const supabase = createClient(
  process.env.PLASMO_PUBLIC_SUPABASE_URL!,
  process.env.PLASMO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storage: chromeStorageAdapter,
      detectSessionInUrl: false
    },
    global: { headers: { "x-client-info": "plasmo-highlighter" } }
  }
)
