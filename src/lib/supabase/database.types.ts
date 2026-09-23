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
      addresses: {
        Row: {
          city: string
          created_at: string
          delivery_zone_id: string | null
          digital_address: string | null
          id: string
          is_default: boolean
          label: string | null
          landmark: string | null
          line1: string
          line2: string | null
          phone: string
          recipient_name: string
          region: string
          updated_at: string
          user_id: string
        }
        Insert: {
          city: string
          created_at?: string
          delivery_zone_id?: string | null
          digital_address?: string | null
          id?: string
          is_default?: boolean
          label?: string | null
          landmark?: string | null
          line1: string
          line2?: string | null
          phone: string
          recipient_name: string
          region: string
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string
          created_at?: string
          delivery_zone_id?: string | null
          digital_address?: string | null
          id?: string
          is_default?: boolean
          label?: string | null
          landmark?: string | null
          line1?: string
          line2?: string | null
          phone?: string
          recipient_name?: string
          region?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "addresses_delivery_zone_id_fkey"
            columns: ["delivery_zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_path: string | null
          is_active: boolean
          name: string
          parent_id: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string | null
          is_active?: boolean
          name: string
          parent_id?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string | null
          is_active?: boolean
          name?: string
          parent_id?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_zones: {
        Row: {
          created_at: string
          description: string | null
          estimated_days: string | null
          fee_minor: number
          free_over_minor: number | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          estimated_days?: string | null
          fee_minor: number
          free_over_minor?: number | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          estimated_days?: string | null
          fee_minor?: number
          free_over_minor?: number | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      discount_codes: {
        Row: {
          code: string
          created_at: string
          description: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          max_discount_minor: number | null
          min_order_minor: number
          per_customer_limit: number | null
          starts_at: string | null
          type: Database["public"]["Enums"]["discount_type"]
          updated_at: string
          usage_count: number
          usage_limit: number | null
          value: number
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_discount_minor?: number | null
          min_order_minor?: number
          per_customer_limit?: number | null
          starts_at?: string | null
          type: Database["public"]["Enums"]["discount_type"]
          updated_at?: string
          usage_count?: number
          usage_limit?: number | null
          value: number
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_discount_minor?: number | null
          min_order_minor?: number
          per_customer_limit?: number | null
          starts_at?: string | null
          type?: Database["public"]["Enums"]["discount_type"]
          updated_at?: string
          usage_count?: number
          usage_limit?: number | null
          value?: number
        }
        Relationships: []
      }
      discount_redemptions: {
        Row: {
          amount_minor: number
          created_at: string
          customer_id: string
          discount_id: string
          email: string
          id: string
          order_id: string
        }
        Insert: {
          amount_minor: number
          created_at?: string
          customer_id: string
          discount_id: string
          email: string
          id?: string
          order_id: string
        }
        Update: {
          amount_minor?: number
          created_at?: string
          customer_id?: string
          discount_id?: string
          email?: string
          id?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discount_redemptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_redemptions_discount_id_fkey"
            columns: ["discount_id"]
            isOneToOne: false
            referencedRelation: "discount_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_redemptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          low_stock_threshold: number | null
          on_hand: number
          reserved: number
          updated_at: string
          variant_id: string
        }
        Insert: {
          low_stock_threshold?: number | null
          on_hand?: number
          reserved?: number
          updated_at?: string
          variant_id: string
        }
        Update: {
          low_stock_threshold?: number | null
          on_hand?: number
          reserved?: number
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: true
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          actor_id: string | null
          created_at: string
          delta_on_hand: number
          delta_reserved: number
          id: number
          note: string | null
          order_id: string | null
          reason: Database["public"]["Enums"]["inventory_reason"]
          variant_id: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          delta_on_hand?: number
          delta_reserved?: number
          id?: never
          note?: string | null
          order_id?: string | null
          reason: Database["public"]["Enums"]["inventory_reason"]
          variant_id?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          delta_on_hand?: number
          delta_reserved?: number
          id?: never
          note?: string | null
          order_id?: string | null
          reason?: Database["public"]["Enums"]["inventory_reason"]
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          image_path: string | null
          line_total_minor: number
          options: Json
          order_id: string
          product_id: string | null
          product_name: string
          product_slug: string | null
          quantity: number
          sku: string | null
          unit_price_minor: number
          variant_id: string | null
          variant_title: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          image_path?: string | null
          line_total_minor: number
          options?: Json
          order_id: string
          product_id?: string | null
          product_name: string
          product_slug?: string | null
          quantity: number
          sku?: string | null
          unit_price_minor: number
          variant_id?: string | null
          variant_title?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          image_path?: string | null
          line_total_minor?: number
          options?: Json
          order_id?: string
          product_id?: string | null
          product_name?: string
          product_slug?: string | null
          quantity?: number
          sku?: string | null
          unit_price_minor?: number
          variant_id?: string | null
          variant_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_notes: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: number
          order_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: never
          order_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: never
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_notes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          actor_id: string | null
          created_at: string
          from_payment_status:
            | Database["public"]["Enums"]["payment_status"]
            | null
          from_status: Database["public"]["Enums"]["order_status"] | null
          id: number
          order_id: string
          to_payment_status: Database["public"]["Enums"]["payment_status"]
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          from_payment_status?:
            | Database["public"]["Enums"]["payment_status"]
            | null
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: never
          order_id: string
          to_payment_status: Database["public"]["Enums"]["payment_status"]
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          from_payment_status?:
            | Database["public"]["Enums"]["payment_status"]
            | null
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: never
          order_id?: string
          to_payment_status?: Database["public"]["Enums"]["payment_status"]
          to_status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          access_token_hash: string
          attention_reason: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          created_at: string
          currency: string
          customer_id: string
          delivery_fee_minor: number
          delivery_instructions: string | null
          delivery_zone_id: string | null
          delivery_zone_name: string
          discount_code: string | null
          discount_code_id: string | null
          discount_minor: number
          email: string
          id: string
          order_number: string
          paid_at: string | null
          payment_provider: string
          payment_reference: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          phone: string
          requires_attention: boolean
          reservation_expires_at: string | null
          shipping_city: string
          shipping_digital_address: string | null
          shipping_line1: string
          shipping_line2: string | null
          shipping_name: string
          shipping_region: string
          status: Database["public"]["Enums"]["order_status"]
          stock_state: Database["public"]["Enums"]["stock_state"]
          subtotal_minor: number
          total_minor: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          access_token_hash: string
          attention_reason?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          currency: string
          customer_id: string
          delivery_fee_minor: number
          delivery_instructions?: string | null
          delivery_zone_id?: string | null
          delivery_zone_name: string
          discount_code?: string | null
          discount_code_id?: string | null
          discount_minor?: number
          email: string
          id?: string
          order_number: string
          paid_at?: string | null
          payment_provider: string
          payment_reference: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          phone: string
          requires_attention?: boolean
          reservation_expires_at?: string | null
          shipping_city: string
          shipping_digital_address?: string | null
          shipping_line1: string
          shipping_line2?: string | null
          shipping_name: string
          shipping_region: string
          status?: Database["public"]["Enums"]["order_status"]
          stock_state?: Database["public"]["Enums"]["stock_state"]
          subtotal_minor: number
          total_minor: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          access_token_hash?: string
          attention_reason?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          currency?: string
          customer_id?: string
          delivery_fee_minor?: number
          delivery_instructions?: string | null
          delivery_zone_id?: string | null
          delivery_zone_name?: string
          discount_code?: string | null
          discount_code_id?: string | null
          discount_minor?: number
          email?: string
          id?: string
          order_number?: string
          paid_at?: string | null
          payment_provider?: string
          payment_reference?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          phone?: string
          requires_attention?: boolean
          reservation_expires_at?: string | null
          shipping_city?: string
          shipping_digital_address?: string | null
          shipping_line1?: string
          shipping_line2?: string | null
          shipping_name?: string
          shipping_region?: string
          status?: Database["public"]["Enums"]["order_status"]
          stock_state?: Database["public"]["Enums"]["stock_state"]
          subtotal_minor?: number
          total_minor?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_zone_id_fkey"
            columns: ["delivery_zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_discount_code_id_fkey"
            columns: ["discount_code_id"]
            isOneToOne: false
            referencedRelation: "discount_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          created_at: string
          error: string | null
          event_type: string
          id: number
          payload: Json
          processed_at: string | null
          provider: string
          provider_event_id: string | null
          reference: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_type: string
          id?: never
          payload: Json
          processed_at?: string | null
          provider: string
          provider_event_id?: string | null
          reference?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          event_type?: string
          id?: never
          payload?: Json
          processed_at?: string | null
          provider?: string
          provider_event_id?: string | null
          reference?: string | null
        }
        Relationships: []
      }
      product_images: {
        Row: {
          alt_text: string | null
          created_at: string
          height: number | null
          id: string
          is_primary: boolean
          option_value_id: string | null
          position: number
          product_id: string
          storage_path: string
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          height?: number | null
          id?: string
          is_primary?: boolean
          option_value_id?: string | null
          position?: number
          product_id: string
          storage_path: string
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          height?: number | null
          id?: string
          is_primary?: boolean
          option_value_id?: string | null
          position?: number
          product_id?: string
          storage_path?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_option_value_id_fkey"
            columns: ["option_value_id"]
            isOneToOne: false
            referencedRelation: "product_option_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_option_values: {
        Row: {
          created_at: string
          id: string
          option_id: string
          position: number
          swatch_hex: string | null
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_id: string
          position?: number
          swatch_hex?: string | null
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          option_id?: string
          position?: number
          swatch_hex?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_option_values_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "product_options"
            referencedColumns: ["id"]
          },
        ]
      }
      product_options: {
        Row: {
          created_at: string
          id: string
          name: string
          position: number
          product_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position: number
          product_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_options_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          compare_at_price_minor: number | null
          created_at: string
          id: string
          is_active: boolean
          option1_value_id: string | null
          option2_value_id: string | null
          option3_value_id: string | null
          position: number
          price_minor: number
          product_id: string
          sku: string | null
          updated_at: string
          weight_grams: number | null
        }
        Insert: {
          compare_at_price_minor?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          option1_value_id?: string | null
          option2_value_id?: string | null
          option3_value_id?: string | null
          position?: number
          price_minor: number
          product_id: string
          sku?: string | null
          updated_at?: string
          weight_grams?: number | null
        }
        Update: {
          compare_at_price_minor?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          option1_value_id?: string | null
          option2_value_id?: string | null
          option3_value_id?: string | null
          position?: number
          price_minor?: number
          product_id?: string
          sku?: string | null
          updated_at?: string
          weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_option1_value_id_fkey"
            columns: ["option1_value_id"]
            isOneToOne: false
            referencedRelation: "product_option_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_option2_value_id_fkey"
            columns: ["option2_value_id"]
            isOneToOne: false
            referencedRelation: "product_option_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_option3_value_id_fkey"
            columns: ["option3_value_id"]
            isOneToOne: false
            referencedRelation: "product_option_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          featured: boolean
          id: string
          name: string
          published_at: string | null
          search: unknown
          seo_description: string | null
          seo_title: string | null
          slug: string
          status: Database["public"]["Enums"]["product_status"]
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          featured?: boolean
          id?: string
          name: string
          published_at?: string | null
          search?: unknown
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          status?: Database["public"]["Enums"]["product_status"]
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          featured?: boolean
          id?: string
          name?: string
          published_at?: string | null
          search?: unknown
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["product_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          hits: number
          key: string
          window_start: string
        }
        Insert: {
          hits?: number
          key: string
          window_start: string
        }
        Update: {
          hits?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      store_settings: {
        Row: {
          allow_guest_checkout: boolean
          announcement: string | null
          business_address: string | null
          contact_email: string | null
          contact_phone: string | null
          currency: string
          free_delivery_over_minor: number | null
          id: boolean
          low_stock_threshold: number
          max_quantity_per_item: number
          order_prefix: string
          reservation_minutes: number
          seo_description: string | null
          seo_title: string | null
          social_links: Json
          store_name: string
          tagline: string | null
          updated_at: string
          whatsapp_number: string | null
        }
        Insert: {
          allow_guest_checkout?: boolean
          announcement?: string | null
          business_address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          currency?: string
          free_delivery_over_minor?: number | null
          id?: boolean
          low_stock_threshold?: number
          max_quantity_per_item?: number
          order_prefix?: string
          reservation_minutes?: number
          seo_description?: string | null
          seo_title?: string | null
          social_links?: Json
          store_name?: string
          tagline?: string | null
          updated_at?: string
          whatsapp_number?: string | null
        }
        Update: {
          allow_guest_checkout?: boolean
          announcement?: string | null
          business_address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          currency?: string
          free_delivery_over_minor?: number | null
          id?: boolean
          low_stock_threshold?: number
          max_quantity_per_item?: number
          order_prefix?: string
          reservation_minutes?: number
          seo_description?: string | null
          seo_title?: string | null
          social_links?: Json
          store_name?: string
          tagline?: string | null
          updated_at?: string
          whatsapp_number?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _commit_order_stock: { Args: { p_order_id: string }; Returns: boolean }
      _release_reserved_stock: {
        Args: { p_order_ids: string[] }
        Returns: undefined
      }
      adjust_inventory: {
        Args: {
          p_delta: number
          p_note?: string
          p_reason?: Database["public"]["Enums"]["inventory_reason"]
          p_variant_id: string
        }
        Returns: number
      }
      admin_customers: {
        Args: { p_limit?: number; p_offset?: number; p_search?: string }
        Returns: {
          customer_id: string
          email: string
          first_seen_at: string
          full_name: string
          has_account: boolean
          last_order_at: string
          order_count: number
          phone: string
          total_count: number
          total_spent_minor: number
          user_id: string
        }[]
      }
      admin_dashboard_stats: { Args: never; Returns: Json }
      admin_inventory: {
        Args: {
          p_filter?: string
          p_limit?: number
          p_offset?: number
          p_search?: string
        }
        Returns: {
          available: number
          on_hand: number
          product_id: string
          product_name: string
          product_status: Database["public"]["Enums"]["product_status"]
          reserved: number
          sku: string
          threshold: number
          total_count: number
          variant_active: boolean
          variant_id: string
          variant_title: string
        }[]
      }
      admin_low_stock: {
        Args: { p_limit?: number }
        Returns: {
          available: number
          product_id: string
          product_name: string
          threshold: number
          variant_id: string
          variant_title: string
        }[]
      }
      admin_mark_refunded: {
        Args: { p_note?: string; p_order_id: string }
        Returns: undefined
      }
      admin_resolve_attention: {
        Args: { p_note: string; p_order_id: string }
        Returns: undefined
      }
      admin_save_product: { Args: { p: Json }; Returns: string }
      admin_set_role_by_email: {
        Args: {
          p_email: string
          p_role: Database["public"]["Enums"]["user_role"]
        }
        Returns: undefined
      }
      admin_team: {
        Args: never
        Returns: {
          created_at: string
          email: string
          full_name: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }[]
      }
      admin_update_order_status: {
        Args: {
          p_note?: string
          p_order_id: string
          p_restock?: boolean
          p_status: Database["public"]["Enums"]["order_status"]
        }
        Returns: undefined
      }
      check_rate_limit: {
        Args: { p_key: string; p_max: number; p_window_seconds: number }
        Returns: boolean
      }
      claim_guest_orders: { Args: never; Returns: number }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      is_admin: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      mark_order_paid: {
        Args: {
          p_amount_minor: number
          p_currency: string
          p_paid_at?: string
          p_reference: string
        }
        Returns: Json
      }
      mark_order_payment_failed: {
        Args: { p_reference: string }
        Returns: Json
      }
      place_order: {
        Args: {
          p_access_token_hash: string
          p_customer: Json
          p_delivery_zone_id: string
          p_discount_code: string
          p_items: Json
          p_payment_provider: string
          p_payment_reference: string
          p_shipping: Json
          p_user_id: string
        }
        Returns: Json
      }
      price_cart: {
        Args: {
          p_delivery_zone_id?: string
          p_discount_code?: string
          p_email?: string
          p_items: Json
        }
        Returns: Json
      }
      release_expired_reservations: { Args: never; Returns: number }
      reorder_product_images: {
        Args: {
          p_image_ids: string[]
          p_primary_id?: string
          p_product_id: string
        }
        Returns: undefined
      }
      require_admin: { Args: never; Returns: undefined }
      require_staff: { Args: never; Returns: undefined }
      set_inventory_level: {
        Args: { p_note?: string; p_on_hand: number; p_variant_id: string }
        Returns: number
      }
      set_user_role: {
        Args: {
          p_role: Database["public"]["Enums"]["user_role"]
          p_user_id: string
        }
        Returns: undefined
      }
      variant_availability: {
        Args: { p_product_ids: string[] }
        Returns: {
          available: number
          product_id: string
          variant_id: string
        }[]
      }
      variant_title: {
        Args: { v: Database["public"]["Tables"]["product_variants"]["Row"] }
        Returns: string
      }
    }
    Enums: {
      discount_type: "percentage" | "fixed"
      inventory_reason:
        | "initial"
        | "restock"
        | "manual_adjustment"
        | "return"
        | "order_reserved"
        | "reservation_released"
        | "order_committed"
        | "order_cancelled_restock"
      order_status:
        | "pending"
        | "confirmed"
        | "processing"
        | "ready"
        | "shipped"
        | "delivered"
        | "cancelled"
      payment_status: "pending" | "paid" | "failed" | "refunded"
      product_status: "draft" | "active" | "archived"
      stock_state: "reserved" | "committed" | "released"
      user_role: "customer" | "staff" | "admin"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      discount_type: ["percentage", "fixed"],
      inventory_reason: [
        "initial",
        "restock",
        "manual_adjustment",
        "return",
        "order_reserved",
        "reservation_released",
        "order_committed",
        "order_cancelled_restock",
      ],
      order_status: [
        "pending",
        "confirmed",
        "processing",
        "ready",
        "shipped",
        "delivered",
        "cancelled",
      ],
      payment_status: ["pending", "paid", "failed", "refunded"],
      product_status: ["draft", "active", "archived"],
      stock_state: ["reserved", "committed", "released"],
      user_role: ["customer", "staff", "admin"],
    },
  },
} as const
