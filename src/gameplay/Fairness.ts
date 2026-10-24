import { FAIRNESS, LaneIndex } from '../config';
import { OBSTACLE_RULES, ObstacleKind, PASS_MASK } from './ObstacleRules';

export type RowPattern = [ObstacleKind | null, ObstacleKind | null, ObstacleKind | null];

export interface ReachableMask {
  lanes: [number, number, number]; // Bitmask of reachable PASS_MASK per lane
}

const ALL_HEIGHTS = PASS_MASK.LOW | PASS_MASK.NORMAL | PASS_MASK.HIGH;

export function createInitialReachable(): ReachableMask {
  return {
    lanes: [ALL_HEIGHTS, ALL_HEIGHTS, ALL_HEIGHTS],
  };
}

export function lanePassMask(kind: ObstacleKind | null): number {
  if (!kind) return ALL_HEIGHTS;
  const rule = OBSTACLE_RULES[kind];
  if (rule.isBonusRing) return ALL_HEIGHTS;
  return rule.passMask;
}

/**
 * Validates whether a candidate obstacle row leaves at least one reachable (lane, height)
 * state given the previous reachable mask and the time delta `dt` between rows.
 */
export function validateRowFairness(
  prev: ReachableMask,
  row: RowPattern,
  dtSeconds: number
): { valid: boolean; next: ReachableMask } {
  const maxLaneSteps = Math.floor(
    Math.max(0, dtSeconds - FAIRNESS.reactionSlack) / FAIRNESS.laneStepTime
  );
  const canChangeVertical =
    dtSeconds >= FAIRNESS.verticalActionTime + FAIRNESS.reactionSlack;

  const next: ReachableMask = { lanes: [0, 0, 0] };

  for (let targetLane = 0 as LaneIndex; targetLane < 3; targetLane = (targetLane + 1) as LaneIndex) {
    const allowedMask = lanePassMask(row[targetLane]);
    if (allowedMask === 0) {
      next.lanes[targetLane] = 0;
      continue;
    }

    let reachableFromPrev = 0;
    for (let srcLane = 0 as LaneIndex; srcLane < 3; srcLane = (srcLane + 1) as LaneIndex) {
      const dist = Math.abs(targetLane - srcLane);
      if (dist <= maxLaneSteps && prev.lanes[srcLane] !== 0) {
        if (canChangeVertical) {
          reachableFromPrev |= ALL_HEIGHTS;
        } else {
          reachableFromPrev |= prev.lanes[srcLane] | PASS_MASK.NORMAL;
        }
      }
    }

    next.lanes[targetLane] = allowedMask & reachableFromPrev;
  }

  const valid = (next.lanes[0] | next.lanes[1] | next.lanes[2]) !== 0;
  return { valid, next };
}
