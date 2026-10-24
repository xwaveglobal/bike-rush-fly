// Pure gameplay rules for obstacles & pass heights (Zero Three.js or DOM imports)

export const PASS_MASK = {
  NONE: 0,
  LOW: 1,    // Dive under
  NORMAL: 2, // Driving height
  HIGH: 4,   // Hop over
} as const;

export type ObstacleKind =
  | 'crate'
  | 'barrier'
  | 'beam'
  | 'drone'
  | 'laser_low'
  | 'laser_high'
  | 'traffic'
  | 'ring'
  | 'gate_closed'
  | 'gate_open';

export interface ObstacleRule {
  kind: ObstacleKind;
  halfX: number;
  minY: number;
  maxY: number;
  halfZ: number;
  passMask: number; // Bitmask of PASS_MASK values that safely clear this obstacle
  isBonusRing?: boolean;
  movesLanes?: boolean;
  oncomingSpeed?: number;
}

export const OBSTACLE_RULES: Record<ObstacleKind, ObstacleRule> = {
  crate: {
    kind: 'crate',
    halfX: 0.92,
    minY: 0.0,
    maxY: 1.65,
    halfZ: 0.95,
    passMask: PASS_MASK.HIGH, // Change lane or hop over
  },
  barrier: {
    kind: 'barrier',
    halfX: 1.05,
    minY: 0.0,
    maxY: 1.35,
    halfZ: 0.55,
    passMask: PASS_MASK.HIGH, // Hop over
  },
  beam: {
    kind: 'beam',
    halfX: 1.15,
    minY: 1.05,
    maxY: 3.8,
    halfZ: 0.65,
    passMask: PASS_MASK.LOW, // Dive under
  },
  drone: {
    kind: 'drone',
    halfX: 0.85,
    minY: 0.35,
    maxY: 1.75,
    halfZ: 0.85,
    passMask: PASS_MASK.HIGH,
    movesLanes: true,
  },
  laser_low: {
    kind: 'laser_low',
    halfX: 1.1,
    minY: 0.1,
    maxY: 1.4,
    halfZ: 0.35,
    passMask: PASS_MASK.HIGH,
  },
  laser_high: {
    kind: 'laser_high',
    halfX: 1.1,
    minY: 1.05,
    maxY: 4.2,
    halfZ: 0.35,
    passMask: PASS_MASK.LOW,
  },
  traffic: {
    kind: 'traffic',
    halfX: 0.86,
    minY: 0.0,
    maxY: 2.35,
    halfZ: 1.85,
    passMask: PASS_MASK.NONE, // Must change lane (unless in SUPER / HYPER / SOS flight)
    oncomingSpeed: 14.0,
  },
  ring: {
    kind: 'ring',
    halfX: 1.15,
    minY: 0.1,
    maxY: 2.6,
    halfZ: 0.4,
    passMask: PASS_MASK.LOW | PASS_MASK.NORMAL | PASS_MASK.HIGH,
    isBonusRing: true,
  },
  gate_closed: {
    kind: 'gate_closed',
    halfX: 1.2,
    minY: 0.0,
    maxY: 4.5,
    halfZ: 0.7,
    passMask: PASS_MASK.NONE,
  },
  gate_open: {
    kind: 'gate_open',
    halfX: 1.2,
    minY: 2.5,
    maxY: 4.5,
    halfZ: 0.7,
    passMask: PASS_MASK.LOW | PASS_MASK.NORMAL,
  },
};

export function heightToMask(y: number): number {
  if (y >= 2.15) return PASS_MASK.HIGH;
  if (y <= 0.52) return PASS_MASK.LOW;
  return PASS_MASK.NORMAL;
}

export function canPassObstacle(kind: ObstacleKind, carY: number): boolean {
  if (carY >= 4.6) return true; // Roadster Jump / HYPER JUMP / Sky Escape clear everything
  const rule = OBSTACLE_RULES[kind];
  if (rule.isBonusRing) return true;
  const mask = heightToMask(carY);
  return (rule.passMask & mask) !== 0;
}
