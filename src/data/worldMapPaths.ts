// Simplified world map SVG paths for equirectangular projection (900×450 viewBox)
// lon/lat → SVG: x = (lon+180)/360*900, y = (90-lat)/180*450

export interface MapRegion {
  name: string;
  d: string;
  labelX: number;
  labelY: number;
  showLabel?: boolean;
}

// Helper: convert [lon, lat][] polygon to SVG path string
function poly(coords: [number, number][]): string {
  return coords
    .map(([lon, lat], i) => {
      const x = ((lon + 180) / 360) * 900;
      const y = ((90 - lat) / 180) * 450;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ") + " Z";
}

export const WORLD_REGIONS: MapRegion[] = [
  // ── North America ──
  {
    name: "North America",
    d: poly([
      [-168, 72], [-140, 70], [-130, 72], [-95, 72], [-85, 70], [-65, 60],
      [-55, 50], [-65, 43], [-75, 35], [-80, 25], [-90, 20], [-105, 20],
      [-117, 32], [-125, 48], [-135, 55], [-145, 60], [-165, 65], [-168, 72],
    ]),
    labelX: (((-98) + 180) / 360) * 900,
    labelY: ((90 - 45) / 180) * 450,
    showLabel: true,
  },
  // ── Central America ──
  {
    name: "C. America",
    d: poly([
      [-90, 20], [-85, 22], [-83, 15], [-78, 8], [-80, 7], [-85, 10],
      [-92, 15], [-97, 17], [-105, 20], [-90, 20],
    ]),
    labelX: (((-85) + 180) / 360) * 900,
    labelY: ((90 - 14) / 180) * 450,
  },
  // ── South America ──
  {
    name: "South America",
    d: poly([
      [-80, 10], [-75, 12], [-60, 8], [-50, 3], [-35, -5], [-35, -15],
      [-40, -23], [-50, -30], [-55, -35], [-65, -40], [-70, -50], [-75, -52],
      [-73, -45], [-70, -35], [-72, -18], [-75, -5], [-78, 2], [-80, 10],
    ]),
    labelX: (((-55) + 180) / 360) * 900,
    labelY: ((90 - (-15)) / 180) * 450,
    showLabel: true,
  },
  // ── Europe ──
  {
    name: "Europe",
    d: poly([
      [-10, 70], [30, 72], [40, 70], [45, 65], [40, 55], [30, 45],
      [27, 40], [25, 35], [15, 37], [5, 43], [-5, 43], [-10, 48],
      [-10, 55], [-5, 58], [-10, 65], [-10, 70],
    ]),
    labelX: (((10) + 180) / 360) * 900,
    labelY: ((90 - 52) / 180) * 450,
    showLabel: true,
  },
  // ── Africa ──
  {
    name: "Africa",
    d: poly([
      [-17, 35], [-15, 30], [-17, 20], [-17, 15], [-8, 5], [5, 5],
      [10, 3], [12, -5], [30, -10], [40, -15], [35, -25], [30, -34],
      [20, -35], [15, -30], [12, -18], [10, -5], [0, 5], [-5, 10],
      [-17, 15], [-17, 20], [-15, 30], [-17, 35],
    ]),
    labelX: (((20) + 180) / 360) * 900,
    labelY: ((90 - 5) / 180) * 450,
    showLabel: true,
  },
  // ── Middle East (detailed) ──
  {
    name: "Middle East",
    d: poly([
      [25, 38], [30, 38], [35, 37], [42, 38], [45, 40], [50, 40],
      [55, 37], [60, 35], [63, 28], [60, 24], [55, 22], [50, 23],
      [48, 28], [45, 30], [42, 30], [40, 27], [35, 28], [32, 30],
      [35, 32], [30, 35], [25, 35], [25, 38],
    ]),
    labelX: (((45) + 180) / 360) * 900,
    labelY: ((90 - 30) / 180) * 450,
    showLabel: true,
  },
  // ── Russia / Central Asia ──
  {
    name: "Russia",
    d: poly([
      [30, 72], [50, 72], [80, 73], [120, 73], [150, 70], [170, 65],
      [180, 65], [180, 55], [160, 50], [140, 48], [130, 50], [120, 52],
      [100, 50], [80, 48], [70, 45], [60, 42], [50, 45], [45, 50],
      [40, 55], [30, 55], [30, 72],
    ]),
    labelX: (((90) + 180) / 360) * 900,
    labelY: ((90 - 60) / 180) * 450,
    showLabel: true,
  },
  // ── South & East Asia ──
  {
    name: "Asia",
    d: poly([
      [60, 42], [70, 45], [75, 38], [78, 35], [75, 28], [72, 22],
      [78, 15], [80, 8], [88, 22], [95, 25], [100, 20], [105, 15],
      [110, 20], [115, 25], [120, 30], [125, 35], [130, 40], [135, 38],
      [140, 42], [140, 48], [130, 50], [120, 52], [100, 50], [80, 48],
      [70, 45], [60, 42],
    ]),
    labelX: (((100) + 180) / 360) * 900,
    labelY: ((90 - 30) / 180) * 450,
    showLabel: true,
  },
  // ── Australia ──
  {
    name: "Australia",
    d: poly([
      [115, -13], [130, -12], [140, -14], [150, -20], [153, -25],
      [150, -33], [140, -38], [130, -35], [120, -33], [115, -25],
      [113, -22], [115, -13],
    ]),
    labelX: (((133) + 180) / 360) * 900,
    labelY: ((90 - (-25)) / 180) * 450,
    showLabel: true,
  },
];

// Key country labels for the threat map (Middle East focus + major powers)
export const COUNTRY_LABELS: { name: string; lon: number; lat: number }[] = [
  { name: "USA", lon: -98, lat: 38 },
  { name: "Russia", lon: 60, lat: 55 },
  { name: "China", lon: 104, lat: 35 },
  { name: "Iran", lon: 53, lat: 32 },
  { name: "Israel", lon: 35, lat: 31 },
  { name: "Saudi Arabia", lon: 45, lat: 24 },
  { name: "Turkey", lon: 35, lat: 39 },
  { name: "UAE", lon: 54, lat: 24 },
  { name: "Syria", lon: 38, lat: 35 },
  { name: "Iraq", lon: 44, lat: 33 },
  { name: "UK", lon: -2, lat: 54 },
  { name: "India", lon: 78, lat: 21 },
  { name: "N. Korea", lon: 127, lat: 40 },
  { name: "Ukraine", lon: 32, lat: 49 },
  { name: "Jordan", lon: 36, lat: 31 },
  { name: "Oman", lon: 57, lat: 21 },
  { name: "Qatar", lon: 51, lat: 25 },
  { name: "Bahrain", lon: 50.5, lat: 26 },
];

// Graticule lines for lat/lon labels
export const GRATICULE_LATS = [-60, -30, 0, 30, 60];
export const GRATICULE_LONS = [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150];
