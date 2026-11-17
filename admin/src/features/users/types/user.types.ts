export interface AdminUser {
  id: string
  username: string
  name: string
  role: string
  is_active: boolean
  last_login_at?: string
  created_at: string
}

export interface CreateUserPayload {
  username: string
  password: string
  name: string
  role: string
  is_active: boolean
}

export interface UpdateUserPayload {
  name: string
  role: string
  is_active: boolean
}

export interface ChangePasswordPayload {
  password: string
}
