import { useState } from "react";
import { Layers, Eye, EyeOff, ChevronDown, ChevronUp } from "lucide-react";

export interface ImageryLayer {
  id: string;
  name: string;
  shortName: string;
  url: string;
  attribution: string;
  type: "base" | "overlay";
  opacity: number;
  enabled: boolean;
  maxZoom?: number;
  category: "satellite" | "terrain" | "weather" | "analysis";
}

const today = new Date().toISOString().split("T")[0];

export const DEFAULT_IMAGERY_LAYERS: ImageryLayer[] = [
  // ── Base Maps ──
  {
    id: "osm-dark",
    name: "OpenStreetMap",
    shortName: "OSM",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OSM contributors",
    type: "base",
    opacity: 1,
    enabled: true,
    maxZoom: 19,
    category: "terrain",
  },
  {
    id: "esri-imagery",
    name: "ESRI World Imagery",
    shortName: "ESRI SAT",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "&copy; Esri, Maxar, Earthstar",
    type: "base",
    opacity: 1,
    enabled: false,
    maxZoom: 18,
    category: "satellite",
  },
  {
    id: "google-satellite",
    name: "Google Satellite",
    shortName: "GSAT",
    url: "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
    attribution: "&copy; Google",
    type: "base",
    opacity: 1,
    enabled: false,
    maxZoom: 20,
    category: "satellite",
  },
  {
    id: "google-hybrid",
    name: "Google Hybrid",
    shortName: "GHYB",
    url: "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
    attribution: "&copy; Google",
    type: "base",
    opacity: 1,
    enabled: false,
    maxZoom: 20,
    category: "satellite",
  },
  {
    id: "sentinel2",
    name: "Sentinel-2 Cloudless",
    shortName: "S2",
    url: "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2021_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg",
    attribution: "&copy; EOX/Sentinel-2 Copernicus",
    type: "base",
    opacity: 1,
    enabled: false,
    maxZoom: 14,
    category: "satellite",
  },
  {
    id: "esri-wayback",
    name: "ESRI Wayback Imagery",
    shortName: "WAYBACK",
    url: "https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/{z}/{y}/{x}",
    attribution: "&copy; Esri Living Atlas Wayback",
    type: "base",
    opacity: 1,
    enabled: false,
    maxZoom: 18,
    category: "satellite",
  },
  {
    id: "esri-terrain",
    name: "ESRI World Terrain",
    shortName: "TERRAIN",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}",
    attribution: "&copy; Esri",
    type: "base",
    opacity: 1,
    enabled: false,
    maxZoom: 13,
    category: "terrain",
  },
  {
    id: "usgs-imagery",
    name: "USGS Imagery",
    shortName: "USGS",
    url: "https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}",
    attribution: "&copy; USGS National Map",
    type: "base",
    opacity: 1,
    enabled: false,
    maxZoom: 16,
    category: "satellite",
  },
  {
    id: "up42-basemap",
    name: "UP42 Satellite (Purchased)",
    shortName: "UP42",
    url: "https://api.up42.com/v2/assets/wmts/1.0.0/WMTSCapabilities/{z}/{x}/{y}.png",
    attribution: "&copy; UP42 / Airbus",
    type: "base",
    opacity: 1,
    enabled: false,
    maxZoom: 20,
    category: "satellite",
  },
  // ── Overlays ──
  {
    id: "modis-truecolor",
    name: "NASA MODIS True Color",
    shortName: "MODIS",
    url: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${today}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
    attribution: "&copy; NASA EOSDIS GIBS",
    type: "overlay",
    opacity: 0.5,
    enabled: false,
    maxZoom: 9,
    category: "satellite",
  },
  {
    id: "modis-fires",
    name: "NASA MODIS Thermal/Fires",
    shortName: "FIRES",
    url: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_Thermal_Anomalies_Day/default/${today}/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png`,
    attribution: "&copy; NASA FIRMS/GIBS",
    type: "overlay",
    opacity: 0.7,
    enabled: false,
    maxZoom: 7,
    category: "analysis",
  },
  {
    id: "landsat-truecolor",
    name: "Landsat 8-9 True Color",
    shortName: "LANDSAT",
    url: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/Landsat_WELD_CorrectedReflectance_TrueColor_Global_Annual/default/2023-01-01/GoogleMapsCompatible_Level12/{z}/{y}/{x}.jpg`,
    attribution: "&copy; NASA/USGS Landsat",
    type: "overlay",
    opacity: 0.6,
    enabled: false,
    maxZoom: 12,
    category: "satellite",
  },
  {
    id: "viirs-nightlights",
    name: "VIIRS Night Lights",
    shortName: "NIGHT",
    url: "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_DayNightBand_AtSensor_M15/default/2024-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png",
    attribution: "&copy; NASA VIIRS/GIBS",
    type: "overlay",
    opacity: 0.6,
    enabled: false,
    maxZoom: 8,
    category: "weather",
  },
  {
    id: "viirs-fires",
    name: "VIIRS Active Fires",
    shortName: "V-FIRES",
    url: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_Thermal_Anomalies_375m_Day/default/${today}/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png`,
    attribution: "&copy; NASA VIIRS FIRMS",
    type: "overlay",
    opacity: 0.7,
    enabled: false,
    maxZoom: 8,
    category: "analysis",
  },
  {
    id: "sentinel2-ndvi",
    name: "Sentinel-2 NDVI",
    shortName: "NDVI",
    url: "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2021_3857_ndvi/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg",
    attribution: "&copy; EOX/Sentinel-2 NDVI",
    type: "overlay",
    opacity: 0.5,
    enabled: false,
    maxZoom: 14,
    category: "analysis",
  },
  {
    id: "owm-clouds",
    name: "Cloud Cover",
    shortName: "CLOUDS",
    url: "https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=b1b15e88fa797225412429c1c50c122a1",
    attribution: "&copy; OpenWeatherMap",
    type: "overlay",
    opacity: 0.4,
    enabled: false,
    maxZoom: 18,
    category: "weather",
  },
  {
    id: "owm-precip",
    name: "Precipitation",
    shortName: "RAIN",
    url: "https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=b1b15e88fa797225412429c1c50c122a1",
    attribution: "&copy; OpenWeatherMap",
    type: "overlay",
    opacity: 0.5,
    enabled: false,
    maxZoom: 18,
    category: "weather",
  },
  {
    id: "owm-temp",
    name: "Temperature Map",
    shortName: "TEMP",
    url: "https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=b1b15e88fa797225412429c1c50c122a1",
    attribution: "&copy; OpenWeatherMap",
    type: "overlay",
    opacity: 0.5,
    enabled: false,
    maxZoom: 18,
    category: "weather",
  },
  {
    id: "owm-wind",
    name: "Wind Speed",
    shortName: "WIND",
    url: "https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=b1b15e88fa797225412429c1c50c122a1",
    attribution: "&copy; OpenWeatherMap",
    type: "overlay",
    opacity: 0.5,
    enabled: false,
    maxZoom: 18,
    category: "weather",
  },
  {
    id: "esri-labels",
    name: "ESRI Reference Labels",
    shortName: "LABELS",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    attribution: "&copy; Esri",
    type: "overlay",
    opacity: 0.9,
    enabled: false,
    maxZoom: 18,
    category: "terrain",
  },
  {
    id: "oam-mosaic",
    name: "OpenAerialMap Mosaic",
    shortName: "OAM",
    url: "https://tiles.openaerialmap.org/mosaic/{z}/{x}/{y}.png",
    attribution: "&copy; OpenAerialMap",
    type: "overlay",
    opacity: 0.7,
    enabled: false,
    maxZoom: 18,
    category: "satellite",
  },
  {
    id: "up42-overlay",
    name: "UP42 Imagery Overlay",
    shortName: "UP42 OVR",
    url: "https://api.up42.com/v2/assets/wmts/1.0.0/WMTSCapabilities/{z}/{x}/{y}.png",
    attribution: "&copy; UP42 / Airbus",
    type: "overlay",
    opacity: 0.8,
    enabled: false,
    maxZoom: 20,
    category: "satellite",
  },
];

interface ImageryLayerPanelProps {
  layers: ImageryLayer[];
  onToggle: (id: string) => void;
  onOpacityChange: (id: string, opacity: number) => void;
  onBaseChange: (id: string) => void;
}

const categoryIcon: Record<string, string> = {
  satellite: "🛰",
  terrain: "🗺",
  weather: "🌤",
  analysis: "🔥",
};

export const ImageryLayerPanel = ({ layers, onToggle, onOpacityChange, onBaseChange }: ImageryLayerPanelProps) => {
  const [expanded, setExpanded] = useState(false);
  const [showOverlays, setShowOverlays] = useState(false);

  const baseLayers = layers.filter(l => l.type === "base");
  const overlayLayers = layers.filter(l => l.type === "overlay");
  const activeBase = baseLayers.find(l => l.enabled);
  const activeOverlays = overlayLayers.filter(l => l.enabled);

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000]">
      {/* Compact bar */}
      <div className="flex items-center gap-1 bg-card/90 backdrop-blur-sm border border-border rounded-md p-1">
        <Layers className="h-3.5 w-3.5 text-primary ml-1" />

        {/* Base layer buttons */}
        {baseLayers.map(layer => (
          <button
            key={layer.id}
            onClick={() => onBaseChange(layer.id)}
            className={`px-2 py-1 rounded text-[10px] font-mono transition-colors ${
              layer.enabled
                ? "bg-primary/20 text-primary font-bold"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            }`}
            title={layer.name}
          >
            {layer.shortName}
          </button>
        ))}

        <div className="w-px h-4 bg-border mx-0.5" />

        {/* Overlay toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono transition-colors ${
            activeOverlays.length > 0
              ? "bg-warning/20 text-warning"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
          }`}
        >
          +{overlayLayers.length} Layers
          {activeOverlays.length > 0 && (
            <span className="bg-warning/30 text-warning text-[8px] px-1 rounded-full font-bold">
              {activeOverlays.length}
            </span>
          )}
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>

      {/* Expanded overlay panel */}
      {expanded && (
        <div className="mt-1 bg-card/95 backdrop-blur-sm border border-border rounded-md p-2 min-w-[280px] shadow-xl">
          <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Imagery Overlays</span>
            <button
              onClick={() => {
                overlayLayers.forEach(l => {
                  if (l.enabled) onToggle(l.id);
                });
              }}
              className="text-[8px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear All
            </button>
          </div>
          <div className="space-y-1.5">
            {overlayLayers.map(layer => (
              <div key={layer.id} className={`rounded px-2 py-1.5 border transition-colors ${
                layer.enabled ? "bg-secondary/40 border-primary/30" : "bg-secondary/10 border-border"
              }`}>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onToggle(layer.id)}
                    className="flex-shrink-0"
                  >
                    {layer.enabled
                      ? <Eye className="h-3 w-3 text-primary" />
                      : <EyeOff className="h-3 w-3 text-muted-foreground" />
                    }
                  </button>
                  <span className="text-[9px] mr-0.5">{categoryIcon[layer.category]}</span>
                  <span className={`text-[10px] font-mono flex-1 ${layer.enabled ? "text-foreground" : "text-muted-foreground"}`}>
                    {layer.name}
                  </span>
                  {layer.enabled && (
                    <span className="text-[8px] font-mono text-muted-foreground">
                      {Math.round(layer.opacity * 100)}%
                    </span>
                  )}
                </div>
                {layer.enabled && (
                  <div className="mt-1 ml-5">
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={layer.opacity * 100}
                      onChange={(e) => onOpacityChange(layer.id, parseInt(e.target.value) / 100)}
                      className="w-full h-1 bg-secondary rounded-full appearance-none cursor-pointer accent-primary"
                      style={{ accentColor: "hsl(var(--primary))" }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-2 pt-1.5 border-t border-border">
            <p className="text-[7px] font-mono text-muted-foreground/50 leading-tight">
              Sources: NASA GIBS/MODIS, VIIRS, Sentinel-2/EOX, OpenAerialMap. Layers stack with configurable opacity.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
