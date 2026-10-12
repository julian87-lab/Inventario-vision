export interface Token {
  access_token: string
  token_type: string
}

export interface Usuario {
  id: number
  nombre: string
  email: string
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
