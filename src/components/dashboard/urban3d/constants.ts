// Static data extracted from UrbanScene3D

export interface CityLandmark {
  name: string;
  lat: number;
  lng: number;
  country: string;
  landmark: string;
  image: string;
  pop: string;
}

export const PRESETS = [
  { name: "Middle East", lat: 29.5, lng: 47.5 },
  { name: "Tehran", lat: 35.6892, lng: 51.389 },
  { name: "Tel Aviv", lat: 32.0853, lng: 34.7818 },
  { name: "Beirut", lat: 33.8938, lng: 35.5018 },
  { name: "Damascus", lat: 33.5138, lng: 36.2765 },
  { name: "Riyadh", lat: 24.7136, lng: 46.6753 },
  { name: "Baghdad", lat: 33.3152, lng: 44.3661 },
  { name: "Dubai", lat: 25.2048, lng: 55.2708 },
  { name: "Amman", lat: 31.9454, lng: 35.9284 },
  { name: "New York", lat: 40.7128, lng: -74.006 },
  { name: "London", lat: 51.5074, lng: -0.1278 },
  { name: "Tokyo", lat: 35.6762, lng: 139.6503 },
];

export const MARITIME_CORRIDORS = [
  { latMin: 23.5, latMax: 30.8, lngMin: 47.5, lngMax: 56.8 },
  { latMin: 22.0, latMax: 27.8, lngMin: 55.8, lngMax: 62.8 },
  { latMin: 12.0, latMax: 30.8, lngMin: 32.0, lngMax: 43.8 },
  { latMin: 30.0, latMax: 33.6, lngMin: 31.8, lngMax: 33.2 },
  { latMin: 31.0, latMax: 37.2, lngMin: 33.2, lngMax: 36.8 },
  { latMin: 36.3, latMax: 47.2, lngMin: 47.0, lngMax: 54.8 },
];

