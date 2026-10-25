import type { RefObject } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"

import { MoodLabel } from "@/components/MoodLabel"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

import { MOODS, moodSchema, type Mood } from "@/features/quack/api/quackSchemas"
import { NEW_POLL, PollFields, pollFormSchema } from "@/features/quack/components/PollFields"
import { useAddQuack } from "@/features/quack/hooks/useAddQuack"

// Mirrors the server-side DTO (MaxLength(280)) so the user is told before
// the request is made — the server still validates independently.
const MAX_LENGTH = 280

// A Select can't hold an empty value, so "no mood" gets a value of its own. It
// stays inside this form and is turned back into "no mood" before posting.
const NO_MOOD = "none"

const schema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Write something first")
    .max(MAX_LENGTH, `Keep it under ${MAX_LENGTH} characters`),
  mood: z.union([moodSchema, z.literal(NO_MOOD)]),
  // Null while the quack has no poll; then none of its rules apply.
  poll: pollFormSchema.nullable(),
})

type FormValues = z.infer<typeof schema>

type QuackFormProps = {
  className?: string
  // The mood picked for every new quack, from the user's settings. Without one
  // a quack starts with no mood.
  defaultMood?: Mood | null
  // Called once a quack has been posted, never after a failed attempt.
  onPosted?: () => void
  // The text box, for whoever wants to send the user here.
  inputRef?: RefObject<HTMLTextAreaElement | null>
}

export function QuackForm({ className, defaultMood, onPosted, inputRef }: QuackFormProps) {
  const addQuack = useAddQuack()
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    // Posting resets the form to these, so the next quack starts from the
    // default mood again.
    defaultValues: { text: "", mood: defaultMood ?? NO_MOOD, poll: null },
  })

  const text = useWatch({ control: form.control, name: "text" })
  const length = text?.length ?? 0
  const hasPoll = useWatch({ control: form.control, name: "poll" }) !== null

  // Removing the poll drops its answers too, so the quack goes out without it.
  const togglePoll = () => {
    form.clearErrors("poll")
    form.setValue("poll", hasPoll ? null : NEW_POLL)
  }

  const handleSubmit = ({ text, mood, poll }: FormValues) => {
    addQuack.mutate(
      {
        text,
        mood: mood === NO_MOOD ? undefined : mood,
        poll: poll
          ? {
              options: poll.options.map((option) => option.text),
              length: poll.length,
              results: poll.results,
              suggestions: poll.suggestions,
            }
          : undefined,
      },
      {
        onSuccess: () => {
          form.reset()
          onPosted?.()
        },
      },
    )
  }

  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit(handleSubmit)}
        className={cn("space-y-3", className)}
      >
        {addQuack.error ? (
          <Alert variant="destructive">
            <AlertDescription>{addQuack.error.message}</AlertDescription>
          </Alert>
        ) : null}

        <FormField
          control={form.control}
          name="text"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New quack</FormLabel>
              <FormControl>
                <Textarea
                  rows={3}
                  placeholder="Quack something..."
                  disabled={addQuack.isPending}
                  {...field}
                  ref={(element) => {
                    field.ref(element)
                    if (inputRef) inputRef.current = element
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {hasPoll ? <PollFields isDisabled={addQuack.isPending} /> : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={addQuack.isPending}
            onClick={togglePoll}
          >
            {hasPoll ? "Remove poll" : "Add poll"}
          </Button>

          <FormField
            control={form.control}
            name="mood"
            render={({ field }) => (
              <FormItem className="flex items-center gap-2">
                <FormLabel>Mood</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={addQuack.isPending}
                >
                  <FormControl>
                    <SelectTrigger
                      size="sm"
                      className="w-32"
                    >
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={NO_MOOD}>None</SelectItem>
                    {MOODS.map((mood) => (
                      <SelectItem
                        key={mood}
                        value={mood}
                      >
                        <MoodLabel mood={mood} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />

          <div className="ml-auto flex items-center gap-3">
            <span
              className={cn(
                "text-sm",
                length > MAX_LENGTH ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {length}/{MAX_LENGTH}
            </span>
            <Button
              type="submit"
              size="sm"
              disabled={addQuack.isPending}
            >
              {addQuack.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Quack
            </Button>
          </div>
        </div>
      </form>
    </Form>
  )
}
