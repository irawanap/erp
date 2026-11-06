export type Role = 'Employee' | 'Supervisor' | 'HRD/Admin'

export interface User {
  id: string
  employee_id: string | null
  email: string
  role: Role
  is_active: boolean
  created_at: string
  updated_at: string
  last_login_at: string | null
}

export interface LoginInput {
  email: string
  password: string
  otp?: string
  recoveryCode?: string
}

export interface CredentialsProof {
  currentPassword: string
  otp?: string
  recoveryCode?: string
}
