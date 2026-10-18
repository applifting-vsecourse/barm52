import { formatDistanceToNowStrict } from "date-fns"
import { Check, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import type { Poll } from "@/features/quack/api/quackSchemas"
import { PollSuggestions } from "@/features/quack/components/PollSuggestions"
import { usePollVote } from "@/features/quack/hooks/usePollVote"
import { formatVotes, percent } from "@/features/quack/lib/poll"

type PollViewProps = { quackId: string; poll: Poll }

// A poll inside its quack's feed item, under the question. It has no card or
// frame of its own: the item is the card.
export function PollView({ quackId, poll: serverPoll }: PollViewProps) {
  const { poll, vote, failure, isAwaitingResults } = usePollVote(quackId, serverPoll)
  const total = poll.totalVotes ?? 0

  return (
    <div className="flex flex-col gap-3 pt-2">
      <ul
        aria-label="Poll answers"
        className="flex flex-col gap-2"
      >
        {poll.options.map((option) => {
          const isChosen = option.id === poll.myVoteOptionId
          const share = option.votes === null ? null : percent(option.votes, total)
          const content = (
            <>
              {/* The bar only pictures the percentage written next to it. */}
              {share !== null ? (
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 rounded-md bg-secondary"
                  style={{ width: `${share}%` }}
                />
              ) : null}
              <span className="relative flex min-w-0 items-center gap-2">
                {isChosen ? (
                  <>
                    <Check
                      aria-hidden
                      className="size-4"
                    />
                    <span className="sr-only">Your vote:</span>
                  </>
                ) : null}
                <span className="break-words">{option.text}</span>
              </span>
              {option.votes !== null && share !== null ? (
                <span className="relative shrink-0 text-muted-foreground tabular-nums">
                  {formatVotes(option.votes)} · {share}%
                </span>
              ) : null}
            </>
          )
          const rowClass =
            "relative h-auto w-full justify-between gap-3 overflow-hidden px-3 py-2 text-left font-normal whitespace-normal"

          return (
            <li key={option.id}>
              {poll.ended ? (
                // Nothing to press once the poll has ended; the row only reports.
                <div
                  className={cn(
                    "flex items-center rounded-md border border-border text-sm",
                    rowClass,
                  )}
                >
                  {content}
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  aria-pressed={isChosen}
                  className={rowClass}
                  onClick={() => vote(option.id)}
                >
                  {content}
                </Button>
              )}
            </li>
          )
        })}
      </ul>

      <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {isAwaitingResults ? (
          <span className="inline-flex items-center gap-2">
            <Loader2
              aria-hidden
              className="size-3 animate-spin"
            />
            Saving your vote…
          </span>
        ) : poll.totalVotes !== null ? (
          <span>{formatVotes(poll.totalVotes)}</span>
        ) : (
          <span>Vote to see results</span>
        )}
        {poll.endsAt ? (
          <>
            <span aria-hidden>·</span>
            <span>
              {poll.ended ? "Ended" : `Ends in ${formatDistanceToNowStrict(poll.endsAt)}`}
            </span>
          </>
        ) : null}
      </p>

      {failure ? (
        <p
          role="alert"
          className="text-sm text-destructive"
        >
          {failure === "ended" ? "This poll has ended." : "Your vote wasn't saved. Try again."}
        </p>
      ) : null}

      <PollSuggestions
        quackId={quackId}
        poll={poll}
      />
    </div>
  )
}
