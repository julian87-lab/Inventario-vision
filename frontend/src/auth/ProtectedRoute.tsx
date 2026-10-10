import { Navigate, Outlet } from "react-router-dom"

import { useAuth } from "./context"

export function ProtectedRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return <p className="p-6 text-sm text-muted-foreground">Cargando...</p>
  }
  if (!user) {
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}