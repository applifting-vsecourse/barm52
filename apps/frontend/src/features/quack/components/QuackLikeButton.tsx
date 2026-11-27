import { useId } from "react"
import { Heart } from "lucide-react"

import { Button } from "@/components/ui/button"

import type { LikeSummary } from "@/features/quack/api/quackSchemas"
import { useQuackLike } from "@/features/quack/hooks/useQuackLike"

export function QuackLikeButton({ quackId, likes }: { quackId: string; likes: LikeSummary }) {
  const countId = useId()
  const mutation = useQuackLike(quackId)

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-muted-foreground aria-pressed:bg-accent aria-pressed:text-foreground"
        aria-label="Like"
        aria-describedby={countId}
        aria-pressed={likes.likedByMe}
        aria-busy={mutation.isPending}
        disabled={mutation.isPending}
        onClick={() => mutation.mutate(!likes.likedByMe)}
      >
        <Heart
          aria-hidden="true"
          className={likes.likedByMe ? "fill-current" : undefined}
        />
        <span id={countId}>
          {likes.count} {likes.count === 1 ? "like" : "likes"}
        </span>
      </Button>
      {mutation.isError ? (
        <p
          role="alert"
          className="text-sm text-destructive"
        >
          Couldn&apos;t update your like. Try again.
        </p>
      ) : null}
    </div>
  )
}
