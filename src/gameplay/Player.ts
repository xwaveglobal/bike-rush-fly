import { HEIGHT, LANES, LaneIndex, SpecialId, TIMING } from '../config';

export type VerticalMode = 'normal' | 'hop' | 'dive' | 'airdash' | 'roadster' | 'hyper' | 'sos';

export class Player {
  public lane: LaneIndex = 1;
  public prevLane: LaneIndex = 1;
  public x = 0;
  public y: number = HEIGHT.NORMAL;
  public z = 0;

  public laneTimer = 0;
  public laneDuration: number = TIMING.laneSwitch;
  public startX = 0;
  public targetX = 0;
  public queuedLaneDir: -1 | 0 | 1 = 0;

  public vMode: VerticalMode = 'normal';
  public vTimer = 0;
  public restTimer = 0;
  public invulnTimer = 0;
  public airLaneChanged = false;

  // Visual pose telemetry for 3D MeshCar
  public roll = 0;
  public pitch = 0;
  public spoilerOpen = 0; // 0 = flush, 1 = deployed (airborne only per v4.5)
  public diveSquash = 0;  // 0 = normal, 1 = compressed low dive pose
  public wheelSpin = 0;
  public steerAngle = 0;

  public hopsAndDivesCount = 0;
  public specialsUsedCount = 0;

  public reset(): void {
    this.lane = 1;
    this.prevLane = 1;
    this.x = LANES[1];
    this.y = HEIGHT.NORMAL;
    this.z = 0;
    this.laneTimer = 0;
    this.startX = LANES[1];
    this.targetX = LANES[1];
    this.queuedLaneDir = 0;
    this.vMode = 'normal';
    this.vTimer = 0;
    this.restTimer = 0;
    this.invulnTimer = 0;
    this.airLaneChanged = false;
    this.roll = 0;
    this.pitch = 0;
    this.spoilerOpen = 0;
    this.diveSquash = 0;
    this.wheelSpin = 0;
    this.steerAngle = 0;
    this.hopsAndDivesCount = 0;
    this.specialsUsedCount = 0;
  }

  public isAirborne(): boolean {
    return (
      this.vMode === 'hop' ||
      this.vMode === 'airdash' ||
      this.vMode === 'roadster' ||
      this.vMode === 'hyper' ||
      this.vMode === 'sos'
    );
  }

  public isProtected(): boolean {
    return (
      this.invulnTimer > 0 ||
      this.vMode === 'airdash' ||
      this.vMode === 'roadster' ||
      this.vMode === 'hyper' ||
      this.vMode === 'sos'
    );
  }

  public moveLane(dir: -1 | 1): boolean {
    if (this.vMode === 'airdash') return false;
    if (this.laneTimer > 0) {
      this.queuedLaneDir = dir;
      return false;
    }
    if (this.vMode === 'hop' && this.airLaneChanged) {
      return false; // v1.9 one lane per hop rule
    }
    const next = (this.lane + dir) as number;
    if (next < 0 || next > 2) return false;
    this.prevLane = this.lane;
    this.lane = next as LaneIndex;
    this.startX = this.x;
    this.targetX = LANES[this.lane];
    this.laneDuration = TIMING.laneSwitch;
    this.laneTimer = this.laneDuration;
    if (this.vMode === 'hop') {
      this.airLaneChanged = true;
    }
    return true;
  }

  public triggerAirDash(): boolean {
    // Outer lane 2-lane flip across to opposite outer lane
    const target: LaneIndex = this.lane === 0 ? 2 : this.lane === 2 ? 0 : 2;
    this.prevLane = this.lane;
    this.lane = target;
    this.startX = this.x;
    this.targetX = LANES[target];
    this.laneDuration = TIMING.airDashDuration;
    this.laneTimer = this.laneDuration;
    this.vMode = 'airdash';
    this.vTimer = 0;
    this.invulnTimer = Math.max(this.invulnTimer, TIMING.airDashDuration + TIMING.airDashGrace);
    return true;
  }

