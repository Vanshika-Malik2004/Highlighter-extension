// lib/highlight-sync.ts
import { supabase } from "./supabase"

export type Highlight = {
  id?: string
  url: string
  quote: string
  color?: string
  note?: string
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
  const { data, error } = await supabase
    .from("highlights")
    .upsert([h], { onConflict: "id" })
    .select()
    .single()

  if (error) throw error
  return data
}
