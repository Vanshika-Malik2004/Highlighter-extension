// contents/utils/highlight-operations.ts

import { computeOffsets, findQuote, getContext, getCssPath } from "./anchoring"
import { CSS_CLASSES } from "./constants"
import { addNoteIcon, wrapRangeInElement } from "./dom-utils"
import { isDeletingNow } from "./observers"
import { saveHighlight } from "./storage"
import { showHighlightToolbar } from "./toolbars"
import type { HighlightAnchor } from "./types"

/**
 * Create and save a new highlight
 */
export async function createHighlight(
  range: Range,
  quote: string,
  color: string,
  note?: string
): Promise<void> {
  console.log("%c[Create] Creating highlight...", "color:#8bc34a")
  const id = `hn-highlight-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const prefix = getContext(range, -30)
  const suffix = getContext(range, 30)
  const { start_pos, end_pos } = computeOffsets(range)
  const css_path = getCssPath(range.startContainer)

  console.log("%c[Create] Anchor data:", "color:#8bc34a", {
    quote: quote.slice(0, 60) + (quote.length > 60 ? "..." : ""),
    prefix: prefix || "(empty)",
    suffix: suffix || "(empty)",
    start_pos,
    end_pos,
    css_path
  })
  console.log(
    "%c[Create] Full context:",
    "color:#8bc34a",
    `"${prefix}" + [${quote.slice(0, 30)}...] + "${suffix}"`
  )

  const span = document.createElement("mark")
  span.className = CSS_CLASSES.HIGHLIGHT
  span.dataset.id = id
  span.style.background = color
  span.dataset.color = color
  if (note) span.dataset.note = note

  wrapRangeInElement(range, span)
  const anchor: HighlightAnchor = {
    id,
    quote,
    prefix,
    suffix,
    color,
    note,
    start_pos,
    end_pos,
    css_path
  }
  await saveHighlight(anchor)
  attachHighlightHoverHandlers()
}

/**
 * Apply a saved highlight to the DOM
 */
export function applyHighlight(anchor: HighlightAnchor): void {
  if (isDeletingNow()) return
  console.log(
    "%c[Apply] Applying saved highlight:",
    "color:#ffc107",
    anchor.quote.slice(0, 60)
  )
  const { quote, prefix, suffix, color, note, id } = anchor
  const range = findQuote(document.body, quote, prefix, suffix)
  if (!range) {
    console.warn(
      "%c[Apply] Could not re-find quote:",
      "color:red",
      quote.slice(0, 60)
    )
    return
  }
  const span = document.createElement("mark")
  span.className = CSS_CLASSES.HIGHLIGHT
  if (id) span.dataset.id = id
  if (note) span.dataset.note = note
  span.style.background = color
  wrapRangeInElement(range, span)
  console.log("%c[Apply] ✓ Highlight restored successfully", "color:#4caf50")
}

/**
 * Attach hover handlers to all highlights (for edit/delete toolbars)
 */
export function attachHighlightHoverHandlers(): void {
  const highlights = document.querySelectorAll(
    `.${CSS_CLASSES.HIGHLIGHT}`
  ) as NodeListOf<HTMLElement>
  highlights.forEach((hl) => {
    // Avoid duplicate listeners
    if ((hl as any)._hasHoverHandler) return
    ;(hl as any)._hasHoverHandler = true

    hl.addEventListener("mouseenter", (e) => showHighlightToolbar(hl, e))
  })
}

// 📝 Handle clicks on highlights with notes
document.addEventListener("click", (e) => {
  const mark = (e.target as HTMLElement)?.closest?.(
    "mark.hn-highlight[data-note]"
  ) as HTMLElement | null
  if (!mark) return

  const note = mark.dataset.note || ""
  if (!note) return

  const preview = note.length > 200 ? note.slice(0, 200) + "..." : note
  alert(`📝 Note:\n\n${preview}`)
})
