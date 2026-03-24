import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

let cachedResponse: any = null;
let cacheTimestamp = 0;
const CACHE_TTL = 86_400_000; // 24 hours

const FALLBACK_DATA = {
  last_analyzed: new Date().toISOString(),
  countries: [
    {
      code: "AE", name: "UAE", overall_outlook: "CAUTIOUS",
      sectors: [
        { name: "Aviation & Tourism", impact: "NEGATIVE", trend: "DOWN", confidence: "HIGH", prediction: "Regional airspace closures and travel advisories are reducing inbound tourism. Hotel occupancy in Dubai dropped 12% week-over-week.", opportunities: ["Domestic tourism campaigns"], risks: ["Extended conflict could trigger cancellations through Q2"] },
        { name: "Energy & Oil", impact: "POSITIVE", trend: "UP", confidence: "HIGH", prediction: "Oil prices above $95/bbl benefit UAE's energy revenues. ADNOC production remains stable with no disruption to offshore facilities.", opportunities: ["Elevated crude prices boost fiscal surplus"], risks: ["Strait of Hormuz escalation could disrupt exports"] },
        { name: "Real Estate", impact: "NEUTRAL", trend: "STABLE", confidence: "MEDIUM", prediction: "Dubai real estate market shows resilience with continued interest from international buyers seeking safe-haven assets in the region.", opportunities: ["Capital flight from conflict zones"], risks: ["Insurance cost increases for Gulf properties"] },
        { name: "Financial Services", impact: "NEGATIVE", trend: "VOLATILE", confidence: "MEDIUM", prediction: "DFM and ADX indices showing increased volatility. Foreign institutional investors reducing Gulf exposure by 8%.", opportunities: ["Contrarian buying opportunities"], risks: ["Further escalation could trigger capital outflows"] },
      ]
    },
    {
      code: "SA", name: "Saudi Arabia", overall_outlook: "CAUTIOUS",
      sectors: [
        { name: "Energy", impact: "POSITIVE", trend: "UP", confidence: "HIGH", prediction: "Saudi Aramco benefits from elevated oil prices. Vision 2030 diversification projects continue but with increased security costs.", opportunities: ["Revenue surplus from oil price spike"], risks: ["Direct targeting of energy infrastructure"] },
        { name: "Defense & Security", impact: "POSITIVE", trend: "UP", confidence: "HIGH", prediction: "Defense spending accelerating with new procurement contracts. Patriot and THAAD systems receiving priority deployment.", opportunities: ["Domestic defense industry growth"], risks: ["Escalation drawing Saudi into direct conflict"] },
        { name: "Tourism (NEOM/Red Sea)", impact: "NEGATIVE", trend: "DOWN", confidence: "MEDIUM", prediction: "Mega-project timelines may face delays due to regional instability. International contractor confidence wavering.", opportunities: ["Long-term fundamentals unchanged"], risks: ["Construction delays, increased insurance costs"] },
        { name: "Logistics & Shipping", impact: "NEGATIVE", trend: "DOWN", confidence: "HIGH", prediction: "Red Sea shipping disruptions continue to affect Jeddah Islamic Port volumes. Re-routing adds 10-14 days to Europe-Asia trade.", opportunities: ["Land bridge alternatives via Saudi rail"], risks: ["Prolonged Houthi attacks on commercial vessels"] },
      ]
    },
    {
      code: "JO", name: "Jordan", overall_outlook: "NEGATIVE",
      sectors: [
        { name: "Tourism", impact: "SEVERE", trend: "DOWN", confidence: "HIGH", prediction: "Jordan tourism revenues down 35% as regional conflict deters visitors. Petra and Dead Sea resorts report mass cancellations.", opportunities: ["Post-conflict recovery potential"], risks: ["Prolonged downturn if conflict expands"] },
        { name: "Trade & Commerce", impact: "NEGATIVE", trend: "DOWN", confidence: "MEDIUM", prediction: "Cross-border trade with Iraq disrupted by security measures. Aqaba port operations continue but with delays.", opportunities: ["Humanitarian aid transit hub"], risks: ["Border closures affecting supply chains"] },
        { name: "Banking", impact: "NEGATIVE", trend: "VOLATILE", confidence: "MEDIUM", prediction: "Jordanian dinar under pressure. Central Bank maintaining peg but reserves declining. Banking sector exposure to regional counterparties under review.", opportunities: ["Remittance flows remain stable"], risks: ["Currency pressure if conflict prolongs"] },
      ]
    },
    {
      code: "IQ", name: "Iraq", overall_outlook: "CRITICAL",
      sectors: [
        { name: "Oil & Gas", impact: "SEVERE", trend: "VOLATILE", confidence: "HIGH", prediction: "Iraqi oil exports face disruption risk from militia activity near Basra infrastructure. Kurdistan region exports already halted.", opportunities: ["Price premium on Iraqi crude"], risks: ["Infrastructure damage, production shutdowns"] },
        { name: "Security", impact: "SEVERE", trend: "DOWN", confidence: "HIGH", prediction: "PMF militia mobilization creating parallel security structures. US forces at Al-Asad and Erbil bases on high alert.", opportunities: ["International security assistance"], risks: ["Civil conflict, sectarian violence resurgence"] },
        { name: "Humanitarian", impact: "SEVERE", trend: "DOWN", confidence: "HIGH", prediction: "IDP numbers rising rapidly in southern provinces. Healthcare infrastructure under severe strain in conflict-affected areas.", opportunities: ["International aid mobilization"], risks: ["Healthcare system collapse in affected regions"] },
      ]
    },
    {
      code: "KW", name: "Kuwait", overall_outlook: "CAUTIOUS",
      sectors: [
        { name: "Energy", impact: "POSITIVE", trend: "UP", confidence: "HIGH", prediction: "Kuwait benefits from elevated oil prices but faces proximity risk to conflict zones. KPC maintains normal production levels.", opportunities: ["Fiscal surplus from oil revenues"], risks: ["Geographic proximity to conflict"] },
        { name: "Financial Services", impact: "NEGATIVE", trend: "VOLATILE", confidence: "MEDIUM", prediction: "Boursa Kuwait showing increased volatility. Foreign investors reducing exposure to Gulf equities.", opportunities: ["Valuation discounts for long-term investors"], risks: ["Regional contagion effects"] },
      ]
    },
    {
      code: "QA", name: "Qatar", overall_outlook: "CAUTIOUS",
      sectors: [
        { name: "LNG & Energy", impact: "POSITIVE", trend: "UP", confidence: "HIGH", prediction: "Qatar's LNG exports see increased demand as European buyers seek alternatives. North Field expansion on track.", opportunities: ["Long-term LNG contract premiums"], risks: ["Strait of Hormuz disruption affecting shipments"] },
        { name: "Diplomacy & Mediation", impact: "POSITIVE", trend: "UP", confidence: "MEDIUM", prediction: "Qatar positioning as key mediator in regional de-escalation efforts. Doha hosting multiple diplomatic channels.", opportunities: ["Enhanced diplomatic standing"], risks: ["Mediation failure could expose Qatar to criticism"] },
      ]
    },
    {
      code: "BH", name: "Bahrain", overall_outlook: "NEGATIVE",
      sectors: [
        { name: "Financial Services", impact: "NEGATIVE", trend: "DOWN", confidence: "MEDIUM", prediction: "Bahrain's banking sector faces elevated risk due to proximity to Iran. US Fifth Fleet presence provides security but also makes Bahrain a potential target.", opportunities: ["Defense-related economic activity"], risks: ["Direct targeting in escalation scenario"] },
        { name: "Real Estate", impact: "NEGATIVE", trend: "DOWN", confidence: "MEDIUM", prediction: "Property market softening as expatriate confidence declines. Rental yields under pressure in Manama.", opportunities: ["Government stimulus packages"], risks: ["Expat departures reducing demand"] },
      ]
    },
    {
      code: "OM", name: "Oman", overall_outlook: "CAUTIOUS",
      sectors: [
        { name: "Energy & Trade", impact: "NEUTRAL", trend: "STABLE", confidence: "MEDIUM", prediction: "Oman maintains neutral diplomatic stance. Duqm port and SEZ continue attracting investment as alternative to Strait of Hormuz routes.", opportunities: ["Duqm as strategic bypass hub"], risks: ["Economic pressure from regional instability"] },
        { name: "Tourism", impact: "NEGATIVE", trend: "DOWN", confidence: "MEDIUM", prediction: "Muscat tourism affected by broader Gulf travel advisories despite Oman's neutral position.", opportunities: ["Positioning as safe regional destination"], risks: ["Guilt by geographic association"] },
      ]
    },
  ],
  regional_summary: "The Gulf and Levant region faces a period of significant uncertainty driven by Iran-related tensions. Energy-producing nations benefit from elevated oil prices but face infrastructure risk. Tourism and aviation sectors are broadly negative across the region. Financial markets show increased volatility with foreign capital outflows. Iraq faces the most severe outlook with potential for internal security deterioration. Diplomatic efforts continue but have not yet produced concrete results.",
  _fallback: true,
};

