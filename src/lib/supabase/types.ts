export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_role: Database["public"]["Enums"]["staff_role"] | null
          branch_id: string | null
          changes: Json | null
          created_at: string
          id: string
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          actor_role?: Database["public"]["Enums"]["staff_role"] | null
          branch_id?: string | null
          changes?: Json | null
          created_at?: string
          id?: string
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          actor_role?: Database["public"]["Enums"]["staff_role"] | null
          branch_id?: string | null
          changes?: Json | null
          created_at?: string
          id?: string
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          latitude: number | null
          longitude: number | null
          maps_url: string | null
          name_ar: string
          name_en: string
          phone: string
          wa_link: string
          whatsapp: string
        }
        Insert: {
          created_at?: string
          id: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          maps_url?: string | null
          name_ar: string
          name_en: string
          phone: string
          wa_link: string
          whatsapp: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          maps_url?: string | null
          name_ar?: string
          name_en?: string
          phone?: string
          wa_link?: string
          whatsapp?: string
        }
        Relationships: []
      }
      business_hours: {
        Row: {
          branch_id: string
          close_time: string
          day_of_week: number
          id: string
          is_closed: boolean
          open_time: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          close_time?: string
          day_of_week: number
          id?: string
          is_closed?: boolean
          open_time?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          close_time?: string
          day_of_week?: number
          id?: string
          is_closed?: boolean
          open_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_hours_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          branch_id: string | null
          created_at: string
          email: string
          id: string
          message: string
          name: string
          phone: string | null
          status: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          phone?: string | null
          status?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          phone?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_messages_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_redemptions: {
        Row: {
          coupon_id: string | null
          customer_id: string | null
          discount_amount: number
          id: string
          order_id: string | null
          order_total: number
          redeemed_at: string | null
        }
        Insert: {
          coupon_id?: string | null
          customer_id?: string | null
          discount_amount: number
          id?: string
          order_id?: string | null
          order_total: number
          redeemed_at?: string | null
        }
        Update: {
          coupon_id?: string | null
          customer_id?: string | null
          discount_amount?: number
          id?: string
          order_id?: string | null
          order_total?: number
          redeemed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_templates: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          discount_type: string
          discount_value: number
          id: string
          name: string
          suggested_max_uses: number | null
          suggested_min_order: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          discount_type: string
          discount_value: number
          id?: string
          name: string
          suggested_max_uses?: number | null
          suggested_min_order?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          name?: string
          suggested_max_uses?: number | null
          suggested_min_order?: number | null
        }
        Relationships: []
      }
      coupon_usages: {
        Row: {
          coupon_id: string
          customer_id: string | null
          discount_amount_bhd: number
          id: string
          order_id: string
          used_at: string
        }
        Insert: {
          coupon_id: string
          customer_id?: string | null
          discount_amount_bhd: number
          id?: string
          order_id: string
          used_at?: string
        }
        Update: {
          coupon_id?: string
          customer_id?: string | null
          discount_amount_bhd?: number
          id?: string
          order_id?: string
          used_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_usages_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_usages_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_usages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          applicable_branches: string[] | null
          applicable_categories: string[] | null
          applicable_items: string[] | null
          auto_apply: boolean | null
          campaign_name: string | null
          code: string
          created_at: string
          created_by: string | null
          customer_segment: string | null
          days_active: number[] | null
          description_ar: string | null
          description_en: string | null
          discount_type: string | null
          id: string
          is_active: boolean
          max_discount_amount: number | null
          max_discount_bhd: number | null
          min_order_value: number | null
          min_order_value_bhd: number
          paused: boolean | null
          paused_at: string | null
          per_customer_limit: number
          time_end: string | null
          time_start: string | null
          total_redemptions: number | null
          total_revenue_impact: number | null
          type: Database["public"]["Enums"]["coupon_type"]
          usage_count: number
          usage_limit: number | null
          valid_from: string
          valid_until: string | null
          value: number
        }
        Insert: {
          applicable_branches?: string[] | null
          applicable_categories?: string[] | null
          applicable_items?: string[] | null
          auto_apply?: boolean | null
          campaign_name?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          customer_segment?: string | null
          days_active?: number[] | null
          description_ar?: string | null
          description_en?: string | null
          discount_type?: string | null
          id?: string
          is_active?: boolean
          max_discount_amount?: number | null
          max_discount_bhd?: number | null
          min_order_value?: number | null
          min_order_value_bhd?: number
          paused?: boolean | null
          paused_at?: string | null
          per_customer_limit?: number
          time_end?: string | null
          time_start?: string | null
          total_redemptions?: number | null
          total_revenue_impact?: number | null
          type: Database["public"]["Enums"]["coupon_type"]
          usage_count?: number
          usage_limit?: number | null
          valid_from?: string
          valid_until?: string | null
          value: number
        }
        Update: {
          applicable_branches?: string[] | null
          applicable_categories?: string[] | null
          applicable_items?: string[] | null
          auto_apply?: boolean | null
          campaign_name?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          customer_segment?: string | null
          days_active?: number[] | null
          description_ar?: string | null
          description_en?: string | null
          discount_type?: string | null
          id?: string
          is_active?: boolean
          max_discount_amount?: number | null
          max_discount_bhd?: number | null
          min_order_value?: number | null
          min_order_value_bhd?: number
          paused?: boolean | null
          paused_at?: string | null
          per_customer_limit?: number
          time_end?: string | null
          time_start?: string | null
          total_redemptions?: number | null
          total_revenue_impact?: number | null
          type?: Database["public"]["Enums"]["coupon_type"]
          usage_count?: number
          usage_limit?: number | null
          valid_from?: string
          valid_until?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "coupons_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_basic"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_profiles: {
        Row: {
          email: string | null
          id: string
          joined_at: string
          last_order_at: string | null
          loyalty_tier: Database["public"]["Enums"]["loyalty_tier"]
          name: string | null
          phone: string
          points_balance: number
          total_orders: number
          total_spent_bhd: number
        }
        Insert: {
          email?: string | null
          id: string
          joined_at?: string
          last_order_at?: string | null
          loyalty_tier?: Database["public"]["Enums"]["loyalty_tier"]
          name?: string | null
          phone: string
          points_balance?: number
          total_orders?: number
          total_spent_bhd?: number
        }
        Update: {
          email?: string | null
          id?: string
          joined_at?: string
          last_order_at?: string | null
          loyalty_tier?: Database["public"]["Enums"]["loyalty_tier"]
          name?: string | null
          phone?: string
          points_balance?: number
          total_orders?: number
          total_spent_bhd?: number
        }
        Relationships: []
      }
      customers: {
        Row: {
          created_at: string
          id: string
          is_guest: boolean
          name: string | null
          phone: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_guest?: boolean
          name?: string | null
          phone?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_guest?: boolean
          name?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      driver_cash_handovers: {
        Row: {
          created_at: string
          driver_id: string
          handed_at: string
          id: string
          notes: string | null
          order_ids: string[]
          received_by: string | null
          shift_date: string
          total_cash: number
          verified: boolean
        }
        Insert: {
          created_at?: string
          driver_id: string
          handed_at?: string
          id?: string
          notes?: string | null
          order_ids?: string[]
          received_by?: string | null
          shift_date: string
          total_cash: number
          verified?: boolean
        }
        Update: {
          created_at?: string
          driver_id?: string
          handed_at?: string
          id?: string
          notes?: string | null
          order_ids?: string[]
          received_by?: string | null
          shift_date?: string
          total_cash?: number
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "driver_cash_handovers_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "staff_basic"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_cash_handovers_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "staff_basic"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_earnings: {
        Row: {
          cash_collected: number | null
          created_at: string | null
          delivery_fee: number
          driver_id: string
          earned_at: string | null
          id: string
          order_id: string
          tip: number | null
        }
        Insert: {
          cash_collected?: number | null
          created_at?: string | null
          delivery_fee: number
          driver_id: string
          earned_at?: string | null
          id?: string
          order_id: string
          tip?: number | null
        }
        Update: {
          cash_collected?: number | null
          created_at?: string | null
          delivery_fee?: number
          driver_id?: string
          earned_at?: string | null
          id?: string
          order_id?: string
          tip?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_earnings_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "staff_basic"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_earnings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_locations: {
        Row: {
          accuracy_m: number | null
          created_at: string
          driver_id: string
          id: string
          lat: number
          lng: number
          order_id: string | null
        }
        Insert: {
          accuracy_m?: number | null
          created_at?: string
          driver_id: string
          id?: string
          lat: number
          lng: number
          order_id?: string | null
        }
        Update: {
          accuracy_m?: number | null
          created_at?: string
          driver_id?: string
          id?: string
          lat?: number
          lng?: number
          order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_locations_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "staff_basic"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_locations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_order_issues: {
        Row: {
          created_at: string
          driver_id: string
          id: string
          notes: string | null
          order_id: string
          reason: string
        }
        Insert: {
          created_at?: string
          driver_id: string
          id?: string
          notes?: string | null
          order_id: string
          reason: string
        }
        Update: {
          created_at?: string
          driver_id?: string
          id?: string
          notes?: string | null
          order_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_order_issues_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "staff_basic"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_order_issues_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      jetski_test: {
        Row: {
          id: number
        }
        Insert: {
          id?: number
        }
        Update: {
          id?: number
        }
        Relationships: []
      }
      kds_queue: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          id: string
          order_id: string
          order_item_id: string
          priority: number
          started_at: string | null
          station: Database["public"]["Enums"]["kds_station"]
          status: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          order_id: string
          order_item_id: string
          priority?: number
          started_at?: string | null
          station?: Database["public"]["Enums"]["kds_station"]
          status?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          order_id?: string
          order_item_id?: string
          priority?: number
          started_at?: string | null
          station?: Database["public"]["Enums"]["kds_station"]
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "kds_queue_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "staff_basic"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kds_queue_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kds_queue_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          days_count: number
          end_date: string
          id: string
          leave_type: string
          reason: string | null
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_notes: string | null
          staff_id: string
          start_date: string
          status: string
        }
        Insert: {
          days_count: number
          end_date: string
          id?: string
          leave_type: string
          reason?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          staff_id: string
          start_date: string
          status?: string
        }
        Update: {
          days_count?: number
          end_date?: string
          id?: string
          leave_type?: string
          reason?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          staff_id?: string
          start_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "staff_basic"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_basic"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items_sync: {
        Row: {
          last_synced_at: string
          name_ar: string
          name_en: string
          price_bhd: number | null
          slug: string
          station: Database["public"]["Enums"]["kds_station"] | null
          sync_source: string
        }
        Insert: {
          last_synced_at?: string
          name_ar: string
          name_en: string
          price_bhd?: number | null
          slug: string
          station?: Database["public"]["Enums"]["kds_station"] | null
          sync_source?: string
        }
        Update: {
          last_synced_at?: string
          name_ar?: string
          name_en?: string
          price_bhd?: number | null
          slug?: string
          station?: Database["public"]["Enums"]["kds_station"] | null
          sync_source?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          item_total_bhd: number
          menu_item_slug: string
          name_ar: string
          name_en: string
          order_id: string
          quantity: number
          selected_size: string | null
          selected_variant: string | null
          unit_price_bhd: number
        }
        Insert: {
          created_at?: string
          id?: string
          item_total_bhd: number
          menu_item_slug: string
          name_ar: string
          name_en: string
          order_id: string
          quantity: number
          selected_size?: string | null
          selected_variant?: string | null
          unit_price_bhd: number
        }
        Update: {
          created_at?: string
          id?: string
          item_total_bhd?: number
          menu_item_slug?: string
          name_ar?: string
          name_en?: string
          order_id?: string
          quantity?: number
          selected_size?: string | null
          selected_variant?: string | null
          unit_price_bhd?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          arrived_at: string | null
          assigned_driver_id: string | null
          branch_id: string
          coupon_discount_bhd: number | null
          coupon_id: string | null
          created_at: string
          customer_location: Json | null
          customer_name: string | null
          customer_notes: string | null
          customer_phone: string | null
          customer_signature: string | null
          delivered_at: string | null
          delivery_address: string | null
          delivery_area: string | null
          delivery_building: string | null
          delivery_instructions: string | null
          delivery_lat: number | null
          delivery_lng: number | null
          delivery_notes: string | null
          delivery_proof_url: string | null
          delivery_street: string | null
          driver_notes: string | null
          expected_delivery_time: string | null
          id: string
          notes: string | null
          order_type: string
          picked_up_at: string | null
          restaurant_location: Json | null
          source: string
          status: Database["public"]["Enums"]["order_status"]
          total_bhd: number
          updated_at: string
          whatsapp_sent_at: string | null
        }
        Insert: {
          arrived_at?: string | null
          assigned_driver_id?: string | null
          branch_id: string
          coupon_discount_bhd?: number | null
          coupon_id?: string | null
          created_at?: string
          customer_location?: Json | null
          customer_name?: string | null
          customer_notes?: string | null
          customer_phone?: string | null
          customer_signature?: string | null
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_area?: string | null
          delivery_building?: string | null
          delivery_instructions?: string | null
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_notes?: string | null
          delivery_proof_url?: string | null
          delivery_street?: string | null
          driver_notes?: string | null
          expected_delivery_time?: string | null
          id?: string
          notes?: string | null
          order_type?: string
          picked_up_at?: string | null
          restaurant_location?: Json | null
          source?: string
          status?: Database["public"]["Enums"]["order_status"]
          total_bhd: number
          updated_at?: string
          whatsapp_sent_at?: string | null
        }
        Update: {
          arrived_at?: string | null
          assigned_driver_id?: string | null
          branch_id?: string
          coupon_discount_bhd?: number | null
          coupon_id?: string | null
          created_at?: string
          customer_location?: Json | null
          customer_name?: string | null
          customer_notes?: string | null
          customer_phone?: string | null
          customer_signature?: string | null
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_area?: string | null
          delivery_building?: string | null
          delivery_instructions?: string | null
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_notes?: string | null
          delivery_proof_url?: string | null
          delivery_street?: string | null
          driver_notes?: string | null
          expected_delivery_time?: string | null
          id?: string
          notes?: string | null
          order_type?: string
          picked_up_at?: string | null
          restaurant_location?: Json | null
          source?: string
          status?: Database["public"]["Enums"]["order_status"]
          total_bhd?: number
          updated_at?: string
          whatsapp_sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_assigned_driver_id_fkey"
            columns: ["assigned_driver_id"]
            isOneToOne: false
            referencedRelation: "staff_basic"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_webhooks: {
        Row: {
          created_at: string
          event_type: string | null
          id: string
          payload: Json
          processed: boolean
          processed_at: string | null
          provider: string
        }
        Insert: {
          created_at?: string
          event_type?: string | null
          id?: string
          payload: Json
          processed?: boolean
          processed_at?: string | null
          provider: string
        }
        Update: {
          created_at?: string
          event_type?: string | null
          id?: string
          payload?: Json
          processed?: boolean
          processed_at?: string | null
          provider?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_bhd: number
          created_at: string
          gateway_response: Json | null
          gateway_transaction_id: string | null
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          order_id: string
          paid_at: string | null
          refund_amount_bhd: number | null
          refund_reason: string | null
          refunded_at: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount_bhd: number
          created_at?: string
          gateway_response?: Json | null
          gateway_transaction_id?: string | null
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          order_id: string
          paid_at?: string | null
          refund_amount_bhd?: number | null
          refund_reason?: string | null
          refunded_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount_bhd?: number
          created_at?: string
          gateway_response?: Json | null
          gateway_transaction_id?: string | null
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          order_id?: string
          paid_at?: string | null
          refund_amount_bhd?: number | null
          refund_reason?: string | null
          refunded_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      points_transactions: {
        Row: {
          balance_after: number
          created_at: string
          customer_id: string
          description: string | null
          id: string
          order_id: string | null
          points_earned: number
          points_spent: number
          transaction_type: string
        }
        Insert: {
          balance_after: number
          created_at?: string
          customer_id: string
          description?: string | null
          id?: string
          order_id?: string | null
          points_earned?: number
          points_spent?: number
          transaction_type: string
        }
        Update: {
          balance_after?: number
          created_at?: string
          customer_id?: string
          description?: string | null
          id?: string
          order_id?: string | null
          points_earned?: number
          points_spent?: number
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "points_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "points_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      report_audit_log: {
        Row: {
          data_snapshot: Json | null
          export_format: string | null
          file_size_kb: number | null
          filters: Json | null
          generated_at: string
          generated_by: string | null
          id: string
          report_name: string
          report_type: string
          row_count: number | null
          validation_flags: Json | null
        }
        Insert: {
          data_snapshot?: Json | null
          export_format?: string | null
          file_size_kb?: number | null
          filters?: Json | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          report_name: string
          report_type: string
          row_count?: number | null
          validation_flags?: Json | null
        }
        Update: {
          data_snapshot?: Json | null
          export_format?: string | null
          file_size_kb?: number | null
          filters?: Json | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          report_name?: string
          report_type?: string
          row_count?: number | null
          validation_flags?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "report_audit_log_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "staff_basic"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_profile: {
        Row: {
          commercial_registration: string | null
          created_at: string
          description_ar: string | null
          description_en: string | null
          email: string | null
          id: string
          logo_url: string | null
          phone: string | null
          restaurant_name_ar: string
          restaurant_name_en: string
          tax_number: string | null
          updated_at: string
        }
        Insert: {
          commercial_registration?: string | null
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          phone?: string | null
          restaurant_name_ar?: string
          restaurant_name_en?: string
          tax_number?: string | null
          updated_at?: string
        }
        Update: {
          commercial_registration?: string | null
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          phone?: string | null
          restaurant_name_ar?: string
          restaurant_name_en?: string
          tax_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      shift_swap_requests: {
        Row: {
          from_staff_id: string
          id: string
          reason: string | null
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          shift_id: string
          status: string
          to_staff_id: string | null
        }
        Insert: {
          from_staff_id: string
          id?: string
          reason?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          shift_id: string
          status?: string
          to_staff_id?: string | null
        }
        Update: {
          from_staff_id?: string
          id?: string
          reason?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          shift_id?: string
          status?: string
          to_staff_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shift_swap_requests_from_staff_id_fkey"
            columns: ["from_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_basic"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swap_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "staff_basic"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swap_requests_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swap_requests_to_staff_id_fkey"
            columns: ["to_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_basic"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          end_time: string
          id: string
          notes: string | null
          position: string | null
          shift_date: string
          staff_id: string
          start_time: string
          status: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          end_time: string
          id?: string
          notes?: string | null
          position?: string | null
          shift_date: string
          staff_id: string
          start_time: string
          status?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          end_time?: string
          id?: string
          notes?: string | null
          position?: string | null
          shift_date?: string
          staff_id?: string
          start_time?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_basic"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_basic"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_basic: {
        Row: {
          address: string | null
          availability_status: string | null
          branch_id: string | null
          clock_pin: string | null
          created_at: string
          date_of_birth: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          employment_type: string | null
          hire_date: string | null
          hourly_rate: number | null
          id: string
          id_number: string | null
          is_active: boolean
          name: string
          phone: string | null
          profile_photo_url: string | null
          role: Database["public"]["Enums"]["staff_role"]
          staff_notes: string | null
        }
        Insert: {
          address?: string | null
          availability_status?: string | null
          branch_id?: string | null
          clock_pin?: string | null
          created_at?: string
          date_of_birth?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employment_type?: string | null
          hire_date?: string | null
          hourly_rate?: number | null
          id?: string
          id_number?: string | null
          is_active?: boolean
          name: string
          phone?: string | null
          profile_photo_url?: string | null
          role: Database["public"]["Enums"]["staff_role"]
          staff_notes?: string | null
        }
        Update: {
          address?: string | null
          availability_status?: string | null
          branch_id?: string | null
          clock_pin?: string | null
          created_at?: string
          date_of_birth?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employment_type?: string | null
          hire_date?: string | null
          hourly_rate?: number | null
          id?: string
          id_number?: string | null
          is_active?: boolean
          name?: string
          phone?: string | null
          profile_photo_url?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
          staff_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_basic_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_documents: {
        Row: {
          document_type: string
          expiry_date: string | null
          file_name: string
          file_size_kb: number | null
          file_url: string
          id: string
          notes: string | null
          staff_id: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          document_type: string
          expiry_date?: string | null
          file_name: string
          file_size_kb?: number | null
          file_url: string
          id?: string
          notes?: string | null
          staff_id: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          document_type?: string
          expiry_date?: string | null
          file_name?: string
          file_size_kb?: number | null
          file_url?: string
          id?: string
          notes?: string | null
          staff_id?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_documents_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_basic"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "staff_basic"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_payroll: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          base_pay: number
          bonuses: number
          created_at: string
          currency: string
          deductions: number
          hourly_rate: number | null
          id: string
          net_pay: number | null
          notes: string | null
          overtime_hours: number
          paid_at: string | null
          period_end: string
          period_start: string
          regular_hours: number
          staff_id: string
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          base_pay?: number
          bonuses?: number
          created_at?: string
          currency?: string
          deductions?: number
          hourly_rate?: number | null
          id?: string
          net_pay?: number | null
          notes?: string | null
          overtime_hours?: number
          paid_at?: string | null
          period_end: string
          period_start: string
          regular_hours?: number
          staff_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          base_pay?: number
          bonuses?: number
          created_at?: string
          currency?: string
          deductions?: number
          hourly_rate?: number | null
          id?: string
          net_pay?: number | null
          notes?: string | null
          overtime_hours?: number
          paid_at?: string | null
          period_end?: string
          period_start?: string
          regular_hours?: number
          staff_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_payroll_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "staff_basic"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_payroll_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_basic"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_permissions: {
        Row: {
          expires_at: string | null
          granted_at: string
          granted_by: string | null
          id: string
          permission: string
          staff_id: string
        }
        Insert: {
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          permission: string
          staff_id: string
        }
        Update: {
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          permission?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_permissions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "staff_basic"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_permissions_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_basic"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      time_entries: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          break_minutes: number
          clock_in: string
          clock_out: string | null
          created_at: string
          id: string
          notes: string | null
          overtime_hours: number
          shift_id: string | null
          staff_id: string
          total_hours: number | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          break_minutes?: number
          clock_in: string
          clock_out?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          overtime_hours?: number
          shift_id?: string | null
          staff_id: string
          total_hours?: number | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          break_minutes?: number
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          overtime_hours?: number
          shift_id?: string | null
          staff_id?: string
          total_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "staff_basic"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_basic"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          date_format: string
          language: string
          notification_prefs: Json
          theme: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          date_format?: string
          language?: string
          notification_prefs?: Json
          theme?: string
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          date_format?: string
          language?: string
          notification_prefs?: Json
          theme?: string
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      customer_lifetime_value: {
        Row: {
          avg_order_value_bhd: number | null
          customer_name: string | null
          customer_phone: string | null
          first_order_at: string | null
          last_order_at: string | null
          order_count: number | null
          total_spent_bhd: number | null
        }
        Relationships: []
      }
      daily_sales: {
        Row: {
          avg_order_value_bhd: number | null
          branch_id: string | null
          order_count: number | null
          order_date: string | null
          total_revenue_bhd: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      hourly_order_distribution: {
        Row: {
          avg_order_value_bhd: number | null
          hour_of_day: number | null
          order_count: number | null
          total_revenue_bhd: number | null
        }
        Relationships: []
      }
      top_menu_items: {
        Row: {
          menu_item_slug: string | null
          name_ar: string | null
          name_en: string | null
          order_count: number | null
          total_quantity: number | null
          total_revenue_bhd: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      auth_user_branch_id: { Args: never; Returns: string }
      auth_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["staff_role"]
      }
      calculate_loyalty_tier: {
        Args: { p_orders: number; p_spent: number }
        Returns: Database["public"]["Enums"]["loyalty_tier"]
      }
      increment_coupon_usage: {
        Args: { p_coupon_id: string }
        Returns: undefined
      }
      refresh_analytics_views: { Args: never; Returns: undefined }
    }
    Enums: {
      coupon_type: "percentage" | "fixed_amount"
      kds_station:
        | "grill"
        | "fry"
        | "salads"
        | "desserts"
        | "drinks"
        | "packing"
      loyalty_tier: "bronze" | "silver" | "gold" | "platinum"
      order_status:
        | "new"
        | "under_review"
        | "accepted"
        | "preparing"
        | "ready"
        | "out_for_delivery"
        | "delivered"
        | "completed"
        | "cancelled"
        | "payment_failed"
      payment_method: "cash" | "benefit_qr" | "tap_card" | "tap_knet"
      payment_status:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "refunded"
      staff_role:
        | "owner"
        | "general_manager"
        | "branch_manager"
        | "cashier"
        | "kitchen"
        | "driver"
        | "inventory"
        | "marketing"
        | "support"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      coupon_type: ["percentage", "fixed_amount"],
      kds_station: ["grill", "fry", "salads", "desserts", "drinks", "packing"],
      loyalty_tier: ["bronze", "silver", "gold", "platinum"],
      order_status: [
        "new",
        "under_review",
        "accepted",
        "preparing",
        "ready",
        "out_for_delivery",
        "delivered",
        "completed",
        "cancelled",
        "payment_failed",
      ],
      payment_method: ["cash", "benefit_qr", "tap_card", "tap_knet"],
      payment_status: [
        "pending",
        "processing",
        "completed",
        "failed",
        "refunded",
      ],
      staff_role: [
        "owner",
        "general_manager",
        "branch_manager",
        "cashier",
        "kitchen",
        "driver",
        "inventory",
        "marketing",
        "support",
      ],
    },
  },
} as const
