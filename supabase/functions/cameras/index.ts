import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type CameraInput = {
  name: string;
  country: string;
  city: string;
  category: "traffic" | "tourism" | "ports" | "weather" | "public";
  source_type: "embed_page" | "snapshot" | "hls";
  source_name: string;
  embed_url?: string | null;
  stream_url?: string | null;
  snapshot_url?: string | null;
  lat: number;
  lng: number;
};

const extractYouTubeId = (url: string) => {
  const embed = url.match(/youtube\.com\/embed\/([^?&/]+)/i);
  if (embed?.[1]) return embed[1];

  const watch = url.match(/[?&]v=([^?&/]+)/i);
  if (watch?.[1]) return watch[1];

  return null;
};

const validateCameraUrl = async (url: string) => {
  const ytId = extractYouTubeId(url);

  try {
    if (ytId) {
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${ytId}&format=json`;
      const ytResp = await fetch(oembedUrl, { signal: AbortSignal.timeout(10000) });
      if (ytResp.ok) return { status: "active", error: null };
      return { status: "error", error: `YouTube unavailable (${ytResp.status})` };
    }

    const headResp = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });

    if (headResp.ok) return { status: "active", error: null };

    const getResp = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-512" },
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });

    if (getResp.ok) return { status: "active", error: null };

    return { status: "error", error: `HTTP ${getResp.status}` };
  } catch (e) {
    return { status: "error", error: e instanceof Error ? e.message : "Check failed" };
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    let body: Record<string, any> = {};

    if (req.method === "POST") {
      try {
        body = await req.json();
      } catch {
        body = {};
      }
    }

    const action = url.searchParams.get("action") || body.action || "list";
    const country = url.searchParams.get("country") || body.country;
    const category = url.searchParams.get("category") || body.category;
    const search = url.searchParams.get("search") || body.search;
    const cameraId = url.searchParams.get("id") || body.id;

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

    if (action === "list") {
      let query = supabase
        .from("cameras")
        .select("*")
        .eq("is_active", true)
        .order("country")
        .order("city");

      if (country) query = query.eq("country", country);
      if (category) query = query.eq("category", category);
      if (search) query = query.or(`name.ilike.%${search}%,city.ilike.%${search}%,country.ilike.%${search}%`);

      const { data, error } = await query;
      if (error) throw error;
      return new Response(JSON.stringify({ cameras: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "health_check") {
      const { data: cameras } = await supabase.from("cameras").select("*").eq("is_active", true);
      const results: any[] = [];

      for (const cam of cameras || []) {
        const urlToCheck = cam.embed_url || cam.stream_url || cam.snapshot_url;
        if (!urlToCheck) {
          await supabase
            .from("cameras")
            .update({
              status: "error",
              error_message: "No URL configured",
              last_checked_at: new Date().toISOString(),
            })
            .eq("id", cam.id);
          results.push({ id: cam.id, status: "error", reason: "No URL" });
          continue;
        }

        const check = await validateCameraUrl(urlToCheck);

        await supabase
          .from("cameras")
          .update({
            status: check.status,
            error_message: check.error,
            last_checked_at: new Date().toISOString(),
          })
          .eq("id", cam.id);

        results.push({ id: cam.id, status: check.status, reason: check.error });
      }

      return new Response(JSON.stringify({ checked: results.length, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "discover") {
      const targetCountry = country || "Middle East";
      const perplexityKey = Deno.env.get("PERPLEXITY_API_KEY");

      if (!perplexityKey) {
        return new Response(
          JSON.stringify({ error: "AI discovery unavailable (PERPLEXITY_API_KEY missing)" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const aiResp = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${perplexityKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "sonar",
          messages: [
            {
              role: "system",
              content:
                "Return only real, public webcam links that are accessible right now. Prefer YouTube live embed links and official city cams. No fabricated URLs.",
            },
            {
              role: "user",
              content: `Find up to 8 public live cameras for ${targetCountry}. Return JSON array with: name, country, city, category (traffic|tourism|ports|weather|public), source_type (embed_page), embed_url, lat, lng.`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "camera_list",
              schema: {
                type: "object",
                properties: {
                  cameras: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        country: { type: "string" },
                        city: { type: "string" },
                        category: { type: "string" },
                        source_type: { type: "string" },
                        embed_url: { type: "string" },
                        lat: { type: "number" },
                        lng: { type: "number" },
                      },
                      required: ["name", "country", "city", "category", "source_type", "embed_url", "lat", "lng"],
                    },
                  },
                },
                required: ["cameras"],
              },
            },
          },
        }),
      });

      const aiData = await aiResp.json();
      if (!aiResp.ok) {
        throw new Error(`AI discovery failed [${aiResp.status}]`);
      }

      const parsed = JSON.parse(aiData?.choices?.[0]?.message?.content || "{\"cameras\":[]}");
      const candidates: CameraInput[] = (parsed?.cameras || []).slice(0, 8);

      const { data: existing } = await supabase.from("cameras").select("embed_url");
      const existingUrls = new Set((existing || []).map((row: any) => row.embed_url).filter(Boolean));

      const inserted: any[] = [];

      for (const cam of candidates) {
        if (!cam?.embed_url || existingUrls.has(cam.embed_url)) continue;

        const check = await validateCameraUrl(cam.embed_url);
        if (check.status !== "active") continue;

        const payload = {
          name: cam.name,
          country: cam.country,
          city: cam.city,
          category: ["traffic", "tourism", "ports", "weather", "public"].includes(cam.category) ? cam.category : "public",
          source_type: "embed_page",
          source_name: "AI Discovery",
          embed_url: cam.embed_url,
          lat: Number(cam.lat) || 0,
          lng: Number(cam.lng) || 0,
          is_active: true,
          status: "active",
          last_checked_at: new Date().toISOString(),
        };

        const { data: created } = await supabase.from("cameras").insert(payload).select().single();
        if (created) inserted.push(created);
      }

      return new Response(JSON.stringify({ discovered: candidates.length, inserted: inserted.length, cameras: inserted }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST") {
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
