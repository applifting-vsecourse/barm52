import { Loader2, RefreshCw } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

import type { Quack } from "@/features/quack/api/quackSchemas"
import { QuackItem } from "@/features/quack/components/QuackItem"

type QuackListProps = {
  quacks: Quack[]
  isLoading?: boolean
  error?: Error
  // The text the list was searched with. Only set while a search is active.
  search?: string
  onClearSearch?: () => void
  onReload?: () => void
}

export function QuackList({
  quacks,
  isLoading,
  error,
  search,
  onClearSearch,
  onReload,
}: QuackListProps) {
  return (
    <div className="flex flex-col">
      {isLoading && quacks.length === 0 ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : null}

      {error ? (
        <Alert
          variant="destructive"
          className="mb-4"
        >
          <AlertTitle>Couldn&apos;t load quacks</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>{error.message}</span>
            {onReload ? (
              <Button
                variant="outline"
                size="sm"
                onClick={onReload}
              >
                <RefreshCw className="size-4" />
                Reload
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {!isLoading && !error && quacks.length === 0 && search ? (
        <div className="py-8 text-center">
          {/* The search is echoed as typed, spacing included, and wraps when long. */}
          <p className="text-sm break-words whitespace-pre-wrap text-muted-foreground">
            No quacks match &quot;{search}&quot;.
          </p>
          {onClearSearch ? (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={onClearSearch}
            >
              Clear search
            </Button>
          ) : null}
        </div>
      ) : null}

      {!isLoading && !error && quacks.length === 0 && !search ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No quacks yet. Post the first one.
        </p>
      ) : null}

      {quacks.map((quack) => (
        <QuackItem
          key={quack.id}
          quack={quack}
        />
      ))}
    </div>
  )
}
