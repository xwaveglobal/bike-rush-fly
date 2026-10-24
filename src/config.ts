export const VERSION = '4.6.1';

export const LANES = [-2.8, 0, 2.8] as const;
export type LaneIndex = 0 | 1 | 2;

export const HEIGHT = {
  LOW: 0.32,
  NORMAL: 0.78,
  HIGH: 3.35,
  SUPER: 5.6,
  HYPER: 7.4,
  SOS: 9.6,
} as const;

export const CAR_HALF = {
  x: 0.88,
  y: 0.52,
  z: 2.12,
} as const;

export const RENDER = {
  carHeightScale: 1.15, // v4.6: 15% taller body at runtime
} as const;

export const TIMING = {
  laneSwitch: 0.17,
  hopAnticipation: 0.04,
  hopRise: 0.22,
  hopHold: 0.34,
  hopFall: 0.24,
  hopRest: 0.03,
  diveDrop: 0.12,
  diveHold: 0.44,
  diveRise: 0.16,
  airDashDuration: 0.42,
  airDashGrace: 0.25,
  superRise: 0.38,
  superHold: 1.45,
  superFall: 0.38,
  superGrace: 0.5,
  hyperHold: 2.1,
  sosHold: 3.0,
  inputBuffer: 0.16,
} as const;

export const SPEED = {
  start: 21.1, // ~76 km/h in m/s
  max: 46.1,   // ~166 km/h in m/s
  rampDist: 3200,
  turboMult: 1.55,
} as const;

export type SpeedLevelId = 'easy' | 'normal' | 'hard';

export interface SpeedLevelConfig {
  id: SpeedLevelId;
  label: string;
  speedMult: number;
  spacingMult: number;
  expRate: number;
  coinMult: number;
  color: string;
  stars: number;
}

export const SPEED_LEVELS: Record<SpeedLevelId, SpeedLevelConfig> = {
  easy: {
    id: 'easy',
    label: 'EASY',
    speedMult: 0.82,
    spacingMult: 1.2,
    expRate: 0.2,
    coinMult: 1.0,
    color: '#22c55e',
    stars: 1,
  },
  normal: {
    id: 'normal',
    label: 'NORMAL',
    speedMult: 1.21,
    spacingMult: 1.0,
    expRate: 0.23,
    coinMult: 1.25,
    color: '#f59e0b',
    stars: 2,
  },
  hard: {
    id: 'hard',
    label: 'HARD',
    speedMult: 1.5,
    spacingMult: 0.92,
    expRate: 0.4,
    coinMult: 1.6,
    color: '#ef4444',
    stars: 3,
  },
};

export type RankClass = 'D' | 'C' | 'B' | 'A' | 'AA' | 'AAA' | 'S' | 'SS' | 'SSS';

export interface RankDef {
  id: RankClass;
  exp: number;
  track2Only?: boolean;
  color: string;
  title: string;
  unlockNote: string;
}

export const RANKS: RankDef[] = [
  { id: 'D', exp: 0, color: '#94a3b8', title: 'Rookie Pilot', unlockNote: 'XWAVE Zenith (Common)' },
  { id: 'C', exp: 3000, color: '#38bdf8', title: 'Sky Cadet', unlockNote: '+300 Coins & 1 Roadster Jump' },
  { id: 'B', exp: 8000, color: '#22c55e', title: 'Aero Runner', unlockNote: '+500 Coins & 1 HYPER JUMP' },
  { id: 'A', exp: 15000, color: '#eab308', title: 'Interceptor', unlockNote: '+800 Coins & 1 Sky Escape' },
  { id: 'AA', exp: 26000, color: '#f97316', title: 'Squadron Ace', unlockNote: 'XWAVE Inferno (Rare)' },
  { id: 'AAA', exp: 40000, color: '#a855f7', title: 'Apex Commander', unlockNote: 'XWAVE Nexus (Epic) & Mega Rush' },
  { id: 'S', exp: 65000, track2Only: true, color: '#ec4899', title: 'Hyper Legend', unlockNote: 'XWAVE Vega (Legendary)' },
  { id: 'SS', exp: 85000, track2Only: true, color: '#06b6d4', title: 'Mythic Sovereign', unlockNote: 'XWAVE Volt (Mythic)' },
  { id: 'SSS', exp: 110000, track2Only: true, color: '#fbbf24', title: 'Ultimate Roadster', unlockNote: 'XWAVE Phantom (Ultimate)' },
];

