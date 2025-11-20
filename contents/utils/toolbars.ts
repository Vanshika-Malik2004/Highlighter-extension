// contents/utils/toolbars.ts
import { COLORS, CSS_CLASSES, HIGHLIGHTER_ENABLED_KEY } from "./constants"
import { addNoteIcon, flashHighlight } from "./dom-utils"
import { createHighlight } from "./highlight-operations"
import { deleteHighlight, updateHighlightInStorage } from "./storage"

/**
 * Button style helper
 */
export function buttonStyle() {
  return {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: "2px 4px",
    fontSize: "14px"
  }
}

/**
 * Show floating toolbar after text selection (for creating highlights)
 */
export function showToolbar(
  x: number,
  y: number,
  range: Range,
  quote: string
): void {
  // console.log("%c[Toolbar] Showing color picker", "color:#ff9800")
  const bar = document.createElement("div")
  bar.className = CSS_CLASSES.TOOLBAR
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
      // console.log("%c[Toolbar] Color chosen:", "color:#ff9800", c)
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
    // console.log("%c[Toolbar] Note added:", "color:#ff9800", note)
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

/**
 * Show floating toolbar on highlight hover (for editing/deleting)
 */
export function showHighlightToolbar(target: HTMLElement, e: MouseEvent): void {
  // Avoid multiple toolbars at once
  if (document.querySelector(`.${CSS_CLASSES.EDIT_TOOLBAR}`)) return

  const existing = document.querySelector(`.${CSS_CLASSES.HOVER_TOOLBAR}`)
  if (existing) existing.remove()

  const rect = target.getBoundingClientRect()

  const bar = document.createElement("div")
  bar.className = CSS_CLASSES.HOVER_TOOLBAR
  Object.assign(bar.style, {
    position: "absolute",
    top: `${rect.bottom + window.scrollY + 1}px`,
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

  // Make it persist while hovering highlight OR toolbar
  let hideTimer: number | null = null

  const startHideTimer = () => {
    hideTimer = window.setTimeout(() => {
      bar.style.opacity = "0"
      setTimeout(() => bar.remove(), 150)
      cleanup()
    }, 800)
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

  target.addEventListener("mouseenter", onMouseEnter)
  target.addEventListener("mouseleave", onMouseLeave)
  bar.addEventListener("mouseenter", onMouseEnter)
  bar.addEventListener("mouseleave", onMouseLeave)
}

/**
 * Open edit toolbar for an existing highlight
 */
export function openEditToolbar(target: HTMLElement): void {
  const rect = target.getBoundingClientRect()
  const color = target.dataset.color || COLORS[0]
  const note = target.dataset.note || ""
  const id = target.dataset.id
  if (!id) return

  // Remove any existing edit toolbar first
  document.querySelector(`.${CSS_CLASSES.EDIT_TOOLBAR}`)?.remove()

  const range = document.createRange()
  range.selectNodeContents(target)
  const endRect = range.getBoundingClientRect()

  const bar = document.createElement("div")
  bar.className = CSS_CLASSES.EDIT_TOOLBAR
  Object.assign(bar.style, {
    position: "absolute",
    top: `${endRect.bottom + window.scrollY + 6}px`,
    left: `${endRect.right + window.scrollX - 120}px`,
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

  // Color buttons
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

  // Edit note button
  const noteBtn = document.createElement("button")
  noteBtn.textContent = "📝"
  Object.assign(noteBtn.style, buttonStyle())
  noteBtn.onclick = async () => {
    const newNote = prompt("Edit note:", note) ?? note
    target.dataset.note = newNote

    const existingIcon = target.querySelector(
      `.${CSS_CLASSES.NOTE_ICON}`
    ) as HTMLElement
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

  // Cancel button
  const cancelBtn = document.createElement("button")
  cancelBtn.textContent = "✖️"
  Object.assign(cancelBtn.style, buttonStyle())
  cancelBtn.onclick = () => bar.remove()
  bar.appendChild(cancelBtn)

  document.body.appendChild(bar)

  // Auto-hide after inactivity
  let hideTimer = window.setTimeout(() => bar.remove(), 6000)

  bar.addEventListener("mouseenter", () => clearTimeout(hideTimer))
  bar.addEventListener("mouseleave", () => {
    hideTimer = window.setTimeout(() => bar.remove(), 3000)
  })
}
