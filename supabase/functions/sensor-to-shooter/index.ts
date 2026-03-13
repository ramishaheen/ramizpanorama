import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const WEAPON_TARGET_MATRIX: Record<string, string[]> = {
  tank: ["hellfire", "jdam", "excalibur", "tow"],
  truck: ["hellfire", "gbu39", "30mm_cannon"],
  missile_launcher: ["jdam", "tomahawk", "hellfire", "gbu39"],
  apc: ["hellfire", "excalibur", "30mm_cannon"],
  radar: ["harm", "jdam", "tomahawk"],
  sam_site: ["harm", "jdam", "tomahawk", "sead_package"],
  artillery: ["jdam", "excalibur", "hellfire"],
  command_post: ["jdam", "tomahawk", "paveway"],
  supply_depot: ["jdam", "gbu39", "paveway"],
  dark_vessel: ["harpoon", "naval_gun", "hellfire"],
};

const ASSET_WEAPONS: Record<string, string[]> = {
  mq9_reaper: ["hellfire", "gbu39", "paveway"],
  mq1_predator: ["hellfire"],
  f35_lightning: ["jdam", "gbu39", "aim120", "harm"],
  f16_falcon: ["jdam", "paveway", "harm", "aim120"],
  ah64_apache: ["hellfire", "30mm_cannon", "hydra_70"],
  artillery_m777: ["excalibur", "he_155mm"],
  mlrs_himars: ["gmlrs", "atacms"],
  naval_destroyer: ["tomahawk", "harpoon", "naval_gun", "sm2"],
  naval_frigate: ["harpoon", "naval_gun"],
  missile_battery_patriot: ["pac3"],
};

const ASSET_SPEED_KMH: Record<string, number> = {
  mq9_reaper: 370, mq1_predator: 220, f35_lightning: 1800, f16_falcon: 2100,
  ah64_apache: 290, artillery_m777: 0, mlrs_himars: 0,
  naval_destroyer: 55, naval_frigate: 50, missile_battery_patriot: 0,
};

const WEAPON_RANGE_KM: Record<string, number> = {
  hellfire: 11, jdam: 28, gbu39: 110, excalibur: 40, harm: 150,
  tomahawk: 2500, harpoon: 280, paveway: 20, naval_gun: 38,
  "30mm_cannon": 4, hydra_70: 8, he_155mm: 30, gmlrs: 84,
  atacms: 300, pac3: 160, sm2: 170, aim120: 180, tow: 4,
  sead_package: 100,
};

const WEAPON_COST_USD: Record<string, number> = {
  hellfire: 150000, jdam: 25000, gbu39: 40000, tomahawk: 1800000,
  harpoon: 1500000, excalibur: 68000, harm: 284000, paveway: 20000,
  "30mm_cannon": 50, hydra_70: 2500, he_155mm: 800, gmlrs: 168000,
  atacms: 1500000, pac3: 5900000, sm2: 2100000, aim120: 1100000,
  tow: 93000, sead_package: 500000, naval_gun: 2000,
};

interface MatchResult {
  shooter_id: string;
  callsign: string;
  asset_type: string;
  distance_km: number;
  time_to_target_min: number;
  best_weapon: string;
  probability_of_kill: number;
  payload_match_score: number;
  roe_status: string;
  collateral_risk: string;
  cost_estimate_usd: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    let body: any = {};
    try { body = await req.json(); } catch { body = {}; }

