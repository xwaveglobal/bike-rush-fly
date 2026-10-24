import * as THREE from 'three';
import { CARS, CarId, RENDER } from '../config';
import { Player } from '../gameplay/Player';

export class VehicleView {
  public root = new THREE.Group();
  private bodyGroup = new THREE.Group();
  private spoilerPivot = new THREE.Group();
  private wheelPods: THREE.Group[] = [];
  private wheelRims: THREE.Object3D[] = [];
  private nitroFlames: THREE.Mesh[] = [];
  private shieldShell: THREE.Mesh;
  private turboShell: THREE.Mesh;
  private shadowPlane: THREE.Mesh;

  private bodyMat: THREE.MeshPhysicalMaterial;
  private accentMat: THREE.MeshStandardMaterial;
  private trimMat: THREE.MeshStandardMaterial;
  private glassMat: THREE.MeshPhysicalMaterial;
  private tailLightMat: THREE.MeshStandardMaterial;

  constructor(isSoftwareGl: boolean) {
    this.bodyMat = new THREE.MeshPhysicalMaterial({
      color: 0xbae6fd,
      metalness: 0.55,
      roughness: 0.22,
      clearcoat: isSoftwareGl ? 0.0 : 0.85,
      clearcoatRoughness: 0.12,
    });

    this.accentMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.65,
      metalness: 0.6,
      roughness: 0.25,
    });

    this.trimMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.35,
      roughness: 0.55,
    });

    this.glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x050814,
      metalness: 0.15,
      roughness: 0.08,
      clearcoat: isSoftwareGl ? 0.0 : 1.0,
    });

    this.tailLightMat = new THREE.MeshStandardMaterial({
      color: 0xff1e42,
      emissive: 0xff1e42,
      emissiveIntensity: 1.4,
      roughness: 0.2,
    });

    // 1. Main lower sculpted hull (ExtrudeGeometry bevelled wedge)
    const hullShape = new THREE.Shape();
    hullShape.moveTo(-0.78, -1.95);
    hullShape.lineTo(0.78, -1.95);
    hullShape.lineTo(0.86, 1.85);
    hullShape.lineTo(-0.86, 1.85);
    hullShape.closePath();

    const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
      depth: 0.42,
      bevelEnabled: true,
      bevelThickness: 0.09,
      bevelSize: 0.08,
      bevelSegments: 3,
    });
    hullGeo.rotateX(Math.PI / 2);
    hullGeo.translate(0, 0.48, 0);
    const hullMesh = new THREE.Mesh(hullGeo, this.bodyMat);
    hullMesh.castShadow = !isSoftwareGl;
    this.bodyGroup.add(hullMesh);

    // 2. Sculpted upper rear haunches & front fenders
    const haunchGeo = new THREE.BoxGeometry(1.74, 0.34, 2.3);
    const haunchMesh = new THREE.Mesh(haunchGeo, this.bodyMat);
    haunchMesh.position.set(0, 0.54, 0.25);
    this.bodyGroup.add(haunchMesh);

    // 3. Panoramic smoked glass canopy + white A-pillar frame
    const canopyGeo = new THREE.BoxGeometry(1.22, 0.38, 1.75);
    const canopyMesh = new THREE.Mesh(canopyGeo, this.glassMat);
    canopyMesh.position.set(0, 0.78, 0.05);
    this.bodyGroup.add(canopyMesh);

    const roofRailGeo = new THREE.BoxGeometry(1.28, 0.06, 1.68);
    const roofRail = new THREE.Mesh(roofRailGeo, this.bodyMat);
    roofRail.position.set(0, 0.96, 0.08);
    this.bodyGroup.add(roofRail);

    // 4. Satin-black rear bumper & 3-fin diffuser
    const diffuserGeo = new THREE.BoxGeometry(1.66, 0.28, 0.42);
    const diffuserMesh = new THREE.Mesh(diffuserGeo, this.trimMat);
    diffuserMesh.position.set(0, 0.28, 1.82);
    this.bodyGroup.add(diffuserMesh);

    for (const fx of [-0.45, 0, 0.45]) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.36), this.trimMat);
      fin.position.set(fx, 0.22, 1.92);
      this.bodyGroup.add(fin);
    }

    // 5. Full-width red LED light bar & accent strips
    const ledBar = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.07, 0.08), this.tailLightMat);
    ledBar.position.set(0, 0.58, 1.98);
    this.bodyGroup.add(ledBar);

    const frontLip = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.06, 0.14), this.accentMat);
    frontLip.position.set(0, 0.22, -2.0);
    this.bodyGroup.add(frontLip);

    for (const side of [-1, 1]) {
      const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 3.1), this.accentMat);
      skirt.position.set(side * 0.89, 0.22, 0);
      this.bodyGroup.add(skirt);
    }

    // 6. Active pop-up rear spoiler (opens only in the air per v4.5)
    this.spoilerPivot.position.set(0, 0.72, 1.65);
    const wingBlade = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.05, 0.34), this.bodyMat);
    wingBlade.position.set(0, 0.08, 0.06);
    const strutL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.12), this.trimMat);
    strutL.position.set(-0.48, 0.02, 0.04);
    const strutR = strutL.clone();
    strutR.position.x = 0.48;
    this.spoilerPivot.add(wingBlade, strutL, strutR);
    this.bodyGroup.add(this.spoilerPivot);

    // 7. Twin Nitro exhaust flames
    const flameGeo = new THREE.ConeGeometry(0.14, 0.85, 10);
    flameGeo.rotateX(Math.PI / 2);
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.85,
    });
    for (const nx of [-0.36, 0.36]) {
      const flame = new THREE.Mesh(flameGeo, flameMat);
      flame.position.set(nx, 0.32, 2.35);
      flame.visible = false;
      this.nitroFlames.push(flame);
      this.bodyGroup.add(flame);
    }

    // Apply v4.6 +15% runtime car body height scale
    this.bodyGroup.scale.set(1, RENDER.carHeightScale, 1);
    this.root.add(this.bodyGroup);

    // 8. Four articulated wheel/thruster pods (stay round on the road)
    const wheelPositions: [number, number, number][] = [
      [-0.88, 0.34, -1.25],
      [0.88, 0.34, -1.25],
      [-0.88, 0.34, 1.25],
      [0.88, 0.34, 1.25],
    ];
    const tyreGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 18);
    tyreGeo.rotateZ(Math.PI / 2);
    const rimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.28, 10);
    rimGeo.rotateZ(Math.PI / 2);

    for (const [wx, wy, wz] of wheelPositions) {
      const pod = new THREE.Group();
      pod.position.set(wx, wy, wz);
      const spinGroup = new THREE.Group();
      const tyre = new THREE.Mesh(tyreGeo, this.trimMat);
      const rim = new THREE.Mesh(rimGeo, this.accentMat);
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.38, 0.06), this.bodyMat);
      spinGroup.add(tyre, rim, spoke);
      pod.add(spinGroup);
      this.wheelPods.push(pod);
      this.wheelRims.push(spinGroup);
      this.root.add(pod);
    }

    // 9. Shield & Turbo protective shells
    const shellGeo = new THREE.SphereGeometry(1.45, 20, 14);
    shellGeo.scale(0.85, 0.55, 1.65);
    this.shieldShell = new THREE.Mesh(
      shellGeo,
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.24,
        wireframe: true,
        depthWrite: false,
      })
    );
    this.shieldShell.position.set(0, 0.65, 0);
    this.shieldShell.visible = false;
    this.root.add(this.shieldShell);

    this.turboShell = new THREE.Mesh(
      shellGeo,
      new THREE.MeshBasicMaterial({
        color: 0x84cc16,
        transparent: true,
        opacity: 0.26,
        wireframe: true,
        depthWrite: false,
      })
    );
    this.turboShell.position.set(0, 0.65, 0);
    this.turboShell.visible = false;
    this.root.add(this.turboShell);

    // 10. Ground contact shadow plane (offset +0.02 Y so it never Z-fights)
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 64;
    shadowCanvas.height = 64;
    const sctx = shadowCanvas.getContext('2d')!;
    const grad = sctx.createRadialGradient(32, 32, 4, 32, 32, 30);
    grad.addColorStop(0, 'rgba(0,0,0,0.65)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, 64, 64);
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);

    this.shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(2.3, 4.4),
      new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        depthWrite: false,
        opacity: 0.6,
      })
    );
    this.shadowPlane.rotation.x = -Math.PI / 2;
    this.shadowPlane.position.set(0, 0.02, 0);
    this.root.add(this.shadowPlane);
  }

  public setCarLivery(carId: CarId, lockedSilhouette = false): void {
    const cfg = CARS.find((c) => c.id === carId) ?? CARS[0];
    if (lockedSilhouette) {
      this.bodyMat.color.setHex(0x090d16);
      this.accentMat.color.setHex(0x1e293b);
      this.accentMat.emissive.setHex(0x0f172a);
      return;
    }
    this.bodyMat.color.setHex(cfg.bodyColor);
    this.accentMat.color.setHex(cfg.accentColor);
    this.accentMat.emissive.setHex(cfg.emissiveColor);
    this.trimMat.color.setHex(cfg.trimColor);
  }

  public sync(player: Player, shieldActive: boolean, turboActive: boolean, timeSec: number): void {
    this.root.position.set(player.x, 0, player.z);
    const liftY = Math.max(0, player.y - 0.78);

    // Apply dive squash vs normal height
    const squashY = 1 - player.diveSquash * 0.34;
    const squashX = 1 + player.diveSquash * 0.12;
    this.bodyGroup.position.y = liftY - player.diveSquash * 0.22;
    this.bodyGroup.scale.set(squashX, RENDER.carHeightScale * squashY, 1);
    this.bodyGroup.rotation.set(player.pitch, 0, player.roll);

    // Active pop-up spoiler rises & tilts 22 deg when airborne
    this.spoilerPivot.position.y = 0.72 + player.spoilerOpen * 0.14;
    this.spoilerPivot.rotation.x = -player.spoilerOpen * 0.38;

    // Wheels spin & tilt into thrusters when airborne
    const thrusterTilt = player.isAirborne() ? Math.PI * 0.45 : 0;
    for (let i = 0; i < 4; i++) {
      const pod = this.wheelPods[i];
      pod.position.y = 0.34 + liftY;
      pod.rotation.z = (i % 2 === 0 ? -1 : 1) * thrusterTilt;
      pod.rotation.y = i < 2 ? -player.steerAngle : 0;
      this.wheelRims[i].rotation.x = -player.wheelSpin;
    }

    // Nitro exhaust flames active during Turbo or airborne boost
    const showFlames = turboActive || player.isAirborne();
    for (const flame of this.nitroFlames) {
      flame.visible = showFlames;
      if (showFlames) {
        const flicker = 0.85 + Math.sin(timeSec * 38) * 0.2;
        flame.scale.set(1, 1, flicker * (turboActive ? 1.45 : 1.0));
      }
    }

    this.shieldShell.visible = shieldActive;
    this.shieldShell.position.y = 0.65 + liftY;

    this.turboShell.visible = turboActive;
    this.turboShell.position.y = 0.65 + liftY;

    // Contact shadow scales down slightly with altitude
    const shadowScale = Math.max(0.45, 1 - liftY * 0.08);
    this.shadowPlane.scale.set(shadowScale, shadowScale, 1);
    (this.shadowPlane.material as THREE.MeshBasicMaterial).opacity = Math.max(0.18, 0.6 - liftY * 0.06);
  }
}
