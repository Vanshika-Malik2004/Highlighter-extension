// contents/utils/storage.ts

import { currentHighlights } from "../highlighter"
import { isDeletingNow, startDeleteCooldown } from "./observers"
import type { HighlightAnchor } from "./types"

/**
 * Save a highlight to chrome.storage.local
 */
export async function saveHighlight(anchor: HighlightAnchor): Promise<void> {
  const url = location.href
  const existing = (await chrome.storage.local.get(url))[url] || {
    highlights: []
  }
  existing.highlights.push(anchor)
  await chrome.storage.local.set({ [url]: existing })

  // 🔥 Update module cache
  currentHighlights.push(anchor)

  console.log("%c[Storage] Highlight saved:", "color:#03a9f4", anchor)
}

/**
 * Update an existing highlight in storage
 */
export async function updateHighlightInStorage(
  id: string,
  updates: Partial<HighlightAnchor>
): Promise<void> {
  const url = location.href
  const data = (await chrome.storage.local.get(url))[url]
  if (!data?.highlights) return

  const idx = data.highlights.findIndex((h: HighlightAnchor) => h.id === id)
  if (idx === -1) return

  data.highlights[idx] = { ...data.highlights[idx], ...updates }
  await chrome.storage.local.set({ [url]: data })

  // 🔥 Update module cache
  const cacheIdx = currentHighlights.findIndex((h) => h.id === id)
  if (cacheIdx !== -1) {
    currentHighlights[cacheIdx] = { ...currentHighlights[cacheIdx], ...updates }
  }

  console.log(
    "%c[Storage] Highlight updated:",
    "color:#4caf50",
    data.highlights[idx]
  )
}

/**
 * Delete a highlight from storage
 */
// contents/utils/storage.ts

export async function deleteHighlight(target: HTMLElement) {
  const id = target.dataset.id || target.getAttribute("id")
  if (!id) return

  // 1) Start short cooldown so MutationObserver won’t repaint this deletion
  startDeleteCooldown(500)

  // 2) Update in-memory cache FIRST (so expectedCount drops before DOM mutation)
  {
    const idx = currentHighlights.findIndex((h) => h.id === id)
    if (idx !== -1) currentHighlights.splice(idx, 1)
  }

  // 3) Unwrap *all* instances of this highlight id across the document
  const nodes = document.querySelectorAll(
    `mark.hn-highlight[id="${id}"], mark.hn-highlight[data-id="${id}"]`
  )
  nodes.forEach((node) => {
    const el = node as HTMLElement

    // remove sibling note icon (if any)
    const sib = el.nextElementSibling
    if (sib && sib.classList.contains("hn-note-icon")) sib.remove()

    // remove any embedded note icons
    el.querySelectorAll(".hn-note-icon").forEach((icon) => icon.remove())

    // unwrap <mark> → keep text
    const frag = document.createDocumentFragment()
    Array.from(el.childNodes).forEach((n) => frag.appendChild(n))
    el.replaceWith(frag)
  })

  // 4) Update storage last
  const url = location.href
  const data = (await chrome.storage.local.get(url))[url] ?? { highlights: [] }
  const filtered = (data.highlights ?? []).filter((h: any) => h.id !== id)
  await chrome.storage.local.set({ [url]: { ...data, highlights: filtered } })

  console.log("%c[Storage] Highlight deleted:", "color:red", id)
}
