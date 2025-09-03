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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          entity_id: string | null
          entity_type: string
          family_id: string
          id: string
          ip_address: unknown | null
          new_data: Json | null
          old_data: Json | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          family_id: string
          id?: string
          ip_address?: unknown | null
          new_data?: Json | null
          old_data?: Json | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          family_id?: string
          id?: string
          ip_address?: unknown | null
          new_data?: Json | null
          old_data?: Json | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_integrations: {
        Row: {
          access_token: string
          calendar_id: string | null
          created_at: string
          created_ip: unknown | null
          expires_at: string | null
          id: string
          integration_type: string
          is_active: boolean
          last_access_ip: unknown | null
          last_token_refresh: string | null
          profile_id: string
          refresh_token: string | null
          security_flags: Json | null
          token_refresh_count: number | null
          updated_at: string
        }
        Insert: {
          access_token: string
          calendar_id?: string | null
          created_at?: string
          created_ip?: unknown | null
          expires_at?: string | null
          id?: string
          integration_type: string
          is_active?: boolean
          last_access_ip?: unknown | null
          last_token_refresh?: string | null
          profile_id: string
          refresh_token?: string | null
          security_flags?: Json | null
          token_refresh_count?: number | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          calendar_id?: string | null
          created_at?: string
          created_ip?: unknown | null
          expires_at?: string | null
          id?: string
          integration_type?: string
          is_active?: boolean
          last_access_ip?: unknown | null
          last_token_refresh?: string | null
          profile_id?: string
          refresh_token?: string | null
          security_flags?: Json | null
          token_refresh_count?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      calendar_token_audit: {
        Row: {
          action: string
          created_at: string
          error_message: string | null
          id: string
          integration_id: string
          ip_address: unknown | null
          success: boolean
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          error_message?: string | null
          id?: string
          integration_id: string
          ip_address?: unknown | null
          success?: boolean
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          error_message?: string | null
          id?: string
          integration_id?: string
          ip_address?: unknown | null
          success?: boolean
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          color: string
          created_at: string
          created_by: string
          family_id: string
          icon: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by: string
          family_id: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string
          family_id?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_sessions: {
        Row: {
          active_member_id: string
          created_at: string
          device_id: string
          id: string
          last_activity: string
          pin_cache_expires: string | null
          session_start: string
          updated_at: string
        }
        Insert: {
          active_member_id: string
          created_at?: string
          device_id: string
          id?: string
          last_activity?: string
          pin_cache_expires?: string | null
          session_start?: string
          updated_at?: string
        }
        Update: {
          active_member_id?: string
          created_at?: string
          device_id?: string
          id?: string
          last_activity?: string
          pin_cache_expires?: string | null
          session_start?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_sessions_active_member_id_fkey"
            columns: ["active_member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_attendees: {
        Row: {
          added_at: string
          added_by: string
          event_id: string
          id: string
          profile_id: string
        }
        Insert: {
          added_at?: string
          added_by: string
          event_id: string
          id?: string
          profile_id: string
        }
        Update: {
          added_at?: string
          added_by?: string
          event_id?: string
          id?: string
          profile_id?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          end_date: string
          family_id: string
          id: string
          is_all_day: boolean
          location: string | null
          start_date: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          end_date: string
          family_id: string
          id?: string
          is_all_day?: boolean
          location?: string | null
          start_date: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string
          family_id?: string
          id?: string
          is_all_day?: boolean
          location?: string | null
          start_date?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      families: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      google_photos_integrations: {
        Row: {
          access_token: string
          album_id: string | null
          album_name: string | null
          created_at: string
          created_by: string
          expires_at: string | null
          family_id: string
          id: string
          is_active: boolean
          last_sync_at: string | null
          refresh_token: string | null
          sync_count: number
          updated_at: string
        }
        Insert: {
          access_token: string
          album_id?: string | null
          album_name?: string | null
          created_at?: string
          created_by: string
          expires_at?: string | null
          family_id: string
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          refresh_token?: string | null
          sync_count?: number
          updated_at?: string
        }
        Update: {
          access_token?: string
          album_id?: string | null
          album_name?: string | null
          created_at?: string
          created_by?: string
          expires_at?: string | null
          family_id?: string
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          refresh_token?: string | null
          sync_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      group_contributions: {
        Row: {
          contributed_at: string
          created_at: string
          family_id: string
          id: string
          points_contributed: number
          profile_id: string
          reward_id: string
          updated_at: string
        }
        Insert: {
          contributed_at?: string
          created_at?: string
          family_id: string
          id?: string
          points_contributed?: number
          profile_id: string
          reward_id: string
          updated_at?: string
        }
        Update: {
          contributed_at?: string
          created_at?: string
          family_id?: string
          id?: string
          points_contributed?: number
          profile_id?: string
          reward_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      household_settings: {
        Row: {
          auto_return_timeout_minutes: number | null
          created_at: string
          dashboard_mode_enabled: boolean | null
          family_id: string
          id: string
          pin_attempts_limit: number
          pin_lockout_duration: number
          subscription_metadata: Json | null
          theme_palette: Json
          updated_at: string
        }
        Insert: {
          auto_return_timeout_minutes?: number | null
          created_at?: string
          dashboard_mode_enabled?: boolean | null
          family_id: string
          id?: string
          pin_attempts_limit?: number
          pin_lockout_duration?: number
          subscription_metadata?: Json | null
          theme_palette?: Json
          updated_at?: string
        }
        Update: {
          auto_return_timeout_minutes?: number | null
          created_at?: string
          dashboard_mode_enabled?: boolean | null
          family_id?: string
          id?: string
          pin_attempts_limit?: number
          pin_lockout_duration?: number
          subscription_metadata?: Json | null
          theme_palette?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_settings_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: true
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      list_item_assignees: {
        Row: {
          assigned_at: string
          assigned_by: string
          id: string
          list_item_id: string
          profile_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          id?: string
          list_item_id: string
          profile_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          id?: string
          list_item_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "list_item_assignees_list_item_id_fkey"
            columns: ["list_item_id"]
            isOneToOne: false
            referencedRelation: "list_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_item_assignees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      list_items: {
        Row: {
          category: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string
          due_date: string | null
          id: string
          is_completed: boolean
          list_id: string
          name: string
          notes: string | null
          quantity: number | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          category?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by: string
          due_date?: string | null
          id?: string
          is_completed?: boolean
          list_id: string
          name: string
          notes?: string | null
          quantity?: number | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string
          due_date?: string | null
          id?: string
          is_completed?: boolean
          list_id?: string
          name?: string
          notes?: string | null
          quantity?: number | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
        ]
      }
      list_templates: {
        Row: {
          created_at: string
          created_by: string | null
          family_id: string | null
          id: string
          is_global: boolean
          list_type: string
          name: string
          template_items: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          family_id?: string | null
          id?: string
          is_global?: boolean
          list_type: string
          name: string
          template_items?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          family_id?: string | null
          id?: string
          is_global?: boolean
          list_type?: string
          name?: string
          template_items?: Json
          updated_at?: string
        }
        Relationships: []
      }
      lists: {
        Row: {
          category_id: string | null
          created_at: string
          created_by: string
          description: string | null
          family_id: string
          id: string
          is_archived: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          family_id: string
          id?: string
          is_archived?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          family_id?: string
          id?: string
          is_archived?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lists_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      points_ledger: {
        Row: {
          created_at: string
          created_by: string
          entry_type: string
          family_id: string
          id: string
          points: number
          profile_id: string
          reason: string
          reward_request_id: string | null
          task_id: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          entry_type: string
          family_id: string
          id?: string
          points: number
          profile_id: string
          reason: string
          reward_request_id?: string | null
          task_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          entry_type?: string
          family_id?: string
          id?: string
          points?: number
          profile_id?: string
          reason?: string
          reward_request_id?: string | null
          task_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          calendar_edit_permission: string | null
          can_add_for_parents: boolean
          can_add_for_self: boolean
          can_add_for_siblings: boolean
          color: string
          created_at: string
          display_name: string
          failed_pin_attempts: number
          family_id: string
          id: string
          pin_hash: string | null
          pin_locked_until: string | null
          require_pin_for_list_deletes: boolean | null
          require_pin_to_complete_tasks: boolean | null
          role: Database["public"]["Enums"]["user_role"]
          sort_order: number | null
          status: string
          streak_count: number
          theme: Json | null
          total_points: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          calendar_edit_permission?: string | null
          can_add_for_parents?: boolean
          can_add_for_self?: boolean
          can_add_for_siblings?: boolean
          color?: string
          created_at?: string
          display_name: string
          failed_pin_attempts?: number
          family_id: string
          id?: string
          pin_hash?: string | null
          pin_locked_until?: string | null
          require_pin_for_list_deletes?: boolean | null
          require_pin_to_complete_tasks?: boolean | null
          role?: Database["public"]["Enums"]["user_role"]
          sort_order?: number | null
          status?: string
          streak_count?: number
          theme?: Json | null
          total_points?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          calendar_edit_permission?: string | null
          can_add_for_parents?: boolean
          can_add_for_self?: boolean
          can_add_for_siblings?: boolean
          color?: string
          created_at?: string
          display_name?: string
          failed_pin_attempts?: number
          family_id?: string
          id?: string
          pin_hash?: string | null
          pin_locked_until?: string | null
          require_pin_for_list_deletes?: boolean | null
          require_pin_to_complete_tasks?: boolean | null
          role?: Database["public"]["Enums"]["user_role"]
          sort_order?: number | null
          status?: string
          streak_count?: number
          theme?: Json | null
          total_points?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_requests: {
        Row: {
          approval_note: string | null
          approved_by: string | null
          created_at: string
          id: string
          points_cost: number
          requested_by: string
          reward_id: string
          status: string
          updated_at: string
        }
        Insert: {
          approval_note?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          points_cost: number
          requested_by: string
          reward_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          approval_note?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          points_cost?: number
          requested_by?: string
          reward_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      rewards: {
        Row: {
          assigned_to: string[] | null
          auto_approve: boolean
          cost_points: number
          created_at: string
          created_by: string
          description: string | null
          family_id: string
          id: string
          image_url: string | null
          is_active: boolean
          reward_type: Database["public"]["Enums"]["reward_type"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string[] | null
          auto_approve?: boolean
          cost_points: number
          created_at?: string
          created_by: string
          description?: string | null
          family_id: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          reward_type?: Database["public"]["Enums"]["reward_type"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string[] | null
          auto_approve?: boolean
          cost_points?: number
          created_at?: string
          created_by?: string
          description?: string | null
          family_id?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          reward_type?: Database["public"]["Enums"]["reward_type"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      rotating_tasks: {
        Row: {
          allow_multiple_completions: boolean
          cadence: string
          created_at: string
          created_by: string
          current_member_index: number
          description: string | null
          family_id: string
          id: string
          is_active: boolean
          is_paused: boolean
          member_order: string[]
          monthly_day: number | null
          name: string
          points: number
          task_group: string | null
          updated_at: string
          weekly_days: number[] | null
        }
        Insert: {
          allow_multiple_completions?: boolean
          cadence: string
          created_at?: string
          created_by: string
          current_member_index?: number
          description?: string | null
          family_id: string
          id?: string
          is_active?: boolean
          is_paused?: boolean
          member_order: string[]
          monthly_day?: number | null
          name: string
          points?: number
          task_group?: string | null
          updated_at?: string
          weekly_days?: number[] | null
        }
        Update: {
          allow_multiple_completions?: boolean
          cadence?: string
          created_at?: string
          created_by?: string
          current_member_index?: number
          description?: string | null
          family_id?: string
          id?: string
          is_active?: boolean
          is_paused?: boolean
          member_order?: string[]
          monthly_day?: number | null
          name?: string
          points?: number
          task_group?: string | null
          updated_at?: string
          weekly_days?: number[] | null
        }
        Relationships: []
      }
      screensaver_images: {
        Row: {
          created_at: string
          family_id: string
          file_path: string
          file_size: number
          id: string
          is_active: boolean
          mime_type: string
          name: string
          sort_order: number
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          family_id: string
          file_path: string
          file_size: number
          id?: string
          is_active?: boolean
          mime_type: string
          name: string
          sort_order?: number
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          family_id?: string
          file_path?: string
          file_size?: number
          id?: string
          is_active?: boolean
          mime_type?: string
          name?: string
          sort_order?: number
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: []
      }
      screensaver_settings: {
        Row: {
          brightness: number
          created_at: string
          created_by: string
          custom_images_enabled: boolean
          display_duration: number
          family_id: string
          google_photos_album_id: string | null
          google_photos_connected: boolean
          id: string
          is_enabled: boolean
          show_clock: boolean
          show_weather: boolean
          timeout_minutes: number
          transition_effect: string
          updated_at: string
        }
        Insert: {
          brightness?: number
          created_at?: string
          created_by: string
          custom_images_enabled?: boolean
          display_duration?: number
          family_id: string
          google_photos_album_id?: string | null
          google_photos_connected?: boolean
          id?: string
          is_enabled?: boolean
          show_clock?: boolean
          show_weather?: boolean
          timeout_minutes?: number
          transition_effect?: string
          updated_at?: string
        }
        Update: {
          brightness?: number
          created_at?: string
          created_by?: string
          custom_images_enabled?: boolean
          display_duration?: number
          family_id?: string
          google_photos_album_id?: string | null
          google_photos_connected?: boolean
          id?: string
          is_enabled?: boolean
          show_clock?: boolean
          show_weather?: boolean
          timeout_minutes?: number
          transition_effect?: string
          updated_at?: string
        }
        Relationships: []
      }
      task_assignees: {
        Row: {
          assigned_at: string
          assigned_by: string
          id: string
          profile_id: string
          task_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          id?: string
          profile_id: string
          task_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          id?: string
          profile_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignees_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignees_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_completions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          completed_at: string
          completed_by: string
          id: string
          points_earned: number
          task_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string
          completed_by: string
          id?: string
          points_earned: number
          task_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string
          completed_by?: string
          id?: string
          points_earned?: number
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_completions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_completions_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_completions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          category_id: string | null
          completion_rule: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          family_id: string
          id: string
          points: number
          task_group: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category_id?: string | null
          completion_rule?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          family_id: string
          id?: string
          points?: number
          task_group?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category_id?: string | null
          completion_rule?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          family_id?: string
          id?: string
          points?: number
          task_group?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_reward_request: {
        Args: { approval_note_param?: string; request_id_param: string }
        Returns: Json
      }
      audit_calendar_token_security: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      authenticate_child_pin: {
        Args: { pin_attempt: string; profile_id_param: string }
        Returns: Json
      }
      authenticate_member_pin_dashboard: {
        Args: { pin_attempt: string; profile_id_param: string }
        Returns: Json
      }
      can_access_calendar_integration: {
        Args: { integration_profile_id: string }
        Returns: boolean
      }
      check_member_pin_cache: {
        Args: { device_id_param?: string; profile_id_param: string }
        Returns: boolean
      }
      check_profile_status: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      check_token_access_rate_limit: {
        Args: {
          integration_id: string
          max_requests?: number
          time_window_minutes?: number
        }
        Returns: boolean
      }
      create_audit_log: {
        Args: {
          p_action: string
          p_actor_id: string
          p_entity_id?: string
          p_entity_type: string
          p_family_id: string
          p_new_data?: Json
          p_old_data?: Json
        }
        Returns: undefined
      }
      create_calendar_integration: {
        Args: {
          access_token_param: string
          calendar_id_param: string
          expires_at_param?: string
          integration_type_param: string
          refresh_token_param?: string
        }
        Returns: Json
      }
      create_google_photos_integration_secure: {
        Args: {
          access_token_param: string
          album_id_param?: string
          album_name_param?: string
          expires_at_param?: string
          refresh_token_param?: string
        }
        Returns: Json
      }
      create_missing_profile_for_user: {
        Args: { user_id_param: string }
        Returns: Json
      }
      create_secure_calendar_integration: {
        Args: {
          access_token_param: string
          calendar_id_param: string
          expires_at_param?: string
          integration_type_param: string
          refresh_token_param?: string
        }
        Returns: Json
      }
      decrypt_oauth_token: {
        Args: {
          encrypted_data: string
          requesting_integration_id?: string
          token_type?: string
        }
        Returns: string
      }
      delete_calendar_integration: {
        Args: { integration_id_param: string }
        Returns: Json
      }
      delete_calendar_integration_secure: {
        Args: { integration_id_param: string }
        Returns: Json
      }
      delete_reward: {
        Args: { reward_id_param: string }
        Returns: {
          error: string
          message: string
          success: boolean
        }[]
      }
      deny_reward_request: {
        Args: { denial_note_param?: string; request_id_param: string }
        Returns: Json
      }
      encrypt_calendar_token: {
        Args: { token_value: string }
        Returns: string
      }
      encrypt_google_photos_tokens: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      encrypt_oauth_token: {
        Args: { token_type?: string; token_value: string }
        Returns: string
      }
      fix_my_missing_profile: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      generate_rotating_task_instance: {
        Args: { rotating_task_id: string }
        Returns: string
      }
      get_calendar_integration_safe: {
        Args: { integration_id: string }
        Returns: {
          calendar_id: string
          created_at: string
          expires_at: string
          id: string
          integration_type: string
          is_active: boolean
          profile_id: string
          updated_at: string
        }[]
      }
      get_calendar_integrations_metadata: {
        Args: Record<PropertyKey, never>
        Returns: {
          calendar_id: string
          created_at: string
          expires_at: string
          has_access_token: boolean
          has_refresh_token: boolean
          id: string
          integration_type: string
          is_active: boolean
          is_encrypted: boolean
          is_expired: boolean
          last_token_refresh: string
          profile_id: string
          token_refresh_count: number
          updated_at: string
        }[]
      }
      get_calendar_integrations_safe: {
        Args: Record<PropertyKey, never>
        Returns: {
          calendar_id: string
          created_at: string
          expires_at: string
          has_access_token: boolean
          has_refresh_token: boolean
          id: string
          integration_type: string
          is_active: boolean
          is_encrypted: boolean
          is_expired: boolean
          last_token_refresh: string
          profile_id: string
          token_refresh_count: number
          updated_at: string
        }[]
      }
      get_calendar_security_alerts: {
        Args: { family_id_param?: string }
        Returns: {
          alert_message: string
          alert_type: string
          created_at: string
          integration_id: string
          severity: string
        }[]
      }
      get_calendar_security_final_status: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_calendar_security_status: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_calendar_security_summary: {
        Args: Record<PropertyKey, never>
        Returns: {
          access_count_7_days: number
          created_at: string
          failed_access_count_7_days: number
          id: string
          integration_type: string
          is_active: boolean
          last_token_refresh: string
          owner_name: string
          token_refresh_count: number
        }[]
      }
      get_calendar_token_for_api: {
        Args: { integration_id: string; requesting_function?: string }
        Returns: {
          access_token: string
          expires_at: string
          refresh_token: string
        }[]
      }
      get_calendar_tokens_secure: {
        Args: { integration_id_param: string }
        Returns: {
          access_token: string
          expires_at: string
          is_expired: boolean
          refresh_token: string
        }[]
      }
      get_calendar_tokens_ultra_secure: {
        Args: { integration_id_param: string; requesting_context?: string }
        Returns: {
          access_token: string
          expires_at: string
          is_expired: boolean
          refresh_token: string
          security_status: string
        }[]
      }
      get_current_user_family_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_current_user_family_id_safe: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_decrypted_calendar_tokens: {
        Args: { integration_id_param: string }
        Returns: {
          access_token: string
          expires_at: string
          is_expired: boolean
          refresh_token: string
        }[]
      }
      get_family_profiles_metadata: {
        Args: Record<PropertyKey, never>
        Returns: {
          avatar_url: string
          calendar_edit_permission: string
          can_add_for_parents: boolean
          can_add_for_self: boolean
          can_add_for_siblings: boolean
          color: string
          created_at: string
          display_name: string
          family_id: string
          has_pin: boolean
          id: string
          is_own_profile: boolean
          require_pin_for_list_deletes: boolean
          require_pin_to_complete_tasks: boolean
          role: Database["public"]["Enums"]["user_role"]
          sort_order: number
          status: string
          streak_count: number
          total_points: number
          updated_at: string
          user_id: string
        }[]
      }
      get_family_profiles_safe: {
        Args: Record<PropertyKey, never>
        Returns: {
          avatar_url: string
          calendar_edit_permission: string
          can_add_for_parents: boolean
          can_add_for_self: boolean
          can_add_for_siblings: boolean
          color: string
          created_at: string
          display_name: string
          family_id: string
          has_pin: boolean
          id: string
          require_pin_for_list_deletes: boolean
          require_pin_to_complete_tasks: boolean
          role: Database["public"]["Enums"]["user_role"]
          sort_order: number
          status: string
          streak_count: number
          total_points: number
          updated_at: string
          user_id: string
        }[]
      }
      get_family_profiles_secure: {
        Args: Record<PropertyKey, never>
        Returns: {
          avatar_url: string
          can_add_for_parents: boolean
          can_add_for_self: boolean
          can_add_for_siblings: boolean
          color: string
          created_at: string
          display_name: string
          failed_pin_attempts: number
          family_id: string
          has_pin_set: boolean
          id: string
          pin_locked_until: string
          role: Database["public"]["Enums"]["user_role"]
          sort_order: number
          status: string
          streak_count: number
          theme: Json
          total_points: number
          updated_at: string
          user_id: string
        }[]
      }
      get_google_photos_integrations_metadata: {
        Args: Record<PropertyKey, never>
        Returns: {
          album_id: string
          album_name: string
          created_at: string
          created_by: string
          expires_at: string
          family_id: string
          has_access_token: boolean
          has_refresh_token: boolean
          id: string
          is_active: boolean
          is_encrypted: boolean
          is_expired: boolean
          last_sync_at: string
          sync_count: number
          updated_at: string
        }[]
      }
      get_google_photos_tokens_for_api: {
        Args: { integration_id_param: string }
        Returns: {
          access_token: string
          expires_at: string
          refresh_token: string
        }[]
      }
      get_profile_points_balance: {
        Args: { profile_id_param: string }
        Returns: number
      }
      get_profile_safe: {
        Args: { profile_id_param: string }
        Returns: {
          avatar_url: string
          calendar_edit_permission: string
          can_add_for_parents: boolean
          can_add_for_self: boolean
          can_add_for_siblings: boolean
          color: string
          created_at: string
          display_name: string
          family_id: string
          has_pin: boolean
          id: string
          require_pin_for_list_deletes: boolean
          require_pin_to_complete_tasks: boolean
          role: Database["public"]["Enums"]["user_role"]
          sort_order: number
          status: string
          streak_count: number
          total_points: number
          updated_at: string
          user_id: string
        }[]
      }
      get_token_encryption_status: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_user_calendar_integrations: {
        Args: Record<PropertyKey, never>
        Returns: {
          calendar_id: string
          created_at: string
          expires_at: string
          has_access_token: boolean
          has_refresh_token: boolean
          id: string
          integration_type: string
          is_active: boolean
          is_token_expired: boolean
          last_token_refresh: string
          token_refresh_count: number
          updated_at: string
        }[]
      }
      get_user_calendar_integrations_metadata: {
        Args: Record<PropertyKey, never>
        Returns: {
          calendar_id: string
          created_at: string
          created_ip: unknown
          expires_at: string
          has_access_token: boolean
          has_refresh_token: boolean
          id: string
          integration_type: string
          is_active: boolean
          is_expired: boolean
          last_access_ip: unknown
          last_token_refresh: string
          profile_id: string
          refresh_token_status: string
          security_flags: Json
          token_refresh_count: number
          token_status: string
          updated_at: string
        }[]
      }
      get_user_calendar_integrations_safe: {
        Args: Record<PropertyKey, never>
        Returns: {
          calendar_id: string
          created_at: string
          expires_at: string
          has_access_token: boolean
          has_refresh_token: boolean
          id: string
          integration_type: string
          is_active: boolean
          is_token_expired: boolean
          last_token_refresh: string
          profile_id: string
          token_refresh_count: number
          updated_at: string
        }[]
      }
      get_user_calendar_integrations_secure: {
        Args: Record<PropertyKey, never>
        Returns: {
          calendar_id: string
          created_at: string
          expires_at: string
          has_access_token: boolean
          has_refresh_token: boolean
          id: string
          integration_type: string
          is_active: boolean
          is_token_expired: boolean
          last_token_refresh: string
          token_refresh_count: number
          updated_at: string
        }[]
      }
      get_user_family_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      hash_pin: {
        Args: { pin_text: string }
        Returns: string
      }
      is_calendar_integration_owner: {
        Args: { integration_id: string }
        Returns: boolean
      }
      is_current_user_parent: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_parent_in_same_family: {
        Args: { target_profile_id: string }
        Returns: boolean
      }
      is_same_family_safe: {
        Args: { target_family_id: string }
        Returns: boolean
      }
      log_calendar_token_access: {
        Args: {
          p_action: string
          p_error_message?: string
          p_integration_id: string
          p_success?: boolean
        }
        Returns: undefined
      }
      log_calendar_token_access_enhanced: {
        Args: {
          action_param: string
          additional_context?: Json
          error_message_param?: string
          integration_id_param: string
          success_param?: boolean
        }
        Returns: undefined
      }
      log_sensitive_access: {
        Args: {
          p_action: string
          p_details?: Json
          p_entity_id: string
          p_entity_type: string
          p_success?: boolean
        }
        Returns: undefined
      }
      mark_reward_claimed: {
        Args: { request_id_param: string }
        Returns: Json
      }
      migrate_existing_tokens_to_encrypted: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      revoke_calendar_integration: {
        Args: { integration_id: string; reason?: string }
        Returns: boolean
      }
      revoke_reward_request: {
        Args: { request_id_param: string; revoke_note_param?: string }
        Returns: Json
      }
      set_child_pin: {
        Args: { new_pin: string; profile_id_param: string }
        Returns: Json
      }
      store_calendar_tokens_secure: {
        Args: {
          access_token_param: string
          expires_at_param?: string
          integration_id_param: string
          refresh_token_param?: string
        }
        Returns: Json
      }
      store_encrypted_calendar_tokens: {
        Args: {
          access_token_param: string
          expires_at_param?: string
          integration_id_param: string
          refresh_token_param?: string
        }
        Returns: Json
      }
      update_calendar_integration_secure: {
        Args: {
          calendar_id_param?: string
          integration_id_param: string
          integration_type_param?: string
          is_active_param?: boolean
        }
        Returns: Json
      }
      update_reward: {
        Args: {
          cost_points_param?: number
          description_param?: string
          image_url_param?: string
          is_active_param?: boolean
          reward_id_param: string
          reward_type_param?: string
          title_param: string
        }
        Returns: Json
      }
      validate_and_cleanup_tokens: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      validate_calendar_token_access: {
        Args: { integration_id: string; requesting_user_id?: string }
        Returns: boolean
      }
      validate_token_encryption: {
        Args: Record<PropertyKey, never>
        Returns: {
          is_secure: boolean
          table_name: string
          total_count: number
          unencrypted_count: number
        }[]
      }
      verify_pin: {
        Args: { pin_hash: string; pin_text: string }
        Returns: boolean
      }
    }
    Enums: {
      reward_request_status:
        | "pending"
        | "approved"
        | "denied"
        | "cancelled"
        | "claimed"
      reward_type: "once_off" | "always_available" | "group_contribution"
      user_role: "parent" | "child"
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
      reward_request_status: [
        "pending",
        "approved",
        "denied",
        "cancelled",
        "claimed",
      ],
      reward_type: ["once_off", "always_available", "group_contribution"],
      user_role: ["parent", "child"],
    },
  },
} as const
