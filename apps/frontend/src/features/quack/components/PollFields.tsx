import { X } from "lucide-react"
import { useFieldArray, useFormContext, type Control } from "react-hook-form"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import {
  MAX_POLL_OPTION_LENGTH,
  MAX_POLL_OPTIONS,
  MIN_POLL_OPTIONS,
  POLL_LENGTHS,
  POLL_RESULTS_VISIBILITIES,
  POLL_SUGGESTION_MODES,
  type PollLength,
  type PollResultsVisibility,
  type PollSuggestionMode,
} from "@/features/quack/api/quackSchemas"

// The same rules the server applies, so mistakes show under the field first.
export const pollFormSchema = z.object({
  options: z
    .array(
      z.object({
        text: z
          .string()
          .trim()
          .min(1, "Fill in or remove this option")
          .max(MAX_POLL_OPTION_LENGTH, `Keep it under ${MAX_POLL_OPTION_LENGTH} characters`),
      }),
    )
    .min(MIN_POLL_OPTIONS)
    .max(MAX_POLL_OPTIONS)
    .superRefine((options, context) => {
      // The later of two equal answers carries the message.
      const seen = new Set<string>()
      options.forEach(({ text }, index) => {
        const key = text.trim().toLowerCase()
        if (!key) return
        if (seen.has(key)) {
          context.addIssue({
            code: "custom",
            message: "Answers must be different",
            path: [index, "text"],
          })
        }
        seen.add(key)
      })
    }),
  length: z.enum(POLL_LENGTHS),
  results: z.enum(POLL_RESULTS_VISIBILITIES),
  suggestions: z.enum(POLL_SUGGESTION_MODES),
})

export type PollFormValues = z.infer<typeof pollFormSchema>

// What "Add poll" starts with: two empty answers and the defaults for new polls.
export const NEW_POLL: PollFormValues = {
  options: [{ text: "" }, { text: "" }],
  length: "1d",
  results: "immediately",
  suggestions: "not_allowed",
}

const LENGTH_LABELS: Record<PollLength, string> = {
  "1h": "1 hour",
  "1d": "1 day",
  "7d": "7 days",
  none: "No end",
}

const RESULTS_LABELS: Record<PollResultsVisibility, string> = {
  immediately: "Show results immediately",
  after_vote: "Show results after voting",
}

const SUGGESTIONS_LABELS: Record<PollSuggestionMode, string> = {
  not_allowed: "Not allowed",
  published: "Published immediately",
  author_approves: "Author approves first",
}

// Only the part of the quack form this section touches.
type FormWithPoll = { poll: PollFormValues | null }

type PollFieldsProps = { isDisabled?: boolean }

// Rendered inside the quack form, whose context it reads. Mounted only while the
// quack has a poll, so the answers list starts from the values "Add poll" put in.
export function PollFields({ isDisabled }: PollFieldsProps) {
  const { control } = useFormContext<FormWithPoll>()
  const options = useFieldArray({ control, name: "poll.options" })

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="sr-only">Poll</legend>

      {options.fields.map((field, index) => (
        <FormField
          key={field.id}
          control={control}
          name={`poll.options.${index}.text`}
          render={({ field: input }) => (
            <FormItem>
              <FormLabel>Option {index + 1}</FormLabel>
              <div className="flex items-center gap-2">
                <FormControl>
                  <Input
                    maxLength={MAX_POLL_OPTION_LENGTH}
                    disabled={isDisabled}
                    {...input}
                  />
                </FormControl>
                {index >= MIN_POLL_OPTIONS ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove option"
                    disabled={isDisabled}
                    onClick={() => options.remove(index)}
                  >
                    <X />
                  </Button>
                ) : null}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      ))}

      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={(isDisabled ?? false) || options.fields.length >= MAX_POLL_OPTIONS}
          onClick={() => options.append({ text: "" })}
        >
          Add option
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SettingField
          control={control}
          name="poll.length"
          label="Poll length"
          labels={LENGTH_LABELS}
          isDisabled={isDisabled}
        />
        <SettingField
          control={control}
          name="poll.results"
          label="Results"
          labels={RESULTS_LABELS}
          isDisabled={isDisabled}
        />
        <SettingField
          control={control}
          name="poll.suggestions"
          label="New answers from others"
          labels={SUGGESTIONS_LABELS}
          isDisabled={isDisabled}
        />
      </div>
    </fieldset>
  )
}

type SettingFieldProps = {
  control: Control<FormWithPoll>
  name: "poll.length" | "poll.results" | "poll.suggestions"
  label: string
  labels: Record<string, string>
  isDisabled?: boolean
}

function SettingField({ control, name, label, labels, isDisabled }: SettingFieldProps) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <Select
            value={field.value}
            onValueChange={field.onChange}
            disabled={isDisabled}
          >
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {Object.entries(labels).map(([value, text]) => (
                <SelectItem
                  key={value}
                  value={value}
                >
                  {text}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormItem>
      )}
    />
  )
}
