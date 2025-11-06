// contents/utils/constants.ts

export const COLORS = ["#fff475", "#a7ffeb", "#ffd6a5", "#caffbf", "#fdffb6"]
export const HIGHLIGHTER_ENABLED_KEY = "highlighterEnabled"
export const HN_DISABLED_CLASS = "hn-disabled"
export const CSS_CLASSES = {
  HIGHLIGHT: "hn-highlight",
  TOOLBAR: "hn-toolbar",
  HOVER_TOOLBAR: "hn-hover-toolbar",
  EDIT_TOOLBAR: "hn-edit-toolbar",
  NOTE_ICON: "hn-note-icon"
} as const

export const THROTTLE_INTERVAL = 1000 // max once per second
export const CALM_DURATION = 300 // ms
export const MAX_WAIT = 5000 // ms
export const SUPABASE_SESSION_KEY = "supabaseSession"
export const SUPABASE_URL_KEY = "supabaseUrl"
export const SUPABASE_ANON_KEY = "supabaseAnonKey"

// contents/utils/constants.ts
export const SYNC_QUEUE_KEY = "__SYNC_QUEUE__"
export const PROCESSING_FLAG_KEY = "__SYNC_PROCESSING__"
export const SYNC_BATCH_SIZE = 20
export const SYNC_INTERVAL_MS = 7000
