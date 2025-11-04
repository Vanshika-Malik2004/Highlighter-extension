// contents/highlighter.ts
// Main entry point for the highlighter content script

import { HIGHLIGHTER_ENABLED_KEY, HN_DISABLED_CLASS } from "./utils/constants"
import { scrollToHighlightById } from "./utils/dom-utils"
import { attachHighlightHoverHandlers } from "./utils/highlight-operations"
import {
  applyAllHighlights,
  observeDomChanges,
  waitForPageCalm
} from "./utils/observers"
import { showHighlightToolbar, showToolbar } from "./utils/toolbars"

export let highlighterEnabled = true

console.log(
  "%c[Highlighter] Content script loaded on:",
  "color:#9c27b0;font-weight:bold",
  location.href
)

// Inject global style once (if not already present)
function ensureHNStyleTag() {
  if (document.getElementById("hn-style-tag")) return
  const style = document.createElement("style")
  style.id = "hn-style-tag"
  style.textContent = `
    /* Hide highlight visuals when disabled */
    .${HN_DISABLED_CLASS} mark.hn-highlight {
      background: transparent !important;
      box-shadow: none !important;
      outline: none !important;
      pointer-events: none !important;
      color: inherit !important;
    }

    /* Hide note icons and toolbars */
    .${HN_DISABLED_CLASS} .hn-note-icon,
    .${HN_DISABLED_CLASS} .hn-toolbar,
    .${HN_DISABLED_CLASS} .hn-hover-toolbar,
    .${HN_DISABLED_CLASS} .hn-edit-toolbar {
      display: none !important;
    }
  `
  document.head.appendChild(style)
}

function toggleHighlighterVisuals(enabled: boolean) {
  document.documentElement.classList.toggle(HN_DISABLED_CLASS, !enabled)
}

// === On load: reapply any saved highlights ===
;(async () => {
  ensureHNStyleTag()
  const { [HIGHLIGHTER_ENABLED_KEY]: storedState } =
    await chrome.storage.sync.get(HIGHLIGHTER_ENABLED_KEY)
  highlighterEnabled = storedState !== false // default ON

  if (!highlighterEnabled) {
    console.log("%c[Highlighter] Disabled by user", "color:red")
    toggleHighlighterVisuals(false)
  }
  const url = location.href
  const data = (await chrome.storage.local.get(url))[url]
  if (data?.highlights?.length) {
    console.log(
      "%c[Reapply] Found highlights to restore:",
      "color:#4caf50",
      data.highlights.length
    )

    // 🕒 Wait for page "calm" (DOM stops mutating) before first apply
    waitForPageCalm().then(() => {
      console.log(
        "%c[Reapply] Page is calm, applying highlights...",
        "color:#4caf50"
      )
      applyAllHighlights(data.highlights)
      attachHighlightHoverHandlers()

      // 👁️ Watch for DOM re-renders (React, SPA routing, etc.)
      observeDomChanges(data.highlights)
    })
  } else {
    console.log(
      "%c[Reapply] No highlights saved for this page.",
      "color:#757575"
    )
  }
})()

// === Listen for text selection ===
function handleSelection(e: MouseEvent) {
  if (!highlighterEnabled) return
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed) return
  const range = sel.getRangeAt(0)
  const text = range.toString().trim()
  if (!text) return
  showToolbar(e.pageX, e.pageY, range, text)
}

document.addEventListener("mouseup", handleSelection)

// === Handle popup messages ===
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "SCROLL_TO_HIGHLIGHT") {
    scrollToHighlightById(msg.id)
    sendResponse({ ok: true })
  }
})

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "TOGGLE_HIGHLIGHTER") {
    highlighterEnabled = msg.enabled
    chrome.storage.sync.set({ [HIGHLIGHTER_ENABLED_KEY]: msg.enabled })
    toggleHighlighterVisuals(highlighterEnabled)

    if (highlighterEnabled) enableHighlighter()
    else disableHighlighter(true)

    sendResponse({ ok: true })
  }

  if (msg.type === "SCROLL_TO_HIGHLIGHT") {
    scrollToHighlightById(msg.id)
    sendResponse({ ok: true })
  }
})

async function disableHighlighter(skipHide = false) {
  if (!highlighterEnabled) return
  highlighterEnabled = false
  console.log("%c[Highlighter] Disabled", "color:red")

  // Add the disabled class (hides via CSS)
  toggleHighlighterVisuals(false)

  // Block selection/hover interactions
  document.removeEventListener("mouseup", handleSelection)

  // Close any open toolbars
  document
    .querySelectorAll(".hn-toolbar, .hn-hover-toolbar, .hn-edit-toolbar")
    .forEach((el) => el.remove())
}

async function enableHighlighter() {
  if (highlighterEnabled) return
  highlighterEnabled = true
  console.log("%c[Highlighter] Enabled", "color:green")

  toggleHighlighterVisuals(true)

  // Reattach listeners
  document.addEventListener("mouseup", handleSelection)
  attachHighlightHoverHandlers()

  // ✅ Reapply stored highlights if none are visible
  const url = location.href
  const data = (await chrome.storage.local.get(url))[url]
  const highlights = data?.highlights ?? []

  const visibleHighlights = document.querySelectorAll(".hn-highlight").length

  if (highlights.length && visibleHighlights === 0) {
    console.log(
      "%c[Reapply] Reapplying stored highlights on enable...",
      "color:#4caf50"
    )
    await waitForPageCalm()
    applyAllHighlights(highlights)
    attachHighlightHoverHandlers()
  }
}
