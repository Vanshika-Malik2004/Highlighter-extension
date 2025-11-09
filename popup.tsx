import { useEffect, useState } from "react"

import "./style.css"

import AuthForm from "./components/AuthForm"
import { HIGHLIGHTER_ENABLED_KEY } from "./contents/utils/constants"
import { listHighlightsForUrl, processSyncQueue } from "./lib/highlight-sync"
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
      // 1️⃣ Load from local storage first
      const local = (await chrome.storage.local.get(tabUrl))[tabUrl]
      const localHighlights = local?.highlights ?? []

      if (!user) {
        // Not logged in → show only local
        setHighlights(localHighlights)
        return
      }
      try {
        await processSyncQueue() // ⬅️ ADD THIS LINE
        console.log("[Popup] Sync queue processed, now fetching from Supabase")
      } catch (err) {
        console.warn("[Popup] Sync failed:", err)
      }

      // 2️⃣ Fetch from Supabase and merge with local
      try {
        const remote = await listHighlightsForUrl(tabUrl)

        // Create a map of remote highlights by ID for fast lookup
        const remoteMap = new Map(remote.map((h) => [h.id, h]))

        // Merge strategy: prefer remote version if exists, otherwise use local
        const merged = localHighlights.map((h) => remoteMap.get(h.id) || h)

        // Add any remote highlights that aren't in local
        remote.forEach((h) => {
          if (!localHighlights.find((local) => local.id === h.id)) {
            merged.push(h)
          }
        })

        console.log(
          `[Popup] Merged highlights: ${localHighlights.length} local + ${remote.length} remote = ${merged.length} total`
        )
        await chrome.storage.local.set({
          [tabUrl]: { highlights: merged }
        })

        console.log(
          `[Popup] Saved ${merged.length} merged highlights to local storage`
        )
        setHighlights(merged)
      } catch (err) {
        console.warn("[Popup] Failed to fetch remote, showing local only:", err)
        // Network error → fall back to local
        setHighlights(localHighlights)
      }
    })()
  }, [tabUrl, user])
  // Process sync queue when popup first opens (if logged in)
  useEffect(() => {
    if (user) {
      console.log("[Popup] Popup opened - processing sync queue")
      processSyncQueue().catch((err) =>
        console.warn("[Popup] Sync queue failed:", err)
      )
    }
  }, []) // Empty deps = run once on mount
  useEffect(() => {
    if (user) processSyncQueue().catch(() => {})
  }, [user])
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

  if (loading) return <div style={{ padding: 16, minWidth: 340 }}>Loading…</div>

  return (
    <div
      style={{
        minWidth: 340,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#edeef0"
      }}>
      {!user ? (
        <AuthForm />
      ) : (
        <div style={{ padding: "10px", background: "#edeef0" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "start"
            }}>
            <div style={{ marginBottom: 8 }}>
              <h3 style={{ fontSize: 20, fontWeight: 900 }}>Welcome Back!</h3>
              {/* <p>{user.email}</p> */}
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={enabled}
                onChange={toggleHighlighter}
              />
              <span className="slider round"></span>
            </label>
          </div>
          <div style={{ marginTop: 10, marginBottom: 10 }}>
            {highlights.length === 0 ? (
              <b>No highlights found.</b>
            ) : !enabled ? (
              <p>Enable highlighter to view highlights </p>
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
                    <div
                      onClick={() => handleJump(h.id)}
                      style={{ cursor: "pointer", flex: 1 }}
                      title="Jump to this highlight">
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: "#222"
                        }}>
                        {h.quote?.length > 100
                          ? h.quote.slice(0, 100) + "…"
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
          </div>
          <button onClick={signOut} className="sign-out-btn">
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
