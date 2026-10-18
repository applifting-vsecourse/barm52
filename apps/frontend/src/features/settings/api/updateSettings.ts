import { api } from "@/lib/api-client"

import { settingsSchema, type Settings } from "@/features/settings/api/settingsSchemas"

// The server refused a value of one field, e.g. a username someone else has.
// The form shows the message under that field.
export class SettingsFieldError extends Error {
  constructor(
    readonly field: keyof Settings,
    message: string,
  ) {
    super(message)
    this.name = "SettingsFieldError"
  }
}

// A 409 names the field it is about; anything else is passed on as it is.
async function asFieldError(error: unknown): Promise<unknown> {
  const response = (error as { response?: Response } | null)?.response
  if (response?.status === 409) {
    try {
      const body = (await response.clone().json()) as { field?: string; message?: string }
      if (body.field === "username" && body.message) {
        return new SettingsFieldError("username", body.message)
      }
    } catch {
      // no JSON body: not ours to interpret
    }
  }
  return error
}

export async function updateSettings(settings: Settings): Promise<Settings> {
  try {
    return settingsSchema.parse(await api.put("settings", { json: settings }).json())
  } catch (error) {
    throw await asFieldError(error)
  }
}
