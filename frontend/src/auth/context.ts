import { createContext, useContext } from "react"

import type { Usuario } from "@/types/api"

export interface AuthContextValue {
  user: Usuario | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error("useAuth debe usarse dentro de AuthProvider")
  }
  return value
}