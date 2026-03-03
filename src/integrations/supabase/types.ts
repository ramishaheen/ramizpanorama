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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      airspace_alerts: {
        Row: {
          active: boolean
          description: string
          id: string
          lat: number
          lng: number
          radius: number
          region: string
          severity: Database["public"]["Enums"]["severity_level"]
          timestamp: string
          type: Database["public"]["Enums"]["airspace_alert_type"]
        }
        Insert: {
          active?: boolean
          description?: string
          id: string
          lat: number
          lng: number
          radius: number
          region: string
          severity?: Database["public"]["Enums"]["severity_level"]
          timestamp?: string
          type: Database["public"]["Enums"]["airspace_alert_type"]
        }
        Update: {
          active?: boolean
          description?: string
          id?: string
          lat?: number
          lng?: number
          radius?: number
          region?: string
          severity?: Database["public"]["Enums"]["severity_level"]
          timestamp?: string
          type?: Database["public"]["Enums"]["airspace_alert_type"]
        }
        Relationships: []
      }
      geo_alerts: {
        Row: {
          id: string
          lat: number
          lng: number
          region: string
          severity: Database["public"]["Enums"]["severity_level"]
          source: string
          summary: string
          timestamp: string
          title: string
          type: Database["public"]["Enums"]["geo_alert_type"]
        }
        Insert: {
          id: string
          lat: number
          lng: number
          region: string
          severity?: Database["public"]["Enums"]["severity_level"]
          source?: string
          summary?: string
          timestamp?: string
          title: string
          type: Database["public"]["Enums"]["geo_alert_type"]
        }
        Update: {
          id?: string
          lat?: number
          lng?: number
          region?: string
          severity?: Database["public"]["Enums"]["severity_level"]
          source?: string
          summary?: string
          timestamp?: string
          title?: string
          type?: Database["public"]["Enums"]["geo_alert_type"]
        }
        Relationships: []
      }
      risk_scores: {
        Row: {
          airspace: number
          diplomatic: number
          id: string
          last_updated: string
          maritime: number
          overall: number
          sentiment: number
          trend: Database["public"]["Enums"]["risk_trend"]
        }
        Insert: {
          airspace?: number
          diplomatic?: number
          id?: string
          last_updated?: string
          maritime?: number
          overall?: number
          sentiment?: number
          trend?: Database["public"]["Enums"]["risk_trend"]
        }
        Update: {
          airspace?: number
          diplomatic?: number
          id?: string
          last_updated?: string
          maritime?: number
          overall?: number
          sentiment?: number
          trend?: Database["public"]["Enums"]["risk_trend"]
        }
        Relationships: []
      }
      timeline_events: {
        Row: {
          id: string
          severity: Database["public"]["Enums"]["severity_level"]
          timestamp: string
          title: string
          type: Database["public"]["Enums"]["timeline_event_type"]
        }
        Insert: {
          id: string
          severity?: Database["public"]["Enums"]["severity_level"]
          timestamp?: string
          title: string
          type: Database["public"]["Enums"]["timeline_event_type"]
        }
        Update: {
          id?: string
          severity?: Database["public"]["Enums"]["severity_level"]
          timestamp?: string
          title?: string
          type?: Database["public"]["Enums"]["timeline_event_type"]
        }
        Relationships: []
      }
      vessels: {
        Row: {
          destination: string | null
          flag: string
          heading: number
          id: string
          lat: number
          lng: number
          name: string
          speed: number
          timestamp: string
          type: Database["public"]["Enums"]["vessel_type"]
        }
        Insert: {
          destination?: string | null
          flag?: string
          heading?: number
          id: string
          lat: number
          lng: number
          name: string
          speed?: number
          timestamp?: string
          type?: Database["public"]["Enums"]["vessel_type"]
        }
        Update: {
          destination?: string | null
          flag?: string
          heading?: number
          id?: string
          lat?: number
          lng?: number
          name?: string
          speed?: number
          timestamp?: string
          type?: Database["public"]["Enums"]["vessel_type"]
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
      airspace_alert_type: "NOTAM" | "TFR" | "CLOSURE"
      geo_alert_type: "DIPLOMATIC" | "MILITARY" | "ECONOMIC" | "HUMANITARIAN"
      risk_trend: "rising" | "falling" | "stable"
      severity_level: "low" | "medium" | "high" | "critical"
      timeline_event_type: "airspace" | "maritime" | "alert" | "diplomatic"
      vessel_type: "MILITARY" | "CARGO" | "TANKER" | "FISHING" | "UNKNOWN"
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
      airspace_alert_type: ["NOTAM", "TFR", "CLOSURE"],
      geo_alert_type: ["DIPLOMATIC", "MILITARY", "ECONOMIC", "HUMANITARIAN"],
      risk_trend: ["rising", "falling", "stable"],
      severity_level: ["low", "medium", "high", "critical"],
      timeline_event_type: ["airspace", "maritime", "alert", "diplomatic"],
      vessel_type: ["MILITARY", "CARGO", "TANKER", "FISHING", "UNKNOWN"],
    },
  },
} as const
