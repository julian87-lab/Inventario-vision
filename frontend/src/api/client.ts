import type { Token, Usuario } from "@/types/api"

const TOKEN_KEY = "token"

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers)
  const token = getToken()

  if (token) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  const response = await fetch(`/api${path}`, {
    ...init,
    headers,
  })

  if (!response.ok) {
    let detail = "Error inesperado"

    try {
      const body: { detail?: unknown } = await response.json()
      if (typeof body.detail === "string") {
        detail = body.detail
      }
    } catch {
      // La respuesta no era JSON.
    }

    if (response.status === 401) {
      clearToken()
    }

    throw new ApiError(response.status, detail)
  }

  return (await response.json()) as T
}

export const api = {
  get<T>(path: string): Promise<T> {
    return request<T>(path)
  },

  post<T>(path: string, body?: BodyInit): Promise<T> {
  const headers =
    body instanceof URLSearchParams
      ? undefined
      : { "Content-Type": "application/json" }

  return request<T>(path, {
    method: "POST",
    body,
    headers,
  })
},
}

export async function login(
  email: string,
  password: string,
): Promise<Token> {
  const form = new URLSearchParams({
    username: email,
    password,
  })

  const data = await api.post<Token>("/auth/login", form)
  setToken(data.access_token)

  return data
}

export function getMe(): Promise<Usuario> {
  return api.get<Usuario>("/auth/me")
}