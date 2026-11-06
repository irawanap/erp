export interface Holiday {
  id: string
  holiday_date: string
  name: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface HolidayInput {
  holidayDate: string
  name: string
  isActive: boolean
}

export interface HolidayFilters {
  page: number
  limit: number
  search: string
  year?: number
  isActive?: 'true' | 'false'
}
