const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PlatformCheck {
  name: string;
  url: string;
  category: string;
}

interface PlatformResult {
  platform: string;
  url: string;
  category: string;
  status: "found" | "not_found" | "error";
  http_status?: number;
  response_time_ms: number;
}

const PLATFORMS: PlatformCheck[] = [
  { name: "Facebook", url: "https://www.facebook.com/{}", category: "social" },
  { name: "Instagram", url: "https://www.instagram.com/{}", category: "social" },
  { name: "Twitter / X", url: "https://x.com/{}", category: "social" },
  { name: "TikTok", url: "https://www.tiktok.com/@{}", category: "social" },
  { name: "LinkedIn", url: "https://www.linkedin.com/in/{}", category: "professional" },
  { name: "GitHub", url: "https://api.github.com/users/{}", category: "coding" },
  { name: "Reddit", url: "https://www.reddit.com/user/{}/about.json", category: "social" },
  { name: "YouTube", url: "https://www.youtube.com/@{}", category: "social" },
  { name: "Pinterest", url: "https://www.pinterest.com/{}", category: "social" },
  { name: "Tumblr", url: "https://api.tumblr.com/v2/blog/{}.tumblr.com/info", category: "blog" },
  { name: "Medium", url: "https://medium.com/@{}", category: "blog" },
  { name: "Twitch", url: "https://www.twitch.tv/{}", category: "social" },
  { name: "Telegram", url: "https://t.me/{}", category: "social" },
  { name: "VK", url: "https://vk.com/{}", category: "social" },
  { name: "Steam", url: "https://steamcommunity.com/id/{}", category: "gaming" },
  { name: "Spotify", url: "https://open.spotify.com/user/{}", category: "music" },
  { name: "SoundCloud", url: "https://soundcloud.com/{}", category: "music" },
  { name: "DeviantArt", url: "https://www.deviantart.com/{}", category: "art" },
  { name: "Flickr", url: "https://www.flickr.com/people/{}", category: "photo" },
  { name: "Dribbble", url: "https://dribbble.com/{}", category: "design" },
  { name: "Behance", url: "https://www.behance.net/{}", category: "design" },
  { name: "GitLab", url: "https://gitlab.com/api/v4/users?username={}", category: "coding" },
  { name: "Bitbucket", url: "https://bitbucket.org/api/2.0/users/{}", category: "coding" },
  { name: "HackerNews", url: "https://hacker-news.firebaseio.com/v0/user/{}.json", category: "tech" },
  { name: "Keybase", url: "https://keybase.io/_/api/1.0/user/lookup.json?usernames={}", category: "security" },
  { name: "Mastodon", url: "https://mastodon.social/@{}", category: "social" },
  { name: "Patreon", url: "https://www.patreon.com/{}", category: "social" },
  { name: "About.me", url: "https://about.me/{}", category: "personal" },
  { name: "Gravatar", url: "https://en.gravatar.com/{}", category: "personal" },
  { name: "Imgur", url: "https://imgur.com/user/{}", category: "photo" },
  { name: "Quora", url: "https://www.quora.com/profile/{}", category: "social" },
  { name: "Vimeo", url: "https://vimeo.com/{}", category: "social" },
  { name: "Roblox", url: "https://www.roblox.com/user.aspx?username={}", category: "gaming" },
  { name: "Chess.com", url: "https://api.chess.com/pub/player/{}", category: "gaming" },
  { name: "Lichess", url: "https://lichess.org/api/user/{}", category: "gaming" },
  { name: "ProductHunt", url: "https://www.producthunt.com/@{}", category: "tech" },
  { name: "Codepen", url: "https://codepen.io/{}", category: "coding" },
  { name: "Replit", url: "https://replit.com/@{}", category: "coding" },
  { name: "NPM", url: "https://www.npmjs.com/~{}", category: "coding" },
  { name: "PyPI", url: "https://pypi.org/user/{}", category: "coding" },
  { name: "Linktree", url: "https://linktr.ee/{}", category: "personal" },
  { name: "BuyMeACoffee", url: "https://buymeacoffee.com/{}", category: "personal" },
  { name: "Ko-fi", url: "https://ko-fi.com/{}", category: "personal" },
  { name: "Substack", url: "https://{}.substack.com", category: "blog" },
  { name: "WordPress", url: "https://{}.wordpress.com", category: "blog" },
];

