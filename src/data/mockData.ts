export interface AirspaceAlert {
  id: string;
  type: 'NOTAM' | 'TFR' | 'CLOSURE';
  region: string;
  lat: number;
  lng: number;
  radius: number; // km
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  timestamp: string;
  active: boolean;
}

export interface MaritimeVessel {
  id: string;
  name: string;
  type: 'MILITARY' | 'CARGO' | 'TANKER' | 'FISHING' | 'UNKNOWN';
  flag: string;
  lat: number;
  lng: number;
  heading: number;
  speed: number; // knots
  destination?: string;
  timestamp: string;
}

export interface GeoAlert {
  id: string;
  type: 'DIPLOMATIC' | 'MILITARY' | 'ECONOMIC' | 'HUMANITARIAN';
  region: string;
  title: string;
  summary: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  timestamp: string;
  lat: number;
  lng: number;
}

export interface RiskScore {
  overall: number;
  airspace: number;
  maritime: number;
  diplomatic: number;
  sentiment: number;
  trend: 'rising' | 'falling' | 'stable';
  lastUpdated: string;
}

export interface Rocket {
  id: string;
  name: string;
  type: string;
  originLat: number;
  originLng: number;
  currentLat: number;
  currentLng: number;
  targetLat: number;
  targetLng: number;
  status: 'launched' | 'in_flight' | 'intercepted' | 'impact';
  severity: 'low' | 'medium' | 'high' | 'critical';
  speed: number;
  altitude: number;
  timestamp: string;
}

