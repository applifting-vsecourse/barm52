import { useEffect, useState } from "react"

// How long the text has to sit still before the list follows it.
const PAUSE_MS = 300

// The state behind the search box. `text` is what the box shows; `search` is
// that text once it has paused, trimmed, and is what the list is fetched with.
export function useQuackSearch() {
  const [text, setText] = useState("")
  const [pausedText, setPausedText] = useState("")

  useEffect(() => {
    const timer = setTimeout(() => setPausedText(text), PAUSE_MS)
    return () => clearTimeout(timer)
  }, [text])

  // Clearing doesn't wait for the pause: whoever asked for it wants the feed now.
  const clear = () => {
    setText("")
    setPausedText("")
  }

  const search = pausedText.trim()

  return {
    text,
    setText,
    search,
    // Mirrors the server: a search of only spaces and @ signs has no words, so
    // it is the plain feed rather than a search that found nothing.
    isSearch: /[^\s@]/.test(search),
    clear,
  }
}
