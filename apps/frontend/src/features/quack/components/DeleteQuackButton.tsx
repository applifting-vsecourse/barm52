import { useState } from "react"
import { Loader2, Trash2 } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { useDeleteQuack } from "@/features/quack/hooks/useDeleteQuack"

type DeleteQuackButtonProps = {
  quackId: string
  className?: string
}

// Asks before deleting. Whether the button shows at all is decided by whoever
// renders it; the server checks again and refuses anyone it shouldn't let in.
export function DeleteQuackButton({ quackId, className }: DeleteQuackButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const deleteQuack = useDeleteQuack()

  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={(isNextOpen) => {
        // The request can't be called back, so the dialog stays until it ends.
        if (deleteQuack.isPending) return
        setIsOpen(isNextOpen)
        deleteQuack.reset()
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Delete quack"
          className={cn("text-muted-foreground", className)}
        >
          <Trash2 />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this quack?</AlertDialogTitle>
          <AlertDialogDescription>
            It disappears from the feed for everyone, together with its poll. This can&apos;t be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {deleteQuack.error ? (
          <p
            role="alert"
            className="text-sm text-destructive"
          >
            {deleteQuack.error.message}
          </p>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteQuack.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={deleteQuack.isPending}
            onClick={(event) => {
              // Keep the dialog open until the server has answered. On success
              // the quack leaves the feed, usually taking the dialog with it.
              event.preventDefault()
              deleteQuack.mutate(quackId, { onSuccess: () => setIsOpen(false) })
            }}
          >
            {deleteQuack.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
