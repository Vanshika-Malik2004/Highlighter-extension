import { useEffect, useState } from "react"

import { HIGHLIGHTER_ENABLED_KEY } from "./contents/utils/constants"

export default function IndexPopup() {
  const [tabUrl, setTabUrl] = useState("")
  const [highlights, setHighlights] = useState<any[]>([])
  const [enabled, setEnabled] = useState(true) // 🌟 toggle state

  // 🧠 Fetch highlights + enabled state on load
  useEffect(() => {
    async function init() {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      })
      const url = tab?.url ?? ""
      setTabUrl(url)

      // 🟢 Load highlights for the page
      if (url) {
        const data = (await chrome.storage.local.get(url))[url]
        setHighlights(data?.highlights ?? [])
      }

      // 🟢 Load enabled/disabled state from sync storage
      const { [HIGHLIGHTER_ENABLED_KEY]: highlighterEnabled } =
        await chrome.storage.sync.get(HIGHLIGHTER_ENABLED_KEY)
      setEnabled(highlighterEnabled !== false) // default true
    }

    init()
  }, [])

  // 🧩 Toggle handler
  const toggleHighlighter = async () => {
    const newState = !enabled
    setEnabled(newState)

    // ✅ use the shared key constant
    await chrome.storage.sync.set({ [HIGHLIGHTER_ENABLED_KEY]: newState })

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) return

    // ✅ send unified message to content script
    await chrome.tabs.sendMessage(tab.id, {
      type: "TOGGLE_HIGHLIGHTER",
      enabled: newState
    })
  }

  // 🧭 Jump to a highlight
  const handleJump = async (id: string) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) return
    await chrome.tabs.sendMessage(tab.id, { type: "SCROLL_TO_HIGHLIGHT", id })
    window.close()
  }

  return (
    <div
      style={{
        width: 340,
        padding: 12,
        fontFamily: "Inter, system-ui, sans-serif"
      }}>
      {/* 🌟 Header row with toggle */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
        <h3 style={{ margin: 0 }}>Highlights</h3>
        <label
          style={{
            fontSize: 13,
            cursor: "pointer",
            userSelect: "none",
            display: "flex",
            alignItems: "center",
            gap: 4
          }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={toggleHighlighter}
            style={{ cursor: "pointer" }}
          />
          <span>{enabled ? "On" : "Off"}</span>
        </label>
      </div>

      <p style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
        {tabUrl || "(unknown)"}
      </p>

      {highlights.length === 0 ? (
        <p style={{ fontSize: 13, opacity: 0.6, marginTop: 12 }}>
          No highlights found.
        </p>
      ) : (
        <div style={{ marginTop: 10, maxHeight: 260, overflowY: "auto" }}>
          {highlights.map((h, i) => (
            <div
              key={i}
              onClick={() => handleJump(h.id)}
              style={{
                background: h.color || "#fff475",
                borderRadius: 8,
                padding: "6px 8px",
                marginBottom: 8,
                cursor: "pointer",
                transition: "background 0.2s",
                boxShadow: "0 1px 4px rgba(0,0,0,0.1)"
              }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#222" }}>
                {h.quote.length > 80 ? h.quote.slice(0, 80) + "..." : h.quote}
              </div>
              {h.note && (
                <div style={{ fontSize: 12, color: "#444", marginTop: 2 }}>
                  📝 {h.note.length > 60 ? h.note.slice(0, 60) + "..." : h.note}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