// Known patterns for "not found" — platform returns 200 but with error content
const NOT_FOUND_BODY_PATTERNS: Record<string, string[]> = {
  "Reddit": ['"error": 404', "page not found"],
  "Tumblr": ['"status":404', '"msg":"Not Found"'],
  "HackerNews": ["null"],
  "GitLab": ["[]"],
};

async function checkPlatform(p: PlatformCheck, username: string): Promise<PlatformResult> {
  const url = p.url.replace("{}", username);
  const displayUrl = p.name === "GitHub"
    ? `https://github.com/${username}`
    : p.name === "Reddit"
    ? `https://www.reddit.com/user/${username}`
    : p.name === "GitLab"
    ? `https://gitlab.com/${username}`
    : p.name === "HackerNews"
    ? `https://news.ycombinator.com/user?id=${username}`
    : p.name === "Keybase"
    ? `https://keybase.io/${username}`
    : p.name === "Chess.com"
    ? `https://www.chess.com/member/${username}`
    : p.name === "Lichess"
    ? `https://lichess.org/@/${username}`
    : p.name === "Bitbucket"
    ? `https://bitbucket.org/${username}`
    : url;

  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/json",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    const elapsed = Date.now() - start;
    const status = res.status;

    // Clear 404
    if (status === 404 || status === 410) {
      await res.text();
      return { platform: p.name, url: displayUrl, category: p.category, status: "not_found", http_status: status, response_time_ms: elapsed };
    }

    // Check body patterns for false-positive 200s
    if (NOT_FOUND_BODY_PATTERNS[p.name]) {
      const body = await res.text();
      const lower = body.toLowerCase();
      const isNotFound = NOT_FOUND_BODY_PATTERNS[p.name].some(pat => lower.includes(pat.toLowerCase()));
      if (isNotFound) {
        return { platform: p.name, url: displayUrl, category: p.category, status: "not_found", http_status: status, response_time_ms: elapsed };
      }
    } else {
      await res.text();
    }

    // 200-range = found
    if (status >= 200 && status < 400) {
      return { platform: p.name, url: displayUrl, category: p.category, status: "found", http_status: status, response_time_ms: elapsed };
    }

    // 403 could mean profile exists but is private
    if (status === 403) {
      return { platform: p.name, url: displayUrl, category: p.category, status: "found", http_status: status, response_time_ms: elapsed };
    }

    return { platform: p.name, url: displayUrl, category: p.category, status: "not_found", http_status: status, response_time_ms: elapsed };
  } catch (e) {
    const elapsed = Date.now() - start;
    return { platform: p.name, url: displayUrl, category: p.category, status: "error", response_time_ms: elapsed };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { username } = await req.json();
    if (!username || typeof username !== "string" || username.length < 2) {
      return new Response(JSON.stringify({ error: "Invalid username" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleaned = username.trim().replace(/[^a-zA-Z0-9._-]/g, "");

    // Run all checks in parallel with concurrency limit
    const CONCURRENCY = 10;
    const results: PlatformResult[] = [];
    const queue = [...PLATFORMS];

    const workers = Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length > 0) {
        const p = queue.shift();
        if (!p) break;
        const result = await checkPlatform(p, cleaned);
        results.push(result);
      }
    });

    await Promise.all(workers);

    // Sort: found first, then by category
    results.sort((a, b) => {
      if (a.status === "found" && b.status !== "found") return -1;
      if (a.status !== "found" && b.status === "found") return 1;
      return a.platform.localeCompare(b.platform);
    });

    const found = results.filter(r => r.status === "found");
    const categories = [...new Set(found.map(r => r.category))];
    const avgResponseTime = Math.round(results.reduce((s, r) => s + r.response_time_ms, 0) / results.length);

    // Build relationship data for graph
    const relationships = categories.map(cat => ({
      category: cat,
      platforms: found.filter(r => r.category === cat).map(r => r.platform),
    }));

    return new Response(JSON.stringify({
      username: cleaned,
      total_checked: results.length,
      found_count: found.length,
      not_found_count: results.filter(r => r.status === "not_found").length,
      error_count: results.filter(r => r.status === "error").length,
      avg_response_time_ms: avgResponseTime,
      results,
      relationships,
      categories_active: categories,
      scan_time: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Social analyzer error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
