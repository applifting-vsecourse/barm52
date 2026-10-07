import type { Ref } from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

// Mirrors the server-side DTO (MaxLength(100)) — the server still validates
// independently.
const MAX_LENGTH = 100

type QuackSearchProps = {
  value: string
  onChange: (value: string) => void
  inputRef?: Ref<HTMLInputElement>
  className?: string
}

export function QuackSearch({ value, onChange, inputRef, className }: QuackSearchProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor="quack-search">Search quacks</Label>
      {/* type="text", not "search": browsers add their own clear button to a
          search field, and this box has no clear control of its own. */}
      <Input
        id="quack-search"
        ref={inputRef}
        type="text"
        maxLength={MAX_LENGTH}
        placeholder="A word or a name"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}
