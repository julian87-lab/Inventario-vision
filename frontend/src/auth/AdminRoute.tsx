import { Navigate, Outlet } from "react-router-dom"

import { useAuth } from "@/auth/context"

export function AdminRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Comprobando acceso…
      </p>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (user.rol !== "administrador") {
    return <Navigate to="/inicio" replace />
  }

  return <Outlet />
}
