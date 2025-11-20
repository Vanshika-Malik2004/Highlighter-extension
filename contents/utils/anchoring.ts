// contents/utils/anchoring.ts

/**
 * Extract nearby context (prefix/suffix) from a range
 */
export function getContext(range: Range, chars: number): string {
  const isPrefix = chars < 0
  const needLength = Math.abs(chars)
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const allNodes: Text[] = []
  let node: Node | null
  while ((node = walker.nextNode())) allNodes.push(node as Text)
  const refNode = isPrefix ? range.startContainer : range.endContainer
  const refOffset = isPrefix ? range.startOffset : range.endOffset
  if (refNode.nodeType !== Node.TEXT_NODE) return ""
  const refIndex = allNodes.indexOf(refNode as Text)
  if (refIndex === -1) return ""
  let context = ""
  if (isPrefix) {
    const textInNode = (refNode.textContent || "").slice(0, refOffset)
    context = textInNode
    let i = refIndex - 1
    while (context.length < needLength && i >= 0) {
      const prevText = allNodes[i].textContent || ""
      context = prevText + context
      i--
    }
    return context.slice(-needLength)
  } else {
    const textInNode = (refNode.textContent || "").slice(refOffset)
    context = textInNode
    let i = refIndex + 1
    while (context.length < needLength && i < allNodes.length) {
      const nextText = allNodes[i].textContent || ""
      context = context + nextText
      i++
    }
    return context.slice(0, needLength)
  }
}

/**
 * Compute absolute character offsets of a range
 */
export function computeOffsets(range: Range) {
  let start = 0,
    end = 0,
    walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  let node: Node | null
  while ((node = walker.nextNode())) {
    const text = node.textContent || ""
    if (node === range.startContainer) start += range.startOffset
    else if (node === range.endContainer) {
      end = start + range.endOffset
      break
    } else start += text.length
  }
  return { start_pos: start, end_pos: end }
}

/**
 * Generate CSS selector path for a node
 */
export function getCssPath(node: Node): string {
  let el = node.nodeType === 3 ? node.parentElement : (node as Element)
  if (!el) return ""
  const path: string[] = []
  while (el && el.nodeType === 1 && el !== document.body) {
    let selector = el.nodeName.toLowerCase()
    if (el.id) {
      selector += `#${el.id}`
      path.unshift(selector)
      break
    } else {
      const sibs = Array.from(el.parentElement?.children || [])
      const idx = sibs.indexOf(el) + 1
      selector += `:nth-child(${idx})`
      path.unshift(selector)
      el = el.parentElement!
    }
  }
  return path.join(" > ")
}

/**
 * Find a quote in the DOM using multiple anchoring strategies
 */
export function findQuote(
  root: Node,
  quote: string,
  prefix?: string,
  suffix?: string,
  start_pos?: number,
  css_path?: string
): Range | null {
  if (css_path) {
    const el = document.querySelector(css_path)
    if (el) root = el
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  const positions: number[] = []
  let combined = ""
  let node: Node | null
  while ((node = walker.nextNode())) {
    textNodes.push(node as Text)
    positions.push(combined.length)
    combined += node.textContent || ""
  }
  const matches: number[] = []
  let idx = combined.indexOf(quote)
  while (idx !== -1) {
    matches.push(idx)
    idx = combined.indexOf(quote, idx + 1)
  }
  if (!matches.length) return null
  const withContext = matches.filter((i) => {
    const before = combined.slice(Math.max(0, i - 10), i)
    const after = combined.slice(i + quote.length, i + quote.length + 10)
    const preOk = !prefix || before.endsWith(prefix.slice(-5))
    const sufOk = !suffix || after.startsWith(suffix.slice(0, 5))
    return preOk && sufOk
  })
  let chosen = withContext[0] ?? matches[0]
  if (withContext.length > 1 && typeof start_pos === "number") {
    chosen = withContext.reduce((best, cur) =>
      Math.abs(cur - start_pos) < Math.abs(best - start_pos) ? cur : best
    )
  }
  const start = chosen
  const end = start + quote.length
  const startNodeIdx = positions.findIndex(
    (p, i) =>
      p <= start && (i === positions.length - 1 || positions[i + 1] > start)
  )
  const endNodeIdx = positions.findIndex(
    (p, i) =>
      p <= end && (i === positions.length - 1 || positions[i + 1] >= end)
  )
  if (startNodeIdx === -1 || endNodeIdx === -1) return null
  const range = document.createRange()
  range.setStart(textNodes[startNodeIdx], start - positions[startNodeIdx])
  range.setEnd(textNodes[endNodeIdx], end - positions[endNodeIdx])
  // console.log(
  //   "%c[FindQuote] Matched occurrence at index",
  //   "color:#4caf50",
  //   chosen,
  //   "out of",
  //   matches.length
  // )
  return range
}
