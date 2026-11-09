import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

import { api, ApiError, getMe, login } from "@/api/client"
import { limpiarSesion } from "@/auth/storage"
import { AuthContext } from "@/auth/context"
import type { Usuario } from "@/types/api"

export function AuthProvider({
  children,
}: {
  children: ReactNode
}) {
  const [user, setUser] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)
  const [aviso, setAviso] = useState<string | null>(null)

  const bloqueo = useRef(false)

  const limpiarAviso = useCallback(() => {
    setAviso(null)
  }, [])

  const signOut = useCallback(() => {
    limpiarSesion()
    setUser(null)
    setAviso("Tu sesión finalizó. Inicia sesión para continuar.")
  }, [])

  const actualizarUsuario = useCallback((usuario: Usuario) => {
    setUser(usuario)
  }, [])

  const signIn = useCallback(
    async (email: string, password: string): Promise<void> => {
      if (bloqueo.current) return

      bloqueo.current = true
      setAviso(null)

      try {
        await login(email, password)

        const usuario = await getMe()

        setUser(usuario)
      } catch (error) {
        if (error instanceof ApiError) {
          if (error.status === 401) {
            throw new Error(
              "Correo o contraseña incorrectos. Revisa los datos e inténtalo de nuevo.",
            )
          }

          if (error.status === 423) {
            throw new Error(
              "Tu cuenta está desactivada. Contacta a un administrador.",
            )
          }

          throw new Error(error.message)
        }

        throw new Error(
          "No se pudo conectar con el servidor. Inténtalo de nuevo.",
        )
      } finally {
        bloqueo.current = false
      }
    },
    [],
  )

  useEffect(() => {
    let activo = true

    async function restaurarSesion() {
      try {
        const usuario = await api.get<Usuario>("/auth/me")

        if (activo) {
          setUser(usuario)
        }
      } catch {
        if (activo) {
          limpiarSesion()
          setUser(null)
        }
      } finally {
        if (activo) {
          setLoading(false)
        }
      }
    }

    void restaurarSesion()

    return () => {
      activo = false
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      aviso,
      signIn,
      signOut,
      limpiarAviso,
      actualizarUsuario,
    }),
    [
      user,
      loading,
      aviso,
      signIn,
      signOut,
      limpiarAviso,
      actualizarUsuario,
    ],
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export default AuthProvider
