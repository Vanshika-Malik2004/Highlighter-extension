// lib/highlight-sync.ts
import type { Highlight } from "../contents/utils/types"
import { supabase } from "./supabase"

const SYNC_QUEUE_KEY = "__SYNC_QUEUE__"
const PROCESSING_FLAG_KEY = "__SYNC_PROCESSING__"
const SYNC_BATCH_SIZE = 20

// ---------- Queue Helpers ----------
type SaveOp = { kind: "save"; highlight: Highlight }
type DeleteOp = { kind: "delete"; id: string }
type SyncOp = SaveOp | DeleteOp

async function getQueue(): Promise<SyncOp[]> {
  const data = (await chrome.storage.local.get(SYNC_QUEUE_KEY))[SYNC_QUEUE_KEY]
  return Array.isArray(data) ? data : []
}

async function setQueue(queue: SyncOp[]) {
  await chrome.storage.local.set({ [SYNC_QUEUE_KEY]: queue })
}

export async function addToSyncQueue(op: SyncOp) {
  const queue = await getQueue()
  queue.push(op)
  await setQueue(queue)
}

async function getProcessingFlag(): Promise<boolean> {
  const val = (await chrome.storage.local.get(PROCESSING_FLAG_KEY))[
    PROCESSING_FLAG_KEY
  ]
  return Boolean(val)
}

async function setProcessingFlag(val: boolean) {
  await chrome.storage.local.set({ [PROCESSING_FLAG_KEY]: val })
}

export async function listHighlightsForUrl(url: string) {
  const { data, error } = await supabase
    .from("highlights")
    .select("*")
    .eq("url", url)
    .order("created_at", { ascending: false })

  if (error) throw error
  return data
}

export async function upsertHighlight(h: Highlight) {
  try {
    const { data, error } = await supabase
      .from("highlights")
      .upsert(
        [
          {
            id: h.id,
            user_id: h.user_id,
            url: h.url,
            quote: h.quote,
            prefix: h.prefix,
            suffix: h.suffix,
            color: h.color,
            note: h.note,
            css_path: h.css_path,
            start_pos: h.start_pos,
            end_pos: h.end_pos,
            position: h.position
          }
        ],
        { onConflict: "id" }
      )
      .select()
      .single()

    if (error) throw error
    return data
  } catch (e) {
    // If network or Supabase error, queue it for retry
    await addToSyncQueue({ kind: "save", highlight: h })
    return h // return local copy
  }
}

// ---------- Cloud delete ----------
export async function deleteHighlightFromSupabase(id: string) {
  const { error } = await supabase.from("highlights").delete().eq("id", id)
  if (error) throw error
}
// ---------- Retry processor ----------
export async function processSyncQueue() {
  if (await getProcessingFlag()) return // prevent double run
  await setProcessingFlag(true)

  try {
    let queue = await getQueue()
    if (queue.length === 0) return

    const batch = queue.slice(0, SYNC_BATCH_SIZE)

    for (const op of batch) {
      try {
        if (op.kind === "save") {
          await upsertHighlight(op.highlight)
        } else {
          await deleteHighlightFromSupabase(op.id)
        }

        // remove first processed item
        queue = await getQueue()
        queue.shift()
        await setQueue(queue)
      } catch (err) {
        // stop processing on first failure (offline / network issue)
        break
      }
    }
  } finally {
    await setProcessingFlag(false)
  }
}