  public hop(): boolean {
    if (this.vMode === 'roadster' || this.vMode === 'hyper' || this.vMode === 'sos' || this.vMode === 'airdash') {
      return false;
    }
    if (this.vMode === 'hop') {
      return false; // UP while airborne is ignored (single hop rule)
    }
    if (this.restTimer > 0 && this.vMode === 'normal') {
      return false;
    }
    this.vMode = 'hop';
    this.vTimer = 0;
    this.airLaneChanged = false;
    this.diveSquash = 0;
    this.hopsAndDivesCount += 1;
    return true;
  }

  public dive(): boolean {
    if (this.vMode === 'sos') return false;
    this.vMode = 'dive';
    this.vTimer = 0;
    this.hopsAndDivesCount += 1;
    return true;
  }

  public activateSpecial(special: SpecialId): boolean {
    this.vMode = special;
    this.vTimer = 0;
    this.diveSquash = 0;
    this.specialsUsedCount += 1;
    const flightTime =
      special === 'sos'
        ? TIMING.superRise + TIMING.sosHold + TIMING.superFall
        : special === 'hyper'
          ? TIMING.superRise + TIMING.hyperHold + TIMING.superFall
          : TIMING.superRise + TIMING.superHold + TIMING.superFall;
    this.invulnTimer = Math.max(this.invulnTimer, flightTime + TIMING.superGrace);
    return true;
  }