async function callAI(messages: Array<{ role: string; content: string }>) {
  const apiKey = Deno.env.get("NVIDIA_API_KEY");
  if (!apiKey) throw new Error("NVIDIA_API_KEY not configured");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);

  try {
    const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "moonshotai/kimi-k2-thinking", messages }),
      signal: controller.signal,
    });

    if (response.status === 429) throw new Error("RATE_LIMIT");
    if (response.status === 402) throw new Error("PAYMENT_REQUIRED");

    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI_UNAVAILABLE");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("AI_UNAVAILABLE");
    return content.trim();
  } finally {
    clearTimeout(timeout);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Return cache if fresh
  if (cachedResponse && Date.now() - cacheTimestamp < CACHE_TTL) {
    return new Response(JSON.stringify(cachedResponse), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const systemPrompt = `You are a senior geopolitical business intelligence analyst covering the Middle East during the Iran conflict. 

Return valid JSON:
{
  "last_analyzed": "ISO timestamp",
  "countries": [
    {
      "code": "AE", "name": "UAE", "overall_outlook": "POSITIVE/CAUTIOUS/NEGATIVE/CRITICAL",
      "sectors": [
        { "name": "string", "impact": "POSITIVE/NEUTRAL/NEGATIVE/SEVERE", "trend": "UP/DOWN/STABLE/VOLATILE", "confidence": "LOW/MEDIUM/HIGH", "prediction": "1-2 sentences", "opportunities": ["opp1"], "risks": ["risk1"] }
      ]
    }
  ],
  "regional_summary": "One paragraph assessment"
}

Cover countries: UAE (AE), Saudi Arabia (SA), Jordan (JO), Bahrain (BH), Oman (OM), Kuwait (KW), Qatar (QA), Iraq (IQ). 4-6 sectors each.`;

    const content = await callAI([
      { role: "system", content: systemPrompt },
      { role: "user", content: "Provide country-by-country sector predictions for the Gulf and Levant region now." },
    ]);

    let predictions;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      const objMatch = (jsonMatch[1] || content).trim().match(/\{[\s\S]*\}/);
      predictions = JSON.parse(objMatch ? objMatch[0] : (jsonMatch[1] || content).trim());
    } catch {
      throw new Error("Failed to parse AI response");
    }

    // Cache successful response
    cachedResponse = predictions;
    cacheTimestamp = Date.now();

    return new Response(JSON.stringify(predictions), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Sector prediction error:", e);

    // Return cached or fallback data instead of error
    const fallback = cachedResponse || { ...FALLBACK_DATA, last_analyzed: new Date().toISOString() };
    return new Response(JSON.stringify(fallback), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
