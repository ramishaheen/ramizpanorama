import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Cache token for reuse
let cachedToken: { access_token: string; expires_at: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires_at - 30000) {
    return cachedToken.access_token;
  }

  const username = Deno.env.get("UP42_USERNAME");
  const password = Deno.env.get("UP42_PASSWORD");
  if (!username || !password) throw new Error("UP42 credentials not configured");

  const res = await fetch("https://auth.up42.com/realms/public/protocol/openid-connect/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      username,
      password,
      grant_type: "password",
      client_id: "up42-api",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`UP42 auth failed [${res.status}]: ${body}`);
  }

  const data = await res.json();
  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in || 300) * 1000,
  };
  return cachedToken.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "search";
    const token = await getAccessToken();

    if (action === "search") {
      // Catalog search
      const { bbox, dateFrom, dateTo, maxCloudCover, collections, limit } = body;

      const searchPayload: any = {
        datetime: `${dateFrom || "2024-01-01T00:00:00Z"}/${dateTo || new Date().toISOString()}`,
        intersects: bbox ? undefined : undefined,
        bbox: bbox || [34.0, 29.0, 36.0, 32.0], // Default: Israel/Palestine area
        limit: limit || 10,
        collections: collections || ["phr", "pneo"],
        query: {
          "eo:cloud_cover": { lte: maxCloudCover ?? 20 },
        },
      };

      const res = await fetch("https://api.up42.com/v2/assets/stac/search", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(searchPayload),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("UP42 catalog search failed:", res.status, errText);
        // Return empty results on error instead of crashing
        return new Response(JSON.stringify({
          type: "FeatureCollection",
          features: [],
          context: { matched: 0, returned: 0 },
          error: `Catalog search returned ${res.status}`,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await res.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "collections") {
      const res = await fetch("https://api.up42.com/v2/assets/stac/collections", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("UP42 error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