export const CITY_LANDMARKS_3D: CityLandmark[] = [
  { name: "Tehran", lat: 35.69, lng: 51.39, country: "Iran", landmark: "Azadi Tower", image: "https://images.unsplash.com/photo-1573225935973-40b81e22e6e3?w=320&h=200&fit=crop", pop: "9.1M" },
  { name: "Isfahan", lat: 32.65, lng: 51.68, country: "Iran", landmark: "Naqsh-e Jahan Square", image: "https://images.unsplash.com/photo-1565447786498-aa4c35d2aa6b?w=320&h=200&fit=crop", pop: "2.2M" },
  { name: "Shiraz", lat: 29.59, lng: 52.58, country: "Iran", landmark: "Nasir al-Mulk Mosque", image: "https://images.unsplash.com/photo-1564399580075-5dfe19c205f0?w=320&h=200&fit=crop", pop: "1.9M" },
  { name: "Tabriz", lat: 38.08, lng: 46.29, country: "Iran", landmark: "Tabriz Grand Bazaar", image: "https://images.unsplash.com/photo-1590595978583-3967cf17d2ea?w=320&h=200&fit=crop", pop: "1.8M" },
  { name: "Mashhad", lat: 36.3, lng: 59.6, country: "Iran", landmark: "Imam Reza Shrine", image: "https://images.unsplash.com/photo-1580834341580-8c17a3a630c1?w=320&h=200&fit=crop", pop: "3.4M" },
  { name: "Kerman", lat: 30.28, lng: 57.08, country: "Iran", landmark: "Ganjali Khan Complex", image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=320&h=200&fit=crop", pop: "738K" },
  { name: "Yazd", lat: 31.9, lng: 54.37, country: "Iran", landmark: "Tower of Silence", image: "https://images.unsplash.com/photo-1566236297412-60a3c6883482?w=320&h=200&fit=crop", pop: "530K" },
  { name: "Amman", lat: 31.95, lng: 35.93, country: "Jordan", landmark: "Roman Theatre", image: "https://images.unsplash.com/photo-1580834341580-8c17a3a630c1?w=320&h=200&fit=crop", pop: "4.1M" },
  { name: "Petra (Wadi Musa)", lat: 30.33, lng: 35.44, country: "Jordan", landmark: "The Treasury", image: "https://images.unsplash.com/photo-1579606032821-4e6161c81571?w=320&h=200&fit=crop", pop: "35K" },
  { name: "Aqaba", lat: 29.53, lng: 35.01, country: "Jordan", landmark: "Red Sea Port", image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=320&h=200&fit=crop", pop: "188K" },
  { name: "Irbid", lat: 32.56, lng: 35.85, country: "Jordan", landmark: "Yarmouk University", image: "https://images.unsplash.com/photo-1566236297412-60a3c6883482?w=320&h=200&fit=crop", pop: "500K" },
  { name: "Zarqa", lat: 32.07, lng: 36.09, country: "Jordan", landmark: "Industrial Hub", image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=320&h=200&fit=crop", pop: "635K" },
  { name: "Jerash", lat: 32.27, lng: 35.89, country: "Jordan", landmark: "Roman Ruins of Gerasa", image: "https://images.unsplash.com/photo-1564399580075-5dfe19c205f0?w=320&h=200&fit=crop", pop: "50K" },
  { name: "Madaba", lat: 31.72, lng: 35.79, country: "Jordan", landmark: "Mosaic Map of Holy Land", image: "https://images.unsplash.com/photo-1566236297412-60a3c6883482?w=320&h=200&fit=crop", pop: "83K" },
  { name: "Salt", lat: 32.04, lng: 35.73, country: "Jordan", landmark: "Ottoman Architecture", image: "https://images.unsplash.com/photo-1580834341580-8c17a3a630c1?w=320&h=200&fit=crop", pop: "97K" },
  { name: "Karak", lat: 31.18, lng: 35.70, country: "Jordan", landmark: "Karak Castle", image: "https://images.unsplash.com/photo-1564399580075-5dfe19c205f0?w=320&h=200&fit=crop", pop: "68K" },
  { name: "Mafraq", lat: 32.34, lng: 36.21, country: "Jordan", landmark: "Northern Gateway", image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=320&h=200&fit=crop", pop: "57K" },
  { name: "Tafilah", lat: 30.84, lng: 35.60, country: "Jordan", landmark: "Dana Nature Reserve", image: "https://images.unsplash.com/photo-1566236297412-60a3c6883482?w=320&h=200&fit=crop", pop: "33K" },
  { name: "Ma'an", lat: 30.20, lng: 35.73, country: "Jordan", landmark: "Gateway to Petra", image: "https://images.unsplash.com/photo-1579606032821-4e6161c81571?w=320&h=200&fit=crop", pop: "41K" },
  { name: "Ajloun", lat: 32.33, lng: 35.75, country: "Jordan", landmark: "Ajloun Castle", image: "https://images.unsplash.com/photo-1564399580075-5dfe19c205f0?w=320&h=200&fit=crop", pop: "42K" },
  { name: "Wadi Rum", lat: 29.57, lng: 35.42, country: "Jordan", landmark: "Valley of the Moon", image: "https://images.unsplash.com/photo-1579606032821-4e6161c81571?w=320&h=200&fit=crop", pop: "—" },
  { name: "Umm Qais", lat: 32.65, lng: 35.68, country: "Jordan", landmark: "Gadara Ruins", image: "https://images.unsplash.com/photo-1566236297412-60a3c6883482?w=320&h=200&fit=crop", pop: "—" },
  { name: "Sweimeh (Dead Sea)", lat: 31.72, lng: 35.59, country: "Jordan", landmark: "Dead Sea Resorts", image: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=320&h=200&fit=crop", pop: "—" },
  { name: "Russeifa", lat: 32.01, lng: 36.05, country: "Jordan", landmark: "Eastern Amman Suburb", image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=320&h=200&fit=crop", pop: "350K" },
  { name: "Aqaba Port", lat: 29.52, lng: 35.01, country: "Jordan", landmark: "Red Sea Gateway", image: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=320&h=200&fit=crop", pop: "—" },
  { name: "Jerusalem", lat: 31.77, lng: 35.23, country: "Israel/Palestine", landmark: "Dome of the Rock", image: "https://images.unsplash.com/photo-1547483238-2cbf881a559f?w=320&h=200&fit=crop", pop: "936K" },
  { name: "Tel Aviv", lat: 32.08, lng: 34.78, country: "Israel", landmark: "White City", image: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=320&h=200&fit=crop", pop: "460K" },
  { name: "Dubai", lat: 25.2, lng: 55.27, country: "UAE", landmark: "Burj Khalifa", image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=320&h=200&fit=crop", pop: "3.5M" },
  { name: "Abu Dhabi", lat: 24.45, lng: 54.38, country: "UAE", landmark: "Sheikh Zayed Mosque", image: "https://images.unsplash.com/photo-1512632578888-169bbbc64f33?w=320&h=200&fit=crop", pop: "1.5M" },
  { name: "Sharjah", lat: 25.34, lng: 55.39, country: "UAE", landmark: "Al Majaz Waterfront", image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=320&h=200&fit=crop", pop: "1.4M" },
  { name: "Ajman", lat: 25.41, lng: 55.44, country: "UAE", landmark: "Ajman Corniche", image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=320&h=200&fit=crop", pop: "504K" },
  { name: "Ras Al Khaimah", lat: 25.79, lng: 55.97, country: "UAE", landmark: "Jebel Jais", image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=320&h=200&fit=crop", pop: "345K" },
  { name: "Fujairah", lat: 25.13, lng: 56.33, country: "UAE", landmark: "Fujairah Fort", image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=320&h=200&fit=crop", pop: "225K" },
  { name: "Umm Al Quwain", lat: 25.56, lng: 55.55, country: "UAE", landmark: "UAQ Fort", image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=320&h=200&fit=crop", pop: "72K" },
  { name: "Al Ain", lat: 24.22, lng: 55.76, country: "UAE", landmark: "Jebel Hafeet", image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=320&h=200&fit=crop", pop: "766K" },
  { name: "Manama", lat: 26.07, lng: 50.55, country: "Bahrain", landmark: "World Trade Center", image: "https://images.unsplash.com/photo-1580745482925-d3806a527cec?w=320&h=200&fit=crop", pop: "411K" },
  { name: "Kuwait City", lat: 29.38, lng: 47.99, country: "Kuwait", landmark: "Kuwait Towers", image: "https://images.unsplash.com/photo-1568816132a-27b5c4caa97a?w=320&h=200&fit=crop", pop: "3.1M" },
  { name: "Doha", lat: 25.29, lng: 51.53, country: "Qatar", landmark: "Museum of Islamic Art", image: "https://images.unsplash.com/photo-1548017544-240c59b4ae3c?w=320&h=200&fit=crop", pop: "1.2M" },
  { name: "Muscat", lat: 23.59, lng: 58.59, country: "Oman", landmark: "Sultan Qaboos Mosque", image: "https://images.unsplash.com/photo-1609599006353-e629aaabfeae?w=320&h=200&fit=crop", pop: "1.4M" },
  { name: "Baghdad", lat: 33.31, lng: 44.37, country: "Iraq", landmark: "Al-Shaheed Monument", image: "https://images.unsplash.com/photo-1603565816030-6b389eeb23cb?w=320&h=200&fit=crop", pop: "8.1M" },
  { name: "Erbil", lat: 36.19, lng: 44.01, country: "Iraq", landmark: "Erbil Citadel", image: "https://images.unsplash.com/photo-1601918774946-7c269a6be31a?w=320&h=200&fit=crop", pop: "880K" },
  { name: "Basra", lat: 30.51, lng: 47.78, country: "Iraq", landmark: "Shatt al-Arab", image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=320&h=200&fit=crop", pop: "2.1M" },
  { name: "Riyadh", lat: 24.71, lng: 46.67, country: "Saudi Arabia", landmark: "Kingdom Centre", image: "https://images.unsplash.com/photo-1586724237569-f3d0c1dee8c6?w=320&h=200&fit=crop", pop: "7.6M" },
  { name: "Mecca", lat: 21.43, lng: 39.83, country: "Saudi Arabia", landmark: "Masjid al-Haram", image: "https://images.unsplash.com/photo-1591604129939-f1efa4d99f7e?w=320&h=200&fit=crop", pop: "2.4M" },
  { name: "Medina", lat: 24.47, lng: 39.61, country: "Saudi Arabia", landmark: "Al-Masjid an-Nabawi", image: "https://images.unsplash.com/photo-1542816417-0983c9c7ad7c?w=320&h=200&fit=crop", pop: "1.5M" },
  { name: "Jeddah", lat: 21.54, lng: 39.17, country: "Saudi Arabia", landmark: "King Fahd Fountain", image: "https://images.unsplash.com/photo-1587974928442-77dc3e0748b1?w=320&h=200&fit=crop", pop: "4.7M" },
  { name: "Beirut", lat: 33.89, lng: 35.5, country: "Lebanon", landmark: "Pigeon Rocks", image: "https://images.unsplash.com/photo-1579606032821-4e6161c81571?w=320&h=200&fit=crop", pop: "2.4M" },
  { name: "Damascus", lat: 33.51, lng: 36.29, country: "Syria", landmark: "Umayyad Mosque", image: "https://images.unsplash.com/photo-1566236297412-60a3c6883482?w=320&h=200&fit=crop", pop: "2.5M" },
  { name: "Aleppo", lat: 36.2, lng: 37.16, country: "Syria", landmark: "Citadel of Aleppo", image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=320&h=200&fit=crop", pop: "1.9M" },
  { name: "Cairo", lat: 30.04, lng: 31.24, country: "Egypt", landmark: "Pyramids of Giza", image: "https://images.unsplash.com/photo-1539768942893-daf53e736495?w=320&h=200&fit=crop", pop: "21M" },
  { name: "Sana'a", lat: 15.37, lng: 44.19, country: "Yemen", landmark: "Old City", image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=320&h=200&fit=crop", pop: "4M" },
  { name: "Aden", lat: 12.78, lng: 45.04, country: "Yemen", landmark: "Aden Harbor", image: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=320&h=200&fit=crop", pop: "1.0M" },
  { name: "Ankara", lat: 39.93, lng: 32.86, country: "Turkey", landmark: "Anıtkabir", image: "https://images.unsplash.com/photo-1589254065878-42c014f2d4d6?w=320&h=200&fit=crop", pop: "5.7M" },
  { name: "Istanbul", lat: 41.01, lng: 28.98, country: "Turkey", landmark: "Hagia Sophia", image: "https://images.unsplash.com/photo-1541432901042-2d8bd64b4a9b?w=320&h=200&fit=crop", pop: "15.8M" },
];
