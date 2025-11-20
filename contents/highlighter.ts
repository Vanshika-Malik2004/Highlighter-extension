// contents/highlighter.ts
// Main entry point for the highlighter content script

import { supabase } from "../lib/supabase"
import { HIGHLIGHTER_ENABLED_KEY, HN_DISABLED_CLASS } from "./utils/constants"
import { scrollToHighlightById } from "./utils/dom-utils"
import { attachHighlightHoverHandlers } from "./utils/highlight-operations"
import {
  applyAllHighlights,
  observeDomChanges,
  waitForPageCalm
} from "./utils/observers"
import { showHighlightToolbar, showToolbar } from "./utils/toolbars"
import type { HighlightAnchor } from "./utils/types"

// 🔥 Module-level cache: single source of truth for highlights
export let currentHighlights: HighlightAnchor[] = []
export let highlighterEnabled = true
let isAuthenticated = false

// console.log(
//   "%c[Highlighter] Content script loaded on:",
//   "color:#9c27b0;font-weight:bold",
//   location.href
// )

// Inject global style once (if not already present)
function ensureHNStyleTag() {
  if (document.getElementById("hn-style-tag")) return
  const style = document.createElement("style")
  style.id = "hn-style-tag"
  style.textContent = `
  /* 🔹 When disabled: hide highlight visuals */
  .${HN_DISABLED_CLASS} mark.hn-highlight {
    background: transparent !important;
    box-shadow: none !important;
    outline: none !important;
    pointer-events: none !important;
    color: inherit !important;
  }

  /* 🔹 Add a built-in note icon when data-note exists */
  mark.hn-highlight[data-note]::after {
    content: " 📝";
    font-size: 0.8em;
    vertical-align: super;
    margin-left: 2px;
    opacity: 0.8;
    cursor: pointer;
  }

  /* 🔹 Hide the note indicator when disabled */
  .${HN_DISABLED_CLASS} mark.hn-highlight[data-note]::after {
    content: "";
  }

  /* 🔹 Hide any toolbars completely when disabled */
  .${HN_DISABLED_CLASS} .hn-toolbar,
  .${HN_DISABLED_CLASS} .hn-hover-toolbar,
  .${HN_DISABLED_CLASS} .hn-edit-toolbar {
    display: none !important;
  }`

  document.head.appendChild(style)
}

function toggleHighlighterVisuals(enabled: boolean) {
  // Visual disable (CSS class) is applied when either not authed or user toggled off
  const shouldEnable = enabled && isAuthenticated
  setTimeout(() => {
    document.documentElement.classList.toggle(HN_DISABLED_CLASS, !shouldEnable)
  }, 100)
}

// ✨ Small toast to explain why nothing happens when logged out
function showLoginPrompt() {
  const id = "__hn_login_prompt"
  if (document.getElementById(id)) return
  const prompt = document.createElement("div")
  prompt.id = id
  prompt.textContent = "🔒 Sign in to use the highlighter"
  prompt.style.cssText = `
    position: fixed;
    bottom: 16px;
    right: 16px;
    background: #111;
    color: #fff;
    padding: 8px 12px;
    border-radius: 8px;
    z-index: 2147483647;
    font-size: 12px;
    box-shadow: 0 6px 16px rgba(0,0,0,0.25);
  `
  document.body.appendChild(prompt)
  setTimeout(() => prompt.remove(), 2200)
}

// === Selection listener (only attached when authed + enabled) ===
function handleSelection(e: MouseEvent) {
  if (!isAuthenticated || !highlighterEnabled) return
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed) return
  const range = sel.getRangeAt(0)
  const text = range.toString().trim()
  if (!text) return
  showToolbar(e.pageX, e.pageY, range, text)
}

// Attach/Detach helpers to ensure clean enable/disable
function attachCoreListeners() {
  document.addEventListener("mouseup", handleSelection)
  attachHighlightHoverHandlers()
}

function detachCoreListeners() {
  document.removeEventListener("mouseup", handleSelection)
  // Close any open toolbars
  document
    .querySelectorAll(".hn-toolbar, .hn-hover-toolbar, .hn-edit-toolbar")
    .forEach((el) => el.remove())
}

// Fully remove highlight markups from DOM (used on logout)
function removeAllHighlightsFromDom() {
  document.querySelectorAll("mark.hn-highlight").forEach((el) => el.remove())
}

// === Auth-gated (re)apply of saved highlights ===
async function reapplyStoredHighlightsIfAny() {
  const url = location.href
  const data = (await chrome.storage.local.get(url))[url]
  const highlights: HighlightAnchor[] = data?.highlights ?? []

  // 🔥 Update module cache
  currentHighlights = highlights

  if (!highlights.length) {
    // console.log(
    //   "%c[Reapply] No highlights saved for this page.",
    //   "color:#757575"
    // )
    return
  }

  // console.log(
  //   "%c[Reapply] Found highlights to restore:",
  //   "color:#4caf50",
  //   highlights.length
  // )

  await waitForPageCalm()
  // console.log(
  //   "%c[Reapply] Page is calm, applying highlights...",
  //   "color:#4caf50"
  // )
  applyAllHighlights(highlights)
  attachHighlightHoverHandlers()
  observeDomChanges()
}

