import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, RefreshCw, Search, Building2, Plane, Navigation, RotateCcw, Eye, EyeOff } from "lucide-react";

interface UrbanSceneProps {
  onClose: () => void;
  initialCoords?: { lat: number; lng: number };
}

interface Aircraft {
  icao24: string;
  callsign: string;
  origin_country: string;
  lat: number;
  lng: number;
  altitude: number;
  velocity: number;
  heading: number;
  vertical_rate: number;
  is_military: boolean;
}

const PRESETS = [
  { name: "Dubai", lat: 25.2048, lng: 55.2708 },
  { name: "Tehran", lat: 35.6892, lng: 51.389 },
  { name: "Tel Aviv", lat: 32.0853, lng: 34.7818 },
  { name: "Beirut", lat: 33.8938, lng: 35.5018 },
  { name: "Damascus", lat: 33.5138, lng: 36.2765 },
  { name: "Riyadh", lat: 24.7136, lng: 46.6753 },
  { name: "Baghdad", lat: 33.3152, lng: 44.3661 },
  { name: "Amman", lat: 31.9454, lng: 35.9284 },
];

export const UrbanScene3D = ({ onClose, initialCoords }: UrbanSceneProps) => {
  const [lat, setLat] = useState(initialCoords?.lat || 25.2048);
  const [lng, setLng] = useState(initialCoords?.lng || 55.2708);
  const [searchInput, setSearchInput] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showFlights, setShowFlights] = useState(true);
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [flightsLoading, setFlightsLoading] = useState(false);
  const [selectedAircraft, setSelectedAircraft] = useState<Aircraft | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [apiKeyLoading, setApiKeyLoading] = useState(true);
  const flightIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch Google Maps API key from backend
  useEffect(() => {
    const fetchKey = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("google-maps-key");
        if (!error && data?.apiKey) {
          setApiKey(data.apiKey);
        }
      } catch (e) {
        console.error("Failed to fetch Google Maps key:", e);
      } finally {
        setApiKeyLoading(false);
      }
    };
    fetchKey();
  }, []);

  // Fetch live flights
  const fetchFlights = useCallback(async () => {
    if (!showFlights) return;
    setFlightsLoading(true);
    try {
      const bbox = {
        lamin: lat - 3,
        lamax: lat + 3,
        lomin: lng - 3,
        lomax: lng + 3,
      };
      const { data, error } = await supabase.functions.invoke("live-flights", { body: bbox });
      if (!error && data?.aircraft) {
        setAircraft(data.aircraft);
      }
    } catch (e) {
      console.error("Failed to fetch flights:", e);
    } finally {
      setFlightsLoading(false);
    }
  }, [lat, lng, showFlights]);

  useEffect(() => {
    fetchFlights();
    flightIntervalRef.current = setInterval(fetchFlights, 30000);
    return () => {
      if (flightIntervalRef.current) clearInterval(flightIntervalRef.current);
    };
  }, [fetchFlights]);

  const navigateTo = useCallback((newLat: number, newLng: number) => {
    setLat(newLat);
    setLng(newLng);
    setSelectedAircraft(null);
  }, []);

  const handleSearchSubmit = useCallback(() => {
    const input = searchInput.trim();
    if (!input) return;
    const coordMatch = input.match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/);
    if (coordMatch) {
      navigateTo(parseFloat(coordMatch[1]), parseFloat(coordMatch[2]));
      setShowSearch(false);
      return;
    }
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(input)}&limit=1`)
      .then((r) => r.json())
      .then((results) => {
        if (results.length > 0) {
          navigateTo(parseFloat(results[0].lat), parseFloat(results[0].lon));
          setShowSearch(false);
        }
      })
      .catch(console.error);
  }, [searchInput, navigateTo]);

  const militaryCount = aircraft.filter((a) => a.is_military).length;
  const civilCount = aircraft.length - militaryCount;

  // Build Google Maps 3D embed URL
  const mapSrc = apiKey
    ? `https://www.google.com/maps/embed/v1/view?key=${apiKey}&center=${lat},${lng}&zoom=17&maptype=satellite`
    : null;

  return (
    <div className="absolute inset-0 z-[2000] bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-card/90 backdrop-blur border-b border-border z-20">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          <span className="text-xs font-mono font-bold text-primary uppercase tracking-widest">
            3D Urban Intel
          </span>
          <span className="text-[9px] font-mono text-muted-foreground">
            GOOGLE 3D TILES
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono uppercase border transition-all ${showSearch ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary"}`}
          >
            <Search className="h-3 w-3" /> Location
          </button>
          <button
            onClick={() => setShowFlights(!showFlights)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono uppercase border transition-all ${showFlights ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary"}`}
          >
            <Plane className="h-3 w-3" />
            Flights
            {aircraft.length > 0 && (
              <span className="bg-primary/20 text-primary text-[8px] px-1 rounded-full font-bold">
                {aircraft.length}
              </span>
            )}
          </button>
          <button
            onClick={() => fetchFlights()}
            className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono uppercase border border-border text-muted-foreground hover:bg-secondary transition-all"
          >
            <RefreshCw className={`h-3 w-3 ${flightsLoading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-7 h-7 rounded border border-border text-muted-foreground hover:bg-destructive/20 hover:text-destructive transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Search + presets */}
      {showSearch && (
        <div className="px-3 py-1.5 bg-card/80 backdrop-blur border-b border-border/50 z-20 space-y-1.5">
          <div className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearchSubmit()}
              placeholder="City name or coordinates (lat, lng)…"
              className="flex-1 bg-transparent text-xs font-mono text-foreground placeholder:text-muted-foreground/50 outline-none"
              autoFocus
            />
            <button
              onClick={handleSearchSubmit}
              className="px-2 py-0.5 rounded text-[9px] font-mono uppercase border border-primary/50 bg-primary/10 text-primary hover:bg-primary/20 transition-all"
            >
              Go
            </button>
          </div>
          <div className="flex items-center gap-1 overflow-x-auto">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => {
                  navigateTo(p.lat, p.lng);
                  setShowSearch(false);
                }}
                className={`flex-shrink-0 px-2 py-0.5 rounded text-[8px] font-mono uppercase border transition-all ${
                  Math.abs(lat - p.lat) < 0.01 && Math.abs(lng - p.lng) < 0.01
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-secondary"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 relative">
        {/* Google Maps 3D Embed */}
        {apiKeyLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-2">
              <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-[10px] font-mono text-primary/70 uppercase tracking-widest">
                Initializing Google 3D Tiles…
              </p>
            </div>
          </div>
        ) : mapSrc ? (
          <iframe
            key={`${lat}-${lng}`}
            src={mapSrc}
            className="absolute inset-0 w-full h-full border-0"
            allowFullScreen
            loading="eager"
            referrerPolicy="no-referrer-when-downgrade"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-card">
            <div className="text-center space-y-2 max-w-sm px-4">
              <Building2 className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="text-xs font-mono text-muted-foreground">
                Google Maps API key not configured. Add GOOGLE_MAPS_API_KEY to enable 3D tiles.
              </p>
            </div>
          </div>
        )}

        {/* HUD Overlay */}
        <div className="absolute top-3 left-3 z-10 pointer-events-none">
          <div
            className="bg-black/70 backdrop-blur border border-primary/30 rounded px-2.5 py-1.5 font-mono text-[9px] text-primary/80 space-y-0.5"
            style={{ boxShadow: "0 0 15px hsl(190 100% 50% / 0.1)" }}
          >
            <div className="text-primary font-bold text-[10px]">// URBAN RECON — GOOGLE 3D</div>
            <div>
              SECTOR {lat.toFixed(4)}N {Math.abs(lng).toFixed(4)}
              {lng >= 0 ? "E" : "W"}
            </div>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              PHOTOREALISTIC 3D TILES
            </div>
          </div>
        </div>

        {/* Flight overlay */}
        {showFlights && aircraft.length > 0 && (
          <div className="absolute top-3 right-3 z-10 pointer-events-auto">
            <div
              className="bg-black/80 backdrop-blur border border-primary/30 rounded-lg p-2 w-56 max-h-[50vh] overflow-hidden"
              style={{ boxShadow: "0 0 20px hsl(190 100% 50% / 0.1)" }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Plane className="h-3 w-3 text-primary" />
                  <span className="text-[9px] font-mono font-bold text-primary uppercase">
                    Live Airspace
                  </span>
                </div>
                <span className="text-[8px] font-mono text-muted-foreground">
                  {aircraft.length} tracked
                </span>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-2 mb-1.5 pb-1.5 border-b border-border/30">
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  <span className="text-[8px] font-mono text-blue-400">
                    CIV: {civilCount}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  <span className="text-[8px] font-mono text-red-400">
                    MIL: {militaryCount}
                  </span>
                </div>
              </div>

              {/* Aircraft list */}
              <div className="space-y-0.5 max-h-[35vh] overflow-y-auto">
                {aircraft
                  .sort((a, b) => (b.is_military ? 1 : 0) - (a.is_military ? 1 : 0))
                  .slice(0, 40)
                  .map((ac) => (
                    <button
                      key={ac.icao24}
                      onClick={() => setSelectedAircraft(selectedAircraft?.icao24 === ac.icao24 ? null : ac)}
                      className={`w-full flex items-center gap-1.5 px-1.5 py-1 rounded text-left transition-all ${
                        selectedAircraft?.icao24 === ac.icao24
                          ? "bg-primary/15 border border-primary/30"
                          : "hover:bg-white/5 border border-transparent"
                      }`}
                    >
                      <Plane
                        className="h-2.5 w-2.5 flex-shrink-0"
                        style={{
                          color: ac.is_military ? "#ef4444" : "#60a5fa",
                          transform: `rotate(${ac.heading}deg)`,
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <span className="text-[8px] font-mono font-bold text-foreground/90 block truncate">
                          {ac.callsign || ac.icao24}
                        </span>
                        <span className="text-[7px] font-mono text-muted-foreground/60">
                          {Math.round(ac.altitude)}m • {Math.round(ac.velocity * 3.6)}km/h •{" "}
                          {ac.origin_country}
                        </span>
                      </div>
                      {ac.is_military && (
                        <span className="text-[6px] font-mono font-bold text-red-400 bg-red-500/15 px-1 rounded">
                          MIL
                        </span>
                      )}
                    </button>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Selected aircraft detail */}
        {selectedAircraft && (
          <div
            className="absolute bottom-14 left-3 z-10 pointer-events-auto bg-black/85 backdrop-blur border rounded-lg p-2.5 w-60"
            style={{
              borderColor: selectedAircraft.is_military
                ? "rgba(239,68,68,0.4)"
                : "rgba(96,165,250,0.4)",
              boxShadow: `0 0 20px ${
                selectedAircraft.is_military
                  ? "rgba(239,68,68,0.15)"
                  : "rgba(96,165,250,0.15)"
              }`,
            }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <Plane
                  className="h-3.5 w-3.5"
                  style={{
                    color: selectedAircraft.is_military ? "#ef4444" : "#60a5fa",
                    transform: `rotate(${selectedAircraft.heading}deg)`,
                  }}
                />
                <span
                  className="text-[10px] font-mono font-bold"
                  style={{
                    color: selectedAircraft.is_military ? "#ef4444" : "#60a5fa",
                  }}
                >
                  {selectedAircraft.callsign || selectedAircraft.icao24}
                </span>
                {selectedAircraft.is_military && (
                  <span className="text-[7px] font-mono font-bold text-red-400 bg-red-500/15 px-1 rounded">
                    MILITARY
                  </span>
                )}
              </div>
              <button
                onClick={() => setSelectedAircraft(null)}
                className="w-4 h-4 flex items-center justify-center rounded hover:bg-white/10"
              >
                <X className="h-2.5 w-2.5 text-muted-foreground" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              <DataRow label="ICAO" value={selectedAircraft.icao24} />
              <DataRow label="ORIGIN" value={selectedAircraft.origin_country} />
              <DataRow label="ALT" value={`${Math.round(selectedAircraft.altitude)}m`} />
              <DataRow label="SPEED" value={`${Math.round(selectedAircraft.velocity * 3.6)} km/h`} />
              <DataRow label="HDG" value={`${Math.round(selectedAircraft.heading)}°`} />
              <DataRow label="V/S" value={`${selectedAircraft.vertical_rate > 0 ? "+" : ""}${selectedAircraft.vertical_rate.toFixed(1)} m/s`} />
              <DataRow label="LAT" value={selectedAircraft.lat.toFixed(4)} />
              <DataRow label="LNG" value={selectedAircraft.lng.toFixed(4)} />
            </div>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="flex items-center gap-3 px-3 py-1.5 bg-card/70 backdrop-blur border-t border-border/50 z-20">
        <span className="text-[8px] font-mono text-muted-foreground uppercase">
          SRC: Google Photorealistic 3D Tiles • OpenSky Network
        </span>
        <span className="ml-auto text-[8px] font-mono text-muted-foreground/50">
          {showFlights
            ? `${aircraft.length} aircraft tracked • ${militaryCount} military • Updates every 30s`
            : "Flight layer disabled"}
        </span>
      </div>
    </div>
  );
};

const DataRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col">
    <span className="text-[6px] font-mono text-muted-foreground/40 uppercase tracking-wider">
      {label}
    </span>
    <span className="text-[9px] font-mono text-foreground/80">{value}</span>
  </div>
);
