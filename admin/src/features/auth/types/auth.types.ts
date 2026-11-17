export interface AdminUser {
  id: string
  username: string
  name: string
  role: string
}

export interface LoginResponse {
  token: string
  expires_at: string
  user: AdminUser
}

export interface LoginInput {
  username: string
  password: string
}
