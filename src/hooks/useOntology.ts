import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface OntologyEntity {
  id: string;
  entity_type: string;
  name: string;
  designation: string;
  description: string;
  lat: number;
  lng: number;
  last_known_at: string;
  affiliation: string;
  attributes: Record<string, any>;
  source_sensor_id: string | null;
  confidence: number;
  status: string;
  event_time: string;
  ingestion_time: string;
}

export interface OntologyRelationship {
  id: string;
  source_entity_id: string;
  target_entity_id: string;
  relationship_type: string;
  confidence: number;
  source_sensor_id: string | null;
  valid_from: string;
  valid_to: string | null;
  metadata: Record<string, any>;
}

export function useOntology() {
  const [entities, setEntities] = useState<OntologyEntity[]>([]);
  const [relationships, setRelationships] = useState<OntologyRelationship[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchEntities = useCallback(async (entityType?: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("sensor-ingest", {
        body: { action: "entities", entity_type: entityType, limit: 100 },
      });
      if (!error && data?.entities) setEntities(data.entities);
    } catch (e) {
      console.error("Failed to fetch ontology entities:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRelationships = useCallback(async (entityId?: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("sensor-ingest", {
        body: { action: "relationships", entity_id: entityId, limit: 50 },
      });
      if (!error && data?.relationships) setRelationships(data.relationships);
    } catch (e) {
      console.error("Failed to fetch relationships:", e);
    }
  }, []);

  const runCorrelation = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("sensor-ingest", {
        body: { action: "auto_correlate" },
      });
      if (error) throw error;
      return data;
    } catch (e) {
      console.error("Correlation failed:", e);
      return null;
    }
  }, []);

  useEffect(() => {
    fetchEntities();
    fetchRelationships();
    const ch = supabase
      .channel("ontology_entities_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "ontology_entities" }, () => fetchEntities())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchEntities, fetchRelationships]);

  return { entities, relationships, loading, fetchEntities, fetchRelationships, runCorrelation };
}
