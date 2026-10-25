import { useMutation, useQueryClient } from "@tanstack/react-query"

import { authKeys } from "@/lib/auth-keys"

import { authClient } from "@/features/auth/lib/auth-client"

type SignInInput = {
  email: string
  password: string
  rememberMe?: boolean
}

export function useSignIn() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ email, password, rememberMe = false }: SignInInput) => {
      const { error } = await authClient.signIn.email({ email, password, rememberMe })
      if (error) throw new Error(error.message ?? "Sign in failed")
    },
    onSuccess: async () => {
      // Nothing on the login page reads the session, so a plain invalidate
      // would leave it "signed out" and send us back to /login. Refetch it
      // whether or not anything is watching.
      await queryClient.invalidateQueries({
        queryKey: authKeys.session(),
        refetchType: "all",
      })
    },
  })
}