export interface TimelineEvent {
  id: string;
  timestamp: string;
  type: 'airspace' | 'maritime' | 'alert' | 'diplomatic';
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// --- Mock Data ---

export const mockAirspaceAlerts: AirspaceAlert[] = [
  { id: 'notam-001', type: 'TFR', region: 'Eastern Mediterranean', lat: 35.0, lng: 33.5, radius: 120, severity: 'high', description: 'Temporary flight restriction over eastern Mediterranean. Military exercises reported.', timestamp: '2026-03-03T08:30:00Z', active: true },
  { id: 'notam-002', type: 'CLOSURE', region: 'Black Sea', lat: 43.5, lng: 34.0, radius: 200, severity: 'critical', description: 'Airspace closure — Black Sea region. Active conflict zone restrictions.', timestamp: '2026-03-03T06:00:00Z', active: true },
  { id: 'notam-003', type: 'NOTAM', region: 'Persian Gulf', lat: 26.5, lng: 51.5, radius: 80, severity: 'medium', description: 'NOTAM advisory — increased military air traffic. Civilian routes rerouted.', timestamp: '2026-03-03T10:15:00Z', active: true },
  { id: 'notam-004', type: 'TFR', region: 'South China Sea', lat: 15.5, lng: 114.0, radius: 150, severity: 'high', description: 'Naval exercise zone — temporary flight restrictions in effect.', timestamp: '2026-03-03T04:00:00Z', active: true },
  { id: 'notam-005', type: 'NOTAM', region: 'Baltic Sea', lat: 57.0, lng: 20.0, radius: 60, severity: 'low', description: 'Routine NATO patrol advisory. No flight restrictions.', timestamp: '2026-03-03T12:00:00Z', active: true },
  { id: 'notam-006', type: 'CLOSURE', region: 'Red Sea', lat: 15.0, lng: 42.0, radius: 100, severity: 'critical', description: 'Airspace closure due to regional security threats. All civilian traffic diverted.', timestamp: '2026-03-03T02:45:00Z', active: true },
];

export const mockVessels: MaritimeVessel[] = [
  { id: 'v-001', name: 'USS EISENHOWER', type: 'MILITARY', flag: 'US', lat: 25.8, lng: 52.3, heading: 270, speed: 18, destination: 'Arabian Sea', timestamp: '2026-03-03T11:00:00Z' },
  { id: 'v-002', name: 'LIAONING', type: 'MILITARY', flag: 'CN', lat: 16.2, lng: 112.8, heading: 180, speed: 15, destination: 'South China Sea', timestamp: '2026-03-03T10:30:00Z' },
  { id: 'v-003', name: 'ADMIRAL KUZNETSOV', type: 'MILITARY', flag: 'RU', lat: 34.5, lng: 32.0, heading: 90, speed: 12, destination: 'Eastern Med', timestamp: '2026-03-03T09:00:00Z' },
  { id: 'v-004', name: 'EVER GIVEN II', type: 'CARGO', flag: 'PA', lat: 30.0, lng: 32.5, heading: 0, speed: 14, destination: 'Rotterdam', timestamp: '2026-03-03T11:30:00Z' },
  { id: 'v-005', name: 'PACIFIC TRADER', type: 'TANKER', flag: 'LR', lat: 14.5, lng: 42.5, heading: 340, speed: 11, destination: 'Jeddah', timestamp: '2026-03-03T08:15:00Z' },
  { id: 'v-006', name: 'HAIYANG SHIYOU', type: 'UNKNOWN', flag: 'CN', lat: 10.5, lng: 115.0, heading: 225, speed: 8, destination: 'Unknown', timestamp: '2026-03-03T07:00:00Z' },
  { id: 'v-007', name: 'HMS QUEEN ELIZABETH', type: 'MILITARY', flag: 'GB', lat: 56.5, lng: 19.5, heading: 45, speed: 20, destination: 'Baltic Patrol', timestamp: '2026-03-03T10:00:00Z' },
  { id: 'v-008', name: 'JS IZUMO', type: 'MILITARY', flag: 'JP', lat: 24.5, lng: 123.0, heading: 200, speed: 16, destination: 'East China Sea', timestamp: '2026-03-03T09:45:00Z' },
];

export const mockGeoAlerts: GeoAlert[] = [
  { id: 'ga-001', type: 'MILITARY', region: 'South China Sea', title: 'Naval buildup detected near Spratly Islands', summary: 'Satellite imagery reveals increased naval presence. Multiple warships and support vessels identified in disputed waters.', severity: 'high', source: 'OSINT Satellite Analysis', timestamp: '2026-03-03T11:30:00Z', lat: 10.0, lng: 114.0 },
  { id: 'ga-002', type: 'DIPLOMATIC', region: 'Middle East', title: 'UN Security Council emergency session called', summary: 'Emergency session scheduled regarding Red Sea shipping disruptions. Multiple nations requesting increased naval escort operations.', severity: 'high', source: 'UN Wire Service', timestamp: '2026-03-03T10:00:00Z', lat: 40.7, lng: -74.0 },
  { id: 'ga-003', type: 'ECONOMIC', region: 'Europe', title: 'Energy supply disruption warning — Baltic pipeline', summary: 'Intelligence reports suggest potential risk to undersea infrastructure in Baltic region. NATO patrols increased.', severity: 'medium', source: 'European Energy Agency', timestamp: '2026-03-03T09:15:00Z', lat: 55.0, lng: 15.0 },
  { id: 'ga-004', type: 'HUMANITARIAN', region: 'Red Sea / Horn of Africa', title: 'Shipping lane closures affecting aid delivery', summary: 'Humanitarian organizations report delays in aid shipments due to security-related shipping diversions around Cape of Good Hope.', severity: 'critical', source: 'ICRC Report', timestamp: '2026-03-03T08:30:00Z', lat: 12.0, lng: 43.0 },
  { id: 'ga-005', type: 'MILITARY', region: 'Eastern Europe', title: 'Increased aerial reconnaissance activity', summary: 'Multiple surveillance aircraft detected operating along NATO eastern flank. Pattern suggests heightened intelligence gathering operations.', severity: 'medium', source: 'Flight Tracking Analysis', timestamp: '2026-03-03T07:00:00Z', lat: 51.0, lng: 24.0 },
  { id: 'ga-006', type: 'DIPLOMATIC', region: 'Indo-Pacific', title: 'Quad nations announce joint maritime patrol', summary: 'Australia, India, Japan, and US announce coordinated freedom of navigation operations in Indo-Pacific region.', severity: 'low', source: 'Joint Press Release', timestamp: '2026-03-03T06:00:00Z', lat: 20.0, lng: 100.0 },
];

export const mockRiskScore: RiskScore = {
  overall: 67,
  airspace: 72,
  maritime: 75,
  diplomatic: 58,
  sentiment: 63,
  trend: 'rising',
  lastUpdated: '2026-03-03T12:00:00Z',
};

export const mockTimeline: TimelineEvent[] = [
  { id: 'te-001', timestamp: '2026-03-03T02:00:00Z', type: 'airspace', title: 'Red Sea airspace closure issued', severity: 'critical' },
  { id: 'te-002', timestamp: '2026-03-03T04:00:00Z', type: 'maritime', title: 'SCS naval exercise zone established', severity: 'high' },
  { id: 'te-003', timestamp: '2026-03-03T06:00:00Z', type: 'diplomatic', title: 'Quad joint patrol announced', severity: 'low' },
  { id: 'te-004', timestamp: '2026-03-03T06:00:00Z', type: 'airspace', title: 'Black Sea airspace closure extended', severity: 'critical' },
  { id: 'te-005', timestamp: '2026-03-03T07:00:00Z', type: 'alert', title: 'Aerial recon activity — Eastern Europe', severity: 'medium' },
  { id: 'te-006', timestamp: '2026-03-03T08:30:00Z', type: 'alert', title: 'Humanitarian shipping disruption alert', severity: 'critical' },
  { id: 'te-007', timestamp: '2026-03-03T09:15:00Z', type: 'alert', title: 'Baltic energy infrastructure warning', severity: 'medium' },
  { id: 'te-008', timestamp: '2026-03-03T10:00:00Z', type: 'diplomatic', title: 'UN Security Council emergency session', severity: 'high' },
  { id: 'te-009', timestamp: '2026-03-03T10:15:00Z', type: 'airspace', title: 'Persian Gulf NOTAM advisory', severity: 'medium' },
  { id: 'te-010', timestamp: '2026-03-03T11:30:00Z', type: 'maritime', title: 'Spratly Islands naval buildup detected', severity: 'high' },
];

export const regions = [
  'Global', 'South China Sea', 'Eastern Mediterranean', 'Black Sea',
  'Persian Gulf', 'Red Sea', 'Baltic Sea', 'Indo-Pacific', 'Eastern Europe'
] as const;
