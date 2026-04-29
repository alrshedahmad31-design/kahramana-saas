// Auto-maintained types for the Kahramana Supabase schema.
// Regenerate after migrations: `npx supabase gen types typescript --local > src/lib/supabase/types.ts`
//
// NOTE: All Row/data types must be `type` aliases (not `interface`) so that
// TypeScript conditional checks like `Row extends Record<string, unknown>` pass
// correctly inside SupabaseClient's generic Schema constraint.

export type OrderStatus =
  | 'new'
  | 'under_review'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'out_for_delivery'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'payment_failed'

export type StaffRole =
  | 'owner'
  | 'general_manager'
  | 'branch_manager'
  | 'cashier'
  | 'kitchen'
  | 'driver'
  | 'inventory'
  | 'marketing'
  | 'support'

// ── Row types ─────────────────────────────────────────────────────────────────

export type BranchRow = {
  id:         string
  name_ar:    string
  name_en:    string
  phone:      string
  whatsapp:   string
  wa_link:    string
  maps_url:   string | null
  latitude:   number | null
  longitude:  number | null
  is_active:  boolean
  created_at: string
}

export type CustomerRow = {
  id:         string
  phone:      string | null
  name:       string | null
  is_guest:   boolean
  created_at: string
}

export type OrderRow = {
  id:               string
  customer_name:    string | null
  customer_phone:   string | null
  branch_id:        string
  status:           OrderStatus
  notes:            string | null
  delivery_address:       string | null
  delivery_lat:           number | null
  delivery_lng:           number | null
  delivery_instructions:  string | null
  delivery_building:      string | null
  delivery_street:        string | null
  delivery_area:          string | null
  expected_delivery_time: string | null
  customer_notes:         string | null
  driver_notes:           string | null
  picked_up_at:           string | null
  arrived_at:             string | null
  delivered_at:           string | null
  source:               string
  total_bhd:            number
  whatsapp_sent_at:     string | null
  coupon_id:            string | null
  coupon_discount_bhd:  number | null
  assigned_driver_id:   string | null
  created_at:           string
  updated_at:           string
}

export type OrderItemRow = {
  id:               string
  order_id:         string
  menu_item_slug:   string
  name_ar:          string
  name_en:          string
  selected_size:    string | null
  selected_variant: string | null
  quantity:         number
  unit_price_bhd:   number
  item_total_bhd:   number
  created_at:       string
}

export type MenuItemSyncRow = {
  slug:           string
  name_ar:        string
  name_en:        string
  price_bhd:      number | null
  sync_source:    string
  last_synced_at: string
  station:        KDSStation | null
}

// ── KDS types ─────────────────────────────────────────────────────────────────

export type KDSStation = 'grill' | 'fry' | 'salads' | 'desserts' | 'drinks' | 'packing'
export type KDSStatus  = 'pending' | 'preparing' | 'ready' | 'delivered'

export type KDSQueueRow = {
  id:            string
  order_id:      string
  order_item_id: string
  station:       KDSStation
  status:        KDSStatus
  priority:      number
  started_at:    string | null
  completed_at:  string | null
  assigned_to:   string | null
  created_at:    string
}

// Extended type for KDS display — joined from order_items + orders
export type KDSQueueItem = KDSQueueRow & {
  order_items: Pick<OrderItemRow, 'name_ar' | 'name_en' | 'quantity' | 'selected_size' | 'selected_variant'>
  orders:      Pick<OrderRow, 'customer_name' | 'notes' | 'branch_id' | 'status' | 'created_at'>
}

// Order-level KDS type — used by the rebuilt Kanban board (queries orders table directly)
export type KDSOrder = Omit<OrderRow, 'status'> & {
  status: 'accepted' | 'preparing' | 'ready'
  order_items: Array<{
    id: string
    name_ar: string
    name_en: string
    quantity: number
    selected_size: string | null
    selected_variant: string | null
  }>
}

export type StaffBasicRow = {
  id:         string
  name:       string
  role:       StaffRole
  branch_id:  string | null
  is_active:  boolean
  created_at: string
}

export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'temporary'
export type ShiftStatus    = 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'
export type LeaveType      = 'annual' | 'sick' | 'emergency' | 'unpaid' | 'other'
export type LeaveStatus    = 'pending' | 'approved' | 'rejected' | 'cancelled'

