import { LANES, LaneIndex, SpeedLevelConfig, TrackId } from '../config';
import { createInitialReachable, ReachableMask, RowPattern, validateRowFairness } from './Fairness';
import { OBSTACLE_RULES, ObstacleKind } from './ObstacleRules';

export interface ActiveObstacle {
  id: number;
  kind: ObstacleKind;
  lane: LaneIndex;
  baseLane: LaneIndex;
  x: number;
  z: number;
  phase: number;
  passed: boolean;
  smashed: boolean;
}

export type PickupKind = 'coin' | 'shield' | 'magnet' | 'turbo' | 'doubleCoins' | 'airDash' | 'heart';

export interface ActivePickup {
  id: number;
  kind: PickupKind;
  lane: LaneIndex;
  x: number;
  y: number;
  z: number;
  collected: boolean;
}

const CANDIDATE_PATTERNS: { tier: number; row: RowPattern }[] = [
  // Tier 1: Easy single obstacles & rings
  { tier: 1, row: ['crate', null, null] },
  { tier: 1, row: [null, 'crate', null] },
  { tier: 1, row: [null, null, 'crate'] },
  { tier: 1, row: ['barrier', null, null] },
  { tier: 1, row: [null, 'barrier', null] },
  { tier: 1, row: [null, null, 'barrier'] },
  { tier: 1, row: ['beam', null, null] },
  { tier: 1, row: [null, 'beam', null] },
  { tier: 1, row: [null, null, 'beam'] },
  { tier: 1, row: [null, 'ring', null] },
  { tier: 1, row: ['ring', null, 'crate'] },
  // Tier 2: Two-lane mixes, beams + barriers, oncoming traffic
  { tier: 2, row: ['crate', 'crate', null] },
  { tier: 2, row: [null, 'crate', 'crate'] },
  { tier: 2, row: ['crate', null, 'crate'] },
  { tier: 2, row: ['barrier', 'barrier', null] },
  { tier: 2, row: ['beam', 'beam', null] },
  { tier: 2, row: ['traffic', null, 'barrier'] },
  { tier: 2, row: ['beam', null, 'traffic'] },
  { tier: 2, row: [null, 'drone', null] },
  { tier: 2, row: ['crate', 'ring', 'crate'] },
  // Tier 3: Full-width forced vertical actions & laser gates
  { tier: 3, row: ['barrier', 'barrier', 'barrier'] },
  { tier: 3, row: ['beam', 'beam', 'beam'] },
  { tier: 3, row: ['laser_low', 'laser_high', 'laser_low'] },
  { tier: 3, row: ['laser_high', 'laser_low', 'laser_high'] },
  { tier: 3, row: ['traffic', 'barrier', 'traffic'] },
  { tier: 3, row: ['traffic', 'beam', 'traffic'] },
  // Tier 4: Mega gates & high-speed combinations
  { tier: 4, row: ['gate_closed', 'gate_open', 'gate_closed'] },
  { tier: 4, row: ['gate_open', 'gate_closed', 'gate_closed'] },
  { tier: 4, row: ['gate_closed', 'gate_closed', 'gate_open'] },
  { tier: 4, row: ['traffic', 'laser_low', 'traffic'] },
];

export class Spawner {
  private nextId = 1;
  private reachable: ReachableMask = createInitialReachable();
  public nextRowZ = -48;
  private rowsSpawned = 0;
  private nextPowerupDist = 180;
  private nextHeartExp = 1000;
  private seed = 1337;

  public reset(seed = Date.now() % 100000): void {
    this.nextId = 1;
    this.reachable = createInitialReachable();
    this.nextRowZ = -45;
    this.rowsSpawned = 0;
    this.nextPowerupDist = 160;
    this.nextHeartExp = 1000;
    this.seed = seed || 1337;
  }

  private rand(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 0xffffffff;
  }

