import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"

import { AuthProvider } from "@/auth/AuthProvider"
import { ProtectedRoute } from "@/auth/ProtectedRoute"
import AppLayout from "@/components/layout/AppLayout"
import Inicio from "@/pages/Inicio"
import Inventario from "@/pages/Inventario"
import Login from "@/pages/Login"
import Catalogo from "@/pages/Catalogo"

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route index element={<Navigate to="/inicio" replace />} />
              <Route path="/inicio" element={<Inicio />} />
              <Route path="/inventario" element={<Catalogo />} />
<Route path="/operaciones" element={<Inventario />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/inicio" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App