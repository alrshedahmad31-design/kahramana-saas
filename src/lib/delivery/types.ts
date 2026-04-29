export type OrderItem = {
  id:               string
  name_ar:          string
  name_en:          string
  quantity:         number
  unit_price_bhd:   number
  item_total_bhd:   number
  selected_size?:   string | null
  selected_variant?: string | null
}

export type DeliveryStatus =
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'out_for_delivery'
  | 'delivered'
  | 'completed'

export type DriverStatus = 'available' | 'delivering' | 'busy' | 'returning' | 'offline'

export type DeliveryOrder = {
  id:               string
  order_number:     string
  status:           DeliveryStatus
  customer_name:    string | null
  customer_phone:   string | null
  customer_address: string | null
  customer_location:{ lat: number; lng: number } | null
  branch_id:        string
  driver_id:        string | null
  driver_name?:     string | null
  driver_phone?:    string | null
  items_count:      number
  total_bhd:        number
  notes:            string | null
  source:           string
  created_at:       string
  updated_at:       string
  eta_minutes?:     number | null
  items?:           OrderItem[]
}

export type Driver = {
  id:               string
  name:             string
  phone:            string | null
  status:           DriverStatus
  location?:        { lat: number; lng: number } | null
  current_order_id: string | null
  completed_today:  number
  avatar_url?:      string | null
  branch_id:        string | null
}

export type DeliveryMetrics = {
  revenue_today:      number
  orders_total:       number
  in_transit:         number
  completed_today:    number
  late_count:         number
  revenue_delta:      number
  orders_delta:       number
}

export type ViewMode = 'map' | 'list' | 'kanban'
