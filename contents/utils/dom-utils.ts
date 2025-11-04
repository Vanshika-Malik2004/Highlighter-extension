// contents/utils/dom-utils.ts

import { CSS_CLASSES } from "./constants"

/**
 * Safely wrap a range in an element (handles multi-element selections)
 */
export function wrapRangeInElement(range: Range, element: HTMLElement): void {
  try {
    range.surroundContents(element)
  } catch (e) {
    console.log("%c[Wrap] Using fallback wrapping method", "color:#ff9800")
    const contents = range.extractContents()
    element.appendChild(contents)
    range.insertNode(element)
  }
}

/**
 * Add a note icon to a highlight element
 */
export function addNoteIcon(
  highlightElement: HTMLElement,
  noteText: string
): void {
  const icon = document.createElement("sup")
  icon.className = CSS_CLASSES.NOTE_ICON
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

/**
 * Flash a highlight with a colored outline
 */
export function flashHighlight(el: HTMLElement, color: string): void {
  const original = el.style.boxShadow
  el.style.transition = "box-shadow 0.3s"
  el.style.boxShadow = `0 0 0 3px ${color}`
  setTimeout(() => {
    el.style.boxShadow = original
  }, 500)
}

/**
 * Scroll to and focus a highlight by its ID
 */
export function scrollToHighlightById(id: string): void {
  const target = document.querySelector(
    `.${CSS_CLASSES.HIGHLIGHT}[data-id="${id}"]`
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
