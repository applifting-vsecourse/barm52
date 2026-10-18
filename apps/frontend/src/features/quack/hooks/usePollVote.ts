import { useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { PollEndedError, votePoll } from "@/features/quack/api/pollApi"
import { setPollInLists } from "@/features/quack/api/pollCache"
import { quackKeys } from "@/features/quack/api/quackKeys"
import type { Poll } from "@/features/quack/api/quackSchemas"
import { applyChoice } from "@/features/quack/lib/poll"

export type VoteFailure = "failed" | "ended"

// Voting in one poll. The click shows at once (the reader's last choice is laid
// over the server's data with applyChoice), while the requests go out one after
// another so the server always ends on the last click. Each answer from the
// server goes into the cache; once the last one is in, the lists are refetched.
// If the last choice can't be saved, the overlay is dropped and the poll shows
// what the server last confirmed, with a lasting error next to it.
export function usePollVote(quackId: string, serverPoll: Poll) {
  const queryClient = useQueryClient()
  // `settled` once the server has accepted this very choice: the overlay then
  // stays only until the data passed in shows it, so nothing flickers back.
  const [overlay, setOverlay] = useState<{ optionId: string; settled: boolean } | null>(null)
  const [failure, setFailure] = useState<VoteFailure | null>(null)
  const latestClick = useRef(0)
  const queue = useRef<Promise<void>>(Promise.resolve())

  // Drop a settled overlay as soon as the data passed in carries the vote. This
  // adjusts state while rendering, when the prop changes, as React recommends
  // over an effect.
  const [seenPoll, setSeenPoll] = useState(serverPoll)
  if (seenPoll !== serverPoll) {
    setSeenPoll(serverPoll)
    if (overlay?.settled && serverPoll.myVoteOptionId === overlay.optionId) {
      setOverlay(null)
    }
  }

  const poll = overlay ? applyChoice(serverPoll, overlay.optionId) : serverPoll
  const isEnded = poll.ended || failure === "ended"

  const vote = (optionId: string) => {
    // A click on the answer already shown as chosen changes nothing and sends
    // nothing.
    if (isEnded || optionId === poll.myVoteOptionId) return
    const click = ++latestClick.current
    setOverlay({ optionId, settled: false })
    setFailure(null)

    queue.current = queue.current.then(async () => {
      try {
        const saved = await votePoll(quackId, optionId)
        setPollInLists(queryClient, quackId, saved)
        if (click !== latestClick.current) return
        setOverlay((current) =>
          current?.optionId === optionId ? { optionId, settled: true } : current,
        )
        await queryClient.invalidateQueries({ queryKey: quackKeys.lists() })
      } catch (error) {
        // An earlier click failing doesn't matter once a later one is on its way.
        if (click !== latestClick.current) return
        setOverlay(null)
        if (error instanceof PollEndedError) {
          setFailure("ended")
          setPollInLists(queryClient, quackId, { ...serverPoll, ended: true, canSuggest: false })
          await queryClient.invalidateQueries({ queryKey: quackKeys.lists() })
        } else {
          setFailure("failed")
        }
      }
    })
  }

  return {
    poll: isEnded ? { ...poll, ended: true, canSuggest: false } : poll,
    vote,
    failure,
    // The first vote in a poll with hidden results: the choice shows, but the
    // numbers only come with the server's answer.
    isAwaitingResults: overlay !== null && !overlay.settled && !poll.resultsVisible,
  }
}
