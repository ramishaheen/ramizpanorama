import { useState, useEffect, useCallback } from "react";
import { IntelLayout } from "@/components/intel/IntelLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Edit, ExternalLink, MapPin, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ReviewQueue = () => {
  const { user, isAdmin, isAnalyst } = useAuth();
  const { toast } = useToast();
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);

  const fetchPending = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("intel_sources")
      .select("*")
      .eq("review_status", "pending")
      .order("created_at", { ascending: true });
    setSources(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  const handleReview = async (sourceId: string, action: string) => {
    // Update source
    const updatePayload: any = { review_status: action, reviewed_by: user?.id, updated_at: new Date().toISOString() };
    if (action === "approved") {
      updatePayload.public_permission_status = "confirmed_public";
      updatePayload.reliability_score = 70;
    }
    await supabase.from("intel_sources").update(updatePayload).eq("id", sourceId);

    // Create review record
    await supabase.from("source_reviews").insert([{
      source_id: sourceId,
      reviewer_id: user?.id,
      action: action as any,
      checks: {
        publicly_accessible: true,
        lawful_to_display: action === "approved",
        url_resolves: true,
        has_coordinates: true,
        not_duplicate: true,
      },
    }]);

    // Audit log
    await supabase.from("audit_logs").insert([{
      user_id: user?.id,
      action: `source_${action}`,
      entity_type: "intel_source",
      entity_id: sourceId,
    }]);

    toast({ title: `Source ${action}`, description: `Review action recorded.` });
    setSelected(null);
    fetchPending();
  };

  if (!isAdmin && !isAnalyst) {
    return (
      <IntelLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-2">
            <Shield className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">Admin or Analyst access required</p>
          </div>
        </div>
      </IntelLayout>
    );
  }

  return (
    <IntelLayout>
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <h1 className="text-lg font-mono font-bold text-foreground">REVIEW QUEUE</h1>
          <span className="text-xs text-muted-foreground font-mono bg-amber-400/10 text-amber-400 px-2 py-0.5 rounded">{sources.length} pending</span>
        </div>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32"><div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : sources.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">Queue is empty — all sources reviewed.</div>
          ) : (
            <div className="p-4 space-y-3">
              {sources.map(s => (
                <div key={s.id} className="bg-secondary/30 border border-border rounded-lg p-4 hover:border-primary/30 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-medium text-foreground truncate">{s.source_name}</h3>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{s.city ? `${s.city}, ` : ""}{s.country}</span>
                        <span className="bg-secondary px-1.5 py-0.5 rounded">{s.source_type.replace(/_/g, " ")}</span>
                        <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded">{s.category.replace(/_/g, " ")}</span>
                        {s.provider_name && <span>by {s.provider_name}</span>}
                      </div>
                      {s.source_url && (
                        <a href={s.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary mt-1 hover:underline">
                          <ExternalLink className="h-3 w-3" />{s.source_url.substring(0, 60)}...
                        </a>
                      )}
                      {s.notes && <p className="text-xs text-muted-foreground mt-1">{s.notes}</p>}
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <Button size="sm" variant="outline" onClick={() => handleReview(s.id, "needs_edits")} className="h-7 gap-1 text-amber-400 border-amber-400/30 hover:bg-amber-400/10">
                        <Edit className="h-3 w-3" />Edits
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleReview(s.id, "rejected")} className="h-7 gap-1 text-destructive border-destructive/30 hover:bg-destructive/10">
                        <XCircle className="h-3 w-3" />Reject
                      </Button>
                      <Button size="sm" onClick={() => handleReview(s.id, "approved")} className="h-7 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                        <CheckCircle className="h-3 w-3" />Approve
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </IntelLayout>
  );
};

export default ReviewQueue;
