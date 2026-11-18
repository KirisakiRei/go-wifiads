export interface AdminUser {
  id: string
  username: string
  name: string
  role: string
  role_display_name?: string
  permissions?: string[]
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

export interface RoleItem {
  id: string
  name: string
  display_name: string
  description: string
  permissions: string[]
  is_system: boolean
  users_count: number
  created_at: string
  updated_at: string
}

export interface CreateRolePayload {
  name: string
  display_name: string
  description: string
  permissions: string[]
}

export interface UpdateRolePayload {
  display_name: string
  description: string
  permissions: string[]
}
