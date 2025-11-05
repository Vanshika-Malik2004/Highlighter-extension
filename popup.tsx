import { useEffect, useState } from "react"

import AuthForm from "./components/AuthForm"
import { HIGHLIGHTER_ENABLED_KEY } from "./contents/utils/constants"
import { listHighlightsForUrl } from "./lib/highlight-sync"
import { supabase } from "./lib/supabase"

export default function IndexPopup() {
  const [tabUrl, setTabUrl] = useState("")
  const [enabled, setEnabled] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [highlights, setHighlights] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const handleJump = async (id: string) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) return
    await chrome.tabs.sendMessage(tab.id, { type: "SCROLL_TO_HIGHLIGHT", id })
    window.close()
  }

  const handleDelete = async (id: string) => {
    // 1) Remove from local storage for this URL
    const url = tabUrl
    const data = (await chrome.storage.local.get(url))[url] ?? {
      highlights: []
    }
    const next = { highlights: data.highlights.filter((h: any) => h.id !== id) }
    await chrome.storage.local.set({ [url]: next })

    // 2) Update popup state
    setHighlights(next.highlights)

    // 3) Tell content script to unpaint immediately (no refresh)
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.id) {
      await chrome.tabs.sendMessage(tab.id, { type: "DELETE_HIGHLIGHT", id })
    }
  }
  // On mount: fetch tab info + session
  useEffect(() => {
    ;(async () => {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      })
      const url = tab?.url ?? ""
      setTabUrl(url)

      const { [HIGHLIGHTER_ENABLED_KEY]: storedState } =
        await chrome.storage.sync.get(HIGHLIGHTER_ENABLED_KEY)
      setEnabled(storedState !== false)

      const { data } = await supabase.auth.getSession()
      setUser(data.session?.user ?? null)
      setLoading(false)
    })()
  }, [])

  // Listen for auth changes
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
      }
    )
    return () => listener.subscription.unsubscribe()
  }, [])

  // Load highlights for current URL
  useEffect(() => {
    if (!tabUrl) return
    ;(async () => {
      const local = (await chrome.storage.local.get(tabUrl))[tabUrl]
      setHighlights(local?.highlights ?? [])

      if (user) {
        try {
          const remote = await listHighlightsForUrl(tabUrl)
          setHighlights(remote)
        } catch {}
      }
    })()
  }, [tabUrl, user])

  const toggleHighlighter = async () => {
    const newState = !enabled
    setEnabled(newState)
    await chrome.storage.sync.set({ [HIGHLIGHTER_ENABLED_KEY]: newState })
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.id)
      await chrome.tabs.sendMessage(tab.id, {
        type: "TOGGLE_HIGHLIGHTER",
        enabled: newState
      })
  }

  const signOut = async () => {
    await supabase.auth.signOut()

    // Notify all active tabs to clear highlights immediately
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.id) {
      await chrome.tabs.sendMessage(tab.id, { type: "USER_SIGNED_OUT" })
    }
  }
  // Notify page on login as well
  useEffect(() => {
    if (user && tabUrl) {
      ;(async () => {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true
        })
        if (tab?.id) {
          await chrome.tabs.sendMessage(tab.id, { type: "USER_SIGNED_IN" })
        }
      })()
    }
  }, [user, tabUrl])

  if (loading) return <div style={{ padding: 16 }}>Loading…</div>

  return (
    <div style={{ width: 340, padding: 12, fontFamily: "Inter, sans-serif" }}>
      <h3>Highlights</h3>

      {!user ? (
        <AuthForm />
      ) : (
        <>
          <div style={{ fontSize: 12, marginBottom: 8 }}>
            Signed in as <b>{user.email}</b>{" "}
            <button
              onClick={signOut}
              style={{
                border: "1px solid #ccc",
                borderRadius: 6,
                marginLeft: 6,
                padding: "2px 6px"
              }}>
              Sign out
            </button>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={toggleHighlighter}
            />
            <span>{enabled ? "On" : "Off"}</span>
          </label>

          {highlights.length === 0 ? (
            <p style={{ fontSize: 13, opacity: 0.6, marginTop: 12 }}>
              No highlights found.
            </p>
          ) : (
            <div style={{ marginTop: 10, maxHeight: 260, overflowY: "auto" }}>
              {highlights.map((h, i) => (
                <div
                  key={h.id || i}
                  style={{
                    background: h.color || "#fff475",
                    borderRadius: 8,
                    padding: "6px 8px",
                    marginBottom: 8,
                    display: "flex",
                    gap: 8,
                    alignItems: "flex-start"
                  }}>
                  {/* Click area → jump */}
                  <div
                    onClick={() => handleJump(h.id)}
                    style={{ cursor: "pointer", flex: 1 }}
                    title="Jump to this highlight">
                    <div
                      style={{ fontSize: 13, fontWeight: 500, color: "#222" }}>
                      {h.quote?.length > 200
                        ? h.quote.slice(0, 200) + "…"
                        : h.quote}
                    </div>
                    {h.note && (
                      <div
                        style={{ fontSize: 12, color: "#444", marginTop: 2 }}>
                        📝{" "}
                        {h.note.length > 60
                          ? h.note.slice(0, 60) + "…"
                          : h.note}
                      </div>
                    )}
                  </div>

                  {/* Delete button */}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
