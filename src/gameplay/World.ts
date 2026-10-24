import {
  CAR_HALF,
  LANES,
  LaneIndex,
  POWERUP_DURATION,
  RANKS,
  RankClass,
  SPEED,
  SPEED_LEVELS,
  SpeedLevelId,
  SpecialId,
  TRACKS,
  TrackId,
  WORLDS,
} from '../config';
import { canPassObstacle, OBSTACLE_RULES, PASS_MASK } from './ObstacleRules';
import { Player } from './Player';
import { ActiveObstacle, ActivePickup, PickupKind, Spawner } from './Spawner';

export type DangerHint = 'up' | 'down' | 'left' | 'right' | 'sos' | null;

export interface WorldEvents {
  onCoin: () => void;
  onRing: () => void;
  onPowerup: (kind: PickupKind) => void;
  onRankUp: (newRank: RankClass) => void;
  onBeatBest: () => void;
  onPortal: (worldIndex: number) => void;
  onHeartLost: (remainingHearts: number) => void;
  onAutoSpecial: (special: SpecialId) => void;
  onCrashEnd: () => void;
  onTrackFinish: () => void;
}

export class World {
  public player = new Player();
  public spawner = new Spawner();
  public obstacles: ActiveObstacle[] = [];
  public pickups: ActivePickup[] = [];

  public speedLevel: SpeedLevelId = 'normal';
  public trackId: TrackId = 'endless';
  public roadSpeed: number = SPEED.start;
  public targetSpeed: number = SPEED.start;

  public distanceMeters = 0;
  public exp = 0;
  public coins = 0;
  public ringsPassed = 0;
  public hearts = 1;
  public revivesUsed = 0;
  public maxRevives = 2;

  public worldIndex = 0;
  public nextPortalDist = 1000;
  public currentRank: RankClass = 'D';
  public beatBestTriggered = false;

  // Active power-up timers
  public shieldTimer = 0;
  public magnetTimer = 0;
  public turboTimer = 0;
  public doubleCoinsTimer = 0;

  // Pre-race equipped special charge
  public equippedSpecial: SpecialId | null = null;
  public specialCharges = 0;

  public dangerHint: DangerHint = null;
  public autopilot = false;
  private autopilotCooldown = 0;

  public reset(opts: {
    speedLevel: SpeedLevelId;
    trackId: TrackId;
    equippedSpecial: SpecialId | null;
    autopilot?: boolean;
  }): void {
    this.speedLevel = opts.speedLevel;
    this.trackId = opts.trackId;
    this.equippedSpecial = opts.equippedSpecial;
    this.specialCharges = opts.equippedSpecial ? 1 : 0;
    this.autopilot = Boolean(opts.autopilot);

    this.player.reset();
    this.spawner.reset();
    this.obstacles = [];
    this.pickups = [];

    const speedCfg = SPEED_LEVELS[this.speedLevel];
    this.roadSpeed = SPEED.start * speedCfg.speedMult;
    this.targetSpeed = this.roadSpeed;

    this.distanceMeters = 0;
    this.exp = 0;
    this.coins = 0;
    this.ringsPassed = 0;
    this.hearts = opts.trackId === 'training' ? 3 : 1;
    this.revivesUsed = 0;

    this.worldIndex = 0;
    this.nextPortalDist = 1000;
    this.currentRank = 'D';
    this.beatBestTriggered = false;

    this.shieldTimer = 0;
    this.magnetTimer = 0;
    this.turboTimer = 0;
    this.doubleCoinsTimer = 0;
    this.dangerHint = null;
    this.autopilotCooldown = 0;
  }

  public revive(): void {
    this.revivesUsed += 1;
    this.player.invulnTimer = 2.6;
    this.player.vMode = 'normal';
    this.player.y = 0.78;
    // Clear immediate obstacles within 28 m
    for (const obs of this.obstacles) {
      if (obs.z > -28 && obs.z < 8) {
        obs.smashed = true;
      }
    }
  }

  public useSpecialButton(): boolean {
    if (!this.equippedSpecial || this.specialCharges <= 0) return false;
    if (this.player.activateSpecial(this.equippedSpecial)) {
      this.specialCharges -= 1;
      if (this.equippedSpecial === 'hyper') {
        this.coins += 25;
      }
      return true;
    }
    return false;
  }

