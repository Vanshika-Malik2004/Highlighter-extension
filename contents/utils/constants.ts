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
