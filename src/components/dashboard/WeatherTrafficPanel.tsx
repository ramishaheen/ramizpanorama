import { useState } from "react";
import { Cloud, Wind, Droplets, Eye, Thermometer, RefreshCw, ChevronDown, ChevronUp, MapPin } from "lucide-react";
import { useWeatherData, type CityWeather } from "@/hooks/useWeatherData";

const conditionIcons: Record<string, string> = {
  Clear: "☀️", Clouds: "☁️", Rain: "🌧️", Drizzle: "🌦️", Thunderstorm: "⛈️",
  Snow: "❄️", Mist: "🌫️", Fog: "🌫️", Haze: "🌫️", Dust: "🌪️", Sand: "🌪️",
  Smoke: "💨", Squall: "💨", Tornado: "🌪️",
};

const windArrow = (deg: number) => {
  const arrows = ["↓", "↙", "←", "↖", "↑", "↗", "→", "↘"];
  return arrows[Math.round(deg / 45) % 8];
};

function CityWeatherCard({ w }: { w: CityWeather }) {
  const emoji = conditionIcons[w.condition] || "🌤️";
  const tempColor = w.temp >= 40 ? "text-red-400" : w.temp >= 30 ? "text-orange-400" : w.temp >= 20 ? "text-yellow-400" : w.temp >= 10 ? "text-cyan-400" : "text-blue-400";

  return (
    <div className="bg-secondary/40 border border-border/30 rounded-md p-2 hover:bg-secondary/60 transition-colors">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{emoji}</span>
          <span className="text-[10px] font-mono font-bold text-foreground">{w.city}</span>
          <span className="text-[8px] font-mono text-muted-foreground">{w.code}</span>
        </div>
        <span className={`text-sm font-mono font-bold ${tempColor}`}>{w.temp}°C</span>
      </div>
      <div className="grid grid-cols-4 gap-1 text-[8px] font-mono text-muted-foreground">
        <div className="flex items-center gap-0.5" title="Feels like">
          <Thermometer className="h-2.5 w-2.5 text-orange-400/70" />
          <span>{w.feels_like}°</span>
        </div>
        <div className="flex items-center gap-0.5" title="Wind">
          <Wind className="h-2.5 w-2.5 text-cyan-400/70" />
          <span>{w.wind_speed}km/h {windArrow(w.wind_deg)}</span>
        </div>
        <div className="flex items-center gap-0.5" title="Humidity">
          <Droplets className="h-2.5 w-2.5 text-blue-400/70" />
          <span>{w.humidity}%</span>
        </div>
        <div className="flex items-center gap-0.5" title="Visibility">
          <Eye className="h-2.5 w-2.5 text-green-400/70" />
          <span>{w.visibility}km</span>
        </div>
      </div>
      <div className="text-[7px] font-mono text-muted-foreground/60 mt-0.5 capitalize">{w.description}</div>
    </div>
  );
}

export function WeatherTrafficPanel() {
  const { weather, loading, error, refetch } = useWeatherData();
  const [expanded, setExpanded] = useState(true);

  // Compute region averages
  const avgTemp = weather.length > 0 ? Math.round(weather.reduce((s, w) => s + w.temp, 0) / weather.length) : 0;
  const avgWind = weather.length > 0 ? Math.round(weather.reduce((s, w) => s + w.wind_speed, 0) / weather.length) : 0;
  const avgHumidity = weather.length > 0 ? Math.round(weather.reduce((s, w) => s + w.humidity, 0) / weather.length) : 0;
  const worstCondition = weather.find(w => ["Thunderstorm", "Rain", "Sand", "Dust", "Tornado"].includes(w.condition));

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cloud className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] font-mono font-bold text-primary uppercase tracking-wider">
            Weather & Conditions
          </span>
          <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary">LIVE</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={refetch} className="p-1 rounded hover:bg-secondary/50 transition-colors" title="Refresh">
            <RefreshCw className={`h-3 w-3 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => setExpanded(!expanded)} className="p-1 rounded hover:bg-secondary/50 transition-colors">
            {expanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
          </button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="px-3 py-1.5 bg-secondary/20 border-b border-border/30 flex items-center gap-4 text-[9px] font-mono">
        <div className="flex items-center gap-1">
          <Thermometer className="h-3 w-3 text-orange-400" />
          <span className="text-muted-foreground">AVG</span>
          <span className="text-foreground font-bold">{avgTemp}°C</span>
        </div>
        <div className="flex items-center gap-1">
          <Wind className="h-3 w-3 text-cyan-400" />
          <span className="text-foreground font-bold">{avgWind}km/h</span>
        </div>
        <div className="flex items-center gap-1">
          <Droplets className="h-3 w-3 text-blue-400" />
          <span className="text-foreground font-bold">{avgHumidity}%</span>
        </div>
        {worstCondition && (
          <div className="flex items-center gap-1 ml-auto">
            <span className="text-warning">⚠</span>
            <span className="text-warning text-[8px]">{worstCondition.condition} in {worstCondition.city}</span>
          </div>
        )}
      </div>

      {/* Traffic status summary */}
      <div className="px-3 py-1.5 bg-secondary/10 border-b border-border/30 flex items-center gap-3 text-[9px] font-mono flex-wrap">
        <MapPin className="h-3 w-3 text-accent" />
        <span className="text-muted-foreground uppercase">Traffic:</span>
        <span className="text-green-400 flex items-center gap-0.5">● Suez: <span className="text-foreground">Restricted</span></span>
        <span className="text-yellow-400 flex items-center gap-0.5">● Hormuz: <span className="text-foreground">Heavy</span></span>
        <span className="text-red-400 flex items-center gap-0.5">● Red Sea: <span className="text-foreground">Diverted</span></span>
        <span className="text-orange-400 flex items-center gap-0.5">● Bab el-Mandeb: <span className="text-foreground">Alert</span></span>
        <span className="text-cyan-400 flex items-center gap-0.5">● E.Med: <span className="text-foreground">Active</span></span>
      </div>

      {/* Weather grid */}
      {expanded && (
        <div className="p-2 space-y-1.5 max-h-[300px] overflow-y-auto">
          {loading && weather.length === 0 && (
            <div className="flex items-center justify-center py-4 text-[10px] font-mono text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5 animate-spin mr-2" />
              Loading weather data...
            </div>
          )}
          {error && weather.length === 0 && (
            <div className="text-[10px] font-mono text-destructive text-center py-2">{error}</div>
          )}
          {weather.map((w) => (
            <CityWeatherCard key={w.code} w={w} />
          ))}
        </div>
      )}
    </div>
  );
}
