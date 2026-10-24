import {
  CARS,
  CarId,
  CLASS_REWARD,
  GraphicsQuality,
  RANKS,
  RankClass,
  SpecialId,
  SpeedLevelId,
} from '../config';

export interface DailyMissionState {
  id: string;
  title: string;
  target: number;
  progress: number;
  rewardCoins: number;
  claimed: boolean;
}

export interface SaveData {
  version: number;
  pilotName: string;
  avatarId: number;
  coins: number;
  bestExp: number;
  exp2Best: number; // Mega Rush track best EXP
  totalRaces: number;
  totalDistance: number;
  selectedCar: CarId;
  selectedSpeed: SpeedLevelId;
  specials: Record<SpecialId, number>;
  equippedSpecial: SpecialId | null;
  seenPromotions: RankClass[];
  tutorialDone: boolean;
  dailyDay: number;
  lastClaimDate: string;
  missionsDate: string;
  missions: DailyMissionState[];
  settings: {
    sound: boolean;
    music: boolean;
    cameraMotion: boolean; // v4.6 default false = fixed center view
    dangerArrows: boolean;
    graphics: GraphicsQuality;
    lang: 'en' | 'fr' | 'ja' | 'pt' | 'de' | 'es';
  };
}

const STORAGE_KEY = 'sky_roadster_save_v4';

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function buildDailyMissions(dateKey: string): DailyMissionState[] {
  const seed = dateKey.split('-').reduce((acc, p) => acc * 31 + Number(p), 7);
  const pool: Omit<DailyMissionState, 'progress' | 'claimed'>[] = [
    { id: 'dist_2000', title: 'Drive 2,000 m across the skyway', target: 2000, rewardCoins: 250 },
    { id: 'coins_80', title: 'Collect 80 Energy Coins', target: 80, rewardCoins: 220 },
    { id: 'exp_1200', title: 'Earn 1,200 EXP in a single race', target: 1200, rewardCoins: 300 },
    { id: 'rings_5', title: 'Fly through 5 Energy Rings', target: 5, rewardCoins: 280 },
    { id: 'special_1', title: 'Activate any Special boost in a race', target: 1, rewardCoins: 240 },
    { id: 'jumps_12', title: 'Perform 12 sky hops or dives', target: 12, rewardCoins: 200 },
  ];
  const chosen: DailyMissionState[] = [];
  for (let i = 0; i < 4; i++) {
    const item = pool[(seed + i * 2) % pool.length];
    chosen.push({ ...item, progress: 0, claimed: false });
  }
  return chosen;
}

export function createDefaultSave(): SaveData {
  const today = todayStr();
  return {
    version: 461,
    pilotName: `PILOT-${Math.floor(1000 + Math.random() * 9000)}`,
    avatarId: 0,
    coins: 1250,
    bestExp: 0,
    exp2Best: 0,
    totalRaces: 0,
    totalDistance: 0,
    selectedCar: 'zenith',
    selectedSpeed: 'normal',
    specials: {
      sos: 1,
      roadster: 2,
      hyper: 1,
    },
    equippedSpecial: null,
    seenPromotions: ['D'],
    tutorialDone: false,
    dailyDay: 1,
    lastClaimDate: '',
    missionsDate: today,
    missions: buildDailyMissions(today),
    settings: {
      sound: true,
      music: true,
      cameraMotion: false,
      dangerArrows: true,
      graphics: 'medium',
      lang: 'en',
    },
  };
}

export class SaveStore {
  public data: SaveData;

  constructor() {
    this.data = this.load();
  }

