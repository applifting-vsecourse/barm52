import { Angry, Frown, Laugh, Smile, type LucideIcon } from "lucide-react"

import type { Mood } from "@/lib/moods"
import { cn } from "@/lib/utils"

// How each mood is written and drawn. The quack form, the feed and settings all
// render through MoodLabel, so they can't drift apart.
const MOOD_DISPLAY: Record<Mood, { label: string; Icon: LucideIcon }> = {
  happy: { label: "Happy", Icon: Smile },
  sad: { label: "Sad", Icon: Frown },
  angry: { label: "Angry", Icon: Angry },
  silly: { label: "Silly", Icon: Laugh },
}

type MoodLabelProps = { mood: Mood; className?: string }

export function MoodLabel({ mood, className }: MoodLabelProps) {
  const { label, Icon } = MOOD_DISPLAY[mood]

  return (
    // Baseline-aligned so the text lines up with its neighbours; the icon opts out
    // and centres itself. The word carries the meaning, so the icon is decorative.
    <span className={cn("inline-flex items-baseline gap-2", className)}>
      <Icon className="size-4 self-center" />
      {label}
    </span>
  )
}
