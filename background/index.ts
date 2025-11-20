// background/index.ts
import { processSyncQueue } from "../lib/highlight-sync"
import { supabase } from "../lib/supabase"

// 🔒 Lock to prevent concurrent sync attempts
let isSyncing = false

/**
 * Safe wrapper around processSyncQueue to prevent concurrent executions
 */
async function safeSyncQueue() {
  if (isSyncing) {
    // console.log("[Background] Sync already in progress, skipping")
    return
  }

  isSyncing = true
  try {
    // Check if user is logged in
    const {
      data: { session }
    } = await supabase.auth.getSession()
    if (!session?.user) {
      // console.log("[Background] No user session, skipping sync")
      return
    }

    // Check if online
    if (!navigator.onLine) {
      // console.log("[Background] Offline, skipping sync")
      return
    }

    // console.log("[Background] Processing sync queue...")
    await processSyncQueue()
    // console.log("[Background] ✅ Sync queue processed successfully")
  } catch (err) {
    // console.error("[Background] ❌ Sync failed:", err)
  } finally {
    isSyncing = false
  }
}

// ═══════════════════════════════════════════════════════════
// 🔄 APPROACH 1: PERIODIC BACKGROUND SYNC (Every 2 minutes)
// ═══════════════════════════════════════════════════════════

/**
 * Create recurring alarm for periodic sync
 */
function createSyncAlarm() {
  chrome.alarms.create("sync-highlights-queue", {
    delayInMinutes: 2,
    periodInMinutes: 2
  })
  // console.log("[Background] ⏰ Sync alarm created (2 min interval)")
}

// On extension install
chrome.runtime.onInstalled.addListener(() => {
  // console.log("[Background] Extension installed/updated")
  createSyncAlarm()
})

// On browser startup
chrome.runtime.onStartup.addListener(() => {
  // console.log("[Background] Browser started")
  createSyncAlarm()
})

// Listen for alarm and trigger sync
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "sync-highlights-queue") {
    // console.log("[Background] ⏰ Periodic sync alarm fired")
    safeSyncQueue()
  }
})

// ═══════════════════════════════════════════════════════════
// 🌐 APPROACH 2: ON RECONNECT DETECTION
// ═══════════════════════════════════════════════════════════

/**
 * Listen for network reconnection in service worker
 */
self.addEventListener("online", () => {
  // console.log("[Background] 🌐 Network reconnected - triggering immediate sync")
  safeSyncQueue()
})

// ═══════════════════════════════════════════════════════════
// 📨 MESSAGE HANDLERS (Manual sync trigger from popup/content)
// ═══════════════════════════════════════════════════════════

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "PROCESS_SYNC_QUEUE") {
    // console.log("[Background] Manual sync requested")
    safeSyncQueue()
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: err.message }))
    return true // Keep channel open for async response
  }

  if (msg.type === "PING") {
    sendResponse({ alive: true })
    return
  }
})

// ═══════════════════════════════════════════════════════════
// 🚀 INITIAL SYNC ON SERVICE WORKER ACTIVATION
// ═══════════════════════════════════════════════════════════

// Trigger sync when service worker first loads
;(async () => {
  // console.log("[Background] Service worker activated")
  // Small delay to let things settle
  setTimeout(() => {
    safeSyncQueue()
  }, 1000)
})()
