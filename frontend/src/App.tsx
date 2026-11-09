import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"

import { AdminRoute } from "@/auth/AdminRoute"
import { AuthProvider } from "@/auth/AuthProvider"
import { ProtectedRoute } from "@/auth/ProtectedRoute"
import AppLayout from "@/components/layout/AppLayout"

import Administracion from "@/pages/Administracion"
import Catalogo from "@/pages/Catalogo"
import Inicio from "@/pages/Inicio"
import Inventario from "@/pages/Inventario"
import Login from "@/pages/Login"
import Perfil from "@/pages/Perfil"
import RecuperarContrasena from "@/pages/RecuperarContrasena"
import Registro from "@/pages/Registro"
import RestablecerContrasena from "@/pages/RestablecerContrasena"

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route path="/registro" element={<Registro />} />

          <Route
            path="/recuperar-contrasena"
            element={<RecuperarContrasena />}
          />

          <Route
            path="/restablecer-contrasena"
            element={<RestablecerContrasena />}
          />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route index element={<Navigate to="/inicio" replace />} />

              <Route path="/inicio" element={<Inicio />} />

              <Route path="/inventario" element={<Catalogo />} />

              <Route path="/operaciones" element={<Inventario />} />

              <Route path="/perfil" element={<Perfil />} />

              <Route element={<AdminRoute />}>
                <Route path="/administracion" element={<Administracion />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/inicio" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
