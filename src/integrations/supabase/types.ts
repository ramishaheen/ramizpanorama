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
      ai_detections: {
        Row: {
          created_at: string
          detections: Json
          heading: number | null
          id: string
          lat: number
          lng: number
          object_count: number | null
          scene_summary: string | null
          source: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          detections?: Json
          heading?: number | null
          id?: string
          lat: number
          lng: number
          object_count?: number | null
          scene_summary?: string | null
          source?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          detections?: Json
          heading?: number | null
          id?: string
          lat?: number
          lng?: number
          object_count?: number | null
          scene_summary?: string | null
          source?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
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
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      camera_events: {
        Row: {
          camera_id: string
          confidence: number
          created_at: string
          detections: Json
          event_type: string
          id: string
          lat: number
          lng: number
          severity: string
          summary: string | null
          thumbnail_url: string | null
        }
        Insert: {
          camera_id: string
          confidence?: number
          created_at?: string
          detections?: Json
          event_type?: string
          id?: string
          lat?: number
          lng?: number
          severity?: string
          summary?: string | null
          thumbnail_url?: string | null
        }
        Update: {
          camera_id?: string
          confidence?: number
          created_at?: string
          detections?: Json
          event_type?: string
          id?: string
          lat?: number
          lng?: number
          severity?: string
          summary?: string | null
          thumbnail_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "camera_events_camera_id_fkey"
            columns: ["camera_id"]
            isOneToOne: false
            referencedRelation: "cameras"
            referencedColumns: ["id"]
          },
        ]
      }
      cameras: {
        Row: {
          ai_detection_enabled: boolean
          ai_event_count: number
          category: Database["public"]["Enums"]["camera_category"]
          city: string
          country: string
          created_at: string
          embed_url: string | null
          error_message: string | null
          failure_count: number
          id: string
          is_active: boolean
          is_verified: boolean | null
          last_ai_analysis_at: string | null
          last_checked_at: string | null
          lat: number
          lng: number
          name: string
          original_url: string | null
          playable_url: string | null
          proxy_url: string | null
          snapshot_url: string | null
          source_name: string
          source_type: Database["public"]["Enums"]["camera_source_type"]
          status: Database["public"]["Enums"]["camera_status"]
          stream_type_detected:
            | Database["public"]["Enums"]["stream_type_detected"]
            | null
          stream_url: string | null
          thumbnail_url: string | null
          updated_at: string
          verification_error: string | null
          verification_status: string | null
          youtube_video_id: string | null
        }
        Insert: {
          ai_detection_enabled?: boolean
          ai_event_count?: number
          category?: Database["public"]["Enums"]["camera_category"]
          city: string
          country: string
          created_at?: string
          embed_url?: string | null
          error_message?: string | null
          failure_count?: number
          id?: string
          is_active?: boolean
          is_verified?: boolean | null
          last_ai_analysis_at?: string | null
          last_checked_at?: string | null
          lat?: number
          lng?: number
          name: string
          original_url?: string | null
          playable_url?: string | null
          proxy_url?: string | null
          snapshot_url?: string | null
          source_name?: string
          source_type?: Database["public"]["Enums"]["camera_source_type"]
          status?: Database["public"]["Enums"]["camera_status"]
          stream_type_detected?:
            | Database["public"]["Enums"]["stream_type_detected"]
            | null
          stream_url?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          verification_error?: string | null
          verification_status?: string | null
          youtube_video_id?: string | null
        }
        Update: {
          ai_detection_enabled?: boolean
          ai_event_count?: number
          category?: Database["public"]["Enums"]["camera_category"]
          city?: string
          country?: string
          created_at?: string
          embed_url?: string | null
          error_message?: string | null
          failure_count?: number
          id?: string
          is_active?: boolean
          is_verified?: boolean | null
          last_ai_analysis_at?: string | null
          last_checked_at?: string | null
          lat?: number
          lng?: number
          name?: string
          original_url?: string | null
          playable_url?: string | null
          proxy_url?: string | null
          snapshot_url?: string | null
          source_name?: string
          source_type?: Database["public"]["Enums"]["camera_source_type"]
          status?: Database["public"]["Enums"]["camera_status"]
          stream_type_detected?:
            | Database["public"]["Enums"]["stream_type_detected"]
            | null
          stream_url?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          verification_error?: string | null
          verification_status?: string | null
          youtube_video_id?: string | null
        }
        Relationships: []
      }
      force_units: {
        Row: {
          affiliation: Database["public"]["Enums"]["affiliation"]
          echelon: Database["public"]["Enums"]["echelon"]
          event_time: string | null
          heading: number
          icon_sidc: string | null
          id: string
          ingestion_time: string | null
          last_updated: string
          lat: number
          lng: number
          name: string
          parent_unit_id: string | null
          source: Database["public"]["Enums"]["intel_source_type"]
          speed_kph: number
          status: Database["public"]["Enums"]["unit_status"]
          unit_type: Database["public"]["Enums"]["unit_type"]
        }
        Insert: {
          affiliation?: Database["public"]["Enums"]["affiliation"]
          echelon?: Database["public"]["Enums"]["echelon"]
          event_time?: string | null
          heading?: number
          icon_sidc?: string | null
          id?: string
          ingestion_time?: string | null
          last_updated?: string
          lat?: number
          lng?: number
          name: string
          parent_unit_id?: string | null
          source?: Database["public"]["Enums"]["intel_source_type"]
          speed_kph?: number
          status?: Database["public"]["Enums"]["unit_status"]
          unit_type?: Database["public"]["Enums"]["unit_type"]
        }
        Update: {
          affiliation?: Database["public"]["Enums"]["affiliation"]
          echelon?: Database["public"]["Enums"]["echelon"]
          event_time?: string | null
          heading?: number
          icon_sidc?: string | null
          id?: string
          ingestion_time?: string | null
          last_updated?: string
          lat?: number
          lng?: number
          name?: string
          parent_unit_id?: string | null
          source?: Database["public"]["Enums"]["intel_source_type"]
          speed_kph?: number
          status?: Database["public"]["Enums"]["unit_status"]
          unit_type?: Database["public"]["Enums"]["unit_type"]
        }
        Relationships: [
          {
            foreignKeyName: "force_units_parent_unit_id_fkey"
            columns: ["parent_unit_id"]
            isOneToOne: false
            referencedRelation: "force_units"
            referencedColumns: ["id"]
          },
        ]
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
      intel_connectors: {
        Row: {
          auth_reference: string | null
          config: Json | null
          connector_type: Database["public"]["Enums"]["connector_type"]
          created_at: string
          enabled: boolean
          endpoint_url: string | null
          id: string
          last_sync_at: string | null
          provider_name: string
          rate_limit: number | null
          updated_at: string
        }
        Insert: {
          auth_reference?: string | null
          config?: Json | null
          connector_type: Database["public"]["Enums"]["connector_type"]
          created_at?: string
          enabled?: boolean
          endpoint_url?: string | null
          id?: string
          last_sync_at?: string | null
          provider_name: string
          rate_limit?: number | null
          updated_at?: string
        }
        Update: {
          auth_reference?: string | null
          config?: Json | null
          connector_type?: Database["public"]["Enums"]["connector_type"]
          created_at?: string
          enabled?: boolean
          endpoint_url?: string | null
          id?: string
          last_sync_at?: string | null
          provider_name?: string
          rate_limit?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      intel_events: {
        Row: {
          city: string | null
          confidence: number
          country: string | null
          created_at: string
          event_type: string
          id: string
          lat: number
          lng: number
          severity: Database["public"]["Enums"]["event_severity"]
          source_id: string | null
          source_link: string | null
          summary: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          verification_status: Database["public"]["Enums"]["event_verification"]
          verified_by: string | null
        }
        Insert: {
          city?: string | null
          confidence?: number
          country?: string | null
          created_at?: string
          event_type?: string
          id?: string
          lat?: number
          lng?: number
          severity?: Database["public"]["Enums"]["event_severity"]
          source_id?: string | null
          source_link?: string | null
          summary?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["event_verification"]
          verified_by?: string | null
        }
        Update: {
          city?: string | null
          confidence?: number
          country?: string | null
          created_at?: string
          event_type?: string
          id?: string
          lat?: number
          lng?: number
          severity?: Database["public"]["Enums"]["event_severity"]
          source_id?: string | null
          source_link?: string | null
          summary?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["event_verification"]
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intel_events_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "intel_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      intel_incidents: {
        Row: {
          analyst_notes: string | null
          city: string | null
          correlation_rule: string | null
          country: string | null
          created_at: string
          created_by: string | null
          id: string
          lat: number
          lng: number
          related_event_ids: string[] | null
          related_source_ids: string[] | null
          resolved_at: string | null
          resolved_by: string | null
          severity: Database["public"]["Enums"]["event_severity"]
          status: Database["public"]["Enums"]["incident_status"]
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          analyst_notes?: string | null
          city?: string | null
          correlation_rule?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lat?: number
          lng?: number
          related_event_ids?: string[] | null
          related_source_ids?: string[] | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["event_severity"]
          status?: Database["public"]["Enums"]["incident_status"]
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          analyst_notes?: string | null
          city?: string | null
          correlation_rule?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lat?: number
          lng?: number
          related_event_ids?: string[] | null
          related_source_ids?: string[] | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["event_severity"]
          status?: Database["public"]["Enums"]["incident_status"]
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      intel_sources: {
        Row: {
          address_text: string | null
          category: Database["public"]["Enums"]["source_category"]
          city: string
          country: string
          created_at: string
          embed_url: string | null
          id: string
          last_checked_at: string | null
          lat: number
          lng: number
          notes: string | null
          ownership_type: Database["public"]["Enums"]["ownership_type"]
          playable_url: string | null
          provider_name: string | null
          public_permission_status: Database["public"]["Enums"]["permission_status"]
          reliability_score: number
          review_status: Database["public"]["Enums"]["review_status"]
          reviewed_by: string | null
          source_name: string
          source_type: Database["public"]["Enums"]["source_type"]
          source_url: string | null
          stream_type_detected: string | null
          submitted_by: string | null
          tags: string[] | null
          thumbnail_url: string | null
          updated_at: string
          youtube_video_id: string | null
        }
        Insert: {
          address_text?: string | null
          category?: Database["public"]["Enums"]["source_category"]
          city?: string
          country?: string
          created_at?: string
          embed_url?: string | null
          id?: string
          last_checked_at?: string | null
          lat?: number
          lng?: number
          notes?: string | null
          ownership_type?: Database["public"]["Enums"]["ownership_type"]
          playable_url?: string | null
          provider_name?: string | null
          public_permission_status?: Database["public"]["Enums"]["permission_status"]
          reliability_score?: number
          review_status?: Database["public"]["Enums"]["review_status"]
          reviewed_by?: string | null
          source_name: string
          source_type?: Database["public"]["Enums"]["source_type"]
          source_url?: string | null
          stream_type_detected?: string | null
          submitted_by?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          updated_at?: string
          youtube_video_id?: string | null
        }
        Update: {
          address_text?: string | null
          category?: Database["public"]["Enums"]["source_category"]
          city?: string
          country?: string
          created_at?: string
          embed_url?: string | null
          id?: string
          last_checked_at?: string | null
          lat?: number
          lng?: number
          notes?: string | null
          ownership_type?: Database["public"]["Enums"]["ownership_type"]
          playable_url?: string | null
          provider_name?: string | null
          public_permission_status?: Database["public"]["Enums"]["permission_status"]
          reliability_score?: number
          review_status?: Database["public"]["Enums"]["review_status"]
          reviewed_by?: string | null
          source_name?: string
          source_type?: Database["public"]["Enums"]["source_type"]
          source_url?: string | null
          stream_type_detected?: string | null
          submitted_by?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          updated_at?: string
          youtube_video_id?: string | null
        }
        Relationships: []
      }
      kill_chain_tasks: {
        Row: {
          approved_by: string | null
          assigned_platform: string | null
          bda_result: string | null
          created_at: string
          id: string
          notes: string | null
          phase: Database["public"]["Enums"]["kc_phase"]
          recommended_weapon: string | null
          requested_by: string | null
          status: Database["public"]["Enums"]["kc_status"]
          target_track_id: string
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          assigned_platform?: string | null
          bda_result?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          phase?: Database["public"]["Enums"]["kc_phase"]
          recommended_weapon?: string | null
          requested_by?: string | null
          status?: Database["public"]["Enums"]["kc_status"]
          target_track_id: string
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          assigned_platform?: string | null
          bda_result?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          phase?: Database["public"]["Enums"]["kc_phase"]
          recommended_weapon?: string | null
          requested_by?: string | null
          status?: Database["public"]["Enums"]["kc_status"]
          target_track_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kill_chain_tasks_target_track_id_fkey"
            columns: ["target_track_id"]
            isOneToOne: false
            referencedRelation: "target_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      launch_history: {
        Row: {
          date: string
          id: string
          impact: number
          intercepted: number
          launches: number
          updated_at: string
        }
        Insert: {
          date: string
          id?: string
          impact?: number
          intercepted?: number
          launches?: number
          updated_at?: string
        }
        Update: {
          date?: string
          id?: string
          impact?: number
          intercepted?: number
          launches?: number
          updated_at?: string
        }
        Relationships: []
      }
      ontology_entities: {
        Row: {
          affiliation: Database["public"]["Enums"]["affiliation"]
          attributes: Json
          confidence: number
          created_at: string
          description: string | null
          designation: string | null
          entity_type: Database["public"]["Enums"]["entity_type"]
          event_time: string
          id: string
          ingestion_time: string
          last_known_at: string
          lat: number
          lng: number
          name: string
          source_sensor_id: string | null
          status: string
        }
        Insert: {
          affiliation?: Database["public"]["Enums"]["affiliation"]
          attributes?: Json
          confidence?: number
          created_at?: string
          description?: string | null
          designation?: string | null
          entity_type?: Database["public"]["Enums"]["entity_type"]
          event_time?: string
          id?: string
          ingestion_time?: string
          last_known_at?: string
          lat?: number
          lng?: number
          name: string
          source_sensor_id?: string | null
          status?: string
        }
        Update: {
          affiliation?: Database["public"]["Enums"]["affiliation"]
          attributes?: Json
          confidence?: number
          created_at?: string
          description?: string | null
          designation?: string | null
          entity_type?: Database["public"]["Enums"]["entity_type"]
          event_time?: string
          id?: string
          ingestion_time?: string
          last_known_at?: string
          lat?: number
          lng?: number
          name?: string
          source_sensor_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ontology_entities_source_sensor_id_fkey"
            columns: ["source_sensor_id"]
            isOneToOne: false
            referencedRelation: "sensor_feeds"
            referencedColumns: ["id"]
          },
        ]
      }
      ontology_relationships: {
        Row: {
          confidence: number
          created_at: string
          id: string
          metadata: Json
          relationship_type: Database["public"]["Enums"]["relationship_type"]
          source_entity_id: string
          source_sensor_id: string | null
          target_entity_id: string
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          confidence?: number
          created_at?: string
          id?: string
          metadata?: Json
          relationship_type: Database["public"]["Enums"]["relationship_type"]
          source_entity_id: string
          source_sensor_id?: string | null
          target_entity_id: string
          valid_from?: string
          valid_to?: string | null
        }
        Update: {
          confidence?: number
          created_at?: string
          id?: string
          metadata?: Json
          relationship_type?: Database["public"]["Enums"]["relationship_type"]
          source_entity_id?: string
          source_sensor_id?: string | null
          target_entity_id?: string
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ontology_relationships_source_entity_id_fkey"
            columns: ["source_entity_id"]
            isOneToOne: false
            referencedRelation: "ontology_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ontology_relationships_source_sensor_id_fkey"
            columns: ["source_sensor_id"]
            isOneToOne: false
            referencedRelation: "sensor_feeds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ontology_relationships_target_entity_id_fkey"
            columns: ["target_entity_id"]
            isOneToOne: false
            referencedRelation: "ontology_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          email?: string | null
          id?: string
          updated_at?: string
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
      rockets: {
        Row: {
          altitude: number
          current_lat: number
          current_lng: number
          id: string
          name: string
          origin_lat: number
          origin_lng: number
          severity: Database["public"]["Enums"]["severity_level"]
          speed: number
          status: Database["public"]["Enums"]["rocket_status"]
          target_lat: number
          target_lng: number
          timestamp: string
          type: string
        }
        Insert: {
          altitude?: number
          current_lat: number
          current_lng: number
          id: string
          name?: string
          origin_lat: number
          origin_lng: number
          severity?: Database["public"]["Enums"]["severity_level"]
          speed?: number
          status?: Database["public"]["Enums"]["rocket_status"]
          target_lat: number
          target_lng: number
          timestamp?: string
          type?: string
        }
        Update: {
          altitude?: number
          current_lat?: number
          current_lng?: number
          id?: string
          name?: string
          origin_lat?: number
          origin_lng?: number
          severity?: Database["public"]["Enums"]["severity_level"]
          speed?: number
          status?: Database["public"]["Enums"]["rocket_status"]
          target_lat?: number
          target_lng?: number
          timestamp?: string
          type?: string
        }
        Relationships: []
      }
      sensor_feeds: {
        Row: {
          classification_level: Database["public"]["Enums"]["classification_level"]
          config: Json
          coverage_radius_km: number
          created_at: string
          data_rate_hz: number
          feed_type: Database["public"]["Enums"]["feed_type"]
          health_score: number
          id: string
          last_data_at: string | null
          lat: number
          linked_camera_id: string | null
          linked_unit_id: string | null
          lng: number
          protocol: Database["public"]["Enums"]["feed_protocol"]
          source_name: string
          status: Database["public"]["Enums"]["feed_status"]
          updated_at: string
        }
        Insert: {
          classification_level?: Database["public"]["Enums"]["classification_level"]
          config?: Json
          coverage_radius_km?: number
          created_at?: string
          data_rate_hz?: number
          feed_type: Database["public"]["Enums"]["feed_type"]
          health_score?: number
          id?: string
          last_data_at?: string | null
          lat?: number
          linked_camera_id?: string | null
          linked_unit_id?: string | null
          lng?: number
          protocol?: Database["public"]["Enums"]["feed_protocol"]
          source_name: string
          status?: Database["public"]["Enums"]["feed_status"]
          updated_at?: string
        }
        Update: {
          classification_level?: Database["public"]["Enums"]["classification_level"]
          config?: Json
          coverage_radius_km?: number
          created_at?: string
          data_rate_hz?: number
          feed_type?: Database["public"]["Enums"]["feed_type"]
          health_score?: number
          id?: string
          last_data_at?: string | null
          lat?: number
          linked_camera_id?: string | null
          linked_unit_id?: string | null
          lng?: number
          protocol?: Database["public"]["Enums"]["feed_protocol"]
          source_name?: string
          status?: Database["public"]["Enums"]["feed_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sensor_feeds_linked_camera_id_fkey"
            columns: ["linked_camera_id"]
            isOneToOne: false
            referencedRelation: "cameras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sensor_feeds_linked_unit_id_fkey"
            columns: ["linked_unit_id"]
            isOneToOne: false
            referencedRelation: "force_units"
            referencedColumns: ["id"]
          },
        ]
      }
      snapshot_analysis: {
        Row: {
          analyzed_at: string
          blockage_estimate: number | null
          change_score: number | null
          current_hash: string | null
          id: string
          motion_estimate: number | null
          occupancy_estimate: number | null
          previous_hash: string | null
          source_id: string
          visibility_estimate: number | null
        }
        Insert: {
          analyzed_at?: string
          blockage_estimate?: number | null
          change_score?: number | null
          current_hash?: string | null
          id?: string
          motion_estimate?: number | null
          occupancy_estimate?: number | null
          previous_hash?: string | null
          source_id: string
          visibility_estimate?: number | null
        }
        Update: {
          analyzed_at?: string
          blockage_estimate?: number | null
          change_score?: number | null
          current_hash?: string | null
          id?: string
          motion_estimate?: number | null
          occupancy_estimate?: number | null
          previous_hash?: string | null
          source_id?: string
          visibility_estimate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "snapshot_analysis_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "intel_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      source_health: {
        Row: {
          checked_at: string
          error_message: string | null
          failure_count: number
          id: string
          last_failure_at: string | null
          last_success_at: string | null
          response_time_ms: number | null
          source_id: string
          status: Database["public"]["Enums"]["health_status"]
        }
        Insert: {
          checked_at?: string
          error_message?: string | null
          failure_count?: number
          id?: string
          last_failure_at?: string | null
          last_success_at?: string | null
          response_time_ms?: number | null
          source_id: string
          status?: Database["public"]["Enums"]["health_status"]
        }
        Update: {
          checked_at?: string
          error_message?: string | null
          failure_count?: number
          id?: string
          last_failure_at?: string | null
          last_success_at?: string | null
          response_time_ms?: number | null
          source_id?: string
          status?: Database["public"]["Enums"]["health_status"]
        }
        Relationships: [
          {
            foreignKeyName: "source_health_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "intel_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      source_reviews: {
        Row: {
          action: Database["public"]["Enums"]["review_status"]
          checks: Json
          created_at: string
          id: string
          notes: string | null
          reviewer_id: string | null
          source_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["review_status"]
          checks?: Json
          created_at?: string
          id?: string
          notes?: string | null
          reviewer_id?: string | null
          source_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["review_status"]
          checks?: Json
          created_at?: string
          id?: string
          notes?: string | null
          reviewer_id?: string | null
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_reviews_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "intel_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      target_tracks: {
        Row: {
          ai_assessment: string | null
          analyst_notes: string | null
          analyst_verified: boolean
          classification: Database["public"]["Enums"]["target_classification"]
          confidence: number
          detected_at: string
          event_time: string | null
          id: string
          image_url: string | null
          ingestion_time: string | null
          lat: number
          lng: number
          priority: Database["public"]["Enums"]["target_priority"]
          source_sensor: Database["public"]["Enums"]["sensor_type"]
          source_sensor_id: string | null
          status: Database["public"]["Enums"]["target_status"]
          track_id: string
        }
        Insert: {
          ai_assessment?: string | null
          analyst_notes?: string | null
          analyst_verified?: boolean
          classification?: Database["public"]["Enums"]["target_classification"]
          confidence?: number
          detected_at?: string
          event_time?: string | null
          id?: string
          image_url?: string | null
          ingestion_time?: string | null
          lat?: number
          lng?: number
          priority?: Database["public"]["Enums"]["target_priority"]
          source_sensor?: Database["public"]["Enums"]["sensor_type"]
          source_sensor_id?: string | null
          status?: Database["public"]["Enums"]["target_status"]
          track_id?: string
        }
        Update: {
          ai_assessment?: string | null
          analyst_notes?: string | null
          analyst_verified?: boolean
          classification?: Database["public"]["Enums"]["target_classification"]
          confidence?: number
          detected_at?: string
          event_time?: string | null
          id?: string
          image_url?: string | null
          ingestion_time?: string | null
          lat?: number
          lng?: number
          priority?: Database["public"]["Enums"]["target_priority"]
          source_sensor?: Database["public"]["Enums"]["sensor_type"]
          source_sensor_id?: string | null
          status?: Database["public"]["Enums"]["target_status"]
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "target_tracks_source_sensor_id_fkey"
            columns: ["source_sensor_id"]
            isOneToOne: false
            referencedRelation: "sensor_feeds"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_intel_cache: {
        Row: {
          fetched_at: string
          id: string
          markers: Json
          region_focus: string
        }
        Insert: {
          fetched_at?: string
          id?: string
          markers?: Json
          region_focus?: string
        }
        Update: {
          fetched_at?: string
          id?: string
          markers?: Json
          region_focus?: string
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
      traffic_segments: {
        Row: {
          congestion_level: Database["public"]["Enums"]["congestion_level"]
          created_at: string
          id: string
          incident_severity:
            | Database["public"]["Enums"]["event_severity"]
            | null
          incident_type: string | null
          lat: number
          lng: number
          polyline_json: Json | null
          road_name: string
          source_provider: string | null
          speed_index: number | null
          updated_at: string
        }
        Insert: {
          congestion_level?: Database["public"]["Enums"]["congestion_level"]
          created_at?: string
          id?: string
          incident_severity?:
            | Database["public"]["Enums"]["event_severity"]
            | null
          incident_type?: string | null
          lat?: number
          lng?: number
          polyline_json?: Json | null
          road_name?: string
          source_provider?: string | null
          speed_index?: number | null
          updated_at?: string
        }
        Update: {
          congestion_level?: Database["public"]["Enums"]["congestion_level"]
          created_at?: string
          id?: string
          incident_severity?:
            | Database["public"]["Enums"]["event_severity"]
            | null
          incident_type?: string | null
          lat?: number
          lng?: number
          polyline_json?: Json | null
          road_name?: string
          source_provider?: string | null
          speed_index?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
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
      watchlist_items: {
        Row: {
          added_at: string
          id: string
          notes: string | null
          pinned: boolean
          source_id: string | null
          watchlist_id: string
        }
        Insert: {
          added_at?: string
          id?: string
          notes?: string | null
          pinned?: boolean
          source_id?: string | null
          watchlist_id: string
        }
        Update: {
          added_at?: string
          id?: string
          notes?: string | null
          pinned?: boolean
          source_id?: string | null
          watchlist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watchlist_items_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "intel_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watchlist_items_watchlist_id_fkey"
            columns: ["watchlist_id"]
            isOneToOne: false
            referencedRelation: "watchlists"
            referencedColumns: ["id"]
          },
        ]
      }
      watchlists: {
        Row: {
          created_at: string
          description: string | null
          filters: Json
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          filters?: Json
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          filters?: Json
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      youtube_channels: {
        Row: {
          category: string
          country: string
          created_at: string
          embed_url: string | null
          id: string
          is_live: boolean
          name: string
          original_url: string
          source_type: string
          status: string
          thumbnail_url: string | null
          updated_at: string
          youtube_channel_id: string | null
          youtube_video_id: string | null
        }
        Insert: {
          category?: string
          country?: string
          created_at?: string
          embed_url?: string | null
          id?: string
          is_live?: boolean
          name: string
          original_url: string
          source_type?: string
          status?: string
          thumbnail_url?: string | null
          updated_at?: string
          youtube_channel_id?: string | null
          youtube_video_id?: string | null
        }
        Update: {
          category?: string
          country?: string
          created_at?: string
          embed_url?: string | null
          id?: string
          is_live?: boolean
          name?: string
          original_url?: string
          source_type?: string
          status?: string
          thumbnail_url?: string | null
          updated_at?: string
          youtube_channel_id?: string | null
          youtube_video_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      affiliation: "blue" | "red" | "neutral" | "unknown"
      airspace_alert_type: "NOTAM" | "TFR" | "CLOSURE"
      app_role: "admin" | "analyst" | "viewer" | "partner"
      camera_category: "traffic" | "tourism" | "ports" | "weather" | "public"
      camera_source_type: "hls" | "snapshot" | "embed_page"
      camera_status: "active" | "inactive" | "error" | "unknown"
      classification_level: "unclassified" | "cui" | "secret" | "top_secret"
      congestion_level:
        | "free_flow"
        | "light"
        | "moderate"
        | "heavy"
        | "standstill"
        | "unknown"
      connector_type:
        | "youtube"
        | "hls_mjpeg"
        | "webcam_page"
        | "traffic_api"
        | "weather_api"
        | "news_feed"
        | "partner_feed"
      echelon:
        | "team"
        | "squad"
        | "platoon"
        | "company"
        | "battalion"
        | "brigade"
        | "division"
      entity_type:
        | "equipment"
        | "facility"
        | "unit"
        | "person"
        | "vehicle"
        | "infrastructure"
        | "weapon_system"
      event_severity: "info" | "low" | "medium" | "high" | "critical"
      event_verification:
        | "unverified"
        | "verified"
        | "dismissed"
        | "auto_detected"
      feed_protocol:
        | "api_rest"
        | "api_ws"
        | "hls_stream"
        | "rtsp"
        | "mqtt"
        | "manual"
        | "webhook"
      feed_status: "active" | "degraded" | "offline" | "maintenance"
      feed_type:
        | "satellite_eo"
        | "satellite_sar"
        | "satellite_ir"
        | "drone_fmv"
        | "drone_lidar"
        | "cctv"
        | "sigint_rf"
        | "sigint_comms"
        | "osint_social"
        | "osint_news"
        | "osint_flight"
        | "osint_maritime"
        | "ground_radar"
        | "ground_acoustic"
        | "iot_scada"
        | "iot_edge"
      geo_alert_type: "DIPLOMATIC" | "MILITARY" | "ECONOMIC" | "HUMANITARIAN"
      health_status: "online" | "intermittent" | "offline" | "unknown"
      incident_status:
        | "open"
        | "investigating"
        | "confirmed"
        | "resolved"
        | "dismissed"
      intel_source_type: "humint" | "sigint" | "imint" | "osint"
      kc_phase: "find" | "fix" | "track" | "target" | "engage" | "assess"
      kc_status:
        | "pending"
        | "in_progress"
        | "approved"
        | "rejected"
        | "complete"
      ownership_type:
        | "government"
        | "municipality"
        | "tourism_board"
        | "private_partner"
        | "community"
        | "news_media"
        | "unknown"
      permission_status:
        | "confirmed_public"
        | "assumed_public"
        | "partner_approved"
        | "pending_review"
        | "denied"
      relationship_type:
        | "occupies"
        | "commands"
        | "observes"
        | "targets"
        | "transports"
        | "supplies"
        | "defends"
        | "attacks"
      review_status:
        | "pending"
        | "approved"
        | "rejected"
        | "needs_edits"
        | "partner_only"
        | "external_link_only"
      risk_trend: "rising" | "falling" | "stable"
      rocket_status: "launched" | "in_flight" | "intercepted" | "impact"
      sensor_type: "satellite" | "drone" | "sigint"
      severity_level: "low" | "medium" | "high" | "critical"
      source_category:
        | "traffic"
        | "tourism"
        | "city_view"
        | "weather"
        | "port"
        | "airport_public"
        | "parking"
        | "event_venue_public"
        | "border_wait_time_data"
        | "road_status"
        | "incident_reporting"
      source_type:
        | "youtube_live"
        | "hls_stream"
        | "mjpeg_stream"
        | "image_snapshot"
        | "official_webcam_page"
        | "external_embed"
        | "traffic_api"
        | "incident_feed"
        | "partner_feed"
      stream_type_detected:
        | "hls"
        | "mjpeg"
        | "snapshot"
        | "embed"
        | "rtsp"
        | "unknown"
      target_classification:
        | "tank"
        | "truck"
        | "missile_launcher"
        | "apc"
        | "radar"
        | "sam_site"
        | "artillery"
        | "command_post"
        | "supply_depot"
      target_priority: "critical" | "high" | "medium" | "low"
      target_status:
        | "detected"
        | "confirmed"
        | "engaged"
        | "destroyed"
        | "bda_pending"
      timeline_event_type: "airspace" | "maritime" | "alert" | "diplomatic"
      unit_status: "active" | "destroyed" | "retreating" | "unknown"
      unit_type:
        | "infantry"
        | "armor"
        | "artillery"
        | "air_defense"
        | "naval"
        | "drone"
        | "logistics"
        | "command"
        | "special_ops"
      validation_status:
        | "valid"
        | "invalid"
        | "pending"
        | "unreachable"
        | "duplicate"
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
      affiliation: ["blue", "red", "neutral", "unknown"],
      airspace_alert_type: ["NOTAM", "TFR", "CLOSURE"],
      app_role: ["admin", "analyst", "viewer", "partner"],
      camera_category: ["traffic", "tourism", "ports", "weather", "public"],
      camera_source_type: ["hls", "snapshot", "embed_page"],
      camera_status: ["active", "inactive", "error", "unknown"],
      classification_level: ["unclassified", "cui", "secret", "top_secret"],
      congestion_level: [
        "free_flow",
        "light",
        "moderate",
        "heavy",
        "standstill",
        "unknown",
      ],
      connector_type: [
        "youtube",
        "hls_mjpeg",
        "webcam_page",
        "traffic_api",
        "weather_api",
        "news_feed",
        "partner_feed",
      ],
      echelon: [
        "team",
        "squad",
        "platoon",
        "company",
        "battalion",
        "brigade",
        "division",
      ],
      entity_type: [
        "equipment",
        "facility",
        "unit",
        "person",
        "vehicle",
        "infrastructure",
        "weapon_system",
      ],
      event_severity: ["info", "low", "medium", "high", "critical"],
      event_verification: [
        "unverified",
        "verified",
        "dismissed",
        "auto_detected",
      ],
      feed_protocol: [
        "api_rest",
        "api_ws",
        "hls_stream",
        "rtsp",
        "mqtt",
        "manual",
        "webhook",
      ],
      feed_status: ["active", "degraded", "offline", "maintenance"],
      feed_type: [
        "satellite_eo",
        "satellite_sar",
        "satellite_ir",
        "drone_fmv",
        "drone_lidar",
        "cctv",
        "sigint_rf",
        "sigint_comms",
        "osint_social",
        "osint_news",
        "osint_flight",
        "osint_maritime",
        "ground_radar",
        "ground_acoustic",
        "iot_scada",
        "iot_edge",
      ],
      geo_alert_type: ["DIPLOMATIC", "MILITARY", "ECONOMIC", "HUMANITARIAN"],
      health_status: ["online", "intermittent", "offline", "unknown"],
      incident_status: [
        "open",
        "investigating",
        "confirmed",
        "resolved",
        "dismissed",
      ],
      intel_source_type: ["humint", "sigint", "imint", "osint"],
      kc_phase: ["find", "fix", "track", "target", "engage", "assess"],
      kc_status: ["pending", "in_progress", "approved", "rejected", "complete"],
      ownership_type: [
        "government",
        "municipality",
        "tourism_board",
        "private_partner",
        "community",
        "news_media",
        "unknown",
      ],
      permission_status: [
        "confirmed_public",
        "assumed_public",
        "partner_approved",
        "pending_review",
        "denied",
      ],
      relationship_type: [
        "occupies",
        "commands",
        "observes",
        "targets",
        "transports",
        "supplies",
        "defends",
        "attacks",
      ],
      review_status: [
        "pending",
        "approved",
        "rejected",
        "needs_edits",
        "partner_only",
        "external_link_only",
      ],
      risk_trend: ["rising", "falling", "stable"],
      rocket_status: ["launched", "in_flight", "intercepted", "impact"],
      sensor_type: ["satellite", "drone", "sigint"],
      severity_level: ["low", "medium", "high", "critical"],
      source_category: [
        "traffic",
        "tourism",
        "city_view",
        "weather",
        "port",
        "airport_public",
        "parking",
        "event_venue_public",
        "border_wait_time_data",
        "road_status",
        "incident_reporting",
      ],
      source_type: [
        "youtube_live",
        "hls_stream",
        "mjpeg_stream",
        "image_snapshot",
        "official_webcam_page",
        "external_embed",
        "traffic_api",
        "incident_feed",
        "partner_feed",
      ],
      stream_type_detected: [
        "hls",
        "mjpeg",
        "snapshot",
        "embed",
        "rtsp",
        "unknown",
      ],
      target_classification: [
        "tank",
        "truck",
        "missile_launcher",
        "apc",
        "radar",
        "sam_site",
        "artillery",
        "command_post",
        "supply_depot",
      ],
      target_priority: ["critical", "high", "medium", "low"],
      target_status: [
        "detected",
        "confirmed",
        "engaged",
        "destroyed",
        "bda_pending",
      ],
      timeline_event_type: ["airspace", "maritime", "alert", "diplomatic"],
      unit_status: ["active", "destroyed", "retreating", "unknown"],
      unit_type: [
        "infantry",
        "armor",
        "artillery",
        "air_defense",
        "naval",
        "drone",
        "logistics",
        "command",
        "special_ops",
      ],
      validation_status: [
        "valid",
        "invalid",
        "pending",
        "unreachable",
        "duplicate",
      ],
      vessel_type: ["MILITARY", "CARGO", "TANKER", "FISHING", "UNKNOWN"],
    },
  },
} as const
