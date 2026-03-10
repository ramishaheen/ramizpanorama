import { useState, useEffect, useCallback } from "react";
import { IntelLayout } from "@/components/intel/IntelLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { List, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Watchlists = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [watchlists, setWatchlists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("watchlists").select("*").order("created_at", { ascending: false });
    setWatchlists(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const create = async () => {
    if (!newName.trim()) return;
    const { error } = await supabase.from("watchlists").insert({ name: newName, description: newDesc, owner_id: user?.id });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Watchlist created" }); setNewName(""); setNewDesc(""); fetch(); }
  };

  const remove = async (id: string) => {
    await supabase.from("watchlists").delete().eq("id", id);
    fetch();
  };

  return (
    <IntelLayout>
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <List className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-mono font-bold text-foreground">WATCHLISTS</h1>
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={fetch} className="h-8"><RefreshCw className="h-3.5 w-3.5" /></Button>
        </div>

        <div className="p-4 border-b border-border flex gap-2 items-end flex-wrap">
          <Input placeholder="Watchlist name" value={newName} onChange={e => setNewName(e.target.value)} className="h-8 w-48 text-xs" />
          <Input placeholder="Description" value={newDesc} onChange={e => setNewDesc(e.target.value)} className="h-8 w-64 text-xs" />
          <Button size="sm" onClick={create} className="h-8 gap-1"><Plus className="h-3.5 w-3.5" />Create</Button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center h-32"><div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : watchlists.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm mt-8">No watchlists created yet.</div>
          ) : watchlists.map(wl => (
            <div key={wl.id} className="bg-card border border-border rounded-lg p-3 flex items-center justify-between hover:border-primary/30 transition-colors">
              <div>
                <h3 className="text-sm font-medium text-foreground">{wl.name}</h3>
                {wl.description && <p className="text-xs text-muted-foreground mt-0.5">{wl.description}</p>}
                <span className="text-[10px] text-muted-foreground">{new Date(wl.created_at).toLocaleDateString()}</span>
              </div>
              <Button size="sm" variant="ghost" onClick={() => remove(wl.id)} className="text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          ))}
        </div>
      </div>
    </IntelLayout>
  );
};

export default Watchlists;