export const CLASS_REWARD: Partial<Record<RankClass, { coins: number; special: SpecialId }>> = {
  C: { coins: 300, special: 'roadster' },
  B: { coins: 500, special: 'hyper' },
  A: { coins: 800, special: 'sos' },
};

export type CarId = 'zenith' | 'inferno' | 'nexus' | 'vega' | 'volt' | 'phantom';

export interface CarConfig {
  id: CarId;
  name: string;
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary' | 'Mythic' | 'Ultimate';
  requiredRank: RankClass;
  bodyColor: number;
  accentColor: number;
  trimColor: number;
  emissiveColor: number;
  rarityColor: string;
  tagline: string;
}

export const CARS: CarConfig[] = [
  {
    id: 'zenith',
    name: 'XWAVE Zenith',
    rarity: 'Common',
    requiredRank: 'D',
    bodyColor: 0xbae6fd, // v4.6.1 ice blue starter
    accentColor: 0x0284c7,
    trimColor: 0x0f172a,
    emissiveColor: 0x38bdf8,
    rarityColor: '#38bdf8',
    tagline: 'Ice-blue X1 interceptor tuned for balanced sky-lane handling.',
  },
  {
    id: 'inferno',
    name: 'XWAVE Inferno',
    rarity: 'Rare',
    requiredRank: 'AA',
    bodyColor: 0xdc2626,
    accentColor: 0xf97316,
    trimColor: 0x18181b,
    emissiveColor: 0xff4d4d,
    rarityColor: '#f97316',
    tagline: 'Twin-intake crimson aero coupe built for Class AA speed gates.',
  },
  {
    id: 'nexus',
    name: 'XWAVE Nexus',
    rarity: 'Epic',
    requiredRank: 'AAA',
    bodyColor: 0x6d28d9,
    accentColor: 0xc084fc,
    trimColor: 0x090d16,
    emissiveColor: 0xa855f7,
    rarityColor: '#a855f7',
    tagline: 'Deep-violet cyber flagship awarded upon reaching Class AAA.',
  },
  {
    id: 'vega',
    name: 'XWAVE Vega',
    rarity: 'Legendary',
    requiredRank: 'S',
    bodyColor: 0xf8fafc,
    accentColor: 0x38bdf8,
    trimColor: 0x0f172a,
    emissiveColor: 0x60a5fa,
    rarityColor: '#ec4899',
    tagline: 'Pearl-white studio master roadster unlocked in Class S.',
  },
  {
    id: 'volt',
    name: 'XWAVE Volt',
    rarity: 'Mythic',
    requiredRank: 'SS',
    bodyColor: 0x0891b2,
    accentColor: 0x22d3ee,
    trimColor: 0x042f2e,
    emissiveColor: 0x00f5d4,
    rarityColor: '#06b6d4',
    tagline: 'High-voltage plasma chassis forged for Mega Rush masters.',
  },
  {
    id: 'phantom',
    name: 'XWAVE Phantom',
    rarity: 'Ultimate',
    requiredRank: 'SSS',
    bodyColor: 0x1e293b,
    accentColor: 0xfbbf24,
    trimColor: 0x020617,
    emissiveColor: 0xf59e0b,
    rarityColor: '#fbbf24',
    tagline: 'Obsidian-and-gold apex hypercar reserved for Class SSS legends.',
  },
];

export type SpecialId = 'sos' | 'roadster' | 'hyper';

export interface SpecialConfig {
  id: SpecialId;
  name: string;
  shortName: string;
  price: number;
  color: string;
  description: string;
}

export const SPECIALS: Record<SpecialId, SpecialConfig> = {
  sos: {
    id: 'sos',
    name: 'Sky Escape (SOS)',
    shortName: 'SOS',
    price: 1200,
    color: '#ef4444',
    description: 'Rockets to 9.6 m and cruises above all hazards for 3.0 s with a landing shockwave.',
  },
  roadster: {
    id: 'roadster',
    name: 'Roadster Jump',
    shortName: 'ROADSTER',
    price: 1800,
    color: '#a855f7',
    description: 'Rocket-assisted super jump to 5.6 m with a mid-air barrel roll that clears 4 obstacle rows.',
  },
  hyper: {
    id: 'hyper',
    name: 'HYPER JUMP',
    shortName: 'HYPER',
    price: 4000,
    color: '#fbbf24',
    description: 'Mythic 7.4 m flight with double barrel roll, golden trail, +25 coins & landing shockwave.',
  },
};

export interface WorldThemeConfig {
  id: string;
  name: string;
  skyColor: number;
  fogColor: number;
  roadTint: number;
  neonPrimary: number;
  neonSecondary: number;
  ambientIntensity: number;
}