// === Enable/Disable respecting auth state ===
async function disableHighlighter(skipHide = false) {
  // Visuals are controlled elsewhere but make sure we clean interactions
  // console.log("%c[Highlighter] Disabled", "color:red")

  // Block selection/hover interactions
  detachCoreListeners()

  // Hide via CSS class
  toggleHighlighterVisuals(false)
}

async function enableHighlighter() {
  // Only enable if BOTH conditions hold
  if (!isAuthenticated) {
    showLoginPrompt()
    await disableHighlighter(true)
    return
  }
  if (!highlighterEnabled) {
    // Respect user's off toggle even if authed
    await disableHighlighter(true)
    return
  }

  // console.log("%c[Highlighter] Enabled", "color:green")
  await new Promise((r) => setTimeout(r, 120))
  toggleHighlighterVisuals(true)

  // Reattach listeners (idempotent because we detach on disable)
  attachCoreListeners()

  // ✅ Reapply stored highlights if none are visible
  const visible = document.querySelectorAll(".hn-highlight").length
  if (visible === 0) {
    await reapplyStoredHighlightsIfAny()
  }
}

// === Consolidated message handler (popup → content) ===
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "SCROLL_TO_HIGHLIGHT") {
    scrollToHighlightById(msg.id)
    sendResponse({ ok: true })
    return
  }
  if (msg.type === "USER_SIGNED_OUT") {
    // console.log("%c[Highlighter] Popup → User signed out", "color:red")

    // Turn off interactions
    highlighterEnabled = false
    isAuthenticated = false

    // Remove all highlight marks immediately
    removeAllHighlightsFromDom()

    // Hide any toolbar or hover UI
    document
      .querySelectorAll(".hn-toolbar, .hn-hover-toolbar, .hn-edit-toolbar")
      .forEach((el) => el.remove())

    // Also disable visuals
    toggleHighlighterVisuals(false)

    sendResponse({ ok: true })
    return
  }
  if (msg.type === "USER_SIGNED_IN") {
    // console.log("%c[Highlighter] Popup → User signed in", "color:green")

    isAuthenticated = true
    enableHighlighter()
    reapplyStoredHighlightsIfAny()

    sendResponse({ ok: true })
    return
  }

  if (msg.type === "TOGGLE_HIGHLIGHTER") {
    highlighterEnabled = msg.enabled
    chrome.storage.sync.set({ [HIGHLIGHTER_ENABLED_KEY]: msg.enabled })

    // Apply visuals considering auth + toggle
    toggleHighlighterVisuals(highlighterEnabled)

    if (highlighterEnabled) {
      // Only truly enable if authed, otherwise show prompt and keep interactions off
      if (isAuthenticated) {
        enableHighlighter()
      } else {
        showLoginPrompt()
        disableHighlighter(true)
      }
    } else {
      disableHighlighter(true)
    }

    sendResponse({ ok: true })
    return
  }
})

// === Boot logic (auth-gated) ===
async function boot() {
  ensureHNStyleTag()

  // Read user's toggle preference (default ON)
  const { [HIGHLIGHTER_ENABLED_KEY]: storedState } =
    await chrome.storage.sync.get(HIGHLIGHTER_ENABLED_KEY)
  highlighterEnabled = storedState !== false

  // Resolve current auth state
  const { data } = await supabase.auth.getSession()
  isAuthenticated = !!data.session?.user

  if (!isAuthenticated) {
    // console.log(
    //   "%c[Highlighter] Not logged in — keeping disabled.",
    //   "color:orange"
    // )
    toggleHighlighterVisuals(false)
    // Ensure nothing is active
    await disableHighlighter(true)
    return
  }

  // Authenticated path
  if (highlighterEnabled) {
    await enableHighlighter()
  } else {
    await disableHighlighter(true)
  }
}

// React to auth state changes live
supabase.auth.onAuthStateChange((_event, session) => {
  isAuthenticated = !!session?.user
  if (isAuthenticated) {
    // console.log(
    //   "%c[Auth] Logged in → enabling (if user toggle is ON)",
    //   "color:green"
    // )
    enableHighlighter()
  } else {
    // console.log("%c[Auth] Logged out → disabling & clearing UI", "color:red")
    // Hide visuals and interactions on logout
    toggleHighlighterVisuals(false)
    disableHighlighter(true)
    // Optionally remove highlight marks from DOM on logout:
    removeAllHighlightsFromDom()
  }
})

// Kick things off
boot()
