import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json();
    const { action } = body;

    if (action === "add") {
      const { name, type, origin_lat, origin_lng, target_lat, target_lng, status, severity } = body;
      const id = `rkt-confirmed-${Date.now()}`;
      const now = new Date().toISOString();

      const { error } = await supabase.from("rockets").insert({
        id,
        name: name || "Unknown",
        type: type || "BALLISTIC",
        origin_lat,
        origin_lng,
        current_lat: origin_lat,
        current_lng: origin_lng,
        target_lat,
        target_lng,
        status: status || "launched",
        severity: severity || "critical",
        speed: 0,
        altitude: 0,
        timestamp: now,
      });

      if (error) throw error;

      // Record in launch_history
      const todayDate = now.slice(0, 10);
      const { data: existing } = await supabase
        .from("launch_history")
        .select("*")
        .eq("date", todayDate)
        .maybeSingle();

      if (existing) {
        await supabase.from("launch_history").update({
          launches: existing.launches + 1,
          updated_at: now,
        }).eq("id", existing.id);
      } else {
        await supabase.from("launch_history").insert({ date: todayDate, launches: 1 });
      }

      return new Response(JSON.stringify({ ok: true, id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_status") {
      const { id, status } = body;
      const now = new Date().toISOString();
      const { error } = await supabase.from("rockets").update({ status, timestamp: now }).eq("id", id);
      if (error) throw error;

      // Update launch history for intercept/impact
      if (status === "intercepted" || status === "impact") {
        const todayDate = now.slice(0, 10);
        const { data: hist } = await supabase.from("launch_history").select("*").eq("date", todayDate).maybeSingle();
        if (hist) {
          const update: Record<string, unknown> = { updated_at: now };
          if (status === "intercepted") update.intercepted = hist.intercepted + 1;
          else update.impact = hist.impact + 1;
          await supabase.from("launch_history").update(update).eq("id", hist.id);
        }
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const { id } = body;
      const { error } = await supabase.from("rockets").delete().eq("id", id);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "clear_all") {
      const { error } = await supabase.from("rockets").delete().neq("id", "");
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
