export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      agent_analytics: {
        Row: {
          agent_id: string
          created_at: string
          dimensions: Json | null
          id: number
          metric: string
          period_end: string
          period_start: string
          value: number
        }
        Insert: {
          agent_id: string
          created_at?: string
          dimensions?: Json | null
          id?: never
          metric: string
          period_end: string
          period_start: string
          value: number
        }
        Update: {
          agent_id?: string
          created_at?: string
          dimensions?: Json | null
          id?: never
          metric?: string
          period_end?: string
          period_start?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "agent_analytics_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_configs: {
        Row: {
          agent_id: string
          config_key: string
          config_value: Json
          id: number
          is_secret: boolean
          updated_at: string
        }
        Insert: {
          agent_id: string
          config_key: string
          config_value?: Json
          id?: never
          is_secret?: boolean
          updated_at?: string
        }
        Update: {
          agent_id?: string
          config_key?: string
          config_value?: Json
          id?: never
          is_secret?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_configs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_deliverables: {
        Row: {
          agent_id: string
          content: Json
          created_at: string
          id: string
          metadata: Json | null
          output_url: string | null
          platform: string | null
          published_at: string | null
          scheduled_at: string | null
          session_id: string | null
          status: string
          title: string | null
          type: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          content?: Json
          created_at?: string
          id?: string
          metadata?: Json | null
          output_url?: string | null
          platform?: string | null
          published_at?: string | null
          scheduled_at?: string | null
          session_id?: string | null
          status?: string
          title?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          content?: Json
          created_at?: string
          id?: string
          metadata?: Json | null
          output_url?: string | null
          platform?: string | null
          published_at?: string | null
          scheduled_at?: string | null
          session_id?: string | null
          status?: string
          title?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_deliverables_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_feedback: {
        Row: {
          agent_id: string
          comment: string | null
          correction: Json | null
          created_at: string
          deliverable_id: string | null
          feedback_type: string
          id: string
          interaction_id: string | null
          rating: number | null
        }
        Insert: {
          agent_id: string
          comment?: string | null
          correction?: Json | null
          created_at?: string
          deliverable_id?: string | null
          feedback_type?: string
          id?: string
          interaction_id?: string | null
          rating?: number | null
        }
        Update: {
          agent_id?: string
          comment?: string | null
          correction?: Json | null
          created_at?: string
          deliverable_id?: string | null
          feedback_type?: string
          id?: string
          interaction_id?: string | null
          rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_feedback_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_feedback_deliverable_id_fkey"
            columns: ["deliverable_id"]
            isOneToOne: false
            referencedRelation: "agent_deliverables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_feedback_interaction_id_fkey"
            columns: ["interaction_id"]
            isOneToOne: false
            referencedRelation: "agent_interactions"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_interactions: {
        Row: {
          agent_id: string
          content: string
          created_at: string
          id: string
          latency_ms: number | null
          metadata: Json | null
          model_used: string | null
          role: string
          session_id: string
          tokens_in: number | null
          tokens_out: number | null
        }
        Insert: {
          agent_id: string
          content: string
          created_at?: string
          id?: string
          latency_ms?: number | null
          metadata?: Json | null
          model_used?: string | null
          role: string
          session_id?: string
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Update: {
          agent_id?: string
          content?: string
          created_at?: string
          id?: string
          latency_ms?: number | null
          metadata?: Json | null
          model_used?: string | null
          role?: string
          session_id?: string
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_interactions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          avatar_url: string | null
          capabilities: Json
          color: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          model: string
          name: string
          slug: string
          system_prompt: string | null
          temperature: number
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          capabilities?: Json
          color?: string | null
          created_at?: string
          description?: string | null
          id: string
          is_active?: boolean
          model?: string
          name: string
          slug: string
          system_prompt?: string | null
          temperature?: number
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          capabilities?: Json
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          model?: string
          name?: string
          slug?: string
          system_prompt?: string | null
          temperature?: number
          updated_at?: string
        }
        Relationships: []
      }
      live_data: {
        Row: {
          source: string
          payload: Json
          updated_at: string
        }
        Insert: {
          source: string
          payload?: Json
          updated_at?: string
        }
        Update: {
          source?: string
          payload?: Json
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Agent = Database["public"]["Tables"]["agents"]["Row"];
export type AgentInteraction = Database["public"]["Tables"]["agent_interactions"]["Row"];
export type AgentDeliverable = Database["public"]["Tables"]["agent_deliverables"]["Row"];
export type AgentAnalytics = Database["public"]["Tables"]["agent_analytics"]["Row"];
export type AgentFeedback = Database["public"]["Tables"]["agent_feedback"]["Row"];
export type AgentConfig = Database["public"]["Tables"]["agent_configs"]["Row"];
