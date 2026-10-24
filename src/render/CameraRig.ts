import * as THREE from 'three';
import { CAMERA, SPEED } from '../config';
import { Player } from '../gameplay/Player';

export class CameraRig {
  public camera: THREE.PerspectiveCamera;
  private lookTarget = new THREE.Vector3(0, 1.0, -10);
  private homeAngle = 0;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(CAMERA.fixed.fov, aspect, 0.1, 220);
    this.camera.position.set(0, CAMERA.fixed.height, CAMERA.fixed.dist);
    this.camera.lookAt(this.lookTarget);
  }

  public resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  public updateHome(dt: number): void {
    // v4.6: Home slow orbit stays strictly inside the road (never swings past guard rails)
    this.homeAngle += dt * 0.45;
    const x = Math.sin(this.homeAngle) * 2.65;
    const z = 4.6 + Math.cos(this.homeAngle * 0.5) * 0.85;
    const y = CAMERA.home.height + Math.sin(this.homeAngle * 0.8) * 0.18;

    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, x, 5, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, y, 5, dt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, z, 5, dt);

    this.lookTarget.set(0, CAMERA.home.lookY, -0.4);
    this.camera.lookAt(this.lookTarget);

    if (Math.abs(this.camera.fov - CAMERA.home.fov) > 0.2) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, CAMERA.home.fov, 6, dt);
      this.camera.updateProjectionMatrix();
    }
  }

  public updateRace(
    dt: number,
    player: Player,
    roadSpeed: number,
    cameraMotionEnabled: boolean
  ): void {
    const preset = cameraMotionEnabled ? CAMERA.chase : CAMERA.fixed;

    // Fit distance on narrow portrait viewports so outer lanes stay 100% visible
    const aspectPenalty = this.camera.aspect < 0.75 ? (0.75 - this.camera.aspect) * 3.8 : 0;
    const targetZ = preset.dist + aspectPenalty;

    const targetX = cameraMotionEnabled ? player.x * 0.68 : 0;
    // Fixed view only lifts for high flights (Roadster / HYPER / SOS) or gentle jump tracking
    const flightLift =
      player.y > 3.6
        ? (player.y - 0.78) * 0.82
        : cameraMotionEnabled
          ? Math.max(0, player.y - 0.78) * 0.45
          : Math.max(0, player.y - 1.6) * 0.35;
    const targetY = preset.height + flightLift;

    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, targetX, 10, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, targetY, 9, dt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, targetZ, 8, dt);

    const lookX = cameraMotionEnabled ? player.x * 0.35 : 0;
    const lookY = 1.05 + flightLift * 0.55;
    this.lookTarget.x = THREE.MathUtils.damp(this.lookTarget.x, lookX, 12, dt);
    this.lookTarget.y = THREE.MathUtils.damp(this.lookTarget.y, lookY, 10, dt);
    this.lookTarget.z = -preset.lookAhead;
    this.camera.lookAt(this.lookTarget);

    const speedRatio = Math.max(0, (roadSpeed - SPEED.start) / (SPEED.max * 1.4));
    const targetFov = preset.fov + speedRatio * 7.5;
    if (Math.abs(this.camera.fov - targetFov) > 0.1) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 6, dt);
      this.camera.updateProjectionMatrix();
    }
  }
}
