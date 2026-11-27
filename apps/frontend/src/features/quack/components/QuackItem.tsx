import { MoodLabel } from "@/components/MoodLabel"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { formatDate } from "@/lib/date"

import type { Quack } from "@/features/quack/api/quackSchemas"
import { DeleteQuackButton } from "@/features/quack/components/DeleteQuackButton"
import { PollView } from "@/features/quack/components/PollView"
import { QuackLikeButton } from "@/features/quack/components/QuackLikeButton"
import { QuackReplies } from "@/features/quack/components/QuackReplies"
import { UsersName } from "@/features/quack/components/UsersName"
import { UsersUserName } from "@/features/quack/components/UsersUserName"

type QuackItemProps = {
  quack: Quack
  // The signed-in user. Their own quacks, or every quack for an admin, get a
  // Delete action. Convenience only: the server decides for itself.
  currentUserId?: string
  isAdmin?: boolean
  // Replies under a top-level quack. Off where the feed is only a preview.
  shouldShowReplies?: boolean
}

export function QuackItem({
  quack,
  currentUserId,
  isAdmin = false,
  shouldShowReplies = false,
}: QuackItemProps) {
  const { name, username } = quack.user
  const canDelete = isAdmin || (currentUserId !== undefined && quack.userId === currentUserId)
  const replies =
    shouldShowReplies && quack.parentId === null ? (
      <QuackReplies
        quackId={quack.id}
        replyCount={quack.replyCount}
        canReply={!quack.deleted}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
      />
    ) : null

  // Deleted, but its replies hold it in place. Nothing of what it said, nor
  // who said it, is shown.
  if (quack.deleted) {
    return (
      <article className="flex w-full flex-col gap-2 border-b border-border pt-2 pb-4 last:border-b-0">
        <p className="py-2 text-sm text-muted-foreground">This quack was deleted.</p>
        {replies}
      </article>
    )
  }

  const initials = name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <article className="flex w-full gap-4 border-b border-border pt-2 pb-4 last:border-b-0">
      <Avatar className="size-12">
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>

      <div className="flex flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span>
            <UsersName name={name} /> <UsersUserName username={username} />
          </span>
          <span className="text-xs text-muted-foreground">·</span>
          <time className="text-xs text-muted-foreground">{formatDate(quack.createdAt)}</time>
          {quack.mood ? (
            <>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="sr-only">Mood:</span>
              <MoodLabel
                mood={quack.mood}
                className="text-sm text-muted-foreground"
              />
            </>
          ) : null}
        </div>
        <p className="text-sm break-words whitespace-pre-line">{quack.text}</p>
        {quack.poll ? (
          <PollView
            quackId={quack.id}
            poll={quack.poll}
          />
        ) : null}
        {quack.likes && currentUserId ? (
          <QuackLikeButton
            quackId={quack.id}
            likes={quack.likes}
          />
        ) : null}
        {replies}
      </div>

      {canDelete ? (
        <DeleteQuackButton
          quackId={quack.id}
          className="shrink-0"
        />
      ) : null}
    </article>
  )
}
