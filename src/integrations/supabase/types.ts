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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          app_name: string
          apple_touch_icon_path: string | null
          favicon_path: string | null
          icon_192_path: string | null
          icon_512_path: string | null
          id: number
          short_name: string
          updated_at: string
        }
        Insert: {
          app_name?: string
          apple_touch_icon_path?: string | null
          favicon_path?: string | null
          icon_192_path?: string | null
          icon_512_path?: string | null
          id?: number
          short_name?: string
          updated_at?: string
        }
        Update: {
          app_name?: string
          apple_touch_icon_path?: string | null
          favicon_path?: string | null
          icon_192_path?: string | null
          icon_512_path?: string | null
          id?: number
          short_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          entity_id: string | null
          entity_type: string
          family_id: string
          id: string
          ip_address: unknown
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
          ip_address?: unknown
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
          ip_address?: unknown
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
          {
            foreignKeyName: "audit_logs_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "super_admin_family_stats"
            referencedColumns: ["family_id"]
          },
        ]
      }
      avatar_icons: {
        Row: {
          created_at: string | null
          icon_type: string | null
          id: string
          is_system: boolean | null
          name: string
          svg_content: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          icon_type?: string | null
          id?: string
          is_system?: boolean | null
          name: string
          svg_content: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          icon_type?: string | null
          id?: string
          is_system?: boolean | null
          name?: string
          svg_content?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      calendar_integrations: {
        Row: {
          access_token: string
          calendar_id: string | null
          created_at: string
          created_ip: unknown
          expires_at: string | null
          id: string
          integration_type: string
          is_active: boolean
          last_access_ip: unknown
          last_sync_at: string | null
          last_token_refresh: string | null
          profile_id: string
          refresh_token: string | null
          security_flags: Json | null
          sync_token: string | null
          token_refresh_count: number | null
          updated_at: string
        }
        Insert: {
          access_token: string
          calendar_id?: string | null
          created_at?: string
          created_ip?: unknown
          expires_at?: string | null
          id?: string
          integration_type: string
          is_active?: boolean
          last_access_ip?: unknown
          last_sync_at?: string | null
          last_token_refresh?: string | null
          profile_id: string
          refresh_token?: string | null
          security_flags?: Json | null
          sync_token?: string | null
          token_refresh_count?: number | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          calendar_id?: string | null
          created_at?: string
          created_ip?: unknown
          expires_at?: string | null
          id?: string
          integration_type?: string
          is_active?: boolean
          last_access_ip?: unknown
          last_sync_at?: string | null
          last_token_refresh?: string | null
          profile_id?: string
          refresh_token?: string | null
          security_flags?: Json | null
          sync_token?: string | null
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
          ip_address: unknown
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
          ip_address?: unknown
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
          ip_address?: unknown
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
          {
            foreignKeyName: "categories_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "super_admin_family_stats"
            referencedColumns: ["family_id"]
          },
        ]
      }
      celebrations: {
        Row: {
          celebration_date: string
          celebration_type: string
          created_at: string | null
          created_by: string
          family_id: string
          icon_id: string | null
          id: string
          is_active: boolean | null
          name: string
          photo_url: string | null
          updated_at: string | null
          visual_type: string
          year_specific: number | null
        }
        Insert: {
          celebration_date: string
          celebration_type: string
          created_at?: string | null
          created_by: string
          family_id: string
          icon_id?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          photo_url?: string | null
          updated_at?: string | null
          visual_type: string
          year_specific?: number | null
        }
        Update: {
          celebration_date?: string
          celebration_type?: string
          created_at?: string | null
          created_by?: string
          family_id?: string
          icon_id?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          photo_url?: string | null
          updated_at?: string | null
          visual_type?: string
          year_specific?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "celebrations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "celebrations_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "celebrations_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "super_admin_family_stats"
            referencedColumns: ["family_id"]
          },
          {
            foreignKeyName: "celebrations_icon_id_fkey"
            columns: ["icon_id"]
            isOneToOne: false
            referencedRelation: "avatar_icons"
            referencedColumns: ["id"]
          },
        ]
      }
      color_palettes: {
        Row: {
          color_key: string
          created_at: string | null
          hex_value: string
          id: string
          is_system: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          color_key: string
          created_at?: string | null
          hex_value?: string
          id?: string
          is_system?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          color_key?: string
          created_at?: string | null
          hex_value?: string
          id?: string
          is_system?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
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
      event_series: {
        Row: {
          attendee_profiles: string[] | null
          created_at: string | null
          created_by: string
          description: string | null
          duration_minutes: number
          exdates: string[] | null
          family_id: string
          id: string
          is_active: boolean | null
          is_all_day: boolean | null
          location: string | null
          original_series_id: string | null
          recurrence_rule: Json
          rrule: string | null
          series_end: string | null
          series_start: string
          title: string
          updated_at: string | null
        }
        Insert: {
          attendee_profiles?: string[] | null
          created_at?: string | null
          created_by: string
          description?: string | null
          duration_minutes?: number
          exdates?: string[] | null
          family_id: string
          id?: string
          is_active?: boolean | null
          is_all_day?: boolean | null
          location?: string | null
          original_series_id?: string | null
          recurrence_rule: Json
          rrule?: string | null
          series_end?: string | null
          series_start: string
          title: string
          updated_at?: string | null
        }
        Update: {
          attendee_profiles?: string[] | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          duration_minutes?: number
          exdates?: string[] | null
          family_id?: string
          id?: string
          is_active?: boolean | null
          is_all_day?: boolean | null
          location?: string | null
          original_series_id?: string | null
          recurrence_rule?: Json
          rrule?: string | null
          series_end?: string | null
          series_start?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_series_original_series_fkey"
            columns: ["original_series_id"]
            isOneToOne: false
            referencedRelation: "event_series"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          end_date: string
          external_event_id: string | null
          family_id: string
          id: string
          is_all_day: boolean
          last_synced_at: string | null
          location: string | null
          migrated_to_series: boolean | null
          recurrence_options: Json | null
          source_integration_id: string | null
          source_type: string | null
          start_date: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          end_date: string
          external_event_id?: string | null
          family_id: string
          id?: string
          is_all_day?: boolean
          last_synced_at?: string | null
          location?: string | null
          migrated_to_series?: boolean | null
          recurrence_options?: Json | null
          source_integration_id?: string | null
          source_type?: string | null
          start_date: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string
          external_event_id?: string | null
          family_id?: string
          id?: string
          is_all_day?: boolean
          last_synced_at?: string | null
          location?: string | null
          migrated_to_series?: boolean | null
          recurrence_options?: Json | null
          source_integration_id?: string | null
          source_type?: string | null
          start_date?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_source_integration_id_fkey"
            columns: ["source_integration_id"]
            isOneToOne: false
            referencedRelation: "calendar_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          created_at: string
          current_plan_id: string | null
          id: string
          name: string
          status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_plan_id?: string | null
          id?: string
          name: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_plan_id?: string | null
          id?: string
          name?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "families_current_plan_id_fkey"
            columns: ["current_plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      family_module_overrides: {
        Row: {
          family_id: string
          id: string
          is_enabled: boolean | null
          module_name: Database["public"]["Enums"]["app_module"]
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          family_id: string
          id?: string
          is_enabled?: boolean | null
          module_name: Database["public"]["Enums"]["app_module"]
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          family_id?: string
          id?: string
          is_enabled?: boolean | null
          module_name?: Database["public"]["Enums"]["app_module"]
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "family_module_overrides_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_module_overrides_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "super_admin_family_stats"
            referencedColumns: ["family_id"]
          },
        ]
      }
      global_style_settings: {
        Row: {
          body_text_color: string
          body_text_size: string
          body_text_weight: string
          border_radius: string
          button_text_size: string
          button_text_weight: string
          card_title_color: string
          card_title_size: string
          card_title_weight: string
          dialog_title_color: string
          dialog_title_size: string
          dialog_title_weight: string
          id: number
          label_text_color: string
          label_text_size: string
          label_text_weight: string
          page_heading_color: string
          page_heading_size: string
          page_heading_weight: string
          section_heading_color: string
          section_heading_size: string
          section_heading_weight: string
          small_text_color: string
          small_text_size: string
          small_text_weight: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body_text_color?: string
          body_text_size?: string
          body_text_weight?: string
          border_radius?: string
          button_text_size?: string
          button_text_weight?: string
          card_title_color?: string
          card_title_size?: string
          card_title_weight?: string
          dialog_title_color?: string
          dialog_title_size?: string
          dialog_title_weight?: string
          id?: number
          label_text_color?: string
          label_text_size?: string
          label_text_weight?: string
          page_heading_color?: string
          page_heading_size?: string
          page_heading_weight?: string
          section_heading_color?: string
          section_heading_size?: string
          section_heading_weight?: string
          small_text_color?: string
          small_text_size?: string
          small_text_weight?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body_text_color?: string
          body_text_size?: string
          body_text_weight?: string
          border_radius?: string
          button_text_size?: string
          button_text_weight?: string
          card_title_color?: string
          card_title_size?: string
          card_title_weight?: string
          dialog_title_color?: string
          dialog_title_size?: string
          dialog_title_weight?: string
          id?: number
          label_text_color?: string
          label_text_size?: string
          label_text_weight?: string
          page_heading_color?: string
          page_heading_size?: string
          page_heading_weight?: string
          section_heading_color?: string
          section_heading_size?: string
          section_heading_weight?: string
          small_text_color?: string
          small_text_size?: string
          small_text_weight?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      goal_assignees: {
        Row: {
          assigned_at: string
          assigned_by: string
          goal_id: string
          id: string
          profile_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          goal_id: string
          id?: string
          profile_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          goal_id?: string
          id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_assignees_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_assignees_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_assignees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_linked_tasks: {
        Row: {
          goal_id: string
          id: string
          linked_at: string
          linked_by: string
          milestone_id: string | null
          rotating_task_id: string | null
          task_id: string | null
          task_series_id: string | null
        }
        Insert: {
          goal_id: string
          id?: string
          linked_at?: string
          linked_by: string
          milestone_id?: string | null
          rotating_task_id?: string | null
          task_id?: string | null
          task_series_id?: string | null
        }
        Update: {
          goal_id?: string
          id?: string
          linked_at?: string
          linked_by?: string
          milestone_id?: string | null
          rotating_task_id?: string | null
          task_id?: string | null
          task_series_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goal_linked_tasks_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_linked_tasks_linked_by_fkey"
            columns: ["linked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_linked_tasks_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "goal_milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_linked_tasks_rotating_task_id_fkey"
            columns: ["rotating_task_id"]
            isOneToOne: false
            referencedRelation: "rotating_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_linked_tasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_linked_tasks_task_series_id_fkey"
            columns: ["task_series_id"]
            isOneToOne: false
            referencedRelation: "task_series"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_milestones: {
        Row: {
          completed_at: string | null
          completion_criteria: Json
          created_at: string
          goal_id: string
          id: string
          is_completed: boolean
          milestone_order: number
          reward_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          completion_criteria: Json
          created_at?: string
          goal_id: string
          id?: string
          is_completed?: boolean
          milestone_order?: number
          reward_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          completion_criteria?: Json
          created_at?: string
          goal_id?: string
          id?: string
          is_completed?: boolean
          milestone_order?: number
          reward_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_milestones_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_milestones_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_progress_snapshots: {
        Row: {
          created_at: string
          goal_id: string
          id: string
          progress_data: Json
          snapshot_date: string
        }
        Insert: {
          created_at?: string
          goal_id: string
          id?: string
          progress_data: Json
          snapshot_date: string
        }
        Update: {
          created_at?: string
          goal_id?: string
          id?: string
          progress_data?: Json
          snapshot_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_progress_snapshots_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string
          description: string | null
          end_date: string | null
          family_id: string
          goal_scope: Database["public"]["Enums"]["goal_scope"]
          goal_type: Database["public"]["Enums"]["goal_type"]
          id: string
          reward_id: string | null
          start_date: string
          status: Database["public"]["Enums"]["goal_status"]
          success_criteria: Json
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          end_date?: string | null
          family_id: string
          goal_scope?: Database["public"]["Enums"]["goal_scope"]
          goal_type: Database["public"]["Enums"]["goal_type"]
          id?: string
          reward_id?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["goal_status"]
          success_criteria: Json
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string | null
          family_id?: string
          goal_scope?: Database["public"]["Enums"]["goal_scope"]
          goal_type?: Database["public"]["Enums"]["goal_type"]
          id?: string
          reward_id?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["goal_status"]
          success_criteria?: Json
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "super_admin_family_stats"
            referencedColumns: ["family_id"]
          },
          {
            foreignKeyName: "goals_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
        ]
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
      holiday_dates: {
        Row: {
          created_at: string
          created_by: string
          end_date: string
          family_id: string
          id: string
          name: string
          start_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          end_date: string
          family_id: string
          id?: string
          name: string
          start_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          end_date?: string
          family_id?: string
          id?: string
          name?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      household_settings: {
        Row: {
          auto_return_enabled: boolean
          auto_return_timeout_minutes: number | null
          completed_tasks_hide_hours: number | null
          created_at: string
          dashboard_mode_enabled: boolean | null
          family_id: string
          id: string
          onboarding_completed: boolean
          onboarding_completed_at: string | null
          pin_attempts_limit: number
          pin_lockout_duration: number
          require_parent_pin_for_dashboard: boolean
          subscription_metadata: Json | null
          theme_palette: Json
          updated_at: string
        }
        Insert: {
          auto_return_enabled?: boolean
          auto_return_timeout_minutes?: number | null
          completed_tasks_hide_hours?: number | null
          created_at?: string
          dashboard_mode_enabled?: boolean | null
          family_id: string
          id?: string
          onboarding_completed?: boolean
          onboarding_completed_at?: string | null
          pin_attempts_limit?: number
          pin_lockout_duration?: number
          require_parent_pin_for_dashboard?: boolean
          subscription_metadata?: Json | null
          theme_palette?: Json
          updated_at?: string
        }
        Update: {
          auto_return_enabled?: boolean
          auto_return_timeout_minutes?: number | null
          completed_tasks_hide_hours?: number | null
          created_at?: string
          dashboard_mode_enabled?: boolean | null
          family_id?: string
          id?: string
          onboarding_completed?: boolean
          onboarding_completed_at?: string | null
          pin_attempts_limit?: number
          pin_lockout_duration?: number
          require_parent_pin_for_dashboard?: boolean
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
          {
            foreignKeyName: "household_settings_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: true
            referencedRelation: "super_admin_family_stats"
            referencedColumns: ["family_id"]
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
      materialized_task_instances: {
        Row: {
          id: string
          materialized_at: string | null
          materialized_by: string | null
          materialized_task_id: string | null
          occurrence_date: string
          series_id: string
        }
        Insert: {
          id?: string
          materialized_at?: string | null
          materialized_by?: string | null
          materialized_task_id?: string | null
          occurrence_date: string
          series_id: string
        }
        Update: {
          id?: string
          materialized_at?: string | null
          materialized_by?: string | null
          materialized_task_id?: string | null
          occurrence_date?: string
          series_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "materialized_task_instances_materialized_by_fkey"
            columns: ["materialized_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materialized_task_instances_materialized_task_id_fkey"
            columns: ["materialized_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materialized_task_instances_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "task_series"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_secrets: {
        Row: {
          created_at: string | null
          id: string
          key: string
          updated_at: string | null
          value: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value?: string | null
        }
        Relationships: []
      }
      plan_modules: {
        Row: {
          id: string
          is_enabled: boolean | null
          module_name: Database["public"]["Enums"]["app_module"]
          plan_id: string
        }
        Insert: {
          id?: string
          is_enabled?: boolean | null
          module_name: Database["public"]["Enums"]["app_module"]
          plan_id: string
        }
        Update: {
          id?: string
          is_enabled?: boolean | null
          module_name?: Database["public"]["Enums"]["app_module"]
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_modules_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
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
          pin_type: string | null
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
          pin_type?: string | null
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
          pin_type?: string | null
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
          {
            foreignKeyName: "profiles_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "super_admin_family_stats"
            referencedColumns: ["family_id"]
          },
        ]
      }
      public_holiday_settings: {
        Row: {
          api_key: string | null
          api_provider: string
          created_at: string | null
          enabled_regions: Json | null
          family_id: string
          id: string
          is_enabled: boolean | null
          last_sync_at: string | null
          updated_at: string | null
        }
        Insert: {
          api_key?: string | null
          api_provider: string
          created_at?: string | null
          enabled_regions?: Json | null
          family_id: string
          id?: string
          is_enabled?: boolean | null
          last_sync_at?: string | null
          updated_at?: string | null
        }
        Update: {
          api_key?: string | null
          api_provider?: string
          created_at?: string | null
          enabled_regions?: Json | null
          family_id?: string
          id?: string
          is_enabled?: boolean | null
          last_sync_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "public_holiday_settings_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: true
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_holiday_settings_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: true
            referencedRelation: "super_admin_family_stats"
            referencedColumns: ["family_id"]
          },
        ]
      }
      public_holidays_cache: {
        Row: {
          cached_at: string | null
          holiday_date: string
          holiday_name: string
          holiday_type: string | null
          id: string
          is_public: boolean | null
          region_code: string
          year: number
        }
        Insert: {
          cached_at?: string | null
          holiday_date: string
          holiday_name: string
          holiday_type?: string | null
          id?: string
          is_public?: boolean | null
          region_code: string
          year: number
        }
        Update: {
          cached_at?: string | null
          holiday_date?: string
          holiday_name?: string
          holiday_type?: string | null
          id?: string
          is_public?: boolean | null
          region_code?: string
          year?: number
        }
        Relationships: []
      }
      recurrence_exceptions: {
        Row: {
          created_at: string | null
          created_by: string
          exception_date: string
          exception_type: string
          id: string
          override_data: Json | null
          recurrence_id: string | null
          series_id: string
          series_type: string
        }
        Insert: {
          created_at?: string | null
          created_by: string
          exception_date: string
          exception_type: string
          id?: string
          override_data?: Json | null
          recurrence_id?: string | null
          series_id: string
          series_type: string
        }
        Update: {
          created_at?: string | null
          created_by?: string
          exception_date?: string
          exception_type?: string
          id?: string
          override_data?: Json | null
          recurrence_id?: string | null
          series_id?: string
          series_type?: string
        }
        Relationships: []
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
      rotation_events: {
        Row: {
          chosen_member_id: string | null
          created_at: string
          family_id: string
          id: string
          new_task_id: string | null
          next_index: number | null
          previous_index: number | null
          reason: string | null
          rotating_task_id: string
          selected_index: number | null
          source: string
          status: string
        }
        Insert: {
          chosen_member_id?: string | null
          created_at?: string
          family_id: string
          id?: string
          new_task_id?: string | null
          next_index?: number | null
          previous_index?: number | null
          reason?: string | null
          rotating_task_id: string
          selected_index?: number | null
          source: string
          status: string
        }
        Update: {
          chosen_member_id?: string | null
          created_at?: string
          family_id?: string
          id?: string
          new_task_id?: string | null
          next_index?: number | null
          previous_index?: number | null
          reason?: string | null
          rotating_task_id?: string
          selected_index?: number | null
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "rotation_events_chosen_member_id_fkey"
            columns: ["chosen_member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rotation_events_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rotation_events_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "super_admin_family_stats"
            referencedColumns: ["family_id"]
          },
          {
            foreignKeyName: "rotation_events_new_task_id_fkey"
            columns: ["new_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rotation_events_rotating_task_id_fkey"
            columns: ["rotating_task_id"]
            isOneToOne: false
            referencedRelation: "rotating_tasks"
            referencedColumns: ["id"]
          },
        ]
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
      subscription_plans: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_custom: boolean | null
          name: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_custom?: boolean | null
          name: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_custom?: boolean | null
          name?: string
          sort_order?: number | null
          updated_at?: string | null
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
      task_series: {
        Row: {
          assigned_profiles: string[] | null
          completion_rule: string | null
          created_at: string | null
          created_by: string
          description: string | null
          exdates: string[] | null
          family_id: string
          id: string
          is_active: boolean | null
          original_series_id: string | null
          points: number
          recurrence_rule: Json
          rrule: string | null
          series_end: string | null
          series_start: string
          task_group: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_profiles?: string[] | null
          completion_rule?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          exdates?: string[] | null
          family_id: string
          id?: string
          is_active?: boolean | null
          original_series_id?: string | null
          points?: number
          recurrence_rule: Json
          rrule?: string | null
          series_end?: string | null
          series_start: string
          task_group?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_profiles?: string[] | null
          completion_rule?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          exdates?: string[] | null
          family_id?: string
          id?: string
          is_active?: boolean | null
          original_series_id?: string | null
          points?: number
          recurrence_rule?: Json
          rrule?: string | null
          series_end?: string | null
          series_start?: string
          task_group?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_series_original_series_fkey"
            columns: ["original_series_id"]
            isOneToOne: false
            referencedRelation: "task_series"
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
          hidden_at: string | null
          id: string
          points: number
          recurrence_options: Json | null
          rotating_task_id: string | null
          task_group: string | null
          task_source: string | null
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
          hidden_at?: string | null
          id?: string
          points?: number
          recurrence_options?: Json | null
          rotating_task_id?: string | null
          task_group?: string | null
          task_source?: string | null
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
          hidden_at?: string | null
          id?: string
          points?: number
          recurrence_options?: Json | null
          rotating_task_id?: string | null
          task_group?: string | null
          task_source?: string | null
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
          {
            foreignKeyName: "tasks_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "super_admin_family_stats"
            referencedColumns: ["family_id"]
          },
          {
            foreignKeyName: "tasks_rotating_task_id_fkey"
            columns: ["rotating_task_id"]
            isOneToOne: false
            referencedRelation: "rotating_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          granted_at: string | null
          granted_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      super_admin_family_stats: {
        Row: {
          active_members: number | null
          created_at: string | null
          current_plan_id: string | null
          event_count: number | null
          family_id: string | null
          family_name: string | null
          is_custom_plan: boolean | null
          last_activity: string | null
          list_count: number | null
          max_streak: number | null
          member_count: number | null
          plan_name: string | null
          reward_count: number | null
          status: string | null
          task_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "families_current_plan_id_fkey"
            columns: ["current_plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_exdate_to_series: {
        Args: { p_exdate: string; p_series_id: string; p_table_name: string }
        Returns: undefined
      }
      approve_reward_request: {
        Args: { approval_note_param?: string; request_id_param: string }
        Returns: Json
      }
      audit_calendar_token_security: { Args: never; Returns: Json }
      authenticate_child_pin: {
        Args: { pin_attempt: string; profile_id_param: string }
        Returns: Json
      }
      authenticate_member_pin_dashboard:
        | {
            Args: { pin_attempt: string; profile_id_param: string }
            Returns: Json
          }
        | {
            Args: {
              device_id_param?: string
              pin_param: string
              pin_type_param?: string
              profile_id_param: string
            }
            Returns: Json
          }
      calculate_goal_progress: { Args: { p_goal_id: string }; Returns: Json }
      can_access_calendar_integration: {
        Args: { integration_profile_id: string }
        Returns: boolean
      }
      can_view_event: {
        Args: { event_id: string; event_source_integration_id: string }
        Returns: boolean
      }
      check_member_pin_cache: {
        Args: { device_id_param?: string; profile_id_param: string }
        Returns: boolean
      }
      check_profile_status: { Args: never; Returns: Json }
      check_token_access_rate_limit: {
        Args: {
          integration_id: string
          max_requests?: number
          time_window_minutes?: number
        }
        Returns: boolean
      }
      cleanup_broken_calendar_integrations: { Args: never; Returns: Json }
      complete_task_for_member:
        | { Args: { p_completed_by: string; p_task_id: string }; Returns: Json }
        | {
            Args: {
              p_completed_by: string
              p_points: number
              p_task_id: string
            }
            Returns: Json
          }
      complete_task_unified: {
        Args: {
          p_completer_profile_id?: string
          p_is_virtual?: boolean
          p_occurrence_date?: string
          p_series_id?: string
          p_task_id?: string
        }
        Returns: Json
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
          target_profile_id_param?: string
        }
        Returns: Json
      }
      decrypt_oauth_token:
        | {
            Args: {
              encrypted_token: string
              integration_id: string
              token_type?: string
            }
            Returns: string
          }
        | {
            Args: {
              encrypted_token: string
              integration_id?: string
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
      encrypt_calendar_token: { Args: { token_value: string }; Returns: string }
      encrypt_google_photos_tokens: { Args: never; Returns: Json }
      encrypt_oauth_token: {
        Args: { token_type?: string; token_value: string }
        Returns: string
      }
      fix_my_missing_profile: { Args: never; Returns: Json }
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
      get_calendar_integration_status: { Args: never; Returns: Json }
      get_calendar_integrations_metadata: {
        Args: never
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
        Args: never
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
      get_calendar_security_final_status: { Args: never; Returns: Json }
      get_calendar_security_status: { Args: never; Returns: Json }
      get_calendar_security_summary: {
        Args: never
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
      get_current_user_family_id: { Args: never; Returns: string }
      get_current_user_family_id_safe: { Args: never; Returns: string }
      get_decrypted_calendar_tokens: {
        Args: { integration_id_param: string }
        Returns: {
          access_token: string
          expires_at: string
          is_expired: boolean
          refresh_token: string
        }[]
      }
      get_decrypted_google_photos_tokens: {
        Args: { family_id_param: string }
        Returns: {
          access_token: string
          expires_at: string
          is_expired: boolean
          refresh_token: string
        }[]
      }
      get_family_modules: {
        Args: { check_family_id: string }
        Returns: {
          is_enabled: boolean
          module_name: string
        }[]
      }
      get_family_profiles_metadata: {
        Args: never
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
        Args: never
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
        Args: never
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
        Args: never
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
      get_oauth_credential: {
        Args: { credential_key: string }
        Returns: string
      }
      get_oauth_credentials: { Args: never; Returns: Json }
      get_oauth_encryption_key: { Args: never; Returns: string }
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
      get_system_stats: { Args: never; Returns: Json }
      get_token_encryption_status: { Args: never; Returns: Json }
      get_user_calendar_integrations: {
        Args: never
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
        Args: never
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
        Args: never
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
        Args: never
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
      get_user_family_id: { Args: never; Returns: string }
      hash_pin: { Args: { pin_text: string }; Returns: string }
      hide_completed_tasks: { Args: { p_family_id: string }; Returns: Json }
      is_calendar_integration_owner: {
        Args: { integration_id: string }
        Returns: boolean
      }
      is_current_user_parent: { Args: never; Returns: boolean }
      is_legacy_calendar_token: {
        Args: { token_value: string }
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
      is_super_admin: { Args: { check_user_id?: string }; Returns: boolean }
      log_admin_action: {
        Args: {
          p_action: string
          p_details?: Json
          p_target_entity: string
          p_target_id?: string
        }
        Returns: undefined
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
      log_pin_attempt: {
        Args: {
          p_attempt_type?: string
          p_profile_id: string
          p_success: boolean
        }
        Returns: undefined
      }
      log_security_event: {
        Args: {
          p_details?: Json
          p_entity_id?: string
          p_entity_type?: string
          p_event_type: string
          p_risk_level?: string
        }
        Returns: undefined
      }
      log_sensitive_access:
        | {
            Args: {
              p_action: string
              p_details?: Json
              p_entity_id: string
              p_entity_type: string
              p_success?: boolean
            }
            Returns: undefined
          }
        | {
            Args: {
              p_action: string
              p_details?: Json
              p_entity_id: string
              p_entity_type: string
              p_success?: boolean
            }
            Returns: undefined
          }
      mark_reward_claimed: { Args: { request_id_param: string }; Returns: Json }
      migrate_existing_tokens_to_encrypted: { Args: never; Returns: Json }
      migrate_tokens_to_v2_format: { Args: never; Returns: Json }
      remove_exdate_from_series: {
        Args: { p_exdate: string; p_series_id: string; p_table_name: string }
        Returns: undefined
      }
      remove_legacy_calendar_integrations: { Args: never; Returns: Json }
      revoke_calendar_integration: {
        Args: { integration_id: string; reason?: string }
        Returns: boolean
      }
      revoke_reward_request: {
        Args: { request_id_param: string; revoke_note_param?: string }
        Returns: Json
      }
      set_child_pin: {
        Args: {
          pin_param: string
          pin_type_param?: string
          profile_id_param: string
        }
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
      store_encrypted_google_photos_tokens: {
        Args: {
          access_token_param: string
          created_by_param?: string
          expires_at_param?: string
          family_id_param: string
          refresh_token_param?: string
        }
        Returns: Json
      }
      uncomplete_task_for_member: {
        Args: { p_completion_id: string }
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
      update_google_photos_tokens: {
        Args: {
          access_token_param: string
          expires_at_param?: string
          family_id_param: string
        }
        Returns: Json
      }
      update_oauth_credentials: { Args: { credentials: Json }; Returns: Json }
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
      validate_and_cleanup_tokens: { Args: never; Returns: Json }
      validate_calendar_token_access: {
        Args: { integration_id: string; requesting_user_id?: string }
        Returns: boolean
      }
      validate_token_encryption: {
        Args: never
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
      app_module:
        | "tasks"
        | "calendar"
        | "lists"
        | "rewards"
        | "rotating_tasks"
        | "screensaver"
        | "goals"
      app_role: "super_admin" | "user"
      goal_scope: "individual" | "family"
      goal_status: "active" | "paused" | "completed" | "archived"
      goal_type: "consistency" | "target_count" | "project"
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
      app_module: [
        "tasks",
        "calendar",
        "lists",
        "rewards",
        "rotating_tasks",
        "screensaver",
        "goals",
      ],
      app_role: ["super_admin", "user"],
      goal_scope: ["individual", "family"],
      goal_status: ["active", "paused", "completed", "archived"],
      goal_type: ["consistency", "target_count", "project"],
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
