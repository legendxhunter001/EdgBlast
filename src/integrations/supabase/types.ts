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
      ai_chat_messages: {
        Row: {
          content: string
          conversation_id: string | null
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_coach_settings: {
        Row: {
          active_persona: string
          coaching_frequency: string
          created_at: string
          custom_instructions: string | null
          enabled: boolean
          id: string
          life_context: string | null
          persona_description: string
          persona_name: string
          preferred_name: string | null
          strategy_notes: string | null
          tone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active_persona?: string
          coaching_frequency?: string
          created_at?: string
          custom_instructions?: string | null
          enabled?: boolean
          id?: string
          life_context?: string | null
          persona_description?: string
          persona_name?: string
          preferred_name?: string | null
          strategy_notes?: string | null
          tone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active_persona?: string
          coaching_frequency?: string
          created_at?: string
          custom_instructions?: string | null
          enabled?: boolean
          id?: string
          life_context?: string | null
          persona_description?: string
          persona_name?: string
          preferred_name?: string | null
          strategy_notes?: string | null
          tone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      analytics_snapshots: {
        Row: {
          avg_rr: number | null
          created_at: string
          id: string
          is_final: boolean
          losses: number
          period_end: string
          period_start: string
          period_type: string
          total_pnl: number
          total_trades: number
          user_id: string
          win_rate: number | null
          wins: number
        }
        Insert: {
          avg_rr?: number | null
          created_at?: string
          id?: string
          is_final?: boolean
          losses?: number
          period_end: string
          period_start: string
          period_type: string
          total_pnl?: number
          total_trades?: number
          user_id: string
          win_rate?: number | null
          wins?: number
        }
        Update: {
          avg_rr?: number | null
          created_at?: string
          id?: string
          is_final?: boolean
          losses?: number
          period_end?: string
          period_start?: string
          period_type?: string
          total_pnl?: number
          total_trades?: number
          user_id?: string
          win_rate?: number | null
          wins?: number
        }
        Relationships: []
      }
      chart_drawings: {
        Row: {
          color: string
          created_at: string
          drawing_type: string
          id: string
          label: string | null
          points: Json
          symbol: string
          timeframe: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          drawing_type: string
          id?: string
          label?: string | null
          points: Json
          symbol: string
          timeframe?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          drawing_type?: string
          id?: string
          label?: string | null
          points?: Json
          symbol?: string
          timeframe?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          created_at: string
          goal_type: string
          id: string
          is_active: boolean
          starting_at: string
          starting_value: number | null
          target_date: string | null
          target_value: number
          user_id: string
        }
        Insert: {
          created_at?: string
          goal_type: string
          id?: string
          is_active?: boolean
          starting_at?: string
          starting_value?: number | null
          target_date?: string | null
          target_value: number
          user_id: string
        }
        Update: {
          created_at?: string
          goal_type?: string
          id?: string
          is_active?: boolean
          starting_at?: string
          starting_value?: number | null
          target_date?: string | null
          target_value?: number
          user_id?: string
        }
        Relationships: []
      }
      journal_entries: {
        Row: {
          content: string
          created_at: string
          id: string
          import_fingerprint: string | null
          is_shared: boolean
          mood: string | null
          raw_import_data: Json | null
          share_token: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          import_fingerprint?: string | null
          is_shared?: boolean
          mood?: string | null
          raw_import_data?: Json | null
          share_token?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          import_fingerprint?: string | null
          is_shared?: boolean
          mood?: string | null
          raw_import_data?: Json | null
          share_token?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      journal_images: {
        Row: {
          album: string | null
          created_at: string
          entry_id: string
          id: string
          storage_path: string
          user_id: string
        }
        Insert: {
          album?: string | null
          created_at?: string
          entry_id: string
          id?: string
          storage_path: string
          user_id: string
        }
        Update: {
          album?: string | null
          created_at?: string
          entry_id?: string
          id?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_images_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      mt5_connections: {
        Row: {
          account_number: string
          broker_server: string
          can_trade: boolean
          created_at: string
          id: string
          is_primary: boolean
          label: string | null
          last_synced_at: string | null
          metaapi_account_id: string | null
          platform: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_number: string
          broker_server: string
          can_trade?: boolean
          created_at?: string
          id?: string
          is_primary?: boolean
          label?: string | null
          last_synced_at?: string | null
          metaapi_account_id?: string | null
          platform?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_number?: string
          broker_server?: string
          can_trade?: boolean
          created_at?: string
          id?: string
          is_primary?: boolean
          label?: string | null
          last_synced_at?: string | null
          metaapi_account_id?: string | null
          platform?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_settings: {
        Row: {
          ai_coaching_summary: boolean
          created_at: string
          id: string
          rule_violation: boolean
          trade_synced: boolean
          updated_at: string
          user_id: string
          weekly_report: boolean
        }
        Insert: {
          ai_coaching_summary?: boolean
          created_at?: string
          id?: string
          rule_violation?: boolean
          trade_synced?: boolean
          updated_at?: string
          user_id: string
          weekly_report?: boolean
        }
        Update: {
          ai_coaching_summary?: boolean
          created_at?: string
          id?: string
          rule_violation?: boolean
          trade_synced?: boolean
          updated_at?: string
          user_id?: string
          weekly_report?: boolean
        }
        Relationships: []
      }
      orders: {
        Row: {
          created_at: string
          direction: string
          entry_price: number | null
          filled_at: string | null
          id: string
          metaapi_order_id: string | null
          metaapi_position_id: string | null
          mt5_connection_id: string
          order_type: string
          rejected_reason: string | null
          risk_amount: number | null
          risk_pct: number | null
          status: string
          stop_loss: number | null
          symbol: string
          take_profit: number | null
          user_id: string
          volume: number
        }
        Insert: {
          created_at?: string
          direction: string
          entry_price?: number | null
          filled_at?: string | null
          id?: string
          metaapi_order_id?: string | null
          metaapi_position_id?: string | null
          mt5_connection_id: string
          order_type: string
          rejected_reason?: string | null
          risk_amount?: number | null
          risk_pct?: number | null
          status?: string
          stop_loss?: number | null
          symbol: string
          take_profit?: number | null
          user_id: string
          volume: number
        }
        Update: {
          created_at?: string
          direction?: string
          entry_price?: number | null
          filled_at?: string | null
          id?: string
          metaapi_order_id?: string | null
          metaapi_position_id?: string | null
          mt5_connection_id?: string
          order_type?: string
          rejected_reason?: string | null
          risk_amount?: number | null
          risk_pct?: number | null
          status?: string
          stop_loss?: number | null
          symbol?: string
          take_profit?: number | null
          user_id?: string
          volume?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_mt5_connection_id_fkey"
            columns: ["mt5_connection_id"]
            isOneToOne: false
            referencedRelation: "mt5_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      price_alerts: {
        Row: {
          condition: string
          created_at: string
          id: string
          notify_email: boolean
          notify_inapp: boolean
          seen: boolean
          symbol: string
          target_price: number
          triggered: boolean
          triggered_at: string | null
          user_id: string
        }
        Insert: {
          condition: string
          created_at?: string
          id?: string
          notify_email?: boolean
          notify_inapp?: boolean
          seen?: boolean
          symbol: string
          target_price: number
          triggered?: boolean
          triggered_at?: string | null
          user_id: string
        }
        Update: {
          condition?: string
          created_at?: string
          id?: string
          notify_email?: boolean
          notify_inapp?: boolean
          seen?: boolean
          symbol?: string
          target_price?: number
          triggered?: boolean
          triggered_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          timezone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          created_at: string
          goals: string | null
          id: string
          lessons: string | null
          losses: string | null
          period: Database["public"]["Enums"]["review_period"]
          period_end: string
          period_start: string
          rating: number | null
          updated_at: string
          user_id: string
          wins: string | null
        }
        Insert: {
          created_at?: string
          goals?: string | null
          id?: string
          lessons?: string | null
          losses?: string | null
          period: Database["public"]["Enums"]["review_period"]
          period_end: string
          period_start: string
          rating?: number | null
          updated_at?: string
          user_id: string
          wins?: string | null
        }
        Update: {
          created_at?: string
          goals?: string | null
          id?: string
          lessons?: string | null
          losses?: string | null
          period?: Database["public"]["Enums"]["review_period"]
          period_end?: string
          period_start?: string
          rating?: number | null
          updated_at?: string
          user_id?: string
          wins?: string | null
        }
        Relationships: []
      }
      risk_audit_log: {
        Row: {
          account_id: string | null
          created_at: string
          detail: Json
          event: string
          id: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          detail?: Json
          event: string
          id?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          detail?: Json
          event?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      risk_rule_changes: {
        Row: {
          applied_at: string | null
          cancelled_at: string | null
          changes: Json
          effective_at: string
          id: string
          requested_at: string
          rule_id: string
          rule_table: string
          user_id: string
        }
        Insert: {
          applied_at?: string | null
          cancelled_at?: string | null
          changes: Json
          effective_at: string
          id?: string
          requested_at?: string
          rule_id: string
          rule_table: string
          user_id: string
        }
        Update: {
          applied_at?: string | null
          cancelled_at?: string | null
          changes?: Json
          effective_at?: string
          id?: string
          requested_at?: string
          rule_id?: string
          rule_table?: string
          user_id?: string
        }
        Relationships: []
      }
      risk_rules: {
        Row: {
          account_id: string | null
          allowed_sessions: string[] | null
          allowed_strategy_ids: string[] | null
          allowed_symbols: string[] | null
          cooldown_losses: number | null
          cooldown_minutes: number | null
          created_at: string
          day_reset_offset_minutes: number
          id: string
          max_daily_loss_pct: number
          max_lot_size: number | null
          max_open_positions: number | null
          max_risk_per_trade_pct: number
          max_trades_per_day: number | null
          max_weekly_loss_pct: number
          min_rr: number
          require_stop_loss: boolean
          require_strategy: boolean
          updated_at: string
          user_id: string
          warn_at_pct: number
        }
        Insert: {
          account_id?: string | null
          allowed_sessions?: string[] | null
          allowed_strategy_ids?: string[] | null
          allowed_symbols?: string[] | null
          cooldown_losses?: number | null
          cooldown_minutes?: number | null
          created_at?: string
          day_reset_offset_minutes?: number
          id?: string
          max_daily_loss_pct?: number
          max_lot_size?: number | null
          max_open_positions?: number | null
          max_risk_per_trade_pct?: number
          max_trades_per_day?: number | null
          max_weekly_loss_pct?: number
          min_rr?: number
          require_stop_loss?: boolean
          require_strategy?: boolean
          updated_at?: string
          user_id: string
          warn_at_pct?: number
        }
        Update: {
          account_id?: string | null
          allowed_sessions?: string[] | null
          allowed_strategy_ids?: string[] | null
          allowed_symbols?: string[] | null
          cooldown_losses?: number | null
          cooldown_minutes?: number | null
          created_at?: string
          day_reset_offset_minutes?: number
          id?: string
          max_daily_loss_pct?: number
          max_lot_size?: number | null
          max_open_positions?: number | null
          max_risk_per_trade_pct?: number
          max_trades_per_day?: number | null
          max_weekly_loss_pct?: number
          min_rr?: number
          require_stop_loss?: boolean
          require_strategy?: boolean
          updated_at?: string
          user_id?: string
          warn_at_pct?: number
        }
        Relationships: []
      }
      rule_evaluations: {
        Row: {
          account_id: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          input: Json
          result: Json
          user_id: string
          verdict: string
        }
        Insert: {
          account_id: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          input: Json
          result: Json
          user_id: string
          verdict: string
        }
        Update: {
          account_id?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          input?: Json
          result?: Json
          user_id?: string
          verdict?: string
        }
        Relationships: []
      }
      strategies: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          entry_rules: string | null
          exit_rules: string | null
          id: string
          market: string | null
          name: string
          risk_notes: string | null
          session: string | null
          timeframe: string | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          entry_rules?: string | null
          exit_rules?: string | null
          id?: string
          market?: string | null
          name: string
          risk_notes?: string | null
          session?: string | null
          timeframe?: string | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          entry_rules?: string | null
          exit_rules?: string | null
          id?: string
          market?: string | null
          name?: string
          risk_notes?: string | null
          session?: string | null
          timeframe?: string | null
          user_id?: string
        }
        Relationships: []
      }
      strategy_rules: {
        Row: {
          active_from: string
          allowed_sessions: string[] | null
          allowed_symbols: string[] | null
          allowed_timeframes: string[] | null
          created_at: string
          enabled: boolean
          enforcement: string
          id: string
          max_risk_pct: number | null
          max_trades_per_day: number | null
          min_rr: number | null
          name: string
          require_screenshot: boolean
          required_confirmations: string[]
          strategy_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active_from?: string
          allowed_sessions?: string[] | null
          allowed_symbols?: string[] | null
          allowed_timeframes?: string[] | null
          created_at?: string
          enabled?: boolean
          enforcement?: string
          id?: string
          max_risk_pct?: number | null
          max_trades_per_day?: number | null
          min_rr?: number | null
          name: string
          require_screenshot?: boolean
          required_confirmations?: string[]
          strategy_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active_from?: string
          allowed_sessions?: string[] | null
          allowed_symbols?: string[] | null
          allowed_timeframes?: string[] | null
          created_at?: string
          enabled?: boolean
          enforcement?: string
          id?: string
          max_risk_pct?: number | null
          max_trades_per_day?: number | null
          min_rr?: number | null
          name?: string
          require_screenshot?: boolean
          required_confirmations?: string[]
          strategy_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "strategy_rules_strategy_id_fkey"
            columns: ["strategy_id"]
            isOneToOne: false
            referencedRelation: "strategies"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      trade_screenshots: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["screenshot_kind"]
          storage_path: string
          trade_id: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["screenshot_kind"]
          storage_path: string
          trade_id: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["screenshot_kind"]
          storage_path?: string
          trade_id?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_screenshots_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_tags: {
        Row: {
          tag_id: string
          trade_id: string
        }
        Insert: {
          tag_id: string
          trade_id: string
        }
        Update: {
          tag_id?: string
          trade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_tags_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      trades: {
        Row: {
          asset: string
          commission: number | null
          confidence_rating: number | null
          created_at: string
          direction: Database["public"]["Enums"]["trade_direction"]
          emotional_state: Database["public"]["Enums"]["emotional_state"] | null
          entry_at: string | null
          entry_price: number | null
          entry_reasoning: string | null
          entry_type: string | null
          execution_notes: string | null
          exit_at: string | null
          exit_price: number | null
          exit_reasoning: string | null
          fees: number | null
          id: string
          import_fingerprint: string | null
          lessons_learned: string | null
          mistakes: string | null
          mt5_connection_id: string | null
          mt5_ticket: string | null
          notes: string | null
          pnl: number | null
          pnl_percent: number | null
          position_id: string | null
          position_size: number | null
          psychology_review: string | null
          raw_import_data: Json | null
          review_score: number | null
          risk_reward: number | null
          status: Database["public"]["Enums"]["trade_status"]
          stop_loss: number | null
          strategy_id: string | null
          swap: number | null
          take_profit: number | null
          thesis: string | null
          updated_at: string
          user_id: string
          what_went_well: string | null
        }
        Insert: {
          asset: string
          commission?: number | null
          confidence_rating?: number | null
          created_at?: string
          direction?: Database["public"]["Enums"]["trade_direction"]
          emotional_state?:
            | Database["public"]["Enums"]["emotional_state"]
            | null
          entry_at?: string | null
          entry_price?: number | null
          entry_reasoning?: string | null
          entry_type?: string | null
          execution_notes?: string | null
          exit_at?: string | null
          exit_price?: number | null
          exit_reasoning?: string | null
          fees?: number | null
          id?: string
          import_fingerprint?: string | null
          lessons_learned?: string | null
          mistakes?: string | null
          mt5_connection_id?: string | null
          mt5_ticket?: string | null
          notes?: string | null
          pnl?: number | null
          pnl_percent?: number | null
          position_id?: string | null
          position_size?: number | null
          psychology_review?: string | null
          raw_import_data?: Json | null
          review_score?: number | null
          risk_reward?: number | null
          status?: Database["public"]["Enums"]["trade_status"]
          stop_loss?: number | null
          strategy_id?: string | null
          swap?: number | null
          take_profit?: number | null
          thesis?: string | null
          updated_at?: string
          user_id: string
          what_went_well?: string | null
        }
        Update: {
          asset?: string
          commission?: number | null
          confidence_rating?: number | null
          created_at?: string
          direction?: Database["public"]["Enums"]["trade_direction"]
          emotional_state?:
            | Database["public"]["Enums"]["emotional_state"]
            | null
          entry_at?: string | null
          entry_price?: number | null
          entry_reasoning?: string | null
          entry_type?: string | null
          execution_notes?: string | null
          exit_at?: string | null
          exit_price?: number | null
          exit_reasoning?: string | null
          fees?: number | null
          id?: string
          import_fingerprint?: string | null
          lessons_learned?: string | null
          mistakes?: string | null
          mt5_connection_id?: string | null
          mt5_ticket?: string | null
          notes?: string | null
          pnl?: number | null
          pnl_percent?: number | null
          position_id?: string | null
          position_size?: number | null
          psychology_review?: string | null
          raw_import_data?: Json | null
          review_score?: number | null
          risk_reward?: number | null
          status?: Database["public"]["Enums"]["trade_status"]
          stop_loss?: number | null
          strategy_id?: string | null
          swap?: number | null
          take_profit?: number | null
          thesis?: string | null
          updated_at?: string
          user_id?: string
          what_went_well?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trades_mt5_connection_id_fkey"
            columns: ["mt5_connection_id"]
            isOneToOne: false
            referencedRelation: "mt5_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_strategy_id_fkey"
            columns: ["strategy_id"]
            isOneToOne: false
            referencedRelation: "strategies"
            referencedColumns: ["id"]
          },
        ]
      }
      trading_locks: {
        Row: {
          account_id: string | null
          created_at: string
          id: string
          reason: string
          released_at: string | null
          until: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          id?: string
          reason: string
          released_at?: string | null
          until: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          id?: string
          reason?: string
          released_at?: string | null
          until?: string
          user_id?: string
        }
        Relationships: []
      }
      trading_rules: {
        Row: {
          confirmation_tf: string | null
          created_at: string
          entry_trigger: string | null
          id: string
          max_risk_pct: number | null
          max_trades_per_day: number | null
          max_trades_per_week: number | null
          min_rr: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          confirmation_tf?: string | null
          created_at?: string
          entry_trigger?: string | null
          id?: string
          max_risk_pct?: number | null
          max_trades_per_day?: number | null
          max_trades_per_week?: number | null
          min_rr?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          confirmation_tf?: string | null
          created_at?: string
          entry_trigger?: string | null
          id?: string
          max_risk_pct?: number | null
          max_trades_per_day?: number | null
          max_trades_per_week?: number | null
          min_rr?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trading_tool_preferences: {
        Row: {
          chart_down_color: string | null
          chart_theme: string
          chart_up_color: string | null
          favorite_symbols: string[]
          last_interval: string
          last_symbol: string
          updated_at: string
          user_id: string
        }
        Insert: {
          chart_down_color?: string | null
          chart_theme?: string
          chart_up_color?: string | null
          favorite_symbols?: string[]
          last_interval?: string
          last_symbol?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          chart_down_color?: string | null
          chart_theme?: string
          chart_up_color?: string | null
          favorite_symbols?: string[]
          last_interval?: string
          last_symbol?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _looser_list: { Args: { n: string[]; o: string[] }; Returns: boolean }
      _looser_max: { Args: { n: number; o: number }; Returns: boolean }
      _looser_min: { Args: { n: number; o: number }; Returns: boolean }
      _queue_loosening: {
        Args: {
          ignore: string[]
          loosened: string[]
          n: Json
          o: Json
          p_id: string
          p_table: string
          p_user: string
        }
        Returns: Json
      }
      _removed_any: { Args: { n: string[]; o: string[] }; Returns: boolean }
      _risk_loosened: {
        Args: {
          n: Database["public"]["Tables"]["risk_rules"]["Row"]
          o: Database["public"]["Tables"]["risk_rules"]["Row"]
        }
        Returns: string[]
      }
      _strategy_loosened: {
        Args: {
          n: Database["public"]["Tables"]["strategy_rules"]["Row"]
          o: Database["public"]["Tables"]["strategy_rules"]["Row"]
        }
        Returns: string[]
      }
      apply_due_rule_changes: { Args: { p_user?: string }; Returns: number }
      cancel_rule_change: { Args: { p_id: string }; Returns: undefined }
      consume_evaluation: {
        Args: { p_id: string; p_user: string }
        Returns: Json
      }
      rule_change_delay: { Args: never; Returns: string }
    }
    Enums: {
      emotional_state:
        | "calm"
        | "confident"
        | "anxious"
        | "fearful"
        | "greedy"
        | "frustrated"
        | "excited"
        | "neutral"
      review_period: "weekly" | "monthly"
      screenshot_kind: "entry" | "exit" | "analysis"
      trade_direction: "long" | "short"
      trade_status: "open" | "closed"
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
      emotional_state: [
        "calm",
        "confident",
        "anxious",
        "fearful",
        "greedy",
        "frustrated",
        "excited",
        "neutral",
      ],
      review_period: ["weekly", "monthly"],
      screenshot_kind: ["entry", "exit", "analysis"],
      trade_direction: ["long", "short"],
      trade_status: ["open", "closed"],
    },
  },
} as const
