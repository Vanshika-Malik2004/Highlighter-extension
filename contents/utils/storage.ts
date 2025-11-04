// contents/utils/storage.ts

import { currentHighlights } from "../highlighter"
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
export async function deleteHighlight(target: HTMLElement) {
  const id = target.dataset.id
  if (!id) return

  // 🧹 Case 1: Remove associated note icon if it's a sibling
  const siblingIcon = target.nextElementSibling
  if (siblingIcon && siblingIcon.classList.contains("hn-note-icon")) {
    siblingIcon.remove()
  }

  // 🧹 Case 2: Remove any embedded note icons inside the highlight (for React/SPAs)
  target.querySelectorAll(".hn-note-icon").forEach((icon) => icon.remove())

  // Unwrap the text (remove <mark>)
  target.replaceWith(...Array.from(target.childNodes))

  // 🧠 Update storage
  const url = location.href
  const data = (await chrome.storage.local.get(url))[url]
  if (!data?.highlights) return

  const filtered = data.highlights.filter((h: any) => h.id !== id)
  await chrome.storage.local.set({ [url]: { ...data, highlights: filtered } })

  // 🔥 Update module cache - THIS FIXES THE INFINITE LOOP!
  const cacheIdx = currentHighlights.findIndex((h) => h.id === id)
  if (cacheIdx !== -1) {
    currentHighlights.splice(cacheIdx, 1)
  }

  console.log("%c[Storage] Highlight deleted:", "color:red", id)
}
