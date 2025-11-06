// contents/utils/types.ts

export interface HighlightAnchor {
  id: string
  quote: string
  prefix: string
  suffix: string
  color: string
  note?: string
  start_pos: number
  end_pos: number
  css_path: string
}

export interface HighlightData {
  highlights: HighlightAnchor[]
}

export interface Highlight {
  id: string
  user_id?: string
  url: string
  quote: string
  prefix?: string
  suffix?: string
  color: string
  note?: string
  css_path?: string
  start_pos?: number
  end_pos?: number
  position?: any
  created_at?: string
  updated_at?: string
}
