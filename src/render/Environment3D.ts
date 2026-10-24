import * as THREE from 'three';
import { LANES, WORLDS } from '../config';
import { OBSTACLE_RULES, ObstacleKind } from '../gameplay/ObstacleRules';
import { ActiveObstacle, ActivePickup, PickupKind } from '../gameplay/Spawner';

export class Environment3D {
  public root = new THREE.Group();
  private roadMesh: THREE.Mesh;
  private roadTexture: THREE.CanvasTexture;
  private railLeft: THREE.Mesh;
  private railRight: THREE.Mesh;
  private buildingsInstanced: THREE.InstancedMesh;
  private buildingWindowsInstanced: THREE.InstancedMesh;
  private lampPostsInstanced: THREE.InstancedMesh;
  private portalGroup = new THREE.Group();

  private obstacleMeshes = new Map<number, THREE.Object3D>();
  private pickupMeshes = new Map<number, THREE.Object3D>();

  private buildingOffsetsZ: number[] = [];
  private buildingMeta: { x: number; w: number; h: number; d: number }[] = [];
  private lampOffsetsZ: number[] = [];
  private scrollOffset = 0;

  private matCrate = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.35, metalness: 0.4 });
  private matBarrier = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0x991b1b, emissiveIntensity: 0.6, roughness: 0.3 });
  private matBeam = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.55, roughness: 0.25, metalness: 0.7 });
  private matLaser = new THREE.MeshBasicMaterial({ color: 0xf43f5e });
  private matTraffic = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.25, metalness: 0.65 });
  private matRing = new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xf59e0b, emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.8 });
  private matGate = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.45, metalness: 0.7 });

  private matCoin = new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xeab308, emissiveIntensity: 0.65, roughness: 0.2, metalness: 0.85 });

  private dummy = new THREE.Object3D();

  constructor(maxAnisotropy: number) {
    this.roadTexture = this.buildProceduralRoadTexture(maxAnisotropy);
    const roadGeo = new THREE.PlaneGeometry(11.6, 180);
    roadGeo.rotateX(-Math.PI / 2);
    const roadMat = new THREE.MeshStandardMaterial({
      map: this.roadTexture,
      roughness: 0.42,
      metalness: 0.22,
    });
    this.roadMesh = new THREE.Mesh(roadGeo, roadMat);
    this.roadMesh.position.set(0, 0, -75);
    this.roadMesh.receiveShadow = true;
    this.root.add(this.roadMesh);

    // Glowing side guard rails
    const railGeo = new THREE.BoxGeometry(0.18, 0.55, 180);
    const railMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.85,
      metalness: 0.75,
      roughness: 0.2,
    });
    this.railLeft = new THREE.Mesh(railGeo, railMat);
    this.railLeft.position.set(-5.6, 0.28, -75);
    this.railRight = new THREE.Mesh(railGeo, railMat);
    this.railRight.position.set(5.6, 0.28, -75);
    this.root.add(this.railLeft, this.railRight);

    // Instanced city skyscrapers along both sides of the highway
    const bCount = 40;
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const bMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.45,
      metalness: 0.6,
    });
    const winMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    this.buildingsInstanced = new THREE.InstancedMesh(boxGeo, bMat, bCount);
    this.buildingWindowsInstanced = new THREE.InstancedMesh(boxGeo, winMat, bCount);
    this.buildingsInstanced.frustumCulled = false;
    this.buildingWindowsInstanced.frustumCulled = false;

    for (let i = 0; i < bCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const z = -Math.floor(i / 2) * 9.5 + 10;
      const h = 10 + ((i * 7) % 24);
      const w = 4.2 + ((i * 3) % 4);
      const d = 4.5 + ((i * 5) % 4);
      const x = side * (11.5 + ((i * 4) % 9));
      this.buildingOffsetsZ.push(z);
      this.buildingMeta.push({ x, w, h, d });
    }
    this.root.add(this.buildingsInstanced, this.buildingWindowsInstanced);

    // Instanced street lamps
    const lampCount = 24;
    const lampGeo = new THREE.CylinderGeometry(0.08, 0.1, 4.8, 8);
    const lampMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.4,
      metalness: 0.8,
      roughness: 0.2,
    });
    this.lampPostsInstanced = new THREE.InstancedMesh(lampGeo, lampMat, lampCount);
    this.lampPostsInstanced.frustumCulled = false;
    for (let i = 0; i < lampCount; i++) {
      this.lampOffsetsZ.push(-Math.floor(i / 2) * 14 + 8);
    }
    this.root.add(this.lampPostsInstanced);

    // World transition portal arch
    const archGeo = new THREE.TorusGeometry(6.2, 0.28, 12, 32, Math.PI);
    const archMesh = new THREE.Mesh(
      archGeo,
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    this.portalGroup.add(archMesh);
    this.portalGroup.position.set(0, 0, -160);
    this.portalGroup.visible = false;
    this.root.add(this.portalGroup);
  }

  private buildProceduralRoadTexture(maxAnisotropy: number): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Dark asphalt base
    ctx.fillStyle = '#0d1322';
    ctx.fillRect(0, 0, 512, 512);

    // Fine asphalt speckle
    for (let i = 0; i < 2400; i++) {
      const x = (i * 73) % 512;
      const y = (i * 137) % 512;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.12)';
      ctx.fillRect(x, y, 2, 2);
    }

    // Polished tyre tracks in the 3 lanes
    const laneCenters = [132, 256, 380];
    ctx.fillStyle = 'rgba(56, 189, 248, 0.04)';
    for (const cx of laneCenters) {
      ctx.fillRect(cx - 28, 0, 14, 512);
      ctx.fillRect(cx + 14, 0, 14, 512);
    }

    // Solid outer edge lines
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(28, 0, 6, 512);
    ctx.fillRect(478, 0, 6, 512);

    // Dashed lane dividers
    ctx.fillStyle = '#e2e8f0';
    for (let y = 0; y < 512; y += 64) {
      ctx.fillRect(192, y + 8, 5, 36);
      ctx.fillRect(315, y + 8, 5, 36);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 14);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAnisotropy;
    return tex;
  }

  public applyWorldTheme(worldIdx: number, scene: THREE.Scene): void {
    const theme = WORLDS[worldIdx % WORLDS.length];
    scene.background = new THREE.Color(theme.skyColor);
    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.color.setHex(theme.fogColor);
    }
    (this.railLeft.material as THREE.MeshStandardMaterial).emissive.setHex(theme.neonPrimary);
    (this.buildingWindowsInstanced.material as THREE.MeshBasicMaterial).color.setHex(theme.neonPrimary);
  }

  public update(
    dt: number,
    roadSpeed: number,
    distanceMeters: number,
    nextPortalDist: number,
    obstacles: ActiveObstacle[],
    pickups: ActivePickup[],
    timeSec: number
  ): void {
    this.scrollOffset = (this.scrollOffset + roadSpeed * dt * 0.085) % 1;
    this.roadTexture.offset.y = -this.scrollOffset;

    // Scroll instanced buildings seamlessly
    for (let i = 0; i < this.buildingOffsetsZ.length; i++) {
      let z = this.buildingOffsetsZ[i] + roadSpeed * dt;
      if (z > 20) z -= 190;
      this.buildingOffsetsZ[i] = z;
      const meta = this.buildingMeta[i];
      this.dummy.position.set(meta.x, meta.h / 2 - 1, z);
      this.dummy.scale.set(meta.w, meta.h, meta.d);
      this.dummy.updateMatrix();
      this.buildingsInstanced.setMatrixAt(i, this.dummy.matrix);

      this.dummy.position.set(meta.x + (meta.x > 0 ? -meta.w * 0.51 : meta.w * 0.51), meta.h * 0.72, z);
      this.dummy.scale.set(0.15, 0.35, meta.d * 0.82);
      this.dummy.updateMatrix();
      this.buildingWindowsInstanced.setMatrixAt(i, this.dummy.matrix);
    }
    this.buildingsInstanced.instanceMatrix.needsUpdate = true;
    this.buildingWindowsInstanced.instanceMatrix.needsUpdate = true;

    // Scroll instanced street lamps
    for (let i = 0; i < this.lampOffsetsZ.length; i++) {
      let z = this.lampOffsetsZ[i] + roadSpeed * dt;
      if (z > 16) z -= 168;
      this.lampOffsetsZ[i] = z;
      const side = i % 2 === 0 ? -1 : 1;
      this.dummy.position.set(side * 5.85, 2.4, z);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();
      this.lampPostsInstanced.setMatrixAt(i, this.dummy.matrix);
    }
    this.lampPostsInstanced.instanceMatrix.needsUpdate = true;

    // Portal visibility approaching 1,000 m mark
    const distToPortal = nextPortalDist - distanceMeters;
    if (distToPortal > -10 && distToPortal < 130) {
      this.portalGroup.visible = true;
      this.portalGroup.position.z = -distToPortal;
    } else {
      this.portalGroup.visible = false;
    }

    // Sync active obstacles
    const activeObsIds = new Set<number>();
    for (const obs of obstacles) {
      if (obs.smashed) continue;
      activeObsIds.add(obs.id);
      let mesh = this.obstacleMeshes.get(obs.id);
      if (!mesh) {
        mesh = this.buildObstacleMesh(obs.kind);
        this.obstacleMeshes.set(obs.id, mesh);
        this.root.add(mesh);
      }
      mesh.position.set(obs.x, 0, obs.z);
    }
    for (const [id, mesh] of this.obstacleMeshes.entries()) {
      if (!activeObsIds.has(id)) {
        this.root.remove(mesh);
        this.obstacleMeshes.delete(id);
      }
    }

    // Sync active pickups (Ring Coins + power-up totems)
    const activePickIds = new Set<number>();
    for (const p of pickups) {
      if (p.collected) continue;
      activePickIds.add(p.id);
      let mesh = this.pickupMeshes.get(p.id);
      if (!mesh) {
        mesh = this.buildPickupMesh(p.kind);
        this.pickupMeshes.set(p.id, mesh);
        this.root.add(mesh);
      }
      mesh.position.set(p.x, p.y, p.z);
      mesh.rotation.y = timeSec * 2.8 + p.id * 0.3;
    }
    for (const [id, mesh] of this.pickupMeshes.entries()) {
      if (!activePickIds.has(id)) {
        this.root.remove(mesh);
        this.pickupMeshes.delete(id);
      }
    }
  }

  private buildObstacleMesh(kind: ObstacleKind): THREE.Object3D {
    const group = new THREE.Group();
    const rule = OBSTACLE_RULES[kind];

    if (kind === 'crate') {
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.75, 1.55, 1.75), this.matCrate);
      box.position.y = 0.78;
      group.add(box);
    } else if (kind === 'barrier') {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(2.05, 1.25, 0.55), this.matBarrier);
      bar.position.y = 0.62;
      group.add(bar);
    } else if (kind === 'beam') {
      const top = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.95, 0.75), this.matBeam);
      top.position.y = 1.95;
      const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.3, 0.35), this.matGate);
      legL.position.set(-1.05, 1.15, 0);
      const legR = legL.clone();
      legR.position.x = 1.05;
      group.add(top, legL, legR);
    } else if (kind === 'laser_low' || kind === 'laser_high') {
      const y = kind === 'laser_low' ? 0.75 : 1.75;
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.1, 10), this.matLaser);
      beam.rotation.z = Math.PI / 2;
      beam.position.y = y;
      group.add(beam);
    } else if (kind === 'drone') {
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.62, 14, 12), this.matGate);
      body.position.y = 1.05;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.08, 8, 20), this.matLaser);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 1.05;
      group.add(body, ring);
    } else if (kind === 'traffic') {
      const car = new THREE.Mesh(new THREE.BoxGeometry(1.62, 1.15, 3.3), this.matTraffic);
      car.position.y = 0.65;
      const headlights = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.14, 0.1), this.matLaser);
      headlights.position.set(0, 0.55, 1.66);
      group.add(car, headlights);
    } else if (kind === 'ring') {
      const torus = new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.12, 12, 28), this.matRing);
      torus.position.y = 1.35;
      group.add(torus);
    } else if (kind === 'gate_closed') {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(2.3, 3.6, 0.85), this.matGate);
      wall.position.y = 1.8;
      group.add(wall);
    } else if (kind === 'gate_open') {
      const header = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.1, 0.85), this.matBeam);
      header.position.y = 3.05;
      group.add(header);
    } else {
      const fallback = new THREE.Mesh(
        new THREE.BoxGeometry(rule.halfX * 2, rule.maxY, rule.halfZ * 2),
        this.matCrate
      );
      fallback.position.y = rule.maxY / 2;
      group.add(fallback);
    }

    return group;
  }

  private buildPickupMesh(kind: PickupKind): THREE.Object3D {
    if (kind === 'coin') {
      // v4.2.1 Ring Coin: thin gold ring with open centre
      return new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.09, 10, 20), this.matCoin);
    }
    const colorMap: Record<PickupKind, number> = {
      coin: 0xfacc15,
      shield: 0x38bdf8,
      magnet: 0xa855f7,
      turbo: 0x84cc16,
      doubleCoins: 0xf59e0b,
      airDash: 0x14b8a6,
      heart: 0xf43f5e,
    };
    const mat = new THREE.MeshStandardMaterial({
      color: colorMap[kind],
      emissive: colorMap[kind],
      emissiveIntensity: 0.75,
      roughness: 0.2,
      metalness: 0.6,
    });
    return new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), mat);
  }
}

export { LANES };
