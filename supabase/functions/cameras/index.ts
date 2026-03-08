import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "list";
    const country = url.searchParams.get("country");
    const category = url.searchParams.get("category");
    const search = url.searchParams.get("search");
    const cameraId = url.searchParams.get("id");

    if (req.method === "GET" || (req.method === "POST" && action === "list")) {
      if (action === "countries") {
        const { data, error } = await supabase
          .from("cameras")
          .select("country")
          .eq("is_active", true);
        if (error) throw error;
        const countries = [...new Set((data || []).map((d: any) => d.country))].sort();
        return new Response(JSON.stringify({ countries }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "detail" && cameraId) {
        const { data, error } = await supabase
          .from("cameras")
          .select("*")
          .eq("id", cameraId)
          .single();
        if (error) throw error;
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // List cameras with filters
      let query = supabase.from("cameras").select("*").eq("is_active", true).order("country").order("city");
      if (country) query = query.eq("country", country);
      if (category) query = query.eq("category", category);
      if (search) query = query.or(`name.ilike.%${search}%,city.ilike.%${search}%,country.ilike.%${search}%`);

      const { data, error } = await query;
      if (error) throw error;
      return new Response(JSON.stringify({ cameras: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin CRUD via POST
    if (req.method === "POST") {
      const body = await req.json();

      if (action === "create") {
        const { data, error } = await supabase.from("cameras").insert(body.camera).select().single();
        if (error) throw error;
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "update") {
        const { data, error } = await supabase
          .from("cameras")
          .update({ ...body.camera, updated_at: new Date().toISOString() })
          .eq("id", body.id)
          .select()
          .single();
        if (error) throw error;
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "delete") {
        const { error } = await supabase.from("cameras").delete().eq("id", body.id);
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "health_check") {
        // Check all active cameras
        const { data: cameras } = await supabase.from("cameras").select("*").eq("is_active", true);
        const results: any[] = [];

        for (const cam of cameras || []) {
          const urlToCheck = cam.embed_url || cam.stream_url || cam.snapshot_url;
          if (!urlToCheck) {
            await supabase.from("cameras").update({
              status: "error",
              error_message: "No URL configured",
              last_checked_at: new Date().toISOString(),
            }).eq("id", cam.id);
            results.push({ id: cam.id, status: "error", reason: "No URL" });
            continue;
          }

          try {
            const resp = await fetch(urlToCheck, { method: "HEAD", signal: AbortSignal.timeout(10000) });
            const newStatus = resp.ok ? "active" : "error";
            await supabase.from("cameras").update({
              status: newStatus,
              error_message: resp.ok ? null : `HTTP ${resp.status}`,
              last_checked_at: new Date().toISOString(),
            }).eq("id", cam.id);
            results.push({ id: cam.id, status: newStatus });
          } catch (e) {
            await supabase.from("cameras").update({
              status: "error",
              error_message: e instanceof Error ? e.message : "Check failed",
              last_checked_at: new Date().toISOString(),
            }).eq("id", cam.id);
            results.push({ id: cam.id, status: "error" });
          }
        }

        return new Response(JSON.stringify({ checked: results.length, results }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Cameras error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