export const WORLDS: WorldThemeConfig[] = [
  {
    id: 'future_city',
    name: 'Future City',
    skyColor: 0x05081c,
    fogColor: 0x0b1033,
    roadTint: 0x161c2e,
    neonPrimary: 0x38bdf8,
    neonSecondary: 0xf43f5e,
    ambientIntensity: 1.0,
  },
  {
    id: 'neon_tunnel',
    name: 'Neon Tunnel',
    skyColor: 0x090418,
    fogColor: 0x1a0b2e,
    roadTint: 0x18122b,
    neonPrimary: 0xa855f7,
    neonSecondary: 0xf97316,
    ambientIntensity: 0.95,
  },
  {
    id: 'cloud_city',
    name: 'Cloud City',
    skyColor: 0x0c1938,
    fogColor: 0x1e3a5f,
    roadTint: 0x1e293b,
    neonPrimary: 0x38bdf8,
    neonSecondary: 0xfbbf24,
    ambientIntensity: 1.15,
  },
  {
    id: 'space_zone',
    name: 'Space Zone',
    skyColor: 0x02040a,
    fogColor: 0x060b19,
    roadTint: 0x0f172a,
    neonPrimary: 0x22d3ee,
    neonSecondary: 0xec4899,
    ambientIntensity: 0.9,
  },
  {
    id: 'megacity',
    name: 'XWAVE Megacity',
    skyColor: 0x070510,
    fogColor: 0x190d24,
    roadTint: 0x171524,
    neonPrimary: 0xf43f5e,
    neonSecondary: 0x38bdf8,
    ambientIntensity: 1.05,
  },
];

export type TrackId = 'endless' | 'mega_rush' | 'bonus' | 'training';

export interface TrackConfig {
  id: TrackId;
  name: string;
  subtitle: string;
  lengthMeters: number; // 0 = endless
  expMult: number;
  coinMult: number;
  requiredRank: RankClass;
  accent: string;
}

export const TRACKS: TrackConfig[] = [
  {
    id: 'endless',
    name: 'Endless Skyway',
    subtitle: 'Rank Ladder D → AAA · Rotating Worlds every 1,000 m',
    lengthMeters: 0,
    expMult: 1.0,
    coinMult: 1.0,
    requiredRank: 'D',
    accent: '#38bdf8',
  },
  {
    id: 'mega_rush',
    name: 'Mega Rush',
    subtitle: 'High-Density Apex Road · The Only Path to S / SS / SSS',
    lengthMeters: 0,
    expMult: 1.25,
    coinMult: 1.35,
    requiredRank: 'AAA',
    accent: '#ec4899',
  },
  {
    id: 'bonus',
    name: 'Horizon Bonus Run',
    subtitle: '5-Minute Coin Highway · Showcase Specials & Ring Jackpots',
    lengthMeters: 3600,
    expMult: 0,
    coinMult: 1.5,
    requiredRank: 'D',
    accent: '#fbbf24',
  },
  {
    id: 'training',
    name: 'Pilot Training',
    subtitle: 'Guided Practice: Lanes, Hop, Dive, Rings & Rocket Jump',
    lengthMeters: 900,
    expMult: 0,
    coinMult: 0.5,
    requiredRank: 'D',
    accent: '#22c55e',
  },
];

export const POWERUP_DURATION = {
  shield: 10.0,
  magnet: 10.0,
  turbo: 4.5,
  doubleCoins: 8.0,
} as const;

export const FAIRNESS = {
  laneStepTime: 0.22,
  verticalActionTime: 0.28,
  reactionSlack: 0.16,
  minRowGapMeters: 16,
} as const;

export const CAMERA = {
  fixed: { dist: 7.4, height: 3.45, lookAhead: 11.5, fov: 56 },
  chase: { dist: 6.5, height: 2.85, lookAhead: 13.0, fov: 60 },
  home: { radius: 5.8, height: 2.25, lookY: 0.75, fov: 46 },
} as const;

export type GraphicsQuality = 'low' | 'medium' | 'high';

export const GRAPHICS: Record<
  GraphicsQuality,
  { pixelRatioCap: number; particleScale: number; roadTexSize: number; buildingCount: number }
> = {
  low: { pixelRatioCap: 1.0, particleScale: 0.5, roadTexSize: 256, buildingCount: 24 },
  medium: { pixelRatioCap: 1.5, particleScale: 0.8, roadTexSize: 512, buildingCount: 36 },
  high: { pixelRatioCap: 2.0, particleScale: 1.0, roadTexSize: 512, buildingCount: 48 },
};