  public update(dt: number, roadSpeed: number): { landedShockwave: boolean } {
    let landedShockwave = false;

    if (this.invulnTimer > 0) {
      this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    }
    if (this.restTimer > 0) {
      this.restTimer = Math.max(0, this.restTimer - dt);
    }

    // Horizontal lane interpolation
    if (this.laneTimer > 0) {
      this.laneTimer = Math.max(0, this.laneTimer - dt);
      const t = 1 - this.laneTimer / this.laneDuration;
      const smooth = t * t * (3 - 2 * t);
      this.x = this.startX + (this.targetX - this.startX) * smooth;
      const dir = Math.sign(this.targetX - this.startX);
      this.steerAngle = dir * Math.sin(t * Math.PI) * 0.28;

      if (this.vMode !== 'airdash' && this.vMode !== 'roadster' && this.vMode !== 'hyper') {
        this.roll = -dir * Math.sin(t * Math.PI) * 0.16;
      }

      if (this.laneTimer === 0 && this.queuedLaneDir !== 0) {
        const q = this.queuedLaneDir;
        this.queuedLaneDir = 0;
        this.moveLane(q);
      }
    } else {
      this.x = LANES[this.lane];
      this.steerAngle *= Math.exp(-14 * dt);
      if (this.vMode === 'normal' || this.vMode === 'dive') {
        this.roll *= Math.exp(-12 * dt);
      }
    }

    // Vertical state machine
    this.vTimer += dt;

    if (this.vMode === 'normal') {
      this.y += (HEIGHT.NORMAL - this.y) * Math.min(1, dt * 18);
      this.pitch *= Math.exp(-12 * dt);
      this.diveSquash *= Math.exp(-14 * dt);
    } else if (this.vMode === 'hop') {
      const riseEnd = TIMING.hopRise;
      const holdEnd = riseEnd + TIMING.hopHold;
      const fallEnd = holdEnd + TIMING.hopFall;

      if (this.vTimer < riseEnd) {
        const u = this.vTimer / riseEnd;
        const ease = 1 - (1 - u) * (1 - u);
        this.y = HEIGHT.NORMAL + (HEIGHT.HIGH - HEIGHT.NORMAL) * ease;
        this.pitch = 0.14 * (1 - u);
      } else if (this.vTimer < holdEnd) {
        this.y = HEIGHT.HIGH;
        this.pitch = 0;
      } else if (this.vTimer < fallEnd) {
        const u = (this.vTimer - holdEnd) / TIMING.hopFall;
        this.y = HEIGHT.HIGH - (HEIGHT.HIGH - HEIGHT.NORMAL) * (u * u);
        this.pitch = -0.1 * Math.sin(u * Math.PI);
      } else {
        this.y = HEIGHT.NORMAL;
        this.vMode = 'normal';
        this.vTimer = 0;
        this.restTimer = TIMING.hopRest;
        this.pitch = -0.06;
      }
    } else if (this.vMode === 'dive') {
      const dropEnd = TIMING.diveDrop;
      const holdEnd = dropEnd + TIMING.diveHold;
      const riseEnd = holdEnd + TIMING.diveRise;

      if (this.vTimer < dropEnd) {
        const u = this.vTimer / dropEnd;
        this.y = HEIGHT.NORMAL - (HEIGHT.NORMAL - HEIGHT.LOW) * u;
        this.diveSquash = u;
        this.pitch = -0.08 * u;
      } else if (this.vTimer < holdEnd) {
        this.y = HEIGHT.LOW;
        this.diveSquash = 1;
        this.pitch = -0.05;
      } else if (this.vTimer < riseEnd) {
        const u = (this.vTimer - holdEnd) / TIMING.diveRise;
        this.y = HEIGHT.LOW + (HEIGHT.NORMAL - HEIGHT.LOW) * u;
        this.diveSquash = 1 - u;
        this.pitch = 0;
      } else {
        this.y = HEIGHT.NORMAL;
        this.diveSquash = 0;
        this.vMode = 'normal';
        this.vTimer = 0;
      }
    } else if (this.vMode === 'airdash') {
      const u = Math.min(1, this.vTimer / TIMING.airDashDuration);
      this.y = HEIGHT.NORMAL + Math.sin(u * Math.PI) * (HEIGHT.HIGH - HEIGHT.NORMAL);
      const dir = Math.sign(this.targetX - this.startX) || 1;
      this.roll = -dir * u * Math.PI * 2; // 360 degree barrel roll
      if (this.vTimer >= TIMING.airDashDuration) {
        this.vMode = 'normal';
        this.vTimer = 0;
        this.roll = 0;
        this.y = HEIGHT.NORMAL;
      }
    } else if (this.vMode === 'roadster' || this.vMode === 'hyper' || this.vMode === 'sos') {
      const peakY =
        this.vMode === 'sos' ? HEIGHT.SOS : this.vMode === 'hyper' ? HEIGHT.HYPER : HEIGHT.SUPER;
      const holdDur =
        this.vMode === 'sos'
          ? TIMING.sosHold
          : this.vMode === 'hyper'
            ? TIMING.hyperHold
            : TIMING.superHold;
      const riseEnd = TIMING.superRise;
      const holdEnd = riseEnd + holdDur;
      const fallEnd = holdEnd + TIMING.superFall;

      if (this.vTimer < riseEnd) {
        const u = this.vTimer / riseEnd;
        this.y = HEIGHT.NORMAL + (peakY - HEIGHT.NORMAL) * (1 - (1 - u) * (1 - u));
        this.pitch = 0.24 * (1 - u);
      } else if (this.vTimer < holdEnd) {
        const u = (this.vTimer - riseEnd) / holdDur;
        this.y = peakY;
        this.pitch = 0;
        if (this.vMode === 'roadster') {
          this.roll = u * Math.PI * 2;
        } else if (this.vMode === 'hyper') {
          this.roll = u * Math.PI * 4;
        } else {
          this.roll = 0;
        }
      } else if (this.vTimer < fallEnd) {
        const u = (this.vTimer - holdEnd) / TIMING.superFall;
        this.y = peakY - (peakY - HEIGHT.NORMAL) * (u * u);
        this.pitch = -0.16 * Math.sin(u * Math.PI);
        this.roll = 0;
      } else {
        this.y = HEIGHT.NORMAL;
        this.vMode = 'normal';
        this.vTimer = 0;
        this.roll = 0;
        this.pitch = 0;
        landedShockwave = true;
      }
    }

    // Active spoiler opens ONLY in the air (v4.5 rule)
    const targetSpoiler = this.isAirborne() ? 1 : 0;
    this.spoilerOpen += (targetSpoiler - this.spoilerOpen) * Math.min(1, dt * 14);

    // Wheel rotation
    this.wheelSpin = (this.wheelSpin + roadSpeed * dt * 2.1) % (Math.PI * 2);

    return { landedShockwave };
  }
}
