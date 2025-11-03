// contents/highlighter.ts
console.log(
  "%c[Highlighter] Content script loaded on:",
  "color:#9c27b0;font-weight:bold",
  location.href
)

const COLORS = ["#fff475", "#a7ffeb", "#ffd6a5", "#caffbf", "#fdffb6"]

// === On load: reapply any saved highlights ===
;(async () => {
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

// === 🧘 Wait for DOM to "settle" (adaptive delay) ===
function waitForPageCalm(maxWait = 5000, calmDuration = 300): Promise<void> {
  return new Promise((resolve) => {
    let lastMutationTime = Date.now()
    let calmTimer: number | null = null
    const startTime = Date.now()

    const checkCalm = () => {
      const elapsed = Date.now() - lastMutationTime
      if (elapsed >= calmDuration) {
        observer.disconnect()
        console.log(
          "%c[Calm] Page settled after",
          "color:#4caf50",
          Date.now() - startTime,
          "ms"
        )
        resolve()
        return
      }
      // Safety: resolve after maxWait regardless
      if (Date.now() - startTime >= maxWait) {
        console.log("%c[Calm] Max wait reached, proceeding...", "color:#ff9800")
        observer.disconnect()
        resolve()
        return
      }
      calmTimer = window.setTimeout(checkCalm, 100)
    }

    const observer = new MutationObserver(() => {
      lastMutationTime = Date.now()
      if (calmTimer) clearTimeout(calmTimer)
      calmTimer = window.setTimeout(checkCalm, 100)
    })

    observer.observe(document.body, { childList: true, subtree: true })
    calmTimer = window.setTimeout(checkCalm, 100)
  })
}

// === 📍 Apply all highlights (with progress tracking) ===
function applyAllHighlights(highlights: any[]) {
  for (const [i, h] of highlights.entries()) {
    console.log(
      `%c[Reapply] (${i + 1}/${highlights.length}) Quote:`,
      "color:#4caf50",
      h.quote.slice(0, 60)
    )
    applyHighlight(h)
  }
}

// === 🧠 React Hydration Fix: Observe DOM changes for SPA updates ===
let globalObserver: MutationObserver | null = null

function observeDomChanges(highlights: any[]) {
  console.log("%c[Observer] Watching DOM for React updates...", "color:#ff5722")

  let reapplyTimeout: number | null = null
  let lastCheckTime = 0
  const THROTTLE_INTERVAL = 1000 // max once per second

  globalObserver = new MutationObserver((mutations) => {
    if (mutations.some((m) => m.type === "childList")) {
      if (reapplyTimeout) clearTimeout(reapplyTimeout)

      // Debounced + throttled re-apply
      reapplyTimeout = window.setTimeout(() => {
        const now = Date.now()
        if (now - lastCheckTime < THROTTLE_INTERVAL) return

        lastCheckTime = now

        // 🐛 FIX: Count actual vs. expected highlights
        const currentCount = document.querySelectorAll(".hn-highlight").length
        const expectedCount = highlights.length

        if (currentCount < expectedCount) {
          console.log(
            `%c[Observer] React updated DOM → Re-applying highlights (${currentCount}/${expectedCount} visible)`,
            "color:#ff5722"
          )
          applyAllHighlights(highlights)
          attachHighlightHoverHandlers()
        }
      }, 500)
    }
  })

  globalObserver.observe(document.body, { childList: true, subtree: true })

  // 🧹 Cleanup on page unload
  window.addEventListener("beforeunload", () => {
    if (globalObserver) {
      globalObserver.disconnect()
      console.log("%c[Observer] Disconnected on unload", "color:#757575")
    }
  })
}

// === Listen for text selection ===
document.addEventListener("mouseup", (e) => {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed) return
  const range = sel.getRangeAt(0)
  const text = range.toString().trim()
  if (!text) return
  console.log(
    "%c[Select] User selected text:",
    "color:#03a9f4",
    `"${text.slice(0, 80)}"`
  )
  showToolbar(e.pageX, e.pageY, range, text)
})

// === Floating toolbar ===
function showToolbar(x: number, y: number, range: Range, quote: string) {
  console.log("%c[Toolbar] Showing color picker", "color:#ff9800")
  const bar = document.createElement("div")
  bar.className = "hn-toolbar"
  Object.assign(bar.style, {
    position: "absolute",
    top: `${y + 8}px`,
    left: `${x}px`,
    background: "#222",
    color: "#fff",
    padding: "6px 8px",
    borderRadius: "8px",
    display: "flex",
    gap: "6px",
    zIndex: "2147483647",
    boxShadow: "0 2px 10px rgba(0,0,0,0.3)"
  })

  COLORS.forEach((c) => {
    const b = document.createElement("button")
    Object.assign(b.style, {
      width: "16px",
      height: "16px",
      borderRadius: "50%",
      border: "none",
      background: c,
      cursor: "pointer"
    })
    b.onclick = () => {
      console.log("%c[Toolbar] Color chosen:", "color:#ff9800", c)
      createHighlight(range, quote, c)
      bar.remove()
    }
    bar.appendChild(b)
  })

  const noteBtn = document.createElement("button")
  noteBtn.textContent = "📝"
  Object.assign(noteBtn.style, {
    background: "transparent",
    border: "none",
    cursor: "pointer"
  })
  noteBtn.onclick = () => {
    const note = prompt("Add a note (optional):") || ""
    console.log("%c[Toolbar] Note added:", "color:#ff9800", note)
    createHighlight(range, quote, COLORS[0], note)
    bar.remove()
  }
  bar.appendChild(noteBtn)

  document.body.appendChild(bar)

  // remove when clicking elsewhere
  setTimeout(() => {
    const handler = (ev: MouseEvent) => {
      if (!bar.contains(ev.target as Node)) bar.remove()
      document.removeEventListener("mousedown", handler)
    }
    document.addEventListener("mousedown", handler)
  }, 0)
}

// === Safe wrapper for ranges that may span multiple elements ===
function wrapRangeInElement(range: Range, element: HTMLElement): void {
  try {
    range.surroundContents(element)
  } catch (e) {
    console.log("%c[Wrap] Using fallback wrapping method", "color:#ff9800")
    const contents = range.extractContents()
    element.appendChild(contents)
    range.insertNode(element)
  }
}

// === Add note icon to highlight element ===
function addNoteIcon(highlightElement: HTMLElement, noteText: string): void {
  const icon = document.createElement("sup")
  icon.className = "hn-note-icon"
  icon.textContent = " 📝"
  Object.assign(icon.style, {
    cursor: "pointer",
    marginLeft: "2px",
    fontSize: "0.8em",
    verticalAlign: "super",
    userSelect: "none"
  })
  icon.onclick = (e) => {
    e.stopPropagation()
    e.preventDefault()
    const noteDisplay =
      noteText.length > 200 ? noteText.slice(0, 200) + "..." : noteText
    alert(`📝 Note:\n\n${noteDisplay}`)
    console.log("%c[Note] Displayed note:", "color:#9c27b0", noteText)
  }
  icon.onmouseenter = () => {
    icon.style.transform = "scale(1.2)"
    icon.style.transition = "transform 0.2s"
  }
  icon.onmouseleave = () => {
    icon.style.transform = "scale(1)"
  }
  highlightElement.appendChild(icon)
  console.log("%c[Note] Icon added to highlight", "color:#9c27b0")
}

// === Create and save highlight ===
async function createHighlight(
  range: Range,
  quote: string,
  color: string,
  note?: string
) {
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
  span.className = "hn-highlight"
  span.dataset.id = id
  span.style.background = color
  span.dataset.color = color
  if (note) span.dataset.note = note

  wrapRangeInElement(range, span)
  if (note) addNoteIcon(span, note)

  const anchor = {
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

// === Extract nearby context ===
function getContext(range: Range, chars: number): string {
  const isPrefix = chars < 0
  const needLength = Math.abs(chars)
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const allNodes: Text[] = []
  let node: Node | null
  while ((node = walker.nextNode())) allNodes.push(node as Text)
  const refNode = isPrefix ? range.startContainer : range.endContainer
  const refOffset = isPrefix ? range.startOffset : range.endOffset
  if (refNode.nodeType !== Node.TEXT_NODE) return ""
  const refIndex = allNodes.indexOf(refNode as Text)
  if (refIndex === -1) return ""
  let context = ""
  if (isPrefix) {
    const textInNode = (refNode.textContent || "").slice(0, refOffset)
    context = textInNode
    let i = refIndex - 1
    while (context.length < needLength && i >= 0) {
      const prevText = allNodes[i].textContent || ""
      context = prevText + context
      i--
    }
    return context.slice(-needLength)
  } else {
    const textInNode = (refNode.textContent || "").slice(refOffset)
    context = textInNode
    let i = refIndex + 1
    while (context.length < needLength && i < allNodes.length) {
      const nextText = allNodes[i].textContent || ""
      context = context + nextText
      i++
    }
    return context.slice(0, needLength)
  }
}

// === Compute absolute offsets ===
function computeOffsets(range: Range) {
  let start = 0,
    end = 0,
    walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  let node: Node | null
  while ((node = walker.nextNode())) {
    const text = node.textContent || ""
    if (node === range.startContainer) start += range.startOffset
    else if (node === range.endContainer) {
      end = start + range.endOffset
      break
    } else start += text.length
  }
  return { start_pos: start, end_pos: end }
}

// === Get simple CSS selector ===
function getCssPath(node: Node): string {
  let el = node.nodeType === 3 ? node.parentElement : (node as Element)
  if (!el) return ""
  const path: string[] = []
  while (el && el.nodeType === 1 && el !== document.body) {
    let selector = el.nodeName.toLowerCase()
    if (el.id) {
      selector += `#${el.id}`
      path.unshift(selector)
      break
    } else {
      const sibs = Array.from(el.parentElement?.children || [])
      const idx = sibs.indexOf(el) + 1
      selector += `:nth-child(${idx})`
      path.unshift(selector)
      el = el.parentElement!
    }
  }
  return path.join(" > ")
}

// === Save to chrome.storage.local ===
async function saveHighlight(anchor: any) {
  const url = location.href
  const existing = (await chrome.storage.local.get(url))[url] || {
    highlights: []
  }
  existing.highlights.push(anchor)
  await chrome.storage.local.set({ [url]: existing })
  console.log("%c[Storage] Highlight saved:", "color:#03a9f4", anchor)
}

// === Apply saved highlight ===
function applyHighlight(anchor: any) {
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
  span.className = "hn-highlight"
  if (id) span.dataset.id = id as string
  span.style.background = color
  wrapRangeInElement(range, span)
  if (note) addNoteIcon(span, note)
  console.log("%c[Apply] ✓ Highlight restored successfully", "color:#4caf50")
}

// === Find quote ===
function findQuote(
  root: Node,
  quote: string,
  prefix?: string,
  suffix?: string,
  start_pos?: number,
  css_path?: string
): Range | null {
  if (css_path) {
    const el = document.querySelector(css_path)
    if (el) root = el
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  const positions: number[] = []
  let combined = ""
  let node: Node | null
  while ((node = walker.nextNode())) {
    textNodes.push(node as Text)
    positions.push(combined.length)
    combined += node.textContent || ""
  }
  const matches: number[] = []
  let idx = combined.indexOf(quote)
  while (idx !== -1) {
    matches.push(idx)
    idx = combined.indexOf(quote, idx + 1)
  }
  if (!matches.length) return null
  const withContext = matches.filter((i) => {
    const before = combined.slice(Math.max(0, i - 10), i)
    const after = combined.slice(i + quote.length, i + quote.length + 10)
    const preOk = !prefix || before.endsWith(prefix.slice(-5))
    const sufOk = !suffix || after.startsWith(suffix.slice(0, 5))
    return preOk && sufOk
  })
  let chosen = withContext[0] ?? matches[0]
  if (withContext.length > 1 && typeof start_pos === "number") {
    chosen = withContext.reduce((best, cur) =>
      Math.abs(cur - start_pos) < Math.abs(best - start_pos) ? cur : best
    )
  }
  const start = chosen
  const end = start + quote.length
  const startNodeIdx = positions.findIndex(
    (p, i) =>
      p <= start && (i === positions.length - 1 || positions[i + 1] > start)
  )
  const endNodeIdx = positions.findIndex(
    (p, i) =>
      p <= end && (i === positions.length - 1 || positions[i + 1] >= end)
  )
  if (startNodeIdx === -1 || endNodeIdx === -1) return null
  const range = document.createRange()
  range.setStart(textNodes[startNodeIdx], start - positions[startNodeIdx])
  range.setEnd(textNodes[endNodeIdx], end - positions[endNodeIdx])
  console.log(
    "%c[FindQuote] Matched occurrence at index",
    "color:#4caf50",
    chosen,
    "out of",
    matches.length
  )
  return range
}
// === Handle popup messages ===
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "SCROLL_TO_HIGHLIGHT") {
    scrollToHighlightById(msg.id)
    sendResponse({ ok: true })
  }
})

function scrollToHighlightById(id: string) {
  const target = document.querySelector(
    `.hn-highlight[data-id="${id}"]`
  ) as HTMLElement
  if (!target) {
    console.warn("Highlight not found for id:", id)
    return
  }

  target.scrollIntoView({ behavior: "smooth", block: "center" })
  target.style.transition = "box-shadow 0.3s, outline 0.3s"
  target.style.boxShadow = "0 0 0 3px #2196f3"
  target.style.outline = "2px solid #2196f3"

  setTimeout(() => {
    target.style.boxShadow = ""
    target.style.outline = ""
  }, 1200)
}

// === Hover toolbar for editing/deleting highlights ===
function attachHighlightHoverHandlers() {
  const highlights = document.querySelectorAll(
    ".hn-highlight"
  ) as NodeListOf<HTMLElement>
  highlights.forEach((hl) => {
    // Avoid duplicate listeners
    if ((hl as any)._hasHoverHandler) return
    ;(hl as any)._hasHoverHandler = true

    hl.addEventListener("mouseenter", (e) => showHighlightToolbar(hl, e))
  })
}

// === Button style helper ===
function buttonStyle() {
  return {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: "2px 4px",
    fontSize: "14px"
  }
}

// === Floating toolbar on hover ===
// === Floating toolbar on hover ===
function showHighlightToolbar(target: HTMLElement, e: MouseEvent) {
  // Avoid multiple toolbars at once
  if (document.querySelector(".hn-edit-toolbar")) return

  const existing = document.querySelector(".hn-hover-toolbar")
  if (existing) existing.remove()

  const rect = target.getBoundingClientRect()

  const bar = document.createElement("div")
  bar.className = "hn-hover-toolbar"
  Object.assign(bar.style, {
    position: "absolute",
    top: `${rect.bottom + window.scrollY + 1}px`, // 👈 BELOW the highlight
    left: `${rect.left + window.scrollX + rect.width / 1}px`,
    transform: "translateX(-50%)",
    background: "#222",
    color: "#fff",
    padding: "4px 8px",
    borderRadius: "8px",
    display: "flex",
    gap: "6px",
    zIndex: "2147483647",
    boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
    fontSize: "13px",
    pointerEvents: "auto",
    transition: "opacity 0.2s",
    opacity: "1"
  })

  const editBtn = document.createElement("button")
  editBtn.textContent = "✏️"
  Object.assign(editBtn.style, buttonStyle())
  editBtn.onclick = (ev) => {
    ev.stopPropagation()
    ev.preventDefault()
    bar.remove()
    openEditToolbar(target)
  }

  const delBtn = document.createElement("button")
  delBtn.textContent = "🗑️"
  Object.assign(delBtn.style, buttonStyle())
  delBtn.onclick = async (ev) => {
    ev.stopPropagation()
    ev.preventDefault()
    bar.remove()
    await deleteHighlight(target)
  }

  bar.append(editBtn, delBtn)
  document.body.appendChild(bar)

  // === 👇 FIX: Make it persist while hovering highlight OR toolbar ===
  let hideTimer: number | null = null

  const startHideTimer = () => {
    hideTimer = window.setTimeout(() => {
      bar.style.opacity = "0"
      setTimeout(() => bar.remove(), 150)
      cleanup()
    }, 800) // <-- wait 0.8s after leaving both
  }

  const cancelHideTimer = () => {
    if (hideTimer) {
      clearTimeout(hideTimer)
      hideTimer = null
    }
  }

  const onMouseEnter = () => cancelHideTimer()
  const onMouseLeave = (ev: MouseEvent) => {
    if (
      !bar.contains(ev.relatedTarget as Node) &&
      !target.contains(ev.relatedTarget as Node)
    ) {
      startHideTimer()
    }
  }

  const cleanup = () => {
    target.removeEventListener("mouseenter", onMouseEnter)
    target.removeEventListener("mouseleave", onMouseLeave)
    bar.removeEventListener("mouseenter", onMouseEnter)
    bar.removeEventListener("mouseleave", onMouseLeave)
  }

  // 🧠 attach both highlight + toolbar listeners
  target.addEventListener("mouseenter", onMouseEnter)
  target.addEventListener("mouseleave", onMouseLeave)
  bar.addEventListener("mouseenter", onMouseEnter)
  bar.addEventListener("mouseleave", onMouseLeave)
}

// === Edit mode (reuse color & note toolbar) ===
function openEditToolbar(target: HTMLElement) {
  const rect = target.getBoundingClientRect()
  const color = target.dataset.color || COLORS[0]
  const note = target.dataset.note || ""
  const id = target.dataset.id
  if (!id) return

  // Remove any existing edit toolbar first
  document.querySelector(".hn-edit-toolbar")?.remove()

  // === 📍 Position toolbar at END of the highlight ===
  const range = document.createRange()
  range.selectNodeContents(target)
  const endRect = range.getBoundingClientRect()

  const bar = document.createElement("div")
  bar.className = "hn-edit-toolbar"
  Object.assign(bar.style, {
    position: "absolute",
    top: `${endRect.bottom + window.scrollY + 6}px`, // below highlight
    left: `${endRect.right + window.scrollX - 120}px`, // align to right edge
    background: "#222",
    color: "#fff",
    padding: "6px 8px",
    borderRadius: "8px",
    display: "flex",
    gap: "6px",
    zIndex: "2147483647",
    boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
    transition: "opacity 0.3s",
    opacity: "1"
  })

  // === 🎨 Color buttons ===
  COLORS.forEach((c) => {
    const b = document.createElement("button")
    Object.assign(b.style, {
      width: "16px",
      height: "16px",
      borderRadius: "50%",
      border: "none",
      background: c,
      cursor: "pointer"
    })
    b.onclick = async () => {
      target.style.background = c
      target.dataset.color = c
      await updateHighlightInStorage(id, { color: c })
      flashHighlight(target, "#2196f3")
      bar.remove()
    }
    bar.appendChild(b)
  })

  // === 📝 Edit note ===
  const noteBtn = document.createElement("button")
  noteBtn.textContent = "📝"
  Object.assign(noteBtn.style, buttonStyle())
  noteBtn.onclick = async () => {
    const newNote = prompt("Edit note:", note) ?? note
    target.dataset.note = newNote

    // Update note icon interaction
    const existingIcon = target.querySelector(".hn-note-icon") as HTMLElement
    if (existingIcon) {
      existingIcon.onclick = (e) => {
        e.stopPropagation()
        e.preventDefault()
        const noteDisplay =
          newNote.length > 200 ? newNote.slice(0, 200) + "..." : newNote
        alert(`📝 Note:\n\n${noteDisplay}`)
      }
    } else {
      addNoteIcon(target, newNote)
    }

    await updateHighlightInStorage(id, { note: newNote })
    flashHighlight(target, "#2196f3")
    bar.remove()
  }
  bar.appendChild(noteBtn)

  // === ✖️ Cancel button ===
  const cancelBtn = document.createElement("button")
  cancelBtn.textContent = "✖️"
  Object.assign(cancelBtn.style, buttonStyle())
  cancelBtn.onclick = () => bar.remove()
  bar.appendChild(cancelBtn)

  document.body.appendChild(bar)

  // === ⏳ Auto-hide after 2 seconds unless hovered ===
  let hideTimer = window.setTimeout(() => bar.remove(), 6000)

  bar.addEventListener("mouseenter", () => clearTimeout(hideTimer))
  bar.addEventListener("mouseleave", () => {
    hideTimer = window.setTimeout(() => bar.remove(), 3000)
  })
}
function flashHighlight(el: HTMLElement, color: string) {
  const original = el.style.boxShadow
  el.style.transition = "box-shadow 0.3s"
  el.style.boxShadow = `0 0 0 3px ${color}`
  setTimeout(() => {
    el.style.boxShadow = original
  }, 500)
}

// === Update existing highlight in storage ===
async function updateHighlightInStorage(id: string, updates: Partial<any>) {
  const url = location.href
  const data = (await chrome.storage.local.get(url))[url]
  if (!data?.highlights) return

  const idx = data.highlights.findIndex((h: any) => h.id === id)
  if (idx === -1) return

  data.highlights[idx] = { ...data.highlights[idx], ...updates }
  await chrome.storage.local.set({ [url]: data })
  console.log(
    "%c[Storage] Highlight updated:",
    "color:#4caf50",
    data.highlights[idx]
  )
}

// === Delete highlight ===
async function deleteHighlight(target: HTMLElement) {
  const id = target.dataset.id
  if (!id) return
  target.replaceWith(...Array.from(target.childNodes)) // unwrap mark
  const url = location.href
  const data = (await chrome.storage.local.get(url))[url]
  if (!data?.highlights) return
  const filtered = data.highlights.filter((h: any) => h.id !== id)
  await chrome.storage.local.set({ [url]: { ...data, highlights: filtered } })
  console.log("%c[Storage] Highlight deleted:", "color:red", id)
}
