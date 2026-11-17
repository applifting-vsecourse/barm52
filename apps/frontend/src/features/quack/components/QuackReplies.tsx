import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import { Loader2, MessageCircle, RefreshCw } from "lucide-react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Textarea } from "@/components/ui/textarea"

import { quackKeys } from "@/features/quack/api/quackKeys"
import { getReplies } from "@/features/quack/api/replies"
import { QuackItem } from "@/features/quack/components/QuackItem"
import { useAddReply } from "@/features/quack/hooks/useAddReply"

// Mirrors the server-side DTO (MaxLength(280)); the server still validates.
const MAX_LENGTH = 280

const schema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Write something first")
    .max(MAX_LENGTH, `Keep it under ${MAX_LENGTH} characters`),
})

type Viewer = {
  // The signed-in user; their own replies get a Delete action.
  currentUserId?: string
  isAdmin?: boolean
}

type QuackRepliesProps = Viewer & {
  quackId: string
  replyCount: number
  // A deleted quack keeps its replies but takes no new ones.
  canReply: boolean
}

const label = (count: number) =>
  count === 0 ? "Reply" : count === 1 ? "1 reply" : `${count} replies`

// Replies sit under their quack, folded until asked for. The thread loads only
// when it's opened, so the feed costs one request however many quacks it has.
export function QuackReplies({
  quackId,
  replyCount,
  canReply,
  currentUserId,
  isAdmin,
}: QuackRepliesProps) {
  const [isOpen, setIsOpen] = useState(false)
  if (replyCount === 0 && !canReply) return null

  return (
    <div className="flex flex-col gap-3">
      <Button
        variant="ghost"
        size="sm"
        className="self-start text-muted-foreground"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
      >
        <MessageCircle />
        {label(replyCount)}
      </Button>

      {isOpen ? (
        <ReplyThread
          quackId={quackId}
          canReply={canReply}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
        />
      ) : null}
    </div>
  )
}

function ReplyThread({
  quackId,
  canReply,
  currentUserId,
  isAdmin,
}: Viewer & { quackId: string; canReply: boolean }) {
  const repliesQuery = useQuery({
    queryKey: quackKeys.replies(quackId),
    queryFn: () => getReplies(quackId),
  })
  const replies = repliesQuery.data ?? []

  return (
    <div className="flex flex-col gap-3 border-l border-border pl-4">
      {repliesQuery.isLoading ? (
        <div className="flex items-center py-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
        </div>
      ) : null}

      {repliesQuery.error ? (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>Couldn&apos;t load replies: {repliesQuery.error.message}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void repliesQuery.refetch()}
            >
              <RefreshCw className="size-4" />
              Reload
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {!repliesQuery.isLoading && !repliesQuery.error && replies.length === 0 ? (
        <p className="text-sm text-muted-foreground">No replies yet.</p>
      ) : null}

      {replies.length > 0 ? (
        <div className="flex flex-col">
          {replies.map((reply) => (
            <QuackItem
              key={reply.id}
              quack={reply}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      ) : null}

      {canReply ? <ReplyForm quackId={quackId} /> : null}
    </div>
  )
}

function ReplyForm({ quackId }: { quackId: string }) {
  const addReply = useAddReply()
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { text: "" },
  })

  return (
    <Form {...form}>
      <form
        noValidate
        className="flex flex-col gap-2"
        onSubmit={form.handleSubmit(({ text }) =>
          addReply.mutate({ quackId, text }, { onSuccess: () => form.reset() }),
        )}
      >
        {addReply.error ? (
          <Alert variant="destructive">
            <AlertDescription>{addReply.error.message}</AlertDescription>
          </Alert>
        ) : null}

        <FormField
          control={form.control}
          name="text"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Your reply</FormLabel>
              <FormControl>
                <Textarea
                  rows={2}
                  placeholder="Quack back..."
                  disabled={addReply.isPending}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          variant="outline"
          size="sm"
          className="self-end"
          disabled={addReply.isPending}
        >
          {addReply.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          Send reply
        </Button>
      </form>
    </Form>
  )
}