export type StaffExtendedRow = StaffBasicRow & {
  hire_date?:               string | null
  employment_type?:         EmploymentType | null
  hourly_rate?:             number | null
  phone?:                   string | null
  emergency_contact_name?:  string | null
  emergency_contact_phone?: string | null
  id_number?:               string | null
  date_of_birth?:           string | null
  address?:                 string | null
  profile_photo_url?:       string | null
  staff_notes?:             string | null
  clock_pin?:               string | null
}

export type ShiftRow = {
  id:         string
  staff_id:   string
  branch_id:  string | null
  shift_date: string
  start_time: string
  end_time:   string
  position:   string | null
  status:     ShiftStatus
  notes:      string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type ShiftWithStaff = ShiftRow & {
  staff_basic: Pick<StaffBasicRow, 'name' | 'role'>
}

export type TimeEntryRow = {
  id:             string
  staff_id:       string
  shift_id:       string | null
  clock_in:       string
  clock_out:      string | null
  break_minutes:  number
  total_hours:    number | null
  overtime_hours: number
  notes:          string | null
  approved_by:    string | null
  approved_at:    string | null
  created_at:     string
}

export type LeaveRequestRow = {
  id:             string
  staff_id:       string
  leave_type:     LeaveType
  start_date:     string
  end_date:       string
  days_count:     number
  reason:         string | null
  status:         LeaveStatus
  requested_at:   string
  reviewed_by:    string | null
  reviewed_at:    string | null
  reviewer_notes: string | null
}

export type AuditLogRow = {
  id:          string
  table_name:  string
  action:      'INSERT' | 'UPDATE' | 'DELETE'
  user_id:     string | null
  record_id:   string | null
  changes:     Record<string, unknown> | null
  branch_id:   string | null
  actor_role:  StaffRole | null
  created_at:  string
}

export type ContactMessageStatus = 'new' | 'read' | 'replied'

export type ContactMessageRow = {
  id:         string
  name:       string
  email:      string
  phone:      string | null
  branch_id:  string | null
  message:    string
  status:     ContactMessageStatus
  created_at: string
}

export type ContactMessageInsert = Omit<ContactMessageRow, 'id' | 'created_at' | 'status'> & {
  id?: string
  status?: ContactMessageStatus
}

// ── Insert types (id + timestamps optional) ───────────────────────────────────

export type OrderInsert = Omit<OrderRow,
  'id' | 'created_at' | 'updated_at' |
  'coupon_id' | 'coupon_discount_bhd' | 'assigned_driver_id' |
  'delivery_address' | 'delivery_lat' | 'delivery_lng' | 'delivery_instructions' |
  'delivery_building' | 'delivery_street' | 'delivery_area' |
  'expected_delivery_time' | 'customer_notes' | 'driver_notes' |
  'picked_up_at' | 'arrived_at' | 'delivered_at'
> & {
  id?: string
  whatsapp_sent_at?: string | null
  coupon_id?: string | null
  coupon_discount_bhd?: number | null
  assigned_driver_id?: string | null
  delivery_address?: string | null
  delivery_lat?: number | null
  delivery_lng?: number | null
  delivery_instructions?: string | null
  delivery_building?: string | null
  delivery_street?: string | null
  delivery_area?: string | null
  expected_delivery_time?: string | null
  customer_notes?: string | null
  driver_notes?: string | null
  picked_up_at?: string | null
  arrived_at?: string | null
  delivered_at?: string | null
}

export type OrderItemInsert = Omit<OrderItemRow, 'id' | 'created_at'> & {
  id?: string
}


// ── Loyalty types (Phase 5) ───────────────────────────────────────────────────

export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum'
export type PointsTransactionType = 'earned' | 'redeemed' | 'expired' | 'bonus'

export type CustomerProfileRow = {
  id:              string
  phone:           string
  name:            string | null
  email:           string | null
  loyalty_tier:    LoyaltyTier
  points_balance:  number
  total_spent_bhd: number
  total_orders:    number
  joined_at:       string
  last_order_at:   string | null
}

export type CustomerProfileInsert = Omit<CustomerProfileRow, 'joined_at' | 'loyalty_tier' | 'points_balance' | 'total_spent_bhd' | 'total_orders' | 'last_order_at'> & {
  joined_at?:       string
  loyalty_tier?:    LoyaltyTier
  points_balance?:  number
  total_spent_bhd?: number
  total_orders?:    number
  last_order_at?:   string | null
}

export type PointsTransactionRow = {
  id:               string
  customer_id:      string
  order_id:         string | null
  points_earned:    number
  points_spent:     number
  balance_after:    number
  transaction_type: PointsTransactionType
  description:      string | null
  created_at:       string
}

export type PointsTransactionInsert = Omit<PointsTransactionRow, 'id' | 'created_at'> & {
  id?: string
}

// ── Coupon types (Phase 5B) ───────────────────────────────────────────────────

export type CouponType = 'percentage' | 'fixed_amount'

export type CouponRow = {
  id:                   string
  code:                 string
  type:                 CouponType
  value:                number
  description_ar:       string | null
  description_en:       string | null
  min_order_value_bhd:  number
  max_discount_bhd:     number | null
  usage_limit:          number | null
  usage_count:          number
  per_customer_limit:   number
  valid_from:           string
  valid_until:          string | null
  is_active:            boolean
  created_by:           string | null
  created_at:           string
  // Enterprise fields
  campaign_name:        string | null
  discount_type:        string | null
  max_discount_amount:  number | null
  min_order_value:      number | null
  applicable_branches:  string[] | null
  applicable_items:     string[] | null
  applicable_categories: string[] | null
  customer_segment:     string | null
  days_active:          number[] | null
  time_start:           string | null
  time_end:             string | null
  auto_apply:           boolean
  total_redemptions:    number
  total_revenue_impact: number
  paused:               boolean
  paused_at:            string | null
}

export type CouponRedemptionRow = {
  id:              string
  coupon_id:       string
  order_id:        string
  customer_id:     string | null
  discount_amount: number
  order_total:     number
  redeemed_at:     string
}

export type CouponTemplateRow = {
  id:                   string
  name:                 string
  description:          string | null
  discount_type:        string
  discount_value:       number
  suggested_min_order:  number | null
  suggested_max_uses:   number | null
  category:             string | null
  created_at:           string
}

export type CouponInsert = Omit<CouponRow, 'id' | 'usage_count' | 'created_at' | 'total_redemptions' | 'total_revenue_impact'> & {
  id?:          string
  usage_count?: number
}

export type CouponUpdate = Partial<Omit<CouponRow, 'id' | 'created_at' | 'usage_count' | 'total_redemptions' | 'total_revenue_impact'>>

export type CouponUsageRow = {
  id:                   string
  coupon_id:            string
  customer_id:          string | null
  order_id:             string
  discount_amount_bhd:  number
  used_at:              string
}

export type CouponUsageInsert = Omit<CouponUsageRow, 'id' | 'used_at'> & { id?: string }

// ── Payment types (Phase 6) ───────────────────────────────────────────────────

export type PaymentMethod = 'cash' | 'benefit_qr' | 'tap_card' | 'tap_knet'
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded'

export type PaymentRow = {
  id:                     string
  order_id:               string
  amount_bhd:             number
  method:                 PaymentMethod
  status:                 PaymentStatus
  gateway_transaction_id: string | null
  gateway_response:       Record<string, unknown> | null
  paid_at:                string | null
  refunded_at:            string | null
  refund_amount_bhd:      number | null
  refund_reason:          string | null
  created_at:             string
  updated_at:             string
}

export type PaymentInsert = {
  id?:                      string
  order_id:                 string
  amount_bhd:               number
  method:                   PaymentMethod
  status?:                  PaymentStatus
  gateway_transaction_id?:  string | null
  gateway_response?:        Record<string, unknown> | null
  paid_at?:                 string | null
  refunded_at?:             string | null
  refund_amount_bhd?:       number | null
  refund_reason?:           string | null
}

export type PaymentUpdate = Partial<Omit<PaymentRow, 'id' | 'order_id' | 'created_at'>>

export type PaymentWebhookRow = {
  id:           string
  provider:     string
  event_type:   string | null
  payload:      Record<string, unknown>
  processed:    boolean
  processed_at: string | null
  created_at:   string
}

// ── Driver types ───────────────────────────────────────────────────────────────

export type DriverOrder = OrderRow & {
  order_items: Pick<OrderItemRow, 'name_ar' | 'name_en' | 'quantity' | 'selected_size' | 'selected_variant'>[]
  payments?:   { method: PaymentMethod }[] | null
}

export type DriverLocationRow = {
  id:         string
  driver_id:  string
  order_id:   string | null
  lat:        number
  lng:        number
  accuracy_m: number | null
  created_at: string
}

export type DriverLocationInsert = Omit<DriverLocationRow, 'id' | 'created_at'> & { id?: string }

// ── Joined types (used in dashboard / confirmation pages) ─────────────────────

export type OrderWithItems = OrderRow & {
  order_items: OrderItemRow[]
  branch:      BranchRow | null
}

// ── Database type (for createBrowserClient / createServerClient) ──────────────

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '12'
  }
  public: {
    Tables: {
      branches: {
        Row:    BranchRow
        Insert: Omit<BranchRow, 'created_at' | 'latitude' | 'longitude'> & { latitude?: number | null; longitude?: number | null }
        Update: Partial<Omit<BranchRow, 'id' | 'created_at'>>
        Relationships: []
      }
      customers: {
        Row:    CustomerRow
        Insert: Omit<CustomerRow, 'id' | 'created_at'> & { id?: string }
        Update: Partial<Omit<CustomerRow, 'id' | 'created_at'>>
        Relationships: []
      }
      orders: {
        Row:    OrderRow
        Insert: OrderInsert
        Update: Partial<Omit<OrderRow, 'id' | 'created_at'>>
        Relationships: []
      }
      order_items: {
        Row:    OrderItemRow
        Insert: OrderItemInsert
        Update: never
        Relationships: []
      }
      menu_items_sync: {
        Row:    MenuItemSyncRow
        Insert: Omit<MenuItemSyncRow, 'last_synced_at'> & { last_synced_at?: string }
        Update: Partial<Omit<MenuItemSyncRow, 'slug'>>
        Relationships: []
      }
      staff_basic: {
        Row:    StaffBasicRow
        Insert: Omit<StaffBasicRow, 'created_at'> & { id?: string }
        Update: Partial<Omit<StaffBasicRow, 'id' | 'created_at'>>
        Relationships: []
      }
      audit_logs: {
        Row:    AuditLogRow
        Insert: Omit<AuditLogRow, 'id' | 'created_at'> & { id?: string }
        Update: never
        Relationships: []
      }
      contact_messages: {
        Row:    ContactMessageRow
        Insert: ContactMessageInsert
        Update: Partial<Pick<ContactMessageRow, 'status'>>
        Relationships: []
      }
      customer_profiles: {
        Row:    CustomerProfileRow
        Insert: CustomerProfileInsert
        Update: Partial<Omit<CustomerProfileRow, 'id' | 'joined_at'>>
        Relationships: []
      }
      points_transactions: {
        Row:    PointsTransactionRow
        Insert: PointsTransactionInsert
        Update: never
        Relationships: []
      }
      coupons: {
        Row:    CouponRow
        Insert: CouponInsert
        Update: CouponUpdate
        Relationships: []
      }
      coupon_usages: {
        Row:    CouponUsageRow
        Insert: CouponUsageInsert
        Update: never
        Relationships: []
      }
      kds_queue: {
        Row:    KDSQueueRow
        Insert: Omit<KDSQueueRow, 'id' | 'created_at'> & { id?: string }
        Update: Partial<Omit<KDSQueueRow, 'id' | 'order_id' | 'order_item_id' | 'created_at'>>
        Relationships: []
      }
      driver_locations: {
        Row:    DriverLocationRow
        Insert: DriverLocationInsert
        Update: never
        Relationships: []
      }
      payments: {
        Row:    PaymentRow
        Insert: PaymentInsert
        Update: PaymentUpdate
        Relationships: []
      }
      payment_webhooks: {
        Row:    PaymentWebhookRow
        Insert: Omit<PaymentWebhookRow, 'id' | 'created_at' | 'processed' | 'processed_at'> & {
          id?:           string
          processed?:    boolean
          processed_at?: string | null
        }
        Update: Partial<Pick<PaymentWebhookRow, 'processed' | 'processed_at'>>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      increment_coupon_usage: {
        Args:    { p_coupon_id: string }
        Returns: void
      }
    }
    Enums: {
      order_status:   OrderStatus
      staff_role:     StaffRole
      kds_station:    KDSStation
      coupon_type:    CouponType
      loyalty_tier:   LoyaltyTier
      payment_method: PaymentMethod
      payment_status: PaymentStatus
    }
  }
}
