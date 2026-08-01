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
      admin_training_programs: {
        Row: {
          category: string
          created_at: string | null
          days_per_week: number | null
          description: string | null
          difficulty: string | null
          difficulty_stars: number | null
          duration: string | null
          equipment: string | null
          expected_results: string | null
          id: string
          image_url: string | null
          is_ai_generated: boolean | null
          is_free: boolean | null
          is_premium: boolean | null
          is_standalone_purchase: boolean | null
          is_visible: boolean | null
          name: string
          nutrition_tips: string | null
          overview: string | null
          price: number | null
          program_structure: string | null
          progression_plan: string | null
          serial_number: number | null
          stripe_price_id: string | null
          stripe_product_id: string | null
          target_audience: string | null
          tier_required: string | null
          updated_at: string | null
          weekly_schedule: string | null
          weeks: number | null
        }
        Insert: {
          category: string
          created_at?: string | null
          days_per_week?: number | null
          description?: string | null
          difficulty?: string | null
          difficulty_stars?: number | null
          duration?: string | null
          equipment?: string | null
          expected_results?: string | null
          id: string
          image_url?: string | null
          is_ai_generated?: boolean | null
          is_free?: boolean | null
          is_premium?: boolean | null
          is_standalone_purchase?: boolean | null
          is_visible?: boolean | null
          name: string
          nutrition_tips?: string | null
          overview?: string | null
          price?: number | null
          program_structure?: string | null
          progression_plan?: string | null
          serial_number?: number | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          target_audience?: string | null
          tier_required?: string | null
          updated_at?: string | null
          weekly_schedule?: string | null
          weeks?: number | null
        }
        Update: {
          category?: string
          created_at?: string | null
          days_per_week?: number | null
          description?: string | null
          difficulty?: string | null
          difficulty_stars?: number | null
          duration?: string | null
          equipment?: string | null
          expected_results?: string | null
          id?: string
          image_url?: string | null
          is_ai_generated?: boolean | null
          is_free?: boolean | null
          is_premium?: boolean | null
          is_standalone_purchase?: boolean | null
          is_visible?: boolean | null
          name?: string
          nutrition_tips?: string | null
          overview?: string | null
          price?: number | null
          program_structure?: string | null
          progression_plan?: string | null
          serial_number?: number | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          target_audience?: string | null
          tier_required?: string | null
          updated_at?: string | null
          weekly_schedule?: string | null
          weeks?: number | null
        }
        Relationships: []
      }
      admin_workouts: {
        Row: {
          activation: string | null
          category: string | null
          cool_down: string | null
          created_at: string | null
          description: string | null
          difficulty: string | null
          difficulty_stars: number | null
          duration: string | null
          equipment: string | null
          finisher: string | null
          focus: string | null
          format: string | null
          generated_for_date: string | null
          id: string
          image_url: string | null
          instructions: string | null
          is_ai_generated: boolean | null
          is_free: boolean | null
          is_premium: boolean | null
          is_standalone_purchase: boolean | null
          is_visible: boolean | null
          is_workout_of_day: boolean | null
          main_workout: string | null
          name: string
          notes: string | null
          price: number | null
          serial_number: number | null
          stripe_price_id: string | null
          stripe_product_id: string | null
          tier_required: string | null
          tips: string | null
          type: string
          updated_at: string | null
          warm_up: string | null
          wod_source: string | null
        }
        Insert: {
          activation?: string | null
          category?: string | null
          cool_down?: string | null
          created_at?: string | null
          description?: string | null
          difficulty?: string | null
          difficulty_stars?: number | null
          duration?: string | null
          equipment?: string | null
          finisher?: string | null
          focus?: string | null
          format?: string | null
          generated_for_date?: string | null
          id: string
          image_url?: string | null
          instructions?: string | null
          is_ai_generated?: boolean | null
          is_free?: boolean | null
          is_premium?: boolean | null
          is_standalone_purchase?: boolean | null
          is_visible?: boolean | null
          is_workout_of_day?: boolean | null
          main_workout?: string | null
          name: string
          notes?: string | null
          price?: number | null
          serial_number?: number | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          tier_required?: string | null
          tips?: string | null
          type: string
          updated_at?: string | null
          warm_up?: string | null
          wod_source?: string | null
        }
        Update: {
          activation?: string | null
          category?: string | null
          cool_down?: string | null
          created_at?: string | null
          description?: string | null
          difficulty?: string | null
          difficulty_stars?: number | null
          duration?: string | null
          equipment?: string | null
          finisher?: string | null
          focus?: string | null
          format?: string | null
          generated_for_date?: string | null
          id?: string
          image_url?: string | null
          instructions?: string | null
          is_ai_generated?: boolean | null
          is_free?: boolean | null
          is_premium?: boolean | null
          is_standalone_purchase?: boolean | null
          is_visible?: boolean | null
          is_workout_of_day?: boolean | null
          main_workout?: string | null
          name?: string
          notes?: string | null
          price?: number | null
          serial_number?: number | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          tier_required?: string | null
          tips?: string | null
          type?: string
          updated_at?: string | null
          warm_up?: string | null
          wod_source?: string | null
        }
        Relationships: []
      }
      app_store_assets: {
        Row: {
          asset_type: string
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          height: number | null
          id: string
          platform: string
          storage_url: string | null
          updated_at: string
          width: number | null
        }
        Insert: {
          asset_type: string
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          height?: number | null
          id?: string
          platform: string
          storage_url?: string | null
          updated_at?: string
          width?: number | null
        }
        Update: {
          asset_type?: string
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          height?: number | null
          id?: string
          platform?: string
          storage_url?: string | null
          updated_at?: string
          width?: number | null
        }
        Relationships: []
      }
      app_store_settings: {
        Row: {
          app_name: string
          category: string
          content_rating: string
          created_at: string
          full_description: string
          id: string
          keywords: string
          marketing_url: string
          privacy_policy_url: string
          promotional_text: string
          short_description: string
          subtitle: string
          support_email: string
          support_url: string
          terms_of_service_url: string
          updated_at: string
          whats_new: string
        }
        Insert: {
          app_name?: string
          category?: string
          content_rating?: string
          created_at?: string
          full_description?: string
          id?: string
          keywords?: string
          marketing_url?: string
          privacy_policy_url?: string
          promotional_text?: string
          short_description?: string
          subtitle?: string
          support_email?: string
          support_url?: string
          terms_of_service_url?: string
          updated_at?: string
          whats_new?: string
        }
        Update: {
          app_name?: string
          category?: string
          content_rating?: string
          created_at?: string
          full_description?: string
          id?: string
          keywords?: string
          marketing_url?: string
          privacy_policy_url?: string
          promotional_text?: string
          short_description?: string
          subtitle?: string
          support_email?: string
          support_url?: string
          terms_of_service_url?: string
          updated_at?: string
          whats_new?: string
        }
        Relationships: []
      }
      app_vault_data: {
        Row: {
          created_at: string | null
          display_order: number | null
          field_key: string
          field_type: string | null
          field_value: string | null
          id: string
          notes: string | null
          section: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          field_key: string
          field_type?: string | null
          field_value?: string | null
          id?: string
          notes?: string | null
          section: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          field_key?: string
          field_type?: string | null
          field_value?: string | null
          id?: string
          notes?: string | null
          section?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      automated_message_templates: {
        Row: {
          automation_key: string | null
          content: string
          created_at: string | null
          dashboard_content: string | null
          dashboard_subject: string | null
          email_content: string | null
          email_subject: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          last_sent_at: string | null
          message_type: Database["public"]["Enums"]["message_type"]
          next_scheduled_time: string | null
          recurrence_interval: string | null
          recurrence_pattern: string | null
          scheduled_time: string | null
          status: string | null
          subject: string
          target_audience: string | null
          template_name: string
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          automation_key?: string | null
          content: string
          created_at?: string | null
          dashboard_content?: string | null
          dashboard_subject?: string | null
          email_content?: string | null
          email_subject?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          last_sent_at?: string | null
          message_type: Database["public"]["Enums"]["message_type"]
          next_scheduled_time?: string | null
          recurrence_interval?: string | null
          recurrence_pattern?: string | null
          scheduled_time?: string | null
          status?: string | null
          subject: string
          target_audience?: string | null
          template_name: string
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          automation_key?: string | null
          content?: string
          created_at?: string | null
          dashboard_content?: string | null
          dashboard_subject?: string | null
          email_content?: string | null
          email_subject?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          last_sent_at?: string | null
          message_type?: Database["public"]["Enums"]["message_type"]
          next_scheduled_time?: string | null
          recurrence_interval?: string | null
          recurrence_pattern?: string | null
          scheduled_time?: string | null
          status?: string | null
          subject?: string
          target_audience?: string | null
          template_name?: string
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      automation_rules: {
        Row: {
          automation_key: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          last_triggered_at: string | null
          message_type: string
          name: string
          next_trigger_at: string | null
          rule_type: string
          sends_dashboard_message: boolean | null
          sends_email: boolean | null
          sends_push: boolean
          target_audience: string | null
          total_executions: number | null
          trigger_config: Json | null
          trigger_type: string
          updated_at: string | null
        }
        Insert: {
          automation_key: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_triggered_at?: string | null
          message_type: string
          name: string
          next_trigger_at?: string | null
          rule_type: string
          sends_dashboard_message?: boolean | null
          sends_email?: boolean | null
          sends_push?: boolean
          target_audience?: string | null
          total_executions?: number | null
          trigger_config?: Json | null
          trigger_type: string
          updated_at?: string | null
        }
        Update: {
          automation_key?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_triggered_at?: string | null
          message_type?: string
          name?: string
          next_trigger_at?: string | null
          rule_type?: string
          sends_dashboard_message?: boolean | null
          sends_email?: boolean | null
          sends_push?: boolean
          target_audience?: string | null
          total_executions?: number | null
          trigger_config?: Json | null
          trigger_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      banned_users: {
        Row: {
          banned_at: string | null
          banned_by: string
          expires_at: string | null
          id: string
          is_permanent: boolean | null
          reason: string
          user_id: string
        }
        Insert: {
          banned_at?: string | null
          banned_by: string
          expires_at?: string | null
          id?: string
          is_permanent?: boolean | null
          reason: string
          user_id: string
        }
        Update: {
          banned_at?: string | null
          banned_by?: string
          expires_at?: string | null
          id?: string
          is_permanent?: boolean | null
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      blog_article_views: {
        Row: {
          article_id: string
          id: string
          user_id: string
          viewed_at: string | null
        }
        Insert: {
          article_id: string
          id?: string
          user_id: string
          viewed_at?: string | null
        }
        Update: {
          article_id?: string
          id?: string
          user_id?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_article_views_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "blog_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_articles: {
        Row: {
          author_credentials: string | null
          author_id: string | null
          author_name: string | null
          category: string
          content: string
          created_at: string
          excerpt: string
          id: string
          image_url: string | null
          is_ai_generated: boolean | null
          is_published: boolean | null
          published_at: string | null
          read_time: string | null
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          author_credentials?: string | null
          author_id?: string | null
          author_name?: string | null
          category: string
          content: string
          created_at?: string
          excerpt: string
          id?: string
          image_url?: string | null
          is_ai_generated?: boolean | null
          is_published?: boolean | null
          published_at?: string | null
          read_time?: string | null
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          author_credentials?: string | null
          author_id?: string | null
          author_name?: string | null
          category?: string
          content?: string
          created_at?: string
          excerpt?: string
          id?: string
          image_url?: string | null
          is_ai_generated?: boolean | null
          is_published?: boolean | null
          published_at?: string | null
          read_time?: string | null
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      bmr_history: {
        Row: {
          age: number
          bmr_result: number
          created_at: string
          gender: string
          height: number
          id: string
          user_id: string
          weight: number
        }
        Insert: {
          age: number
          bmr_result: number
          created_at?: string
          gender: string
          height: number
          id?: string
          user_id: string
          weight: number
        }
        Update: {
          age?: number
          bmr_result?: number
          created_at?: string
          gender?: string
          height?: number
          id?: string
          user_id?: string
          weight?: number
        }
        Relationships: []
      }
      calorie_history: {
        Row: {
          activity_level: string
          age: number
          created_at: string
          gender: string
          goal: string
          height: number
          id: string
          maintenance_calories: number
          target_calories: number
          user_id: string
          weight: number
        }
        Insert: {
          activity_level: string
          age: number
          created_at?: string
          gender: string
          goal: string
          height: number
          id?: string
          maintenance_calories: number
          target_calories: number
          user_id: string
          weight: number
        }
        Update: {
          activity_level?: string
          age?: number
          created_at?: string
          gender?: string
          goal?: string
          height?: number
          id?: string
          maintenance_calories?: number
          target_calories?: number
          user_id?: string
          weight?: number
        }
        Relationships: []
      }
      contact_message_history: {
        Row: {
          contact_message_id: string
          content: string
          created_at: string | null
          id: string
          message_type: string
          sender: string
        }
        Insert: {
          contact_message_id: string
          content: string
          created_at?: string | null
          id?: string
          message_type: string
          sender: string
        }
        Update: {
          contact_message_id?: string
          content?: string
          created_at?: string | null
          id?: string
          message_type?: string
          sender?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_message_history_contact_message_id_fkey"
            columns: ["contact_message_id"]
            isOneToOne: false
            referencedRelation: "contact_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          attachments: Json | null
          category: string
          created_at: string
          email: string
          id: string
          message: string
          name: string
          read_at: string | null
          responded_at: string | null
          response: string | null
          response_read_at: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          attachments?: Json | null
          category?: string
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          read_at?: string | null
          responded_at?: string | null
          response?: string | null
          response_read_at?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          attachments?: Json | null
          category?: string
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          read_at?: string | null
          responded_at?: string | null
          response?: string | null
          response_read_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      content_flags: {
        Row: {
          content_id: string
          content_type: string
          created_at: string | null
          flagged_by: string
          id: string
          reason: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string | null
          flagged_by: string
          id?: string
          reason: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string | null
          flagged_by?: string
          id?: string
          reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
        }
        Relationships: []
      }
      corporate_members: {
        Row: {
          corporate_subscription_id: string
          created_at: string
          created_by: string
          email: string
          id: string
          user_id: string
        }
        Insert: {
          corporate_subscription_id: string
          created_at?: string
          created_by: string
          email: string
          id?: string
          user_id: string
        }
        Update: {
          corporate_subscription_id?: string
          created_at?: string
          created_by?: string
          email?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "corporate_members_corporate_subscription_id_fkey"
            columns: ["corporate_subscription_id"]
            isOneToOne: false
            referencedRelation: "corporate_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      corporate_subscriptions: {
        Row: {
          admin_user_id: string
          created_at: string
          current_period_end: string
          current_period_start: string
          current_users_count: number
          id: string
          max_users: number
          organization_name: string
          plan_type: Database["public"]["Enums"]["corporate_plan_type"]
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          admin_user_id: string
          created_at?: string
          current_period_end: string
          current_period_start?: string
          current_users_count?: number
          id?: string
          max_users: number
          organization_name: string
          plan_type: Database["public"]["Enums"]["corporate_plan_type"]
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          admin_user_id?: string
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          current_users_count?: number
          id?: string
          max_users?: number
          organization_name?: string
          plan_type?: Database["public"]["Enums"]["corporate_plan_type"]
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cron_job_metadata: {
        Row: {
          category: string | null
          consecutive_failures: number
          created_at: string | null
          description: string | null
          display_name: string
          edge_function_name: string | null
          id: string
          is_active: boolean | null
          is_critical: boolean | null
          job_name: string
          last_run_at: string | null
          last_run_duration_ms: number | null
          last_run_status: string | null
          next_run_estimate: string | null
          request_body: Json | null
          schedule: string | null
          schedule_human_readable: string | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          consecutive_failures?: number
          created_at?: string | null
          description?: string | null
          display_name: string
          edge_function_name?: string | null
          id?: string
          is_active?: boolean | null
          is_critical?: boolean | null
          job_name: string
          last_run_at?: string | null
          last_run_duration_ms?: number | null
          last_run_status?: string | null
          next_run_estimate?: string | null
          request_body?: Json | null
          schedule?: string | null
          schedule_human_readable?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          consecutive_failures?: number
          created_at?: string | null
          description?: string | null
          display_name?: string
          edge_function_name?: string | null
          id?: string
          is_active?: boolean | null
          is_critical?: boolean | null
          job_name?: string
          last_run_at?: string | null
          last_run_duration_ms?: number | null
          last_run_status?: string | null
          next_run_estimate?: string | null
          request_body?: Json | null
          schedule?: string | null
          schedule_human_readable?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      cron_job_runs: {
        Row: {
          created_at: string
          duration_ms: number | null
          error_message: string | null
          finished_at: string | null
          http_status: number | null
          id: string
          job_name: string
          metadata: Json | null
          started_at: string
          status: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          http_status?: number | null
          id?: string
          job_name: string
          metadata?: Json | null
          started_at?: string
          status?: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          http_status?: number | null
          id?: string
          job_name?: string
          metadata?: Json | null
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      daily_ritual_assignments: {
        Row: {
          assigned_at: string
          cycle_number: number
          ritual_date: string
          ritual_id: string
        }
        Insert: {
          assigned_at?: string
          cycle_number?: number
          ritual_date: string
          ritual_id: string
        }
        Update: {
          assigned_at?: string
          cycle_number?: number
          ritual_date?: string
          ritual_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_ritual_assignments_ritual_id_fkey"
            columns: ["ritual_id"]
            isOneToOne: false
            referencedRelation: "daily_smarty_rituals"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_smarty_rituals: {
        Row: {
          created_at: string | null
          day_number: number
          evening_content: string
          id: string
          is_visible: boolean | null
          midday_content: string
          morning_content: string
          ritual_date: string
        }
        Insert: {
          created_at?: string | null
          day_number: number
          evening_content: string
          id?: string
          is_visible?: boolean | null
          midday_content: string
          morning_content: string
          ritual_date: string
        }
        Update: {
          created_at?: string | null
          day_number?: number
          evening_content?: string
          id?: string
          is_visible?: boolean | null
          midday_content?: string
          morning_content?: string
          ritual_date?: string
        }
        Relationships: []
      }
      email_campaign_log: {
        Row: {
          campaign_type: string
          email_id: string | null
          id: string
          sent_at: string | null
          user_id: string
        }
        Insert: {
          campaign_type: string
          email_id?: string | null
          id?: string
          sent_at?: string | null
          user_id: string
        }
        Update: {
          campaign_type?: string
          email_id?: string | null
          id?: string
          sent_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      email_delivery_log: {
        Row: {
          error_message: string | null
          id: string
          message_type: string
          metadata: Json | null
          resend_id: string | null
          sent_at: string
          status: string
          to_email: string
          user_id: string | null
        }
        Insert: {
          error_message?: string | null
          id?: string
          message_type: string
          metadata?: Json | null
          resend_id?: string | null
          sent_at?: string
          status: string
          to_email: string
          user_id?: string | null
        }
        Update: {
          error_message?: string | null
          id?: string
          message_type?: string
          metadata?: Json | null
          resend_id?: string | null
          sent_at?: string
          status?: string
          to_email?: string
          user_id?: string | null
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body: string
          category: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          subject: string
          updated_at: string | null
        }
        Insert: {
          body: string
          category: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          subject: string
          updated_at?: string | null
        }
        Update: {
          body?: string
          category?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          subject?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      exercise_library_videos: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          is_promotional: boolean | null
          is_visible: boolean | null
          muscle_group: string | null
          program_category: string | null
          target_muscle: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string | null
          workout_category: string | null
          workout_phase: string | null
          youtube_url: string
          youtube_video_id: string
        }
        Insert: {
          category?: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_promotional?: boolean | null
          is_visible?: boolean | null
          muscle_group?: string | null
          program_category?: string | null
          target_muscle?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
          workout_category?: string | null
          workout_phase?: string | null
          youtube_url: string
          youtube_video_id: string
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_promotional?: boolean | null
          is_visible?: boolean | null
          muscle_group?: string | null
          program_category?: string | null
          target_muscle?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
          workout_category?: string | null
          workout_phase?: string | null
          youtube_url?: string
          youtube_video_id?: string
        }
        Relationships: []
      }
      exercises: {
        Row: {
          body_part: string
          category: string | null
          created_at: string | null
          description: string | null
          difficulty: string | null
          equipment: string
          frame_end_url: string | null
          frame_start_url: string | null
          gif_url: string | null
          id: string
          instructions: string[] | null
          name: string
          secondary_muscles: string[] | null
          target: string
        }
        Insert: {
          body_part: string
          category?: string | null
          created_at?: string | null
          description?: string | null
          difficulty?: string | null
          equipment: string
          frame_end_url?: string | null
          frame_start_url?: string | null
          gif_url?: string | null
          id: string
          instructions?: string[] | null
          name: string
          secondary_muscles?: string[] | null
          target: string
        }
        Update: {
          body_part?: string
          category?: string | null
          created_at?: string | null
          description?: string | null
          difficulty?: string | null
          equipment?: string
          frame_end_url?: string | null
          frame_start_url?: string | null
          gif_url?: string | null
          id?: string
          instructions?: string[] | null
          name?: string
          secondary_muscles?: string[] | null
          target?: string
        }
        Relationships: []
      }
      image_repair_jobs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          errors: Json | null
          id: string
          processed_items: number | null
          repaired_items: number | null
          skipped_items: number | null
          started_at: string | null
          status: string
          stripe_synced: number | null
          total_items: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          errors?: Json | null
          id?: string
          processed_items?: number | null
          repaired_items?: number | null
          skipped_items?: number | null
          started_at?: string | null
          status?: string
          stripe_synced?: number | null
          total_items?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          errors?: Json | null
          id?: string
          processed_items?: number | null
          repaired_items?: number | null
          skipped_items?: number | null
          started_at?: string | null
          status?: string
          stripe_synced?: number | null
          total_items?: number | null
        }
        Relationships: []
      }
      indexnow_queue: {
        Row: {
          attempts: number
          content_id: string | null
          content_type: string
          id: number
          last_error: string | null
          processed_at: string | null
          queued_at: string
          url: string
        }
        Insert: {
          attempts?: number
          content_id?: string | null
          content_type: string
          id?: number
          last_error?: string | null
          processed_at?: string | null
          queued_at?: string
          url: string
        }
        Update: {
          attempts?: number
          content_id?: string | null
          content_type?: string
          id?: number
          last_error?: string | null
          processed_at?: string | null
          queued_at?: string
          url?: string
        }
        Relationships: []
      }
      mismatched_exercises: {
        Row: {
          created_at: string | null
          exercise_name: string
          id: string
          resolved_at: string | null
          resolved_exercise_id: string | null
          source_id: string | null
          source_name: string | null
          source_type: string
        }
        Insert: {
          created_at?: string | null
          exercise_name: string
          id?: string
          resolved_at?: string | null
          resolved_exercise_id?: string | null
          source_id?: string | null
          source_name?: string | null
          source_type: string
        }
        Update: {
          created_at?: string | null
          exercise_name?: string
          id?: string
          resolved_at?: string | null
          resolved_exercise_id?: string | null
          source_id?: string | null
          source_name?: string | null
          source_type?: string
        }
        Relationships: []
      }
      moderation_actions: {
        Row: {
          action_type: string
          created_at: string | null
          id: string
          moderator_id: string
          reason: string | null
          target_id: string
          target_type: string
        }
        Insert: {
          action_type: string
          created_at?: string | null
          id?: string
          moderator_id: string
          reason?: string | null
          target_id: string
          target_type: string
        }
        Update: {
          action_type?: string
          created_at?: string | null
          id?: string
          moderator_id?: string
          reason?: string | null
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          active: boolean
          email: string
          id: string
          name: string
          subscribed_at: string
        }
        Insert: {
          active?: boolean
          email: string
          id?: string
          name: string
          subscribed_at?: string
        }
        Update: {
          active?: boolean
          email?: string
          id?: string
          name?: string
          subscribed_at?: string
        }
        Relationships: []
      }
      notification_audit_log: {
        Row: {
          content: string
          failed_count: number | null
          id: string
          message_type: string
          metadata: Json | null
          notification_type: string
          recipient_count: number | null
          recipient_filter: string | null
          sent_at: string | null
          sent_by: string | null
          subject: string
          success_count: number | null
        }
        Insert: {
          content: string
          failed_count?: number | null
          id?: string
          message_type: string
          metadata?: Json | null
          notification_type: string
          recipient_count?: number | null
          recipient_filter?: string | null
          sent_at?: string | null
          sent_by?: string | null
          subject: string
          success_count?: number | null
        }
        Update: {
          content?: string
          failed_count?: number | null
          id?: string
          message_type?: string
          metadata?: Json | null
          notification_type?: string
          recipient_count?: number | null
          recipient_filter?: string | null
          sent_at?: string | null
          sent_by?: string | null
          subject?: string
          success_count?: number | null
        }
        Relationships: []
      }
      onerm_history: {
        Row: {
          created_at: string
          exercise_name: string | null
          id: string
          one_rm_result: number
          reps: number
          user_id: string
          weight_lifted: number
        }
        Insert: {
          created_at?: string
          exercise_name?: string | null
          id?: string
          one_rm_result: number
          reps: number
          user_id: string
          weight_lifted: number
        }
        Update: {
          created_at?: string
          exercise_name?: string | null
          id?: string
          one_rm_result?: number
          reps?: number
          user_id?: string
          weight_lifted?: number
        }
        Relationships: []
      }
      parq_responses: {
        Row: {
          created_at: string
          id: string
          is_cleared: boolean
          responses: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_cleared: boolean
          responses: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_cleared?: boolean
          responses?: Json
          user_id?: string
        }
        Relationships: []
      }
      pending_content_notifications: {
        Row: {
          content_category: string | null
          content_id: string
          content_name: string
          content_type: string
          created_at: string | null
          id: string
        }
        Insert: {
          content_category?: string | null
          content_id: string
          content_name: string
          content_type: string
          created_at?: string | null
          id?: string
        }
        Update: {
          content_category?: string | null
          content_id?: string
          content_name?: string
          content_type?: string
          created_at?: string | null
          id?: string
        }
        Relationships: []
      }
      plan_generation_usage: {
        Row: {
          generated_at: string
          id: string
          month_year: string
          plan_type: string
          user_id: string
        }
        Insert: {
          generated_at?: string
          id?: string
          month_year: string
          plan_type: string
          user_id: string
        }
        Update: {
          generated_at?: string
          id?: string
          month_year?: string
          plan_type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          custom_session_duration: number | null
          full_name: string | null
          id: string
          notification_preferences: Json | null
          timezone: string | null
          updated_at: string
          user_id: string
          welcome_sent: boolean | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          custom_session_duration?: number | null
          full_name?: string | null
          id?: string
          notification_preferences?: Json | null
          timezone?: string | null
          updated_at?: string
          user_id: string
          welcome_sent?: boolean | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          custom_session_duration?: number | null
          full_name?: string | null
          id?: string
          notification_preferences?: Json | null
          timezone?: string | null
          updated_at?: string
          user_id?: string
          welcome_sent?: boolean | null
        }
        Relationships: []
      }
      program_interactions: {
        Row: {
          created_at: string | null
          has_viewed: boolean | null
          id: string
          is_completed: boolean | null
          is_favorite: boolean | null
          is_ongoing: boolean | null
          program_id: string
          program_name: string
          program_type: string
          rating: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          has_viewed?: boolean | null
          id?: string
          is_completed?: boolean | null
          is_favorite?: boolean | null
          is_ongoing?: boolean | null
          program_id: string
          program_name: string
          program_type: string
          rating?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          has_viewed?: boolean | null
          id?: string
          is_completed?: boolean | null
          is_favorite?: boolean | null
          is_ongoing?: boolean | null
          program_id?: string
          program_name?: string
          program_type?: string
          rating?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      progress_logs: {
        Row: {
          created_at: string
          id: string
          log_date: string
          notes: string | null
          photos_url: string | null
          plan_id: string
          plan_type: string
          user_id: string
          weight: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          log_date?: string
          notes?: string | null
          photos_url?: string | null
          plan_id: string
          plan_type: string
          user_id: string
          weight?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          log_date?: string
          notes?: string | null
          photos_url?: string | null
          plan_id?: string
          plan_type?: string
          user_id?: string
          weight?: number | null
        }
        Relationships: []
      }
      promo_banners: {
        Row: {
          bg_color: string
          created_at: string
          id: string
          is_active: boolean
          link_text: string
          link_url: string
          title: string
        }
        Insert: {
          bg_color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          link_text?: string
          link_url?: string
          title: string
        }
        Update: {
          bg_color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          link_text?: string
          link_url?: string
          title?: string
        }
        Relationships: []
      }
      promotional_videos: {
        Row: {
          component_code: string | null
          component_name: string | null
          created_at: string | null
          description: string | null
          duration: string | null
          id: string
          is_current: boolean
          name: string
          parent_version_id: string | null
          updated_at: string | null
          version: number
          video_url: string | null
        }
        Insert: {
          component_code?: string | null
          component_name?: string | null
          created_at?: string | null
          description?: string | null
          duration?: string | null
          id?: string
          is_current?: boolean
          name: string
          parent_version_id?: string | null
          updated_at?: string | null
          version?: number
          video_url?: string | null
        }
        Update: {
          component_code?: string | null
          component_name?: string | null
          created_at?: string | null
          description?: string | null
          duration?: string | null
          id?: string
          is_current?: boolean
          name?: string
          parent_version_id?: string | null
          updated_at?: string | null
          version?: number
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promotional_videos_parent_version_id_fkey"
            columns: ["parent_version_id"]
            isOneToOne: false
            referencedRelation: "promotional_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          identifier: string
          last_request_at: string | null
          request_count: number
          window_start: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          identifier: string
          last_request_at?: string | null
          request_count?: number
          window_start?: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          identifier?: string
          last_request_at?: string | null
          request_count?: number
          window_start?: string
        }
        Relationships: []
      }
      response_templates: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          subject: string
          updated_at: string
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          subject: string
          updated_at?: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      ritual_purchases: {
        Row: {
          id: string
          purchased_at: string | null
          ritual_date: string
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          user_id: string
        }
        Insert: {
          id?: string
          purchased_at?: string | null
          ritual_date: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          user_id: string
        }
        Update: {
          id?: string
          purchased_at?: string | null
          ritual_date?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      saved_training_programs: {
        Row: {
          comment: string | null
          content: string
          created_at: string
          duration: string
          id: string
          is_favorite: boolean | null
          name: string
          rating: number | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          content: string
          created_at?: string
          duration: string
          id?: string
          is_favorite?: boolean | null
          name: string
          rating?: number | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string | null
          content?: string
          created_at?: string
          duration?: string
          id?: string
          is_favorite?: boolean | null
          name?: string
          rating?: number | null
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_workouts: {
        Row: {
          comment: string | null
          content: string
          created_at: string
          id: string
          is_favorite: boolean | null
          name: string
          rating: number | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          content: string
          created_at?: string
          id?: string
          is_favorite?: boolean | null
          name: string
          rating?: number | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string | null
          content?: string
          created_at?: string
          id?: string
          is_favorite?: boolean | null
          name?: string
          rating?: number | null
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scheduled_emails: {
        Row: {
          body: string
          created_at: string | null
          created_by: string | null
          error_message: string | null
          id: string
          last_sent_at: string | null
          next_scheduled_time: string | null
          recipient_count: number | null
          recipient_emails: string[] | null
          recurrence_interval: string | null
          recurrence_pattern: string | null
          scheduled_time: string
          sent_at: string | null
          status: string | null
          subject: string
          target_audience: string
          template_id: string | null
          timezone: string | null
        }
        Insert: {
          body: string
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          id?: string
          last_sent_at?: string | null
          next_scheduled_time?: string | null
          recipient_count?: number | null
          recipient_emails?: string[] | null
          recurrence_interval?: string | null
          recurrence_pattern?: string | null
          scheduled_time: string
          sent_at?: string | null
          status?: string | null
          subject: string
          target_audience: string
          template_id?: string | null
          timezone?: string | null
        }
        Update: {
          body?: string
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          id?: string
          last_sent_at?: string | null
          next_scheduled_time?: string | null
          recipient_count?: number | null
          recipient_emails?: string[] | null
          recurrence_interval?: string | null
          recurrence_pattern?: string | null
          scheduled_time?: string
          sent_at?: string | null
          status?: string | null
          subject?: string
          target_audience?: string
          template_id?: string | null
          timezone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_emails_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_notifications: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          error_message: string | null
          icon: string | null
          id: string
          last_sent_at: string | null
          next_scheduled_time: string | null
          recipient_count: number | null
          recurrence_interval: string | null
          recurrence_pattern: string | null
          scheduled_time: string
          sent_at: string | null
          status: string
          target_audience: string
          timezone: string | null
          title: string
          url: string | null
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          icon?: string | null
          id?: string
          last_sent_at?: string | null
          next_scheduled_time?: string | null
          recipient_count?: number | null
          recurrence_interval?: string | null
          recurrence_pattern?: string | null
          scheduled_time: string
          sent_at?: string | null
          status?: string
          target_audience: string
          timezone?: string | null
          title: string
          url?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          icon?: string | null
          id?: string
          last_sent_at?: string | null
          next_scheduled_time?: string | null
          recipient_count?: number | null
          recurrence_interval?: string | null
          recurrence_pattern?: string | null
          scheduled_time?: string
          sent_at?: string | null
          status?: string
          target_audience?: string
          timezone?: string | null
          title?: string
          url?: string | null
        }
        Relationships: []
      }
      scheduled_workouts: {
        Row: {
          content_id: string
          content_name: string
          content_type: string
          created_at: string
          google_calendar_event_id: string | null
          id: string
          notes: string | null
          reminder_before_minutes: number | null
          reminder_sent: boolean | null
          scheduled_date: string
          scheduled_time: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content_id: string
          content_name: string
          content_type: string
          created_at?: string
          google_calendar_event_id?: string | null
          id?: string
          notes?: string | null
          reminder_before_minutes?: number | null
          reminder_sent?: boolean | null
          scheduled_date: string
          scheduled_time?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content_id?: string
          content_name?: string
          content_type?: string
          created_at?: string
          google_calendar_event_id?: string | null
          id?: string
          notes?: string | null
          reminder_before_minutes?: number | null
          reminder_sent?: boolean | null
          scheduled_date?: string
          scheduled_time?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      seo_metadata: {
        Row: {
          content_id: string
          content_type: string
          created_at: string | null
          id: string
          image_alt_text: string | null
          internal_links: string[] | null
          json_ld: Json | null
          keywords: string[] | null
          last_refreshed_at: string | null
          meta_description: string | null
          meta_title: string | null
          updated_at: string | null
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string | null
          id?: string
          image_alt_text?: string | null
          internal_links?: string[] | null
          json_ld?: Json | null
          keywords?: string[] | null
          last_refreshed_at?: string | null
          meta_description?: string | null
          meta_title?: string | null
          updated_at?: string | null
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string | null
          id?: string
          image_alt_text?: string | null
          internal_links?: string[] | null
          json_ld?: Json | null
          keywords?: string[] | null
          last_refreshed_at?: string | null
          meta_description?: string | null
          meta_title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      seo_refresh_log: {
        Row: {
          completed_at: string | null
          error_message: string | null
          id: string
          items_scanned: number | null
          items_updated: number | null
          metadata: Json | null
          refresh_type: string
          sitemap_generated: boolean | null
          started_at: string | null
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          items_scanned?: number | null
          items_updated?: number | null
          metadata?: Json | null
          refresh_type: string
          sitemap_generated?: boolean | null
          started_at?: string | null
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          items_scanned?: number | null
          items_updated?: number | null
          metadata?: Json | null
          refresh_type?: string
          sitemap_generated?: boolean | null
          started_at?: string | null
        }
        Relationships: []
      }
      shop_products: {
        Row: {
          amazon_url: string | null
          category: string
          created_at: string
          description: string
          display_order: number | null
          id: string
          image_url: string
          is_available: boolean | null
          is_featured: boolean | null
          price: number | null
          price_range: string
          product_type: string
          stock_quantity: number | null
          stripe_price_id: string | null
          stripe_product_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          amazon_url?: string | null
          category: string
          created_at?: string
          description: string
          display_order?: number | null
          id?: string
          image_url: string
          is_available?: boolean | null
          is_featured?: boolean | null
          price?: number | null
          price_range: string
          product_type?: string
          stock_quantity?: number | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          amazon_url?: string | null
          category?: string
          created_at?: string
          description?: string
          display_order?: number | null
          id?: string
          image_url?: string
          is_available?: boolean | null
          is_featured?: boolean | null
          price?: number | null
          price_range?: string
          product_type?: string
          stock_quantity?: number | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      smartly_suggest_interactions: {
        Row: {
          action_taken: string | null
          confidence_level: string
          created_at: string
          id: string
          questions_asked: Json | null
          suggested_content_id: string
          suggested_content_type: string
          user_id: string
          user_responses: Json | null
        }
        Insert: {
          action_taken?: string | null
          confidence_level: string
          created_at?: string
          id?: string
          questions_asked?: Json | null
          suggested_content_id: string
          suggested_content_type: string
          user_id: string
          user_responses?: Json | null
        }
        Update: {
          action_taken?: string | null
          confidence_level?: string
          created_at?: string
          id?: string
          questions_asked?: Json | null
          suggested_content_id?: string
          suggested_content_type?: string
          user_id?: string
          user_responses?: Json | null
        }
        Relationships: []
      }
      smarty_checkins: {
        Row: {
          checkin_date: string
          created_at: string | null
          daily_smarty_score: number | null
          day_strain: number | null
          day_strain_score: number | null
          hydration_liters: number | null
          hydration_score: number | null
          id: string
          mood_rating: number | null
          mood_score: number | null
          morning_completed: boolean | null
          morning_completed_at: string | null
          morning_modal_shown: boolean | null
          movement_score: number | null
          night_completed: boolean | null
          night_completed_at: string | null
          night_modal_shown: boolean | null
          protein_level: number | null
          protein_score_norm: number | null
          readiness_score: number | null
          readiness_score_norm: number | null
          score_category: string | null
          sleep_hours: number | null
          sleep_quality: number | null
          sleep_score: number | null
          soreness_rating: number | null
          soreness_score: number | null
          status: string | null
          steps_bucket: number | null
          steps_value: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          checkin_date: string
          created_at?: string | null
          daily_smarty_score?: number | null
          day_strain?: number | null
          day_strain_score?: number | null
          hydration_liters?: number | null
          hydration_score?: number | null
          id?: string
          mood_rating?: number | null
          mood_score?: number | null
          morning_completed?: boolean | null
          morning_completed_at?: string | null
          morning_modal_shown?: boolean | null
          movement_score?: number | null
          night_completed?: boolean | null
          night_completed_at?: string | null
          night_modal_shown?: boolean | null
          protein_level?: number | null
          protein_score_norm?: number | null
          readiness_score?: number | null
          readiness_score_norm?: number | null
          score_category?: string | null
          sleep_hours?: number | null
          sleep_quality?: number | null
          sleep_score?: number | null
          soreness_rating?: number | null
          soreness_score?: number | null
          status?: string | null
          steps_bucket?: number | null
          steps_value?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          checkin_date?: string
          created_at?: string | null
          daily_smarty_score?: number | null
          day_strain?: number | null
          day_strain_score?: number | null
          hydration_liters?: number | null
          hydration_score?: number | null
          id?: string
          mood_rating?: number | null
          mood_score?: number | null
          morning_completed?: boolean | null
          morning_completed_at?: string | null
          morning_modal_shown?: boolean | null
          movement_score?: number | null
          night_completed?: boolean | null
          night_completed_at?: string | null
          night_modal_shown?: boolean | null
          protein_level?: number | null
          protein_score_norm?: number | null
          readiness_score?: number | null
          readiness_score_norm?: number | null
          score_category?: string | null
          sleep_hours?: number | null
          sleep_quality?: number | null
          sleep_score?: number | null
          soreness_rating?: number | null
          soreness_score?: number | null
          status?: string | null
          steps_bucket?: number | null
          steps_value?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      social_media_analytics: {
        Row: {
          browser_info: string | null
          created_at: string | null
          device_type: string | null
          event_type: string
          event_value: number | null
          id: string
          landing_page: string | null
          referral_source: string
          session_id: string
          user_id: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          browser_info?: string | null
          created_at?: string | null
          device_type?: string | null
          event_type: string
          event_value?: number | null
          id?: string
          landing_page?: string | null
          referral_source: string
          session_id: string
          user_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          browser_info?: string | null
          created_at?: string | null
          device_type?: string | null
          event_type?: string
          event_value?: number | null
          id?: string
          landing_page?: string | null
          referral_source?: string
          session_id?: string
          user_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: []
      }
      stripe_sync_audit: {
        Row: {
          broken_count: number
          created_at: string
          id: string
          issues: Json
          ok_count: number
          scope: string
          summary: Json
          total: number
        }
        Insert: {
          broken_count: number
          created_at?: string
          id?: string
          issues?: Json
          ok_count: number
          scope: string
          summary?: Json
          total: number
        }
        Update: {
          broken_count?: number
          created_at?: string
          id?: string
          issues?: Json
          ok_count?: number
          scope?: string
          summary?: Json
          total?: number
        }
        Relationships: []
      }
      stripe_webhook_events: {
        Row: {
          event_id: string
          event_type: string
          processed_at: string
        }
        Insert: {
          event_id: string
          event_type: string
          processed_at?: string
        }
        Update: {
          event_id?: string
          event_type?: string
          processed_at?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      system_health_audits: {
        Row: {
          audit_date: string
          created_at: string
          critical_issues: string[] | null
          duration_ms: number | null
          failed_checks: number
          id: string
          passed_checks: number
          results: Json | null
          skipped_checks: number
          total_checks: number
          warning_checks: number
        }
        Insert: {
          audit_date?: string
          created_at?: string
          critical_issues?: string[] | null
          duration_ms?: number | null
          failed_checks?: number
          id?: string
          passed_checks?: number
          results?: Json | null
          skipped_checks?: number
          total_checks?: number
          warning_checks?: number
        }
        Update: {
          audit_date?: string
          created_at?: string
          critical_issues?: string[] | null
          duration_ms?: number | null
          failed_checks?: number
          id?: string
          passed_checks?: number
          results?: Json | null
          skipped_checks?: number
          total_checks?: number
          warning_checks?: number
        }
        Relationships: []
      }
      system_health_events: {
        Row: {
          attempt_count: number
          autofix_attempted: boolean
          autofix_result: Json | null
          autofix_status: string | null
          candidate_rejection_reasons: Json | null
          category: string | null
          check_type: string
          created_at: string
          day_in_84: number | null
          difficulty: string | null
          equipment_slot: string | null
          id: string
          issue_message: string | null
          resolved_at: string | null
          scheduled_for_date: string | null
          severity: string
          status: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          autofix_attempted?: boolean
          autofix_result?: Json | null
          autofix_status?: string | null
          candidate_rejection_reasons?: Json | null
          category?: string | null
          check_type: string
          created_at?: string
          day_in_84?: number | null
          difficulty?: string | null
          equipment_slot?: string | null
          id?: string
          issue_message?: string | null
          resolved_at?: string | null
          scheduled_for_date?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          autofix_attempted?: boolean
          autofix_result?: Json | null
          autofix_status?: string | null
          candidate_rejection_reasons?: Json | null
          category?: string | null
          check_type?: string
          created_at?: string
          day_in_84?: number | null
          difficulty?: string | null
          equipment_slot?: string | null
          id?: string
          issue_message?: string | null
          resolved_at?: string | null
          scheduled_for_date?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          setting_key: string
          setting_value: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          created_at: string
          display_name: string
          id: string
          rating: number
          testimonial_text: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          rating: number
          testimonial_text: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          rating?: number
          testimonial_text?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_activity_log: {
        Row: {
          action_type: string
          activity_date: string
          content_type: string
          created_at: string
          id: string
          item_id: string
          item_name: string
          program_day: number | null
          program_week: number | null
          tool_input: Json | null
          tool_result: Json | null
          total_days_per_week: number | null
          total_weeks: number | null
          user_id: string
        }
        Insert: {
          action_type: string
          activity_date?: string
          content_type: string
          created_at?: string
          id?: string
          item_id: string
          item_name: string
          program_day?: number | null
          program_week?: number | null
          tool_input?: Json | null
          tool_result?: Json | null
          total_days_per_week?: number | null
          total_weeks?: number | null
          user_id: string
        }
        Update: {
          action_type?: string
          activity_date?: string
          content_type?: string
          created_at?: string
          id?: string
          item_id?: string
          item_name?: string
          program_day?: number | null
          program_week?: number | null
          tool_input?: Json | null
          tool_result?: Json | null
          total_days_per_week?: number | null
          total_weeks?: number | null
          user_id?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge_data: Json | null
          badge_level: string
          badge_type: string
          earned_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          badge_data?: Json | null
          badge_level: string
          badge_type: string
          earned_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          badge_data?: Json | null
          badge_level?: string
          badge_type?: string
          earned_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_fitness_goals: {
        Row: {
          created_at: string
          equipment_available: string | null
          experience_level: string | null
          id: string
          primary_goal: string
          secondary_goal: string | null
          time_availability_default: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          equipment_available?: string | null
          experience_level?: string | null
          id?: string
          primary_goal?: string
          secondary_goal?: string | null
          time_availability_default?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          equipment_available?: string | null
          experience_level?: string | null
          id?: string
          primary_goal?: string
          secondary_goal?: string | null
          time_availability_default?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_measurement_goals: {
        Row: {
          body_fat_goal_achieved_at: string | null
          created_at: string
          id: string
          muscle_mass_goal_achieved_at: string | null
          programs_goal_achieved_at: string | null
          target_body_fat: number | null
          target_date: string | null
          target_muscle_mass: number | null
          target_programs_completed: number | null
          target_weight: number | null
          target_workouts_completed: number | null
          updated_at: string
          user_id: string
          weight_goal_achieved_at: string | null
          workouts_goal_achieved_at: string | null
        }
        Insert: {
          body_fat_goal_achieved_at?: string | null
          created_at?: string
          id?: string
          muscle_mass_goal_achieved_at?: string | null
          programs_goal_achieved_at?: string | null
          target_body_fat?: number | null
          target_date?: string | null
          target_muscle_mass?: number | null
          target_programs_completed?: number | null
          target_weight?: number | null
          target_workouts_completed?: number | null
          updated_at?: string
          user_id: string
          weight_goal_achieved_at?: string | null
          workouts_goal_achieved_at?: string | null
        }
        Update: {
          body_fat_goal_achieved_at?: string | null
          created_at?: string
          id?: string
          muscle_mass_goal_achieved_at?: string | null
          programs_goal_achieved_at?: string | null
          target_body_fat?: number | null
          target_date?: string | null
          target_muscle_mass?: number | null
          target_programs_completed?: number | null
          target_weight?: number | null
          target_workouts_completed?: number | null
          updated_at?: string
          user_id?: string
          weight_goal_achieved_at?: string | null
          workouts_goal_achieved_at?: string | null
        }
        Relationships: []
      }
      user_purchases: {
        Row: {
          content_deleted: boolean | null
          content_id: string
          content_name: string
          content_type: string
          fulfillment_status: string | null
          id: string
          price: number
          purchased_at: string
          shipping_address: Json | null
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          tracking_info: string | null
          user_id: string
        }
        Insert: {
          content_deleted?: boolean | null
          content_id: string
          content_name: string
          content_type: string
          fulfillment_status?: string | null
          id?: string
          price: number
          purchased_at?: string
          shipping_address?: Json | null
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          tracking_info?: string | null
          user_id: string
        }
        Update: {
          content_deleted?: boolean | null
          content_id?: string
          content_name?: string
          content_type?: string
          fulfillment_status?: string | null
          id?: string
          price?: number
          purchased_at?: string
          shipping_address?: Json | null
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          tracking_info?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          grant_notes: string | null
          granted_by: string | null
          id: string
          plan_type: Database["public"]["Enums"]["plan_type"]
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_source: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          grant_notes?: string | null
          granted_by?: string | null
          id?: string
          plan_type?: Database["public"]["Enums"]["plan_type"]
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_source?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          grant_notes?: string | null
          granted_by?: string | null
          id?: string
          plan_type?: Database["public"]["Enums"]["plan_type"]
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_source?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_system_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_read: boolean | null
          message_type: Database["public"]["Enums"]["message_type"]
          subject: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message_type: Database["public"]["Enums"]["message_type"]
          subject: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message_type?: Database["public"]["Enums"]["message_type"]
          subject?: string
          user_id?: string
        }
        Relationships: []
      }
      wod_auto_generation_config: {
        Row: {
          created_at: string
          generation_hour_utc: number
          generation_minute_utc: number
          id: string
          is_enabled: boolean
          pause_reason: string | null
          paused_until: string | null
          updated_at: string
          wod_mode: string
        }
        Insert: {
          created_at?: string
          generation_hour_utc?: number
          generation_minute_utc?: number
          id?: string
          is_enabled?: boolean
          pause_reason?: string | null
          paused_until?: string | null
          updated_at?: string
          wod_mode?: string
        }
        Update: {
          created_at?: string
          generation_hour_utc?: number
          generation_minute_utc?: number
          id?: string
          is_enabled?: boolean
          pause_reason?: string | null
          paused_until?: string | null
          updated_at?: string
          wod_mode?: string
        }
        Relationships: []
      }
      wod_generation_notifications: {
        Row: {
          attempt_source: string | null
          created_at: string
          id: string
          notified_at: string
          slot: string
          status: string
          target_date: string
        }
        Insert: {
          attempt_source?: string | null
          created_at?: string
          id?: string
          notified_at?: string
          slot: string
          status: string
          target_date: string
        }
        Update: {
          attempt_source?: string | null
          created_at?: string
          id?: string
          notified_at?: string
          slot?: string
          status?: string
          target_date?: string
        }
        Relationships: []
      }
      wod_generation_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          cyprus_date: string
          error_message: string | null
          expected_category: string | null
          expected_count: number
          found_count: number | null
          id: string
          is_recovery_day: boolean | null
          started_at: string
          status: string
          trigger_source: string | null
          wods_created: Json | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          cyprus_date: string
          error_message?: string | null
          expected_category?: string | null
          expected_count: number
          found_count?: number | null
          id?: string
          is_recovery_day?: boolean | null
          started_at?: string
          status?: string
          trigger_source?: string | null
          wods_created?: Json | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          cyprus_date?: string
          error_message?: string | null
          expected_category?: string | null
          expected_count?: number
          found_count?: number | null
          id?: string
          is_recovery_day?: boolean | null
          started_at?: string
          status?: string
          trigger_source?: string | null
          wods_created?: Json | null
        }
        Relationships: []
      }
      wod_readiness_audits: {
        Row: {
          audit_date: string
          created_at: string
          failed_check_keys: string[] | null
          failed_count: number
          id: string
          notes: string | null
          overall_status: string
          passed_count: number
          results: Json | null
          total_checks: number
          triggered_by: string
          warning_check_keys: string[] | null
          warning_count: number
        }
        Insert: {
          audit_date?: string
          created_at?: string
          failed_check_keys?: string[] | null
          failed_count?: number
          id?: string
          notes?: string | null
          overall_status?: string
          passed_count?: number
          results?: Json | null
          total_checks?: number
          triggered_by?: string
          warning_check_keys?: string[] | null
          warning_count?: number
        }
        Update: {
          audit_date?: string
          created_at?: string
          failed_check_keys?: string[] | null
          failed_count?: number
          id?: string
          notes?: string | null
          overall_status?: string
          passed_count?: number
          results?: Json | null
          total_checks?: number
          triggered_by?: string
          warning_check_keys?: string[] | null
          warning_count?: number
        }
        Relationships: []
      }
      wod_selection_cooldown: {
        Row: {
          category: string
          created_at: string | null
          difficulty: string | null
          equipment: string | null
          id: string
          selected_for_date: string
          source_workout_id: string
        }
        Insert: {
          category: string
          created_at?: string | null
          difficulty?: string | null
          equipment?: string | null
          id?: string
          selected_for_date: string
          source_workout_id: string
        }
        Update: {
          category?: string
          created_at?: string | null
          difficulty?: string | null
          equipment?: string | null
          id?: string
          selected_for_date?: string
          source_workout_id?: string
        }
        Relationships: []
      }
      wod_tomorrow_preview: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          bodyweight_workout_id: string | null
          category: string | null
          created_at: string
          date: string
          difficulty: string | null
          difficulty_stars_max: number | null
          difficulty_stars_min: number | null
          equipment_workout_id: string | null
          is_recovery_day: boolean
          notes: string | null
          picked_at: string
          picked_by: string
          recovery_workout_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          bodyweight_workout_id?: string | null
          category?: string | null
          created_at?: string
          date: string
          difficulty?: string | null
          difficulty_stars_max?: number | null
          difficulty_stars_min?: number | null
          equipment_workout_id?: string | null
          is_recovery_day?: boolean
          notes?: string | null
          picked_at?: string
          picked_by?: string
          recovery_workout_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          bodyweight_workout_id?: string | null
          category?: string | null
          created_at?: string
          date?: string
          difficulty?: string | null
          difficulty_stars_max?: number | null
          difficulty_stars_min?: number | null
          equipment_workout_id?: string | null
          is_recovery_day?: boolean
          notes?: string | null
          picked_at?: string
          picked_by?: string
          recovery_workout_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wod_tomorrow_preview_bodyweight_workout_id_fkey"
            columns: ["bodyweight_workout_id"]
            isOneToOne: false
            referencedRelation: "admin_workouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wod_tomorrow_preview_bodyweight_workout_id_fkey"
            columns: ["bodyweight_workout_id"]
            isOneToOne: false
            referencedRelation: "public_workout_metadata"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wod_tomorrow_preview_equipment_workout_id_fkey"
            columns: ["equipment_workout_id"]
            isOneToOne: false
            referencedRelation: "admin_workouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wod_tomorrow_preview_equipment_workout_id_fkey"
            columns: ["equipment_workout_id"]
            isOneToOne: false
            referencedRelation: "public_workout_metadata"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wod_tomorrow_preview_recovery_workout_id_fkey"
            columns: ["recovery_workout_id"]
            isOneToOne: false
            referencedRelation: "admin_workouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wod_tomorrow_preview_recovery_workout_id_fkey"
            columns: ["recovery_workout_id"]
            isOneToOne: false
            referencedRelation: "public_workout_metadata"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_comments: {
        Row: {
          comment_text: string
          created_at: string
          id: string
          program_id: string | null
          program_name: string | null
          program_type: string | null
          updated_at: string
          user_id: string
          workout_id: string | null
          workout_name: string | null
          workout_type: string | null
        }
        Insert: {
          comment_text: string
          created_at?: string
          id?: string
          program_id?: string | null
          program_name?: string | null
          program_type?: string | null
          updated_at?: string
          user_id: string
          workout_id?: string | null
          workout_name?: string | null
          workout_type?: string | null
        }
        Update: {
          comment_text?: string
          created_at?: string
          id?: string
          program_id?: string | null
          program_name?: string | null
          program_type?: string | null
          updated_at?: string
          user_id?: string
          workout_id?: string | null
          workout_name?: string | null
          workout_type?: string | null
        }
        Relationships: []
      }
      workout_interactions: {
        Row: {
          created_at: string | null
          has_viewed: boolean | null
          id: string
          is_completed: boolean | null
          is_favorite: boolean | null
          rating: number | null
          updated_at: string | null
          user_id: string
          workout_id: string
          workout_name: string
          workout_type: string
        }
        Insert: {
          created_at?: string | null
          has_viewed?: boolean | null
          id?: string
          is_completed?: boolean | null
          is_favorite?: boolean | null
          rating?: number | null
          updated_at?: string | null
          user_id: string
          workout_id: string
          workout_name: string
          workout_type: string
        }
        Update: {
          created_at?: string | null
          has_viewed?: boolean | null
          id?: string
          is_completed?: boolean | null
          is_favorite?: boolean | null
          rating?: number | null
          updated_at?: string | null
          user_id?: string
          workout_id?: string
          workout_name?: string
          workout_type?: string
        }
        Relationships: []
      }
      workout_of_day_state: {
        Row: {
          created_at: string | null
          difficulty_advanced_count: number | null
          difficulty_beginner_count: number | null
          difficulty_intermediate_count: number | null
          equipment_bodyweight_count: number | null
          equipment_with_count: number | null
          format_usage: Json | null
          id: string
          last_difficulty: string | null
          last_equipment: string | null
          last_generated_at: string | null
          manual_overrides: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          difficulty_advanced_count?: number | null
          difficulty_beginner_count?: number | null
          difficulty_intermediate_count?: number | null
          equipment_bodyweight_count?: number | null
          equipment_with_count?: number | null
          format_usage?: Json | null
          id?: string
          last_difficulty?: string | null
          last_equipment?: string | null
          last_generated_at?: string | null
          manual_overrides?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          difficulty_advanced_count?: number | null
          difficulty_beginner_count?: number | null
          difficulty_intermediate_count?: number | null
          equipment_bodyweight_count?: number | null
          equipment_with_count?: number | null
          format_usage?: Json | null
          id?: string
          last_difficulty?: string | null
          last_equipment?: string | null
          last_generated_at?: string | null
          manual_overrides?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      workout_repair_log: {
        Row: {
          bugs_found: Json
          changed: boolean
          fixes_applied: Json
          flagged_for_review: Json
          id: string
          run_at: string
          workout_id: string
          workout_name: string | null
        }
        Insert: {
          bugs_found?: Json
          changed?: boolean
          fixes_applied?: Json
          flagged_for_review?: Json
          id?: string
          run_at?: string
          workout_id: string
          workout_name?: string | null
        }
        Update: {
          bugs_found?: Json
          changed?: boolean
          fixes_applied?: Json
          flagged_for_review?: Json
          id?: string
          run_at?: string
          workout_id?: string
          workout_name?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      leaderboard_stats: {
        Row: {
          avatar_url: string | null
          avg_score: number | null
          best_score: number | null
          complete_days: number | null
          display_name: string | null
          streak_days: number | null
          total_checkins: number | null
        }
        Relationships: []
      }
      program_activity_summary: {
        Row: {
          avg_rating: number | null
          favorites_count: number | null
          program_name: string | null
          program_type: string | null
          times_completed: number | null
          times_started: number | null
        }
        Relationships: []
      }
      public_program_metadata: {
        Row: {
          category: string | null
          created_at: string | null
          days_per_week: number | null
          description: string | null
          difficulty: string | null
          difficulty_stars: number | null
          duration: string | null
          equipment: string | null
          expected_results: string | null
          id: string | null
          image_url: string | null
          is_free: boolean | null
          is_premium: boolean | null
          is_standalone_purchase: boolean | null
          is_visible: boolean | null
          name: string | null
          nutrition_tips: string | null
          overview: string | null
          price: number | null
          program_structure: string | null
          progression_plan: string | null
          serial_number: number | null
          stripe_price_id: string | null
          stripe_product_id: string | null
          target_audience: string | null
          tier_required: string | null
          updated_at: string | null
          weekly_schedule: string | null
          weeks: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          days_per_week?: number | null
          description?: string | null
          difficulty?: string | null
          difficulty_stars?: number | null
          duration?: string | null
          equipment?: string | null
          expected_results?: never
          id?: string | null
          image_url?: string | null
          is_free?: boolean | null
          is_premium?: boolean | null
          is_standalone_purchase?: boolean | null
          is_visible?: boolean | null
          name?: string | null
          nutrition_tips?: never
          overview?: never
          price?: number | null
          program_structure?: never
          progression_plan?: never
          serial_number?: number | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          target_audience?: never
          tier_required?: string | null
          updated_at?: string | null
          weekly_schedule?: never
          weeks?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          days_per_week?: number | null
          description?: string | null
          difficulty?: string | null
          difficulty_stars?: number | null
          duration?: string | null
          equipment?: string | null
          expected_results?: never
          id?: string | null
          image_url?: string | null
          is_free?: boolean | null
          is_premium?: boolean | null
          is_standalone_purchase?: boolean | null
          is_visible?: boolean | null
          name?: string | null
          nutrition_tips?: never
          overview?: never
          price?: number | null
          program_structure?: never
          progression_plan?: never
          serial_number?: number | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          target_audience?: never
          tier_required?: string | null
          updated_at?: string | null
          weekly_schedule?: never
          weeks?: number | null
        }
        Relationships: []
      }
      public_workout_metadata: {
        Row: {
          activation: string | null
          category: string | null
          cool_down: string | null
          created_at: string | null
          description: string | null
          difficulty: string | null
          difficulty_stars: number | null
          duration: string | null
          equipment: string | null
          finisher: string | null
          focus: string | null
          format: string | null
          generated_for_date: string | null
          id: string | null
          image_url: string | null
          instructions: string | null
          is_free: boolean | null
          is_premium: boolean | null
          is_standalone_purchase: boolean | null
          is_visible: boolean | null
          is_workout_of_day: boolean | null
          main_workout: string | null
          name: string | null
          notes: string | null
          price: number | null
          serial_number: number | null
          stripe_price_id: string | null
          stripe_product_id: string | null
          tier_required: string | null
          tips: string | null
          type: string | null
          updated_at: string | null
          warm_up: string | null
        }
        Insert: {
          activation?: never
          category?: string | null
          cool_down?: never
          created_at?: string | null
          description?: string | null
          difficulty?: string | null
          difficulty_stars?: number | null
          duration?: string | null
          equipment?: string | null
          finisher?: never
          focus?: string | null
          format?: string | null
          generated_for_date?: string | null
          id?: string | null
          image_url?: string | null
          instructions?: never
          is_free?: boolean | null
          is_premium?: boolean | null
          is_standalone_purchase?: boolean | null
          is_visible?: boolean | null
          is_workout_of_day?: boolean | null
          main_workout?: never
          name?: string | null
          notes?: never
          price?: number | null
          serial_number?: number | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          tier_required?: string | null
          tips?: never
          type?: string | null
          updated_at?: string | null
          warm_up?: never
        }
        Update: {
          activation?: never
          category?: string | null
          cool_down?: never
          created_at?: string | null
          description?: string | null
          difficulty?: string | null
          difficulty_stars?: number | null
          duration?: string | null
          equipment?: string | null
          finisher?: never
          focus?: string | null
          format?: string | null
          generated_for_date?: string | null
          id?: string | null
          image_url?: string | null
          instructions?: never
          is_free?: boolean | null
          is_premium?: boolean | null
          is_standalone_purchase?: boolean | null
          is_visible?: boolean | null
          is_workout_of_day?: boolean | null
          main_workout?: never
          name?: string | null
          notes?: never
          price?: number | null
          serial_number?: number | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          tier_required?: string | null
          tips?: never
          type?: string | null
          updated_at?: string | null
          warm_up?: never
        }
        Relationships: []
      }
      workout_activity_summary: {
        Row: {
          avg_rating: number | null
          favorites_count: number | null
          times_completed: number | null
          workout_name: string | null
          workout_type: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_rate_limit: {
        Args: {
          p_endpoint: string
          p_identifier: string
          p_max_requests?: number
          p_window_minutes?: number
        }
        Returns: boolean
      }
      corporate_subscription_billing_unchanged: {
        Args: {
          _current_period_end: string
          _id: string
          _max_users: number
          _plan_type: Database["public"]["Enums"]["corporate_plan_type"]
          _status: string
          _stripe_customer_id: string
          _stripe_subscription_id: string
        }
        Returns: boolean
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      ensure_cron_jobs: { Args: never; Returns: Json }
      exec_sql: { Args: { sql: string }; Returns: undefined }
      get_checkin_leaderboard: {
        Args: never
        Returns: {
          avatar_url: string
          consistency_score: number
          display_name: string
          user_id: string
        }[]
      }
      get_cron_heartbeat_snapshot: {
        Args: never
        Returns: {
          consecutive_failures: number
          created_at: string
          display_name: string
          edge_function_name: string
          is_active: boolean
          is_critical: boolean
          job_name: string
          live_job_active: boolean
          live_job_exists: boolean
          live_schedule: string
          metadata_last_run_at: string
          metadata_last_run_status: string
          registered_schedule: string
          scheduler_last_message: string
          scheduler_last_run_at: string
          scheduler_last_status: string
        }[]
      }
      get_cron_jobs: {
        Args: never
        Returns: {
          active: boolean
          jobname: string
          schedule: string
        }[]
      }
      get_profile_display_names: {
        Args: { user_ids: string[] }
        Returns: {
          full_name: string
          user_id: string
        }[]
      }
      get_program_leaderboard: {
        Args: never
        Returns: {
          avatar_url: string
          completed_count: number
          display_name: string
          user_id: string
        }[]
      }
      get_program_ratings: {
        Args: never
        Returns: {
          average_rating: number
          program_id: string
          program_name: string
          program_type: string
          rating_count: number
        }[]
      }
      get_public_testimonials: {
        Args: never
        Returns: {
          created_at: string
          display_name: string
          id: string
          is_mine: boolean
          rating: number
          testimonial_text: string
          updated_at: string
        }[]
      }
      get_testimonial_rating_stats: {
        Args: never
        Returns: {
          average: number
          count: number
        }[]
      }
      get_visible_program_metadata: {
        Args: { _program_id?: string }
        Returns: {
          category: string
          created_at: string
          days_per_week: number
          description: string
          difficulty: string
          difficulty_stars: number
          duration: string
          equipment: string
          expected_results: string
          id: string
          image_url: string
          is_free: boolean
          is_premium: boolean
          is_standalone_purchase: boolean
          is_visible: boolean
          name: string
          nutrition_tips: string
          overview: string
          price: number
          program_structure: string
          progression_plan: string
          serial_number: number
          stripe_price_id: string
          stripe_product_id: string
          target_audience: string
          tier_required: string
          updated_at: string
          weekly_schedule: string
          weeks: number
        }[]
      }
      get_visible_workout_metadata: {
        Args: { _workout_id?: string }
        Returns: {
          activation: string
          category: string
          cool_down: string
          created_at: string
          description: string
          difficulty: string
          difficulty_stars: number
          duration: string
          equipment: string
          finisher: string
          focus: string
          format: string
          generated_for_date: string
          id: string
          image_url: string
          instructions: string
          is_free: boolean
          is_premium: boolean
          is_standalone_purchase: boolean
          is_visible: boolean
          is_workout_of_day: boolean
          main_workout: string
          name: string
          notes: string
          price: number
          serial_number: number
          stripe_price_id: string
          stripe_product_id: string
          tier_required: string
          tips: string
          type: string
          updated_at: string
          warm_up: string
          wod_source: string
        }[]
      }
      get_website_analytics_summary: {
        Args: { end_date: string; start_date: string }
        Returns: {
          signups: number
          total_revenue: number
          total_visits: number
          unique_sessions: number
        }[]
      }
      get_workout_leaderboard: {
        Args: never
        Returns: {
          avatar_url: string
          completed_count: number
          display_name: string
          user_id: string
        }[]
      }
      get_workout_ratings: {
        Args: never
        Returns: {
          average_rating: number
          rating_count: number
          workout_id: string
          workout_name: string
          workout_type: string
        }[]
      }
      has_premium_subscription: {
        Args: { check_user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role_check: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_user_banned: { Args: { user_id_param: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      pg_cron_enabled: { Args: never; Returns: boolean }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      sync_cron_metadata_from_live_scheduler: { Args: never; Returns: number }
      user_has_active_premium_access: {
        Args: { _user_id: string }
        Returns: boolean
      }
      user_has_purchased_content: {
        Args: { _content_id: string; _content_type: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      corporate_plan_type: "dynamic" | "power" | "elite" | "enterprise"
      message_type:
        | "welcome"
        | "purchase_workout"
        | "purchase_program"
        | "purchase_personal_training"
        | "purchase_subscription"
        | "renewal_reminder"
        | "renewal_thank_you"
        | "cancellation"
        | "announcement_new_workout"
        | "announcement_new_program"
        | "announcement_new_service"
        | "announcement_special_offer"
        | "announcement_update"
        | "announcement_event"
        | "purchase_shop_product"
        | "motivational_weekly"
        | "daily_ritual"
        | "weekly_activity_report"
        | "wod_notification"
        | "checkin_reminder"
        | "subscription_expired"
        | "reactivation"
        | "support"
        | "mass_notification"
        | "new_workout"
        | "new_program"
        | "new_article"
        | "program_delivered"
        | "morning_wod"
        | "morning_wod_recovery"
        | "morning_ritual"
        | "morning_daily_digest"
        | "new_category_announcement"
        | "checkin_reminder_morning"
        | "checkin_reminder_evening"
        | "goal_achievement"
        | "welcome_onboarding"
        | "payment_failed_attempt"
        | "payment_failed_final"
      plan_type:
        | "free"
        | "gold"
        | "platinum"
        | "lifetime"
        | "legacy_premium"
        | "premium"
      subscription_status: "active" | "canceled" | "past_due"
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
      app_role: ["admin", "moderator", "user"],
      corporate_plan_type: ["dynamic", "power", "elite", "enterprise"],
      message_type: [
        "welcome",
        "purchase_workout",
        "purchase_program",
        "purchase_personal_training",
        "purchase_subscription",
        "renewal_reminder",
        "renewal_thank_you",
        "cancellation",
        "announcement_new_workout",
        "announcement_new_program",
        "announcement_new_service",
        "announcement_special_offer",
        "announcement_update",
        "announcement_event",
        "purchase_shop_product",
        "motivational_weekly",
        "daily_ritual",
        "weekly_activity_report",
        "wod_notification",
        "checkin_reminder",
        "subscription_expired",
        "reactivation",
        "support",
        "mass_notification",
        "new_workout",
        "new_program",
        "new_article",
        "program_delivered",
        "morning_wod",
        "morning_wod_recovery",
        "morning_ritual",
        "morning_daily_digest",
        "new_category_announcement",
        "checkin_reminder_morning",
        "checkin_reminder_evening",
        "goal_achievement",
        "welcome_onboarding",
        "payment_failed_attempt",
        "payment_failed_final",
      ],
      plan_type: [
        "free",
        "gold",
        "platinum",
        "lifetime",
        "legacy_premium",
        "premium",
      ],
      subscription_status: ["active", "canceled", "past_due"],
    },
  },
} as const