  public update(dt: number, prevBestExp: number, events: WorldEvents): void {
    const speedCfg = SPEED_LEVELS[this.speedLevel];
    const trackCfg = TRACKS.find((t) => t.id === this.trackId) ?? TRACKS[0];

    // Smooth target speed progression
    const rampT = Math.min(1, this.distanceMeters / SPEED.rampDist);
    const baseSpeed = (SPEED.start + (SPEED.max - SPEED.start) * rampT) * speedCfg.speedMult;
    const turboMult = this.turboTimer > 0 ? SPEED.turboMult : 1.0;
    this.targetSpeed = baseSpeed * turboMult;
    this.roadSpeed += (this.targetSpeed - this.roadSpeed) * Math.min(1, dt * 4.5);

    // Update power-up timers
    if (this.shieldTimer > 0) this.shieldTimer = Math.max(0, this.shieldTimer - dt);
    if (this.magnetTimer > 0) this.magnetTimer = Math.max(0, this.magnetTimer - dt);
    if (this.turboTimer > 0) {
      this.turboTimer = Math.max(0, this.turboTimer - dt);
      if (this.turboTimer === 0) {
        this.player.invulnTimer = Math.max(this.player.invulnTimer, 0.8);
      }
    }
    if (this.doubleCoinsTimer > 0) this.doubleCoinsTimer = Math.max(0, this.doubleCoinsTimer - dt);

    // Advance distance & EXP
    const dZ = this.roadSpeed * dt;
    this.distanceMeters += dZ;
    this.spawner.nextRowZ += dZ;

    if (trackCfg.expMult > 0) {
      this.exp = Math.floor(this.distanceMeters * speedCfg.expRate * trackCfg.expMult);
      const newRank = this.computeRunRank(this.exp, this.trackId === 'mega_rush');
      if (newRank !== this.currentRank) {
        this.currentRank = newRank;
        events.onRankUp(newRank);
      }
      if (!this.beatBestTriggered && prevBestExp > 100 && this.exp > prevBestExp) {
        this.beatBestTriggered = true;
        events.onBeatBest();
      }
    }

    // World portal transitions every 1,000 m
    if (this.distanceMeters >= this.nextPortalDist) {
      this.nextPortalDist += 1000;
      this.worldIndex = (this.worldIndex + 1) % WORLDS.length;
      events.onPortal(this.worldIndex);
    }

    // Check finite track finish
    if (trackCfg.lengthMeters > 0 && this.distanceMeters >= trackCfg.lengthMeters) {
      events.onTrackFinish();
      return;
    }

    // Update player kinematics
    const { landedShockwave } = this.player.update(dt, this.roadSpeed);
    if (landedShockwave) {
      for (const obs of this.obstacles) {
        if (obs.z > -26 && obs.z < 6) {
          obs.smashed = true;
        }
      }
    }

    // Spawn upcoming rows
    this.spawner.update(
      this.distanceMeters,
      this.exp,
      this.roadSpeed,
      speedCfg,
      this.trackId,
      this.obstacles,
      this.pickups
    );

    // Compute danger hint & optional autopilot
    this.dangerHint = this.solveDangerHint();
    if (this.autopilot) {
      this.runAutopilot(dt);
    }

    // Scroll & collide obstacles
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      const rule = OBSTACLE_RULES[obs.kind];
      const extraSpeed = rule.oncomingSpeed ?? 0;
      obs.z += (this.roadSpeed + extraSpeed) * dt;

      if (rule.movesLanes) {
        obs.phase += dt * 2.2;
        obs.x = LANES[obs.baseLane] + Math.sin(obs.phase) * 2.4;
        obs.lane = (obs.x < -1.4 ? 0 : obs.x > 1.4 ? 2 : 1) as LaneIndex;
      }

      if (!obs.smashed && !obs.passed) {
        const zOverlap = Math.abs(obs.z - this.player.z) < CAR_HALF.z + rule.halfZ;
        const xOverlap = Math.abs(obs.x - this.player.x) < CAR_HALF.x + rule.halfX * 0.82;

        if (zOverlap && xOverlap) {
          if (rule.isBonusRing) {
            obs.passed = true;
            this.ringsPassed += 1;
            this.doubleCoinsTimer = POWERUP_DURATION.doubleCoins;
            events.onRing();
          } else if (!canPassObstacle(obs.kind, this.player.y)) {
            if (this.turboTimer > 0 || this.player.isProtected()) {
              obs.smashed = true;
            } else if (this.shieldTimer > 0) {
              this.shieldTimer = 0;
              this.player.invulnTimer = 1.2;
              obs.smashed = true;
            } else if (this.trackId === 'training') {
              obs.smashed = true;
              this.player.hop();
            } else if (this.hearts > 1) {
              this.hearts -= 1;
              this.player.invulnTimer = 2.0;
              obs.smashed = true;
              events.onHeartLost(this.hearts);
            } else if (this.equippedSpecial && this.specialCharges > 0) {
              // v4.5 Last-chance auto special activation!
              const sp = this.equippedSpecial;
              this.useSpecialButton();
              obs.smashed = true;
              events.onAutoSpecial(sp);
            } else {
              obs.smashed = true;
              events.onCrashEnd();
              return;
            }
          }
        }
      }

      if (obs.z > 14) {
        this.obstacles.splice(i, 1);
      }
    }