    const { action } = body;
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // ============================================
    // ACTION: recommend — quick single-shooter match for kill chain initiation
    // ============================================
    if (action === "recommend") {
      const { target_id } = body;
      if (!target_id) throw new Error("target_id required");

      const { data: target, error: tErr } = await supabase
        .from("target_tracks").select("*").eq("id", target_id).single();
      if (tErr || !target) throw new Error("Target not found");

      const { data: shooters } = await supabase
        .from("shooter_assets")
        .select("*")
        .in("current_tasking", ["idle", "combat"])
        .eq("command_link_status", "active");

      if (!shooters?.length) {
        return new Response(JSON.stringify({ recommendation: null, reason: "No available shooters" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const targetWeapons = WEAPON_TARGET_MATRIX[target.classification] || Object.values(WEAPON_TARGET_MATRIX).flat();
      let bestMatch: { shooter: any; weapon: string; dist: number; pk: number } | null = null;

      for (const shooter of shooters) {
        const dist = haversine(shooter.lat, shooter.lng, target.lat, target.lng);
        const assetWeapons = ASSET_WEAPONS[shooter.asset_type] || [];
        const matching = assetWeapons.filter((w: string) => targetWeapons.includes(w));
        if (matching.length === 0) continue;

        const weapon = matching.reduce((best: string, w: string) => {
          const r = WEAPON_RANGE_KM[w] || 0;
          const br = WEAPON_RANGE_KM[best] || 0;
          return r >= dist && r < br ? w : (br < dist && r >= dist ? w : best);
        }, matching[0]);

        const weaponRange = WEAPON_RANGE_KM[weapon] || 50;
        const distFactor = Math.max(0, 1 - (dist / (weaponRange * 3)));
        const matchScore = matching.length / Math.max(targetWeapons.length, 1);
        const fuelFactor = shooter.fuel_remaining_pct / 100;
        const pk = Math.min(0.98, distFactor * 0.5 + matchScore * 0.3 + fuelFactor * 0.2);

        if (!bestMatch || pk > bestMatch.pk || (pk === bestMatch.pk && dist < bestMatch.dist)) {
          bestMatch = { shooter, weapon, dist, pk };
        }
      }

      if (!bestMatch) {
        return new Response(JSON.stringify({ recommendation: null, reason: "No weapon match" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        recommendation: {
          recommended_weapon: bestMatch.weapon,
          callsign: bestMatch.shooter.callsign,
          asset_type: bestMatch.shooter.asset_type,
          distance_km: Math.round(bestMatch.dist * 10) / 10,
          probability_of_kill: Math.round(bestMatch.pk * 100) / 100,
          cost_estimate_usd: WEAPON_COST_USD[bestMatch.weapon] || 0,
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ============================================
    // ACTION: match_shooters
    // ============================================
    if (action === "match_shooters") {
      const { target_track_id } = body;
      if (!target_track_id) throw new Error("target_track_id required");

      const { data: target, error: tErr } = await supabase
        .from("target_tracks").select("*").eq("id", target_track_id).single();
      if (tErr || !target) throw new Error("Target not found");

      const { data: ontMatch } = await supabase
        .from("ontology_entities")
        .select("*")
        .gte("lat", target.lat - 0.05).lte("lat", target.lat + 0.05)
        .gte("lng", target.lng - 0.05).lte("lng", target.lng + 0.05)
        .limit(5);

      const knownFriendly = ontMatch?.some((e: any) => e.affiliation === "blue");
      if (knownFriendly) {
        return new Response(JSON.stringify({
          error: "ABORT: Target correlates with BLUE FORCE entity in Ontology. IFF check FAILED.",
          iff_result: "friendly",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: shooters } = await supabase
        .from("shooter_assets")
        .select("*")
        .in("current_tasking", ["idle", "combat"])
        .eq("command_link_status", "active");

      if (!shooters?.length) {
        return new Response(JSON.stringify({ error: "No available shooters", matches: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const targetWeapons = WEAPON_TARGET_MATRIX[target.classification] || [];
      const matches: MatchResult[] = [];
      const threatLevel = target.threat_level || 3;

      for (const shooter of shooters) {
        const dist = haversine(shooter.lat, shooter.lng, target.lat, target.lng);
        const assetWeapons = ASSET_WEAPONS[shooter.asset_type] || [];
        const matchingWeapons = assetWeapons.filter((w: string) => targetWeapons.includes(w));
        if (matchingWeapons.length === 0) continue;

        const bestWeapon = matchingWeapons.reduce((best: string, w: string) => {
          const range = WEAPON_RANGE_KM[w] || 0;
          const bestRange = WEAPON_RANGE_KM[best] || 0;
          return range >= dist && range < bestRange ? w : (bestRange < dist && range >= dist ? w : best);
        }, matchingWeapons[0]);

        const weaponRange = WEAPON_RANGE_KM[bestWeapon] || 50;
        const speedKmh = ASSET_SPEED_KMH[shooter.asset_type] || 200;
        const flyDist = Math.max(0, dist - weaponRange);
        const tttMin = speedKmh > 0 ? (flyDist / speedKmh) * 60 : (dist <= weaponRange ? 0.5 : 999);

        const distFactor = Math.max(0, 1 - (dist / (weaponRange * 3)));
        const fuelFactor = shooter.fuel_remaining_pct / 100;
        const matchScore = matchingWeapons.length / Math.max(targetWeapons.length, 1);
        const threatBonus = threatLevel >= 4 ? 0.05 : 0;
        const pk = Math.min(0.98, distFactor * 0.5 + matchScore * 0.3 + fuelFactor * 0.2 + threatBonus);

        const roeStatus = shooter.roe_zone === "no_strike" ? "DENIED"
          : shooter.roe_zone === "weapons_hold" ? "HOLD"
          : shooter.roe_zone === "free_fire" ? "CLEAR"
          : "RESTRICTED — REQUIRES APPROVAL";

        const collateralRisk = dist < 5 ? "high" : dist < 20 ? "medium" : "low";
        const costEstimate = WEAPON_COST_USD[bestWeapon] || 0;

        matches.push({
          shooter_id: shooter.id, callsign: shooter.callsign, asset_type: shooter.asset_type,
          distance_km: Math.round(dist * 10) / 10, time_to_target_min: Math.round(tttMin * 10) / 10,
          best_weapon: bestWeapon, probability_of_kill: Math.round(pk * 100) / 100,
          payload_match_score: Math.round(matchScore * 100) / 100, roe_status: roeStatus,
          collateral_risk: collateralRisk, cost_estimate_usd: costEstimate,
        });
      }

      matches.sort((a, b) => a.time_to_target_min - b.time_to_target_min || b.probability_of_kill - a.probability_of_kill);
      const topMatches = matches.slice(0, 5);

      let aiReasoning = "";
      if (topMatches.length > 0) {
        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
        if (LOVABLE_API_KEY) {
          try {
            const threatLabel = ["", "MINIMAL", "LOW", "MODERATE", "HIGH", "CRITICAL"][threatLevel] || "UNKNOWN";
            const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [{
                  role: "user",
                  content: `You are a JADC2 weaponeering AI. Generate a 2-sentence tactical recommendation for this engagement:

Target: ${target.classification.toUpperCase()} at ${target.lat.toFixed(4)}°N, ${target.lng.toFixed(4)}°E, confidence ${(target.confidence * 100).toFixed(0)}%, priority ${target.priority}, threat level ${threatLevel}/5 (${threatLabel}).
Best Shooter: ${topMatches[0].callsign} (${topMatches[0].asset_type}), ${topMatches[0].distance_km}km away, weapon: ${topMatches[0].best_weapon}, Pk: ${(topMatches[0].probability_of_kill * 100).toFixed(0)}%, TTT: ${topMatches[0].time_to_target_min}min, ROE: ${topMatches[0].roe_status}, Cost: $${topMatches[0].cost_estimate_usd.toLocaleString()}.
IFF Result: ${knownFriendly ? "FRIENDLY - ABORT" : ontMatch?.length ? "CORRELATED — review ontology" : "NEW HOSTILE — no ontology match"}.
Estimated Time to Intercept: ${topMatches[0].time_to_target_min} minutes.

Be concise and military-professional.`,
                }],
                max_tokens: 150,
              }),
            });
            if (aiResp.ok) {
              const aiData = await aiResp.json();
              aiReasoning = aiData.choices?.[0]?.message?.content || "";
            }
          } catch { /* AI is optional */ }
        }
      }

      const recommendations = [];
      for (const m of topMatches) {
        const { data: rec } = await supabase.from("strike_recommendations").insert({
          target_track_id, shooter_asset_id: m.shooter_id,
          recommended_weapon: m.best_weapon, time_to_target_min: m.time_to_target_min,
          probability_of_kill: m.probability_of_kill, collateral_risk: m.collateral_risk,
          roe_status: m.roe_status, proximity_km: m.distance_km,
          payload_match_score: m.payload_match_score,
          cost_estimate_usd: m.cost_estimate_usd,
          ai_reasoning: m.shooter_id === topMatches[0].shooter_id ? aiReasoning : "",
          decision: "pending",
        }).select().single();
        if (rec) recommendations.push(rec);
      }

      return new Response(JSON.stringify({
        target, iff_result: knownFriendly ? "friendly" : ontMatch?.length ? "correlated" : "new_hostile",
        ontology_matches: ontMatch?.length || 0, matches: topMatches, recommendations, ai_reasoning: aiReasoning,
        estimated_time_to_intercept: topMatches[0]?.time_to_target_min || null,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ============================================
    // ACTION: commit_strike
    // ============================================
    if (action === "commit_strike") {
      const { recommendation_id } = body;
      if (!recommendation_id) throw new Error("recommendation_id required");

      const { data: rec } = await supabase
        .from("strike_recommendations")
        .update({ decision: "committed", decided_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", recommendation_id)
        .select("*, target_tracks(*), shooter_assets(*)")
        .single();

      if (rec) {
        await supabase.from("shooter_assets")
          .update({ current_tasking: "tasked", last_updated: new Date().toISOString() })
          .eq("id", rec.shooter_asset_id);

        if (rec.kill_chain_task_id) {
          await supabase.from("kill_chain_tasks")
            .update({ phase: "engage", status: "in_progress", updated_at: new Date().toISOString() })
            .eq("id", rec.kill_chain_task_id);
        }

        await supabase.from("action_logs").insert({
          strike_recommendation_id: recommendation_id,
          target_track_id: rec.target_track_id,
          effect: "bda_pending",
          lat: rec.target_tracks?.lat || 0,
          lng: rec.target_tracks?.lng || 0,
          bda_summary: `Strike committed: ${rec.shooter_assets?.callsign} → ${rec.target_tracks?.classification} with ${rec.recommended_weapon}`,
        });
      }

      return new Response(JSON.stringify({ success: true, recommendation: rec }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============================================
    // ACTION: discard_strike
    // ============================================
    if (action === "discard_strike") {
      const { recommendation_id, reason } = body;
      await supabase.from("strike_recommendations")
        .update({ decision: "discarded", decided_at: new Date().toISOString(), ai_reasoning: reason || "Operator discarded", updated_at: new Date().toISOString() })
        .eq("id", recommendation_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============================================
    // ACTION: slew_sensor
    // ============================================
    if (action === "slew_sensor") {
      const { lat, lng } = body;
      if (lat == null || lng == null) throw new Error("lat and lng required");

      const { data: assets } = await supabase
        .from("shooter_assets")
        .select("*")
        .in("asset_type", ["mq9_reaper", "mq1_predator"])
        .in("current_tasking", ["idle", "combat"])
        .eq("command_link_status", "active");

      if (!assets?.length) {
        return new Response(JSON.stringify({ error: "No idle ISR assets available" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const sorted = assets.sort((a: any, b: any) =>
        haversine(a.lat, a.lng, lat, lng) - haversine(b.lat, b.lng, lat, lng)
      );
      const nearest = sorted[0];
      const dist = haversine(nearest.lat, nearest.lng, lat, lng);
      const speedKmh = ASSET_SPEED_KMH[nearest.asset_type] || 300;
      const etaMin = Math.round((dist / speedKmh) * 60 * 10) / 10;

      await supabase.from("shooter_assets")
        .update({ current_tasking: "tasked", last_updated: new Date().toISOString() })
        .eq("id", nearest.id);

      return new Response(JSON.stringify({
        success: true,
        slewed_asset: {
          id: nearest.id, callsign: nearest.callsign, asset_type: nearest.asset_type,
          distance_km: Math.round(dist * 10) / 10, eta_min: etaMin,
        },
        target_coords: { lat, lng },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ============================================
    // ACTION: dark_vessel_detect
    // ============================================
    if (action === "dark_vessel_detect") {
      const { region } = body;
      const bounds = region === "bab_el_mandeb"
        ? { latMin: 12.0, latMax: 13.5, lngMin: 43.0, lngMax: 44.0 }
        : region === "hormuz"
        ? { latMin: 25.5, latMax: 27.0, lngMin: 55.5, lngMax: 57.0 }
        : { latMin: 12.0, latMax: 15.0, lngMin: 42.0, lngMax: 45.0 };

      const { data: aisVessels } = await supabase
        .from("vessels").select("*")
        .gte("lat", bounds.latMin).lte("lat", bounds.latMax)
        .gte("lng", bounds.lngMin).lte("lng", bounds.lngMax);

      const sarDetections = [
        { lat: bounds.latMin + 0.6 + Math.random() * 0.5, lng: bounds.lngMin + 0.3 + Math.random() * 0.3, hull_length_m: 120 + Math.random() * 80, sar_confidence: 0.85 + Math.random() * 0.12 },
        { lat: bounds.latMin + 0.9 + Math.random() * 0.3, lng: bounds.lngMin + 0.5 + Math.random() * 0.2, hull_length_m: 80 + Math.random() * 40, sar_confidence: 0.7 + Math.random() * 0.15 },
      ];

      const darkVessels = sarDetections.filter(sar => {
        const matched = aisVessels?.some((v: any) => haversine(sar.lat, sar.lng, v.lat, v.lng) < 2.0);
        return !matched;
      });

      const tracks = [];
      for (const dv of darkVessels) {
        const { data: track } = await supabase.from("target_tracks").insert({
          track_id: `DARK-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          classification: "truck",
          confidence: dv.sar_confidence,
          lat: dv.lat, lng: dv.lng,
          source_sensor: "satellite",
          status: "detected",
          priority: "high",
          threat_level: 4,
          ai_assessment: `DARK VESSEL: SAR hull signature (${dv.hull_length_m.toFixed(0)}m) detected with NO AIS correlation. Transponder OFF. Hull moving toward commercial shipping lane. Recommend ISR drone divert for visual ID.`,
        }).select().single();
        if (track) tracks.push(track);
      }

      const { data: drones } = await supabase
        .from("shooter_assets").select("*")
        .in("asset_type", ["mq9_reaper", "mq1_predator"])
        .in("current_tasking", ["idle", "combat"]);

      let divertAsset = null;
      if (drones?.length && tracks.length > 0) {
        const dv = tracks[0];
        const sorted = drones.sort((a: any, b: any) =>
          haversine(a.lat, a.lng, dv.lat, dv.lng) - haversine(b.lat, b.lng, dv.lat, dv.lng)
        );
        divertAsset = sorted[0];
        await supabase.from("shooter_assets")
          .update({ current_tasking: "tasked", last_updated: new Date().toISOString() })
          .eq("id", divertAsset.id);
      }

      return new Response(JSON.stringify({
        region, ais_vessels_in_region: aisVessels?.length || 0,
        sar_detections: sarDetections.length, dark_vessels_detected: darkVessels.length,
        dark_vessel_tracks: tracks,
        drone_diverted: divertAsset ? {
          callsign: divertAsset.callsign, asset_type: divertAsset.asset_type,
          distance_km: tracks[0] ? Math.round(haversine(divertAsset.lat, divertAsset.lng, tracks[0].lat, tracks[0].lng) * 10) / 10 : 0,
          eta_min: tracks[0] ? Math.round((haversine(divertAsset.lat, divertAsset.lng, tracks[0].lat, tracks[0].lng) / 370) * 60 * 10) / 10 : 0,
        } : null,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action. Use: recommend, match_shooters, commit_strike, discard_strike, slew_sensor, dark_vessel_detect" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("sensor-to-shooter error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
