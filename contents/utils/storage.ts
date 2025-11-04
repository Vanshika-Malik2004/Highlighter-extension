// contents/utils/storage.ts

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
  console.log(
    "%c[Storage] Highlight updated:",
    "color:#4caf50",
    data.highlights[idx]
  )
}

/**
 * Delete a highlight from storage
 */
export async function deleteHighlight(target: HTMLElement): Promise<void> {
  const id = target.dataset.id
  if (!id) return
  target.replaceWith(...Array.from(target.childNodes)) // unwrap mark
  const url = location.href
  const data = (await chrome.storage.local.get(url))[url]
  if (!data?.highlights) return
  const filtered = data.highlights.filter((h: HighlightAnchor) => h.id !== id)
  await chrome.storage.local.set({ [url]: { ...data, highlights: filtered } })
  console.log("%c[Storage] Highlight deleted:", "color:red", id)
}
