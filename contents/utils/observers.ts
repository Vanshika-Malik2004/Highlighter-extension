// contents/utils/observers.ts
import {
  CALM_DURATION,
  CSS_CLASSES,
  MAX_WAIT,
  THROTTLE_INTERVAL
} from "./constants"
import {
  applyHighlight,
  attachHighlightHoverHandlers
} from "./highlight-operations"
import type { HighlightAnchor } from "./types"

/**
 * Wait for DOM to "settle" (no mutations for a certain duration)
 */
export function waitForPageCalm(
  maxWait = MAX_WAIT,
  calmDuration = CALM_DURATION
): Promise<void> {
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

/**
 * Apply all highlights with progress tracking
 */
export function applyAllHighlights(highlights: HighlightAnchor[]): void {
  for (const [i, h] of highlights.entries()) {
    console.log(
      `%c[Reapply] (${i + 1}/${highlights.length}) Quote:`,
      "color:#4caf50",
      h.quote.slice(0, 60)
    )
    applyHighlight(h)
  }
}

/**
 * Global observer instance
 */
let globalObserver: MutationObserver | null = null

/**
 * Observe DOM changes and re-apply highlights when needed (React, SPA updates)
 */

export function observeDomChanges(highlights: HighlightAnchor[]): void {
  console.log("%c[Observer] Watching DOM for React updates...", "color:#ff5722")

  let reapplyTimeout: number | null = null
  let lastCheckTime = 0

  globalObserver = new MutationObserver((mutations) => {
    if (mutations.some((m) => m.type === "childList")) {
      if (reapplyTimeout) clearTimeout(reapplyTimeout)

      // Debounced + throttled re-apply
      reapplyTimeout = window.setTimeout(() => {
        const now = Date.now()
        if (now - lastCheckTime < THROTTLE_INTERVAL) return

        lastCheckTime = now

        // 🐛 FIX: Count actual vs. expected highlights
        const currentCount = document.querySelectorAll(
          `.${CSS_CLASSES.HIGHLIGHT}`
        ).length
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
