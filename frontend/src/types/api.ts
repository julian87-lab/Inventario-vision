export interface Token {
  access_token: string
  token_type: string
}

export type Rol = "administrador" | "operador"

export interface Usuario {
  id: number
  nombre: string
  email: string
  rol: Rol
}

export type Producto = {
  id: number
  clase_yolo: number
  nombre: string
  stock_actual: number
  umbral_alerta: number
  activo: boolean
}


export type Movimiento = {
  id: number
  producto_id: number
  usuario_id: number
  deteccion_id: number | null
  tipo: string
  cantidad: number
  stock_antes: number
  stock_despues: number
  fecha_hora: string
}

export type Alerta = {
  id: number
  producto_id: number
  tipo: "stock_bajo" | "sin_stock"
  fecha_hora: string
  atendida: boolean
}


export type EstadoDeteccion = "pendiente" | "confirmada" | "descartada"

export type DeteccionItem = {
  id: number
  producto_id: number
  cantidad_detectada: number
  confianza: number | null
  cantidad_confirmada: number | null
}

export type Deteccion = {
  id: number
  usuario_id: number
  fecha_hora: string
  imagen_url: string
  modelo_version: string
  estado: EstadoDeteccion
  items: DeteccionItem[]
}


export type InvitacionInfo = {
  email: string
  rol: Rol
}

export type UsuarioAdmin = {
  id: number
  nombre: string
  email: string
  rol: Rol
  activo: boolean
  creado_en: string
}

export type EstadoInvitacion = "pendiente" | "usada" | "revocada" | "vencida"

export type Invitacion = {
  id: number
  email: string
  rol: Rol
  estado: EstadoInvitacion
  creada_por_id: number
  creada_en: string
  expira_en: string
  usada_en: string | null
  revocada_en: string | null
}

export type EventoAuditoria = {
  id: number
  usuario_id: number | null
  accion: string
  objeto_tipo: string
  objeto_id: number | null
  detalle: string | null
  fecha_hora: string
}
