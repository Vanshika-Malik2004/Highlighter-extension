// background/index.ts
chrome.runtime.onInstalled.addListener(() => {
  console.log("[bg] Extension installed")
  chrome.alarms.create("heartbeat", { periodInMinutes: 1 })
})

chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === "heartbeat") console.log("[bg] tick")
})

chrome.runtime.onMessage.addListener((msg, _sender, send) => {
  if (msg?.type === "PING_BG") {
    send({ pong: true, at: Date.now() })
  }
  return true
})