  public update(
    distanceMeters: number,
    currentExp: number,
    roadSpeed: number,
    speedCfg: SpeedLevelConfig,
    trackId: TrackId,
    obstacles: ActiveObstacle[],
    pickups: ActivePickup[]
  ): void {
    const spawnHorizonZ = -135;

    while (this.nextRowZ > spawnHorizonZ) {
      const maxTier =
        trackId === 'training'
          ? 2
          : trackId === 'mega_rush'
            ? 4
            : distanceMeters < 400
              ? 1
              : distanceMeters < 1100
                ? 2
                : distanceMeters < 2400
                  ? 3
                  : 4;

      const baseGap = Math.max(17, roadSpeed * 0.62) * speedCfg.spacingMult;
      const dtSeconds = baseGap / Math.max(18, roadSpeed);

      const eligible = CANDIDATE_PATTERNS.filter((p) => p.tier <= maxTier);
      let chosen: RowPattern = ['crate', null, null];
      let nextMask = this.reachable;

      for (let attempt = 0; attempt < 14; attempt++) {
        const candidate = eligible[Math.floor(this.rand() * eligible.length)].row;
        const check = validateRowFairness(this.reachable, candidate, dtSeconds);
        if (check.valid) {
          chosen = candidate;
          nextMask = check.next;
          break;
        }
      }

      // Fallback guaranteed fair single crate
      const fallbackCheck = validateRowFairness(this.reachable, chosen, dtSeconds);
      this.reachable = fallbackCheck.valid ? nextMask : createInitialReachable();

      const z = this.nextRowZ;
      for (let lane = 0 as LaneIndex; lane < 3; lane = (lane + 1) as LaneIndex) {
        const kind = chosen[lane];
        if (!kind) continue;
        obstacles.push({
          id: this.nextId++,
          kind,
          lane,
          baseLane: lane,
          x: LANES[lane],
          z,
          phase: this.rand() * Math.PI * 2,
          passed: false,
          smashed: false,
        });
      }

      // Spawn coin lines in safe lanes
      this.spawnCoinsForRow(chosen, z, baseGap, pickups);

      // Spawn road power-ups & Air Dash / Hearts
      if (distanceMeters >= this.nextPowerupDist) {
        this.nextPowerupDist = distanceMeters + 190 + this.rand() * 110;
        this.spawnPowerup(chosen, z - baseGap * 0.45, pickups);
      }

      if (currentExp >= this.nextHeartExp && trackId !== 'bonus' && trackId !== 'training') {
        this.nextHeartExp += 1000;
        const freeLane = ([0, 1, 2] as LaneIndex[]).find((l) => chosen[l] === null) ?? 1;
        pickups.push({
          id: this.nextId++,
          kind: 'heart',
          lane: freeLane,
          x: LANES[freeLane],
          y: 1.1,
          z: z - baseGap * 0.3,
          collected: false,
        });
      }

      this.rowsSpawned += 1;
      this.nextRowZ -= baseGap;
    }
  }

  private spawnCoinsForRow(
    row: RowPattern,
    rowZ: number,
    gap: number,
    pickups: ActivePickup[]
  ): void {
    if (this.rand() < 0.18) return; // v2.2.4 skip 18%
    const safeLanes = ([0, 1, 2] as LaneIndex[]).filter((l) => {
      const k = row[l];
      return k === null || k === 'ring' || k === 'barrier' || k === 'beam';
    });
    if (safeLanes.length === 0) return;
    const lane = safeLanes[Math.floor(this.rand() * safeLanes.length)];
    const kindAtLane = row[lane];
    const count = 4 + Math.floor(this.rand() * 4);
    const spacing = Math.min(2.6, (gap * 0.65) / count);

    for (let i = 0; i < count; i++) {
      const offsetZ = (i - (count - 1) / 2) * spacing;
      let y = 0.95;
      if (kindAtLane === 'barrier' && Math.abs(offsetZ) < 2.2) {
        y = 2.85; // Arc coins over jumpable barrier
      } else if (kindAtLane === 'beam' && Math.abs(offsetZ) < 2.2) {
        y = 0.48; // Low coins under beam
      }
      pickups.push({
        id: this.nextId++,
        kind: 'coin',
        lane,
        x: LANES[lane],
        y,
        z: rowZ + offsetZ,
        collected: false,
      });
    }
  }

  private spawnPowerup(row: RowPattern, z: number, pickups: ActivePickup[]): void {
    const roll = this.rand();
    let kind: PickupKind = 'shield';
    if (roll < 0.28) kind = 'shield';
    else if (roll < 0.54) kind = 'magnet';
    else if (roll < 0.76) kind = 'turbo';
    else if (roll < 0.9) kind = 'doubleCoins';
    else kind = 'airDash';

    // Air Dash only spawns in outer lanes (0 or 2) per v4.5 rule
    let lane: LaneIndex = 1;
    if (kind === 'airDash') {
      lane = this.rand() < 0.5 ? 0 : 2;
    } else {
      const open = ([0, 1, 2] as LaneIndex[]).filter((l) => row[l] === null);
      lane = open.length > 0 ? open[Math.floor(this.rand() * open.length)] : 1;
    }

    pickups.push({
      id: this.nextId++,
      kind,
      lane,
      x: LANES[lane],
      y: 1.15,
      z,
      collected: false,
    });
  }
}

export { OBSTACLE_RULES };