  private load(): SaveData {
    const fallback = createDefaultSave();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      const merged: SaveData = {
        ...fallback,
        ...parsed,
        specials: {
          ...fallback.specials,
          ...(parsed.specials ?? {}),
        },
        settings: {
          ...fallback.settings,
          ...(parsed.settings ?? {}),
        },
      };
      const today = todayStr();
      if (merged.missionsDate !== today || !Array.isArray(merged.missions) || merged.missions.length === 0) {
        merged.missionsDate = today;
        merged.missions = buildDailyMissions(today);
      }
      if (!CARS.some((c) => c.id === merged.selectedCar)) {
        merged.selectedCar = 'zenith';
      }
      return merged;
    } catch {
      return fallback;
    }
  }

  public save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // Ignore quota errors in restricted frames
    }
  }

  public getPlayerRank(): RankClass {
    let best: RankClass = 'D';
    for (const r of RANKS) {
      if (r.track2Only) {
        if (this.data.exp2Best >= r.exp && this.data.bestExp >= 40000) {
          best = r.id;
        }
      } else if (this.data.bestExp >= r.exp) {
        best = r.id;
      }
    }
    return best;
  }

  public getRankIndex(rank: RankClass = this.getPlayerRank()): number {
    return RANKS.findIndex((r) => r.id === rank);
  }

  public isCarUnlocked(carId: CarId): boolean {
    const car = CARS.find((c) => c.id === carId);
    if (!car) return false;
    const playerIdx = this.getRankIndex(this.getPlayerRank());
    const reqIdx = this.getRankIndex(car.requiredRank);
    return playerIdx >= reqIdx;
  }

  public canClaimDaily(): boolean {
    return this.data.lastClaimDate !== todayStr();
  }

  public claimDaily(): { day: number; coins: number; special?: SpecialId } | null {
    if (!this.canClaimDaily()) return null;
    const day = this.data.dailyDay;
    const coinsByDay = [150, 200, 250, 300, 350, 400, 600];
    const coins = coinsByDay[(day - 1) % 7];
    let special: SpecialId | undefined;
    if (day === 7) {
      special = 'hyper';
      this.data.specials.hyper += 1;
    } else if (day === 4) {
      special = 'roadster';
      this.data.specials.roadster += 1;
    }
    this.data.coins += coins;
    this.data.lastClaimDate = todayStr();
    this.data.dailyDay = (day % 7) + 1;
    this.save();
    return { day, coins, special };
  }

  public recordRunProgress(stats: {
    distanceMeters: number;
    coinsCollected: number;
    expEarned: number;
    ringsPassed: number;
    specialsUsed: number;
    hopsAndDives: number;
    isMegaRush: boolean;
  }): { promotedTo: RankClass | null; promotionReward: { coins: number; special: SpecialId } | null } {
    const prevRankIdx = this.getRankIndex();
    this.data.totalRaces += 1;
    this.data.totalDistance += Math.round(stats.distanceMeters);
    this.data.coins += stats.coinsCollected;

    if (stats.isMegaRush) {
      if (stats.expEarned > this.data.exp2Best) {
        this.data.exp2Best = stats.expEarned;
      }
    } else {
      if (stats.expEarned > this.data.bestExp) {
        this.data.bestExp = stats.expEarned;
      }
    }

    for (const m of this.data.missions) {
      if (m.claimed) continue;
      if (m.id === 'dist_2000') m.progress = Math.min(m.target, m.progress + Math.round(stats.distanceMeters));
      if (m.id === 'coins_80') m.progress = Math.min(m.target, m.progress + stats.coinsCollected);
      if (m.id === 'exp_1200') m.progress = Math.min(m.target, Math.max(m.progress, stats.expEarned));
      if (m.id === 'rings_5') m.progress = Math.min(m.target, m.progress + stats.ringsPassed);
      if (m.id === 'special_1') m.progress = Math.min(m.target, m.progress + stats.specialsUsed);
      if (m.id === 'jumps_12') m.progress = Math.min(m.target, m.progress + stats.hopsAndDives);
    }

    const newRank = this.getPlayerRank();
    const newRankIdx = this.getRankIndex(newRank);
    let promotedTo: RankClass | null = null;
    let promotionReward: { coins: number; special: SpecialId } | null = null;

    if (newRankIdx > prevRankIdx && !this.data.seenPromotions.includes(newRank)) {
      promotedTo = newRank;
      this.data.seenPromotions.push(newRank);
      const reward = CLASS_REWARD[newRank];
      if (reward) {
        this.data.coins += reward.coins;
        this.data.specials[reward.special] += 1;
        promotionReward = reward;
      }
    }

    this.save();
    return { promotedTo, promotionReward };
  }
}
