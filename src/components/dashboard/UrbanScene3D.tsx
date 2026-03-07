import { useEffect, useRef, useState, useCallback, useMemo, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Sky, Environment, Text, Html } from "@react-three/drei";
import * as THREE from "three";
import { X, RefreshCw, Search, Building2, Navigation, RotateCcw, Sun, Moon } from "lucide-react";

interface UrbanSceneProps {
  onClose: () => void;
  initialCoords?: { lat: number; lng: number };
}

interface BuildingData {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  color: string;
  type: string;
}

interface RoadSegment {
  start: [number, number];
  end: [number, number];
  width: number;
}

// Fetch building footprints from Overpass API (OpenStreetMap)
async function fetchBuildings(lat: number, lng: number, radius = 0.005): Promise<any[]> {
  const bbox = `${lat - radius},${lng - radius},${lat + radius},${lng + radius}`;
  const query = `[out:json][timeout:25];(way["building"](${bbox});relation["building"](${bbox}););out body;>;out skel qt;`;
  try {
    const resp = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: `data=${encodeURIComponent(query)}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    if (!resp.ok) throw new Error("Overpass API error");
    const data = await resp.json();
    return data.elements || [];
  } catch (e) {
    console.error("Failed to fetch OSM buildings:", e);
    return [];
  }
}

function processOSMData(elements: any[], centerLat: number, centerLng: number): { buildings: BuildingData[]; roads: RoadSegment[] } {
  const nodes = new Map<number, { lat: number; lon: number }>();
  const buildings: BuildingData[] = [];

  elements.forEach((el) => {
    if (el.type === "node") nodes.set(el.id, { lat: el.lat, lon: el.lon });
  });

  const metersPerDegreeLat = 111320;
  const metersPerDegreeLng = 111320 * Math.cos((centerLat * Math.PI) / 180);
  const SCALE = 1;

  elements.forEach((el) => {
    if (el.type !== "way" || !el.tags?.building) return;
    const coords = (el.nodes || []).map((nid: number) => nodes.get(nid)).filter(Boolean);
    if (coords.length < 3) return;

    // Compute centroid and bounding box
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    let cx = 0, cz = 0;
    coords.forEach((c: any) => {
      const x = (c.lon - centerLng) * metersPerDegreeLng * SCALE;
      const z = -(c.lat - centerLat) * metersPerDegreeLat * SCALE;
      cx += x; cz += z;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    });
    cx /= coords.length; cz /= coords.length;

    const width = Math.max(maxX - minX, 3);
    const depth = Math.max(maxZ - minZ, 3);
    const levels = parseInt(el.tags?.["building:levels"] || "0") || Math.ceil(Math.random() * 8 + 1);
    const height = levels * 3.2;

    const bType = el.tags?.building || "yes";
    let color = "#4a5568";
    if (bType === "residential" || bType === "apartments") color = "#6b7280";
    else if (bType === "commercial" || bType === "office") color = "#374151";
    else if (bType === "industrial") color = "#4b5563";
    else if (bType === "hospital" || bType === "school") color = "#1e3a5f";
    else color = `hsl(${210 + Math.random() * 20}, ${15 + Math.random() * 10}%, ${25 + Math.random() * 15}%)`;

    buildings.push({ x: cx, z: cz, width, depth, height, color, type: bType });
  });

  return { buildings, roads: [] };
}

// Generate procedural buildings when OSM data is sparse
function generateProceduralBuildings(count: number, spread: number): BuildingData[] {
  const buildings: BuildingData[] = [];
  const gridSize = Math.ceil(Math.sqrt(count));

  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / gridSize);
    const col = i % gridSize;
    const blockX = (col - gridSize / 2) * 35 + (Math.random() - 0.5) * 10;
    const blockZ = (row - gridSize / 2) * 35 + (Math.random() - 0.5) * 10;

    // Skip road areas
    if (Math.abs(blockX % 70) < 8 || Math.abs(blockZ % 70) < 8) continue;

    const isSkyscraper = Math.random() < 0.08;
    const isMid = Math.random() < 0.3;
    const height = isSkyscraper ? 60 + Math.random() * 120 : isMid ? 15 + Math.random() * 30 : 4 + Math.random() * 12;
    const width = isSkyscraper ? 12 + Math.random() * 8 : 8 + Math.random() * 15;
    const depth = isSkyscraper ? 12 + Math.random() * 8 : 8 + Math.random() * 15;

    const hue = 200 + Math.random() * 30;
    const sat = 10 + Math.random() * 15;
    const light = isSkyscraper ? 20 + Math.random() * 10 : 25 + Math.random() * 15;

    buildings.push({
      x: blockX, z: blockZ, width, depth, height,
      color: `hsl(${hue}, ${sat}%, ${light}%)`,
      type: isSkyscraper ? "skyscraper" : isMid ? "commercial" : "residential",
    });
  }
  return buildings;
}

// --- Three.js Components ---

function Building({ data }: { data: BuildingData }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const color = useMemo(() => new THREE.Color(data.color), [data.color]);

  // Window emissive pattern
  const windowColor = useMemo(() => {
    return Math.random() > 0.4 ? new THREE.Color("#ffd54f").multiplyScalar(0.3) : new THREE.Color("#000000");
  }, []);

  return (
    <group position={[data.x, data.height / 2, data.z]}>
      <mesh ref={meshRef} castShadow receiveShadow>
        <boxGeometry args={[data.width, data.height, data.depth]} />
        <meshStandardMaterial
          color={color}
          roughness={0.7}
          metalness={0.3}
          emissive={windowColor}
          emissiveIntensity={0.15}
        />
      </mesh>
      {/* Roof accent for tall buildings */}
      {data.height > 30 && (
        <mesh position={[0, data.height / 2 + 0.5, 0]}>
          <boxGeometry args={[data.width * 0.6, 1, data.depth * 0.6]} />
          <meshStandardMaterial color="#1a1a2e" emissive="#ff3333" emissiveIntensity={0.5} />
        </mesh>
      )}
    </group>
  );
}

function Ground({ size = 2000 }: { size?: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial color="#1a1f2e" roughness={0.9} />
    </mesh>
  );
}

function Roads({ size = 1000 }: { size?: number }) {
  const roads: JSX.Element[] = [];
  const spacing = 70;

  for (let i = -size / 2; i < size / 2; i += spacing) {
    roads.push(
      <mesh key={`h-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, i]}>
        <planeGeometry args={[size, 8]} />
        <meshStandardMaterial color="#2d3748" roughness={0.8} />
      </mesh>,
      <mesh key={`v-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[i, 0.01, 0]}>
        <planeGeometry args={[8, size]} />
        <meshStandardMaterial color="#2d3748" roughness={0.8} />
      </mesh>
    );
  }
  return <>{roads}</>;
}

function GridOverlay() {
  return (
    <gridHelper args={[2000, 200, "#00d4ff", "#0a1628"]} position={[0, 0.02, 0]} />
  );
}

function AutoFlyCamera({ enabled }: { enabled: boolean }) {
  const { camera } = useThree();
  const timeRef = useRef(0);
  const radiusRef = useRef(200);

  useFrame((_, delta) => {
    if (!enabled) return;
    timeRef.current += delta * 0.15;
    const r = radiusRef.current;
    camera.position.x = Math.cos(timeRef.current) * r;
    camera.position.z = Math.sin(timeRef.current) * r;
    camera.position.y = 80 + Math.sin(timeRef.current * 0.5) * 30;
    camera.lookAt(0, 20, 0);
  });

  return null;
}

function HUDOverlay({ lat, lng, buildingCount, isNight }: { lat: number; lng: number; buildingCount: number; isNight: boolean }) {
  return (
    <div className="absolute top-14 left-3 z-10 pointer-events-none space-y-1">
      <div className="bg-black/70 backdrop-blur border border-primary/30 rounded px-2.5 py-1.5 font-mono text-[9px] text-primary/80 space-y-0.5"
        style={{ boxShadow: "0 0 15px hsl(190 100% 50% / 0.1)" }}>
        <div className="text-primary font-bold text-[10px]">// URBAN RECON</div>
        <div>SECTOR {lat.toFixed(4)}N {Math.abs(lng).toFixed(4)}{lng >= 0 ? "E" : "W"}</div>
        <div>STRUCTURES: {buildingCount}</div>
        <div>MODE: {isNight ? "NIGHT OPS" : "DAYLIGHT"}</div>
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          LIVE RENDER
        </div>
      </div>
    </div>
  );
}

// --- Main Component ---

export const UrbanScene3D = ({ onClose, initialCoords }: UrbanSceneProps) => {
  const [lat, setLat] = useState(initialCoords?.lat || 25.2048);
  const [lng, setLng] = useState(initialCoords?.lng || 55.2708);
  const [searchInput, setSearchInput] = useState("");
  const [buildings, setBuildings] = useState<BuildingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoFly, setAutoFly] = useState(true);
  const [isNight, setIsNight] = useState(true);
  const [showSearch, setShowSearch] = useState(false);

  const loadScene = useCallback(async (newLat: number, newLng: number) => {
    setLoading(true);
    setLat(newLat);
    setLng(newLng);

    try {
      const osmElements = await fetchBuildings(newLat, newLng, 0.006);
      const { buildings: osmBuildings } = processOSMData(osmElements, newLat, newLng);

      if (osmBuildings.length > 10) {
        setBuildings(osmBuildings);
      } else {
        // Fall back to procedural generation enriched with any OSM data
        const procedural = generateProceduralBuildings(200, 500);
        setBuildings([...osmBuildings, ...procedural]);
      }
    } catch {
      setBuildings(generateProceduralBuildings(200, 500));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadScene(lat, lng);
  }, []);

  const handleSearchSubmit = useCallback(() => {
    const input = searchInput.trim();
    if (!input) return;

    // Try parsing coordinates
    const coordMatch = input.match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/);
    if (coordMatch) {
      loadScene(parseFloat(coordMatch[1]), parseFloat(coordMatch[2]));
      setShowSearch(false);
      return;
    }

    // Geocode using Nominatim
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(input)}&limit=1`)
      .then((r) => r.json())
      .then((results) => {
        if (results.length > 0) {
          loadScene(parseFloat(results[0].lat), parseFloat(results[0].lon));
          setShowSearch(false);
        }
      })
      .catch(console.error);
  }, [searchInput, loadScene]);

  const PRESETS = [
    { name: "Dubai", lat: 25.2048, lng: 55.2708 },
    { name: "Tehran", lat: 35.6892, lng: 51.3890 },
    { name: "Tel Aviv", lat: 32.0853, lng: 34.7818 },
    { name: "Beirut", lat: 33.8938, lng: 35.5018 },
    { name: "Damascus", lat: 33.5138, lng: 36.2765 },
    { name: "Riyadh", lat: 24.7136, lng: 46.6753 },
    { name: "Baghdad", lat: 33.3152, lng: 44.3661 },
    { name: "Cairo", lat: 30.0444, lng: 31.2357 },
  ];

  return (
    <div className="absolute inset-0 z-[2000] bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-card/90 backdrop-blur border-b border-border z-10">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          <span className="text-xs font-mono font-bold text-primary uppercase tracking-widest">3D Urban Recon</span>
          <span className="text-[9px] font-mono text-muted-foreground">
            {loading ? "GENERATING…" : `${buildings.length} STRUCTURES`}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setShowSearch(!showSearch)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono uppercase border transition-all ${showSearch ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary"}`}>
            <Search className="h-3 w-3" /> Location
          </button>
          <button onClick={() => setAutoFly(!autoFly)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono uppercase border transition-all ${autoFly ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary"}`}>
            <Navigation className="h-3 w-3" /> Flythrough
          </button>
          <button onClick={() => setIsNight(!isNight)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono uppercase border transition-all ${isNight ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary"}`}>
            {isNight ? <Moon className="h-3 w-3" /> : <Sun className="h-3 w-3" />}
          </button>
          <button onClick={() => loadScene(lat, lng)}
            className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono uppercase border border-border text-muted-foreground hover:bg-secondary transition-all">
            <RotateCcw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={onClose}
            className="flex items-center justify-center w-7 h-7 rounded border border-border text-muted-foreground hover:bg-destructive/20 hover:text-destructive transition-all">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Search + presets */}
      {showSearch && (
        <div className="px-3 py-1.5 bg-card/80 backdrop-blur border-b border-border/50 z-10 space-y-1.5">
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
            <button onClick={handleSearchSubmit}
              className="px-2 py-0.5 rounded text-[9px] font-mono uppercase border border-primary/50 bg-primary/10 text-primary hover:bg-primary/20 transition-all">
              Go
            </button>
          </div>
          <div className="flex items-center gap-1 overflow-x-auto">
            {PRESETS.map((p) => (
              <button key={p.name}
                onClick={() => { loadScene(p.lat, p.lng); setShowSearch(false); }}
                className={`flex-shrink-0 px-2 py-0.5 rounded text-[8px] font-mono uppercase border transition-all ${
                  Math.abs(lat - p.lat) < 0.01 && Math.abs(lng - p.lng) < 0.01
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-secondary"
                }`}>
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 3D Canvas */}
      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
            <div className="text-center space-y-2">
              <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-[10px] font-mono text-primary/70 uppercase tracking-widest">
                Loading urban geometry…
              </p>
            </div>
          </div>
        )}

        <HUDOverlay lat={lat} lng={lng} buildingCount={buildings.length} isNight={isNight} />

        <Canvas
          shadows
          camera={{ position: [200, 100, 200], fov: 50, near: 0.1, far: 5000 }}
          gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: isNight ? 0.5 : 1.2 }}
        >
          <Suspense fallback={null}>
            {/* Lighting */}
            <ambientLight intensity={isNight ? 0.08 : 0.4} />
            <directionalLight
              position={[100, 200, 100]}
              intensity={isNight ? 0.3 : 1.5}
              castShadow
              shadow-mapSize={[2048, 2048]}
              shadow-camera-far={500}
              shadow-camera-left={-200}
              shadow-camera-right={200}
              shadow-camera-top={200}
              shadow-camera-bottom={-200}
            />
            {isNight && (
              <>
                <pointLight position={[0, 50, 0]} intensity={0.5} color="#00d4ff" distance={300} />
                <pointLight position={[100, 30, -50]} intensity={0.3} color="#ffb800" distance={200} />
                <pointLight position={[-80, 20, 80]} intensity={0.2} color="#ef4444" distance={150} />
              </>
            )}

            {/* Sky */}
            {!isNight && <Sky sunPosition={[100, 50, 100]} turbidity={8} rayleigh={2} />}
            <fog attach="fog" args={[isNight ? "#0a0e1a" : "#b0c4de", 100, isNight ? 600 : 1200]} />

            {/* Scene */}
            <Ground />
            <Roads />
            <GridOverlay />

            {buildings.map((b, i) => (
              <Building key={i} data={b} />
            ))}

            {/* Camera controls */}
            <AutoFlyCamera enabled={autoFly} />
            {!autoFly && (
              <OrbitControls
                enableDamping
                dampingFactor={0.05}
                maxPolarAngle={Math.PI / 2.1}
                minDistance={20}
                maxDistance={800}
                target={[0, 20, 0]}
              />
            )}
          </Suspense>
        </Canvas>
      </div>

      {/* Bottom bar */}
      <div className="flex items-center gap-3 px-3 py-1.5 bg-card/70 backdrop-blur border-t border-border/50 z-10">
        <span className="text-[8px] font-mono text-muted-foreground uppercase">
          SRC: OpenStreetMap • {buildings.length} buildings rendered
        </span>
        <span className="ml-auto text-[8px] font-mono text-muted-foreground/50">
          {autoFly ? "AUTO FLYTHROUGH • Click Flythrough to take manual control" : "MANUAL • Scroll to zoom, drag to orbit"}
        </span>
      </div>
    </div>
  );
};
