import { useState, useEffect, useCallback } from "react";
import { IntelLayout } from "@/components/intel/IntelLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings, Plus, RefreshCw, Power, PowerOff, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Connectors = () => {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [connectors, setConnectors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ provider_name: "", connector_type: "youtube", endpoint_url: "", rate_limit: "60" });

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("intel_connectors").select("*").order("created_at", { ascending: false });
    setConnectors(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("intel_connectors").insert({
      provider_name: form.provider_name,
      connector_type: form.connector_type,
      endpoint_url: form.endpoint_url || null,
      rate_limit: parseInt(form.rate_limit) || 60,
    });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Connector added" }); setShowAdd(false); fetch(); }
  };

  const toggle = async (id: string, enabled: boolean) => {
    await supabase.from("intel_connectors").update({ enabled: !enabled }).eq("id", id);
    fetch();
  };

  if (!isAdmin) {
    return <IntelLayout><div className="flex items-center justify-center h-full"><Shield className="h-8 w-8 text-muted-foreground" /><p className="text-sm text-muted-foreground ml-2">Admin access required</p></div></IntelLayout>;
  }

  return (
    <IntelLayout>
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <Settings className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-mono font-bold text-foreground">CONNECTORS</h1>
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={fetch} className="h-8"><RefreshCw className="h-3.5 w-3.5" /></Button>
          <Button size="sm" onClick={() => setShowAdd(true)} className="h-8 gap-1"><Plus className="h-3.5 w-3.5" />Add</Button>
        </div>

        {showAdd && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
            <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <h2 className="text-sm font-mono font-bold mb-4">ADD CONNECTOR</h2>
              <form onSubmit={add} className="space-y-3">
                <Input placeholder="Provider Name" required value={form.provider_name} onChange={e => setForm(f => ({ ...f, provider_name: e.target.value }))} className="text-xs" />
                <select value={form.connector_type} onChange={e => setForm(f => ({ ...f, connector_type: e.target.value }))} className="w-full h-9 rounded-md border border-input bg-secondary/50 px-3 text-xs">
                  {["youtube","hls_mjpeg","webcam_page","traffic_api","weather_api","news_feed","partner_feed"].map(t => <option key={t} value={t}>{t.replace(/_/g," ")}</option>)}
                </select>
                <Input placeholder="Endpoint URL" value={form.endpoint_url} onChange={e => setForm(f => ({ ...f, endpoint_url: e.target.value }))} className="text-xs" />
                <Input placeholder="Rate Limit (req/min)" type="number" value={form.rate_limit} onChange={e => setForm(f => ({ ...f, rate_limit: e.target.value }))} className="text-xs" />
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
                  <Button type="submit" size="sm">Add Connector</Button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto p-4 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center h-32"><div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : connectors.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm mt-8">No connectors configured.</div>
          ) : connectors.map(c => (
            <div key={c.id} className="bg-card border border-border rounded-lg p-3 flex items-center gap-3 hover:border-primary/30 transition-colors">
              <div className={`h-2 w-2 rounded-full ${c.enabled ? "bg-emerald-400" : "bg-muted-foreground"}`} />
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-medium text-foreground">{c.provider_name}</h3>
                <div className="text-xs text-muted-foreground flex gap-2">
                  <span className="bg-secondary px-1.5 py-0.5 rounded">{c.connector_type.replace(/_/g," ")}</span>
                  <span>{c.rate_limit} req/min</span>
                  {c.last_sync_at && <span>Last sync: {new Date(c.last_sync_at).toLocaleString()}</span>}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => toggle(c.id, c.enabled)} className={`h-7 gap-1 ${c.enabled ? "text-emerald-400" : "text-muted-foreground"}`}>
                {c.enabled ? <Power className="h-3 w-3" /> : <PowerOff className="h-3 w-3" />}
                {c.enabled ? "ON" : "OFF"}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </IntelLayout>
  );
};

export default Connectors;
