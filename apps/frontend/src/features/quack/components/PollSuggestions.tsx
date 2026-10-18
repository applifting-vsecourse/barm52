import { useId, useState, type FormEvent } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import {
  approvePollSuggestion,
  PollEndedError,
  rejectPollSuggestion,
  suggestPollOption,
} from "@/features/quack/api/pollApi"
import { setPollInLists } from "@/features/quack/api/pollCache"
import { quackKeys } from "@/features/quack/api/quackKeys"
import { MAX_POLL_OPTION_LENGTH, type Poll } from "@/features/quack/api/quackSchemas"

type PollSuggestionsProps = { quackId: string; poll: Poll }

// Mirrors the server's checks so the reader hears about a mistake before the
// request; the server still decides, against suggestions this reader can't see.
function suggestionError(text: string, poll: Poll): string | null {
  const answer = text.trim()
  if (!answer) return "Write an answer first"
  if (answer.length > MAX_POLL_OPTION_LENGTH) {
    return `Keep it under ${MAX_POLL_OPTION_LENGTH} characters`
  }
  const known = [...poll.options, ...poll.pendingSuggestions].map((o) => o.text.toLowerCase())
  if (known.includes(answer.toLowerCase())) return "Answers must be different"
  return null
}

function useApplyPoll(quackId: string) {
  const queryClient = useQueryClient()
  return async (poll: Poll) => {
    setPollInLists(queryClient, quackId, poll)
    await queryClient.invalidateQueries({ queryKey: quackKeys.lists() })
  }
}

// Refused because the poll ended: refetch, so it shows as ended for everyone.
function useOnPollError() {
  const queryClient = useQueryClient()
  return (error: Error) => {
    if (error instanceof PollEndedError) {
      void queryClient.invalidateQueries({ queryKey: quackKeys.lists() })
    }
  }
}

export function PollSuggestions({ quackId, poll }: PollSuggestionsProps) {
  return (
    <>
      {poll.pendingSuggestions.length > 0 ? (
        poll.isAuthor ? (
          <PendingForAuthor
            quackId={quackId}
            poll={poll}
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {poll.pendingSuggestions.map((suggestion) => (
              <li
                key={suggestion.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed border-border px-3 py-2 text-sm"
              >
                <span className="break-words">{suggestion.text}</span>
                <span className="text-xs text-muted-foreground">Awaiting approval</span>
              </li>
            ))}
          </ul>
        )
      ) : null}

      {poll.canSuggest ? (
        <SuggestForm
          quackId={quackId}
          poll={poll}
        />
      ) : null}
    </>
  )
}

function SuggestForm({ quackId, poll }: PollSuggestionsProps) {
  const inputId = useId()
  const errorId = useId()
  const [text, setText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const applyPoll = useApplyPoll(quackId)
  const onPollError = useOnPollError()
  const suggest = useMutation({
    mutationFn: (answer: string) => suggestPollOption(quackId, answer),
    onSuccess: async (saved) => {
      setText("")
      await applyPoll(saved)
    },
    onError: (failure) => {
      setError(failure.message)
      onPollError(failure)
    },
  })

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const problem = suggestionError(text, poll)
    setError(problem)
    if (!problem) suggest.mutate(text.trim())
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      className="flex flex-col gap-2"
    >
      <Label htmlFor={inputId}>Your answer</Label>
      <div className="flex flex-wrap gap-2">
        <Input
          id={inputId}
          value={text}
          maxLength={MAX_POLL_OPTION_LENGTH}
          placeholder="Another option"
          disabled={suggest.isPending}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="min-w-0 flex-1"
          onChange={(event) => setText(event.target.value)}
        />
        <Button
          type="submit"
          variant="outline"
          disabled={suggest.isPending}
        >
          {suggest.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          Suggest an answer
        </Button>
      </div>
      {error ? (
        <p
          id={errorId}
          className="text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}
    </form>
  )
}

function PendingForAuthor({ quackId, poll }: PollSuggestionsProps) {
  const applyPoll = useApplyPoll(quackId)
  const onPollError = useOnPollError()
  const decide = useMutation({
    mutationFn: ({ optionId, decision }: { optionId: string; decision: "approve" | "reject" }) =>
      decision === "approve"
        ? approvePollSuggestion(quackId, optionId)
        : rejectPollSuggestion(quackId, optionId),
    onSuccess: applyPoll,
    onError: onPollError,
  })
  const count = poll.pendingSuggestions.length

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        {count === 1 ? "1 suggestion" : `${count} suggestions`} awaiting approval
      </p>
      <ul className="flex flex-col gap-2">
        {poll.pendingSuggestions.map((suggestion) => (
          <li
            key={suggestion.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed border-border px-3 py-2 text-sm"
          >
            <span className="break-words">{suggestion.text}</span>
            <span className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={decide.isPending}
                onClick={() => decide.mutate({ optionId: suggestion.id, decision: "approve" })}
              >
                Approve
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={decide.isPending}
                onClick={() => decide.mutate({ optionId: suggestion.id, decision: "reject" })}
              >
                Reject
              </Button>
            </span>
          </li>
        ))}
      </ul>
      {decide.error ? (
        <p
          role="alert"
          className="text-sm text-destructive"
        >
          {decide.error.message}
        </p>
      ) : null}
    </div>
  )
}