    // Scroll & collect pickups
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.z += this.roadSpeed * dt;

      if (!p.collected && p.kind === 'coin' && this.magnetTimer > 0 && p.z > -22 && p.z < 4) {
        p.x += (this.player.x - p.x) * Math.min(1, dt * 11);
        p.y += (this.player.y - p.y) * Math.min(1, dt * 11);
      }

      if (!p.collected) {
        const dx = Math.abs(p.x - this.player.x);
        const dy = Math.abs(p.y - this.player.y);
        const dz = Math.abs(p.z - this.player.z);
        if (dx < 1.35 && dy < 1.65 && dz < 2.1) {
          p.collected = true;
          this.applyPickup(p.kind, events);
        }
      }

      if (p.collected || p.z > 12) {
        this.pickups.splice(i, 1);
      }
    }
  }

  private applyPickup(kind: PickupKind, events: WorldEvents): void {
    if (kind === 'coin') {
      const mult = this.doubleCoinsTimer > 0 ? 2 : 1;
      this.coins += mult;
      events.onCoin();
      return;
    }
    if (kind === 'shield') {
      this.shieldTimer = POWERUP_DURATION.shield;
    } else if (kind === 'magnet') {
      this.magnetTimer = POWERUP_DURATION.magnet;
    } else if (kind === 'turbo') {
      this.turboTimer = POWERUP_DURATION.turbo;
    } else if (kind === 'doubleCoins') {
      this.doubleCoinsTimer = POWERUP_DURATION.doubleCoins;
    } else if (kind === 'airDash') {
      this.player.triggerAirDash();
    } else if (kind === 'heart') {
      this.hearts = Math.min(3, this.hearts + 1);
    }
    events.onPowerup(kind);
  }

  private computeRunRank(exp: number, isMegaRush: boolean): RankClass {
    let best: RankClass = 'D';
    for (const r of RANKS) {
      if (r.track2Only && !isMegaRush) continue;
      if (exp >= r.exp) best = r.id;
    }
    return best;
  }

  private solveDangerHint(): DangerHint {
    if (this.player.isProtected() || this.turboTimer > 0) return null;
    const lookAheadZ = -this.roadSpeed * 0.85;
    let nearestThreat: ActiveObstacle | null = null;

    for (const obs of this.obstacles) {
      if (obs.smashed || obs.passed) continue;
      if (obs.z < lookAheadZ || obs.z > -1.5) continue;
      if (obs.lane === this.player.lane && !canPassObstacle(obs.kind, this.player.y)) {
        if (!nearestThreat || obs.z > nearestThreat.z) {
          nearestThreat = obs;
        }
      }
    }

    if (!nearestThreat) return null;
    const rule = OBSTACLE_RULES[nearestThreat.kind];
    if ((rule.passMask & PASS_MASK.HIGH) !== 0) return 'up';
    if ((rule.passMask & PASS_MASK.LOW) !== 0) return 'down';

    // Check adjacent lanes at nearestThreat.z
    const candidates: LaneIndex[] =
      this.player.lane === 1 ? [0, 2] : ([1] as LaneIndex[]);
    for (const cLane of candidates) {
      const blocked = this.obstacles.some(
        (o) =>
          !o.smashed &&
          Math.abs(o.z - nearestThreat!.z) < 4.5 &&
          o.lane === cLane &&
          !canPassObstacle(o.kind, this.player.y)
      );
      if (!blocked) {
        return cLane < this.player.lane ? 'left' : 'right';
      }
    }
    return this.specialCharges > 0 ? 'sos' : 'up';
  }

  private runAutopilot(dt: number): void {
    this.autopilotCooldown = Math.max(0, this.autopilotCooldown - dt);
    if (this.autopilotCooldown > 0 || !this.dangerHint) return;
    if (this.dangerHint === 'up') this.player.hop();
    else if (this.dangerHint === 'down') this.player.dive();
    else if (this.dangerHint === 'left') this.player.moveLane(-1);
    else if (this.dangerHint === 'right') this.player.moveLane(1);
    else if (this.dangerHint === 'sos') this.useSpecialButton();
    this.autopilotCooldown = 0.16;
  }
}
