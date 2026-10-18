import type { Poll } from "@/features/quack/api/quackSchemas"

// The share of the votes as a whole percent, rounded half up: 1 of 8 is 13%.
// Integer arithmetic, so no floating-point error can tip a .5 the wrong way.
// No votes at all is 0%. The shown percentages may add up to 99–101; the
// counts are what is exact.
export function percent(votes: number, total: number): number {
  if (total <= 0) return 0
  return Math.floor((200 * votes + total) / (2 * total))
}

export function formatVotes(count: number): string {
  return count === 1 ? "1 vote" : `${count} votes`
}

// The poll as it will be once the server records a vote for `optionId`: the
// reader's vote moves there from wherever the poll says it was. It works from
// whatever the poll currently says, so applying it to data that already holds
// the vote changes nothing, and a refetch mid-flight can't count anyone twice.
// Hidden results stay hidden; only the choice moves.
export function applyChoice(poll: Poll, optionId: string): Poll {
  const previous = poll.myVoteOptionId
  if (previous === optionId) return poll
  if (!poll.resultsVisible || poll.totalVotes === null) {
    return { ...poll, myVoteOptionId: optionId }
  }
  return {
    ...poll,
    myVoteOptionId: optionId,
    totalVotes: previous === null ? poll.totalVotes + 1 : poll.totalVotes,
    options: poll.options.map((option) => {
      if (option.votes === null) return option
      if (option.id === optionId) return { ...option, votes: option.votes + 1 }
      if (option.id === previous) return { ...option, votes: option.votes - 1 }
      return option
    }),
  }
}
