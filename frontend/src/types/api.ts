export interface ApiResponse<T> {
  success: true
  data: T
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export interface ApiErrorBody {
  success: false
  message: string
  errors?: { field: string; message: string }[]
}
