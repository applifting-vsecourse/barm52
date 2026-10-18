import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { MoodLabel } from "@/components/MoodLabel"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { MOODS } from "@/lib/moods"
import { cn } from "@/lib/utils"

import {
  MAX_BIO_LENGTH,
  MAX_DISPLAY_NAME_LENGTH,
  MAX_USERNAME_LENGTH,
  MIN_USERNAME_LENGTH,
  USERNAME_PATTERN,
  type Settings,
} from "@/features/settings/api/settingsSchemas"
import { SettingsFieldError } from "@/features/settings/api/updateSettings"
import { useUpdateSettings } from "@/features/settings/hooks/useUpdateSettings"

// A Select can't hold an empty value, so "no mood" gets a value of its own. It
// stays inside this form and is turned back into null before saving.
const NO_MOOD = "none"

const USERNAME_LENGTH_MESSAGE = `Username must be ${MIN_USERNAME_LENGTH}–${MAX_USERNAME_LENGTH} characters`

const schema = z.object({
  username: z
    .string()
    .trim()
    .min(MIN_USERNAME_LENGTH, USERNAME_LENGTH_MESSAGE)
    .max(MAX_USERNAME_LENGTH, USERNAME_LENGTH_MESSAGE)
    .regex(USERNAME_PATTERN, "Use only letters, numbers, underscores and dots"),
  displayName: z
    .string()
    .trim()
    .min(1, "Display name is required")
    .max(MAX_DISPLAY_NAME_LENGTH, `Keep it under ${MAX_DISPLAY_NAME_LENGTH} characters`),
  bio: z.string().trim().max(MAX_BIO_LENGTH, `Keep it under ${MAX_BIO_LENGTH} characters`),
  defaultMood: z.union([z.enum(MOODS), z.literal(NO_MOOD)]),
})

type FormValues = z.infer<typeof schema>

const toFormValues = (settings: Settings): FormValues => ({
  username: settings.username,
  displayName: settings.displayName,
  bio: settings.bio ?? "",
  defaultMood: settings.defaultMood ?? NO_MOOD,
})

type SettingsFormProps = { settings: Settings }

export function SettingsForm({ settings }: SettingsFormProps) {
  const update = useUpdateSettings()
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toFormValues(settings),
  })

  const bio = useWatch({ control: form.control, name: "bio" })
  const bioLength = bio?.length ?? 0
  const isPending = update.isPending

  const handleSubmit = (values: FormValues) => {
    update.mutate(
      {
        username: values.username,
        displayName: values.displayName,
        bio: values.bio || null,
        defaultMood: values.defaultMood === NO_MOOD ? null : values.defaultMood,
      },
      {
        onSuccess: (saved) => {
          // What was saved becomes what Discard goes back to.
          form.reset(toFormValues(saved))
          toast.success("Settings saved")
        },
        onError: (error) => {
          if (error instanceof SettingsFieldError) {
            form.setError(error.field, { message: error.message }, { shouldFocus: true })
          }
        },
      },
    )
  }

  // Field errors show under their field; anything else goes in the alert.
  const formError =
    update.error && !(update.error instanceof SettingsFieldError) ? update.error : null

  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit(handleSubmit)}
        className="flex flex-col gap-6"
      >
        {formError ? (
          <Alert variant="destructive">
            <AlertDescription>{formError.message}</AlertDescription>
          </Alert>
        ) : null}

        <FormField
          control={form.control}
          name="displayName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Display name</FormLabel>
              <FormControl>
                <Input
                  autoComplete="name"
                  disabled={isPending}
                  {...field}
                />
              </FormControl>
              <FormDescription>Shown on your quacks and in the header.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  disabled={isPending}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                {MIN_USERNAME_LENGTH}–{MAX_USERNAME_LENGTH} letters, numbers, underscores or dots.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="bio"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-baseline justify-between gap-3">
                <FormLabel>Bio</FormLabel>
                <span
                  className={cn(
                    "text-sm",
                    bioLength > MAX_BIO_LENGTH ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {bioLength}/{MAX_BIO_LENGTH}
                </span>
              </div>
              <FormControl>
                <Textarea
                  rows={3}
                  placeholder="A line about you"
                  disabled={isPending}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="defaultMood"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Default mood</FormLabel>
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={isPending}
              >
                <FormControl>
                  <SelectTrigger className="w-40">
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
              <FormDescription>Picked for you when you write a new quack.</FormDescription>
            </FormItem>
          )}
        />

        <div className="flex gap-3">
          <Button
            type="submit"
            disabled={isPending}
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Save
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isPending || !form.formState.isDirty}
            onClick={() => {
              update.reset()
              form.reset()
            }}
          >
            Discard
          </Button>
        </div>
      </form>
    </Form>
  )
}
