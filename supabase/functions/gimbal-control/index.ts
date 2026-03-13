import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json();
    const { action } = body;

    // ── SLEW_TO_CUE: Point asset gimbal to coordinates ──
    if (action === "slew_to_cue") {
      const { asset_id, lat, lng, alt } = body;
      if (!asset_id || lat == null || lng == null) throw new Error("asset_id, lat, lng required");

      const { data: asset, error: assetErr } = await sb.from("shooter_assets")
        .select("*").eq("id", asset_id).single();
      if (assetErr || !asset) throw new Error("Asset not found");

      // Calculate ETA based on distance
      const dist = haversine(asset.lat, asset.lng, lat, lng);
      const speed_ms = (asset.speed_kts || 100) * 0.514444;
      const eta_sec = speed_ms > 0 ? Math.round(dist / speed_ms) : 0;

      // Update tasking
      await sb.from("shooter_assets").update({
        current_tasking: "tasked",
        last_updated: new Date().toISOString(),
      }).eq("id", asset_id);

      // Audit log
      await sb.from("action_logs").insert({
        lat, lng,
        effect: "unknown",
        decision_time_sec: 0,
        bda_summary: `SLEW-TO-CUE: ${asset.callsign} → ${lat.toFixed(5)}, ${lng.toFixed(5)}${alt ? ` ALT ${alt}ft` : ""}`,
      });

      return new Response(JSON.stringify({
        ok: true,
        command: "slew_to_cue",
        asset: { id: asset.id, callsign: asset.callsign, type: asset.asset_type },
        target: { lat, lng, alt: alt || null },
        distance_km: Math.round(dist / 1000 * 100) / 100,
        eta_seconds: eta_sec,
        timestamp: new Date().toISOString(),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── MISSION_TASK: Push flight plan / zone of interest ──
    if (action === "mission_task") {
      const { asset_id, waypoints, zone_of_interest } = body;
      if (!asset_id) throw new Error("asset_id required");
      if (!waypoints?.length && !zone_of_interest) throw new Error("waypoints[] or zone_of_interest required");

      const { data: asset, error: assetErr } = await sb.from("shooter_assets")
        .select("*").eq("id", asset_id).single();
      if (assetErr || !asset) throw new Error("Asset not found");

      const missionPlan = {
        mission_id: `MSN-${Date.now().toString(36).toUpperCase()}`,
        created_at: new Date().toISOString(),
        waypoints: (waypoints || []).map((wp: any, i: number) => ({
          seq: i,
          lat: wp.lat,
          lng: wp.lng,
          alt_m: wp.alt || 0,
          loiter_sec: wp.loiter_sec || 0,
          action: wp.action || "flythrough",
        })),
        zone_of_interest: zone_of_interest || null,
        status: "uploaded",
      };

      // Total distance
      let totalDist = 0;
      const wps = missionPlan.waypoints;
      if (wps.length > 0) {
        totalDist += haversine(asset.lat, asset.lng, wps[0].lat, wps[0].lng);
        for (let i = 1; i < wps.length; i++) {
          totalDist += haversine(wps[i - 1].lat, wps[i - 1].lng, wps[i].lat, wps[i].lng);
        }
      }

      await sb.from("shooter_assets").update({
        mission_plan: missionPlan,
        current_tasking: "tasked",
        last_updated: new Date().toISOString(),
      }).eq("id", asset_id);

      await sb.from("action_logs").insert({
        lat: wps[0]?.lat || asset.lat,
        lng: wps[0]?.lng || asset.lng,
        effect: "unknown",
        decision_time_sec: 0,
        bda_summary: `MISSION UPLOAD: ${asset.callsign} — ${wps.length} waypoints, ${Math.round(totalDist / 1000)}km total`,
      });

      return new Response(JSON.stringify({
        ok: true,
        command: "mission_task",
        mission: missionPlan,
        total_distance_km: Math.round(totalDist / 1000 * 100) / 100,
        asset: { id: asset.id, callsign: asset.callsign },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── WEAPON_RELEASE: Double-handshake strike command ──
    if (action === "weapon_release") {
      const { phase, asset_id, recommendation_id, nonce } = body;

      if (phase === "arm") {
        if (!asset_id || !recommendation_id) throw new Error("asset_id and recommendation_id required for arm phase");

        const { data: asset } = await sb.from("shooter_assets").select("*").eq("id", asset_id).single();
        if (!asset) throw new Error("Asset not found");

        const { data: rec } = await sb.from("strike_recommendations").select("*").eq("id", recommendation_id).single();
        if (!rec) throw new Error("Strike recommendation not found");
        if (rec.decision !== "pending") throw new Error(`Recommendation already decided: ${rec.decision}`);

        // Generate nonce
        const weaponNonce = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 30000).toISOString();

        await sb.from("shooter_assets").update({
          weapon_nonce: weaponNonce,
          weapon_nonce_expires_at: expiresAt,
        }).eq("id", asset_id);

        await sb.from("action_logs").insert({
          lat: asset.lat, lng: asset.lng,
          effect: "unknown",
          decision_time_sec: 0,
          strike_recommendation_id: recommendation_id,
          bda_summary: `WEAPON ARM: ${asset.callsign} — nonce issued, expires in 30s`,
        });

        return new Response(JSON.stringify({
          ok: true,
          phase: "armed",
          nonce: weaponNonce,
          expires_at: expiresAt,
          asset: { id: asset.id, callsign: asset.callsign },
          recommendation_id,
          warning: "WEAPON ARMED — Send phase:fire with this nonce within 30 seconds to execute",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (phase === "fire") {
        if (!asset_id || !nonce || !recommendation_id) throw new Error("asset_id, nonce, and recommendation_id required for fire phase");

        const { data: asset } = await sb.from("shooter_assets").select("*").eq("id", asset_id).single();
        if (!asset) throw new Error("Asset not found");

        // Validate nonce
        if (!asset.weapon_nonce || asset.weapon_nonce !== nonce) {
          await sb.from("action_logs").insert({
            lat: asset.lat, lng: asset.lng,
            effect: "unknown",
            decision_time_sec: 0,
            bda_summary: `WEAPON FIRE REJECTED: ${asset.callsign} — invalid nonce`,
          });
          throw new Error("Invalid nonce — re-arm required");
        }

        if (new Date(asset.weapon_nonce_expires_at) < new Date()) {
          await sb.from("shooter_assets").update({ weapon_nonce: null, weapon_nonce_expires_at: null }).eq("id", asset_id);
          throw new Error("Nonce expired — re-arm required");
        }

        // Execute strike
        const { data: rec } = await sb.from("strike_recommendations").select("*").eq("id", recommendation_id).single();
        if (!rec) throw new Error("Strike recommendation not found");

        await sb.from("strike_recommendations").update({
          decision: "approved",
          decided_at: new Date().toISOString(),
        }).eq("id", recommendation_id);

        // Clear nonce
        await sb.from("shooter_assets").update({
          weapon_nonce: null,
          weapon_nonce_expires_at: null,
          current_tasking: "engaged",
          last_updated: new Date().toISOString(),
        }).eq("id", asset_id);

        await sb.from("action_logs").insert({
          lat: rec.proximity_km ? asset.lat : 0,
          lng: rec.proximity_km ? asset.lng : 0,
          effect: "unknown",
          decision_time_sec: 0,
          strike_recommendation_id: recommendation_id,
          bda_summary: `WEAPON RELEASE EXECUTED: ${asset.callsign} — ${rec.recommended_weapon} — awaiting BDA`,
        });

        return new Response(JSON.stringify({
          ok: true,
          phase: "fired",
          asset: { id: asset.id, callsign: asset.callsign },
          weapon: rec.recommended_weapon,
          recommendation_id,
          timestamp: new Date().toISOString(),
          status: "WEAPON AWAY — BDA pending",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      throw new Error("phase must be 'arm' or 'fire'");
    }

    return new Response(JSON.stringify({ error: "Unknown action. Use: slew_to_cue, mission_task, weapon_release" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("gimbal-control error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
