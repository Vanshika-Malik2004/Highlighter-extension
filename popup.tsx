import { useEffect, useState } from "react"

export default function IndexPopup() {
  const [tabUrl, setTabUrl] = useState("")
  const [highlights, setHighlights] = useState<any[]>([])

  // 🧠 Fetch highlights for active tab
  useEffect(() => {
    async function fetchHighlights() {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      })
      const url = tab?.url ?? ""
      setTabUrl(url)

      if (!url) return
      const data = (await chrome.storage.local.get(url))[url]
      setHighlights(data?.highlights ?? [])
    }

    fetchHighlights()
  }, [])

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
      <h3 style={{ margin: 0 }}>Highlights for this page</h3>
      <p style={{ fontSize: 12, opacity: 0.7 }}>{tabUrl || "(unknown)"}</p>

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
