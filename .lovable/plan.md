

# Fix: Make Commodity Prices Live and Up-to-Date

## Problem
The `commodity-prices` edge function returns **empty prices** `{}`. Alpha Vantage free tier has severe rate limits (5 calls/min, 25 calls/day) and is consistently returning nothing. The client falls back to hardcoded defaults + random simulation, so prices are fake.

CoinGecko (BTC/ETH) works fine from the client side.

## Solution
Replace the Alpha Vantage backend with **Yahoo Finance unofficial API** — free, no API key needed, covers all 10 symbols in a single batch request. This is the most reliable free source for commodities, forex, and ETFs.

### 1. Rewrite `supabase/functions/commodity-prices/index.ts`
- Use Yahoo Finance v8 quote API: `https://query1.finance.yahoo.com/v8/finance/chart/{symbol}` for each symbol
- Batch all 10 symbols in parallel: `CL=F` (WTI), `BZ=F` (Brent), `GC=F` (Gold), `SI=F` (Silver), `NG=F` (Nat Gas), `HG=F` (Copper), `ZW=F` (Wheat), `USDILS=X` (USD/ILS), `USDSAR=X` (USD/SAR), `ITA` (Defense ETF)
- Extract price, previous close, compute change/changePercent
- Keep 5-minute in-memory cache
- No API key required — remove Alpha Vantage dependency

### 2. Update `src/hooks/useCommodityPrices.ts`
- Remove the random simulation interval (the `updateCommodities` with `sim()` calls) — this generates fake ticks
- Keep the 60s live fetch interval from the edge function
- Keep CoinGecko fetch for BTC/ETH (already working)
- Show a "LIVE" vs "STALE" indicator based on `lastUpdated` freshness

### Files Modified
- `supabase/functions/commodity-prices/index.ts` — complete rewrite to Yahoo Finance
- `src/hooks/useCommodityPrices.ts` — remove fake simulation, keep live polling

