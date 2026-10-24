import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  CarId,
  GRAPHICS,
  SpecialId,
  SpeedLevelId,
  TrackId,
  VERSION,
  WORLDS,
} from './config';
import { SoundEngine } from './audio/Audio';
import { SaveStore } from './core/Save';
import { World } from './gameplay/World';
import { CameraRig } from './render/CameraRig';
import { Environment3D } from './render/Environment3D';
import { VehicleView } from './render/Vehicle';
import { GameUI } from './ui/UI';

export { VERSION };

export class Game {
  private mount: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private cameraRig: CameraRig;
  private env3d: Environment3D;
  private vehicleView: VehicleView;

  private save = new SaveStore();
  private sound = new SoundEngine();
  private world = new World();
  private ui: GameUI;

  private isSoftwareGl: boolean;
  private state: 'home' | 'running' | 'paused' | 'revive' | 'gameover' = 'home';
  private lastTrackId: TrackId = 'endless';
  private lastEquippedSpecial: SpecialId | null = null;
  private specialConsumedThisRun = false;

  private clock = new THREE.Clock();
  private elapsedSec = 0;

  // Touch gesture tracking
  private touchStartX = 0;
  private touchStartY = 0;
  private touchActive = false;

  constructor(mount: HTMLElement) {
    this.mount = mount;

    // Detect software WebGL per Three.js skill directive
    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.className = 'sr-canvas';
    this.mount.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(WORLDS[0].skyColor);
    this.scene.fog = new THREE.FogExp2(WORLDS[0].fogColor, 0.012);

    // Studio RoomEnvironment reflection map
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // Balanced 3-point + hemisphere lighting
    const hemiLight = new THREE.HemisphereLight(0x7dd3fc, 0x1e1b4b, 0.85);
    this.scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.65);
    keyLight.position.set(12, 24, 16);
    keyLight.castShadow = !this.isSoftwareGl;
    if (!this.isSoftwareGl) {
      keyLight.shadow.camera.left = -12;
      keyLight.shadow.camera.right = 12;
      keyLight.shadow.camera.top = 18;
      keyLight.shadow.camera.bottom = -18;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.9);
    rimLight.position.set(-10, 8, -18);
    this.scene.add(rimLight);

    this.cameraRig = new CameraRig(window.innerWidth / Math.max(1, window.innerHeight));
    this.env3d = new Environment3D(this.renderer.capabilities.getMaxAnisotropy());
    this.scene.add(this.env3d.root);

    this.vehicleView = new VehicleView(this.isSoftwareGl);
    this.vehicleView.setCarLivery(this.save.data.selectedCar, false);
    this.scene.add(this.vehicleView.root);

    this.applySettings();
    this.onResize();

    this.ui = new GameUI(this.mount, this.save, this.sound, {
      onStartRace: (trackId, equippedSpecial) => this.startRace(trackId, equippedSpecial),
      onSelectCar: (carId) => this.previewOrSelectCar(carId),
      onSelectSpeed: (spd) => {
        this.save.data.selectedSpeed = spd;
        this.save.save();
      },
      onMoveLane: (dir) => this.handleMoveLane(dir),
      onHop: () => this.handleHop(),
      onDive: () => this.handleDive(),
      onUseSpecial: () => this.handleUseSpecial(),
      onPauseToggle: () => this.togglePause(),
      onReviveAccept: () => this.acceptRevive(),
      onReviveDecline: () => this.finalizeRun(),
      onRestartRace: () => this.startRace(this.lastTrackId, this.lastEquippedSpecial),
      onQuitToHome: () => this.returnHome(),
      onSettingsChanged: () => this.applySettings(),
    });

    this.bindInputs();

    // URL flags support (?autopilot)
    const params = new URLSearchParams(window.location.search);
    if (params.has('autopilot')) {
      this.startRace('endless', 'roadster', true);
    }

    this.clock.start();
    this.startLoop();
  }

  private applySettings(): void {
    const s = this.save.data.settings;
    this.sound.soundEnabled = s.sound;
    this.sound.musicEnabled = s.music;
    const gfx = GRAPHICS[s.graphics];
    const ratio = this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, gfx.pixelRatioCap);
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private previewOrSelectCar(carId: CarId): void {
    const unlocked = this.save.isCarUnlocked(carId);
    this.vehicleView.setCarLivery(carId, !unlocked);
  }

  private startRace(
    trackId: TrackId,
    equippedSpecial: SpecialId | null,
    autopilot = false
  ): void {
    this.sound.unlock();
    this.sound.startMusic();
    this.lastTrackId = trackId;
    this.lastEquippedSpecial = equippedSpecial;
    this.specialConsumedThisRun = false;

    this.vehicleView.setCarLivery(this.save.data.selectedCar, false);
    this.world.reset({
      speedLevel: this.save.data.selectedSpeed as SpeedLevelId,
      trackId,
      equippedSpecial,
      autopilot,
    });
    this.env3d.applyWorldTheme(0, this.scene);

    this.state = 'running';
    this.ui.mode = 'race';
    this.ui.activeModal = null;
    this.ui.render();

    if (trackId === 'training') {
      this.ui.showToast('TRAINING: Swipe ←/→ lanes, ↑ Hop, ↓ Dive, [E] Special!', 4.5);
    }
  }

  private returnHome(): void {
    this.state = 'home';
    this.world.player.reset();
    this.vehicleView.setCarLivery(this.save.data.selectedCar, false);
    this.ui.mode = 'home';
    this.ui.activeModal = null;
    this.ui.render();
  }

  private togglePause(): void {
    if (this.state === 'running') {
      this.state = 'paused';
      this.ui.openModal('pause');
    } else if (this.state === 'paused') {
      this.state = 'running';
      this.ui.activeModal = null;
      this.ui.render();
    }
  }

  private acceptRevive(): void {
    this.world.revive();
    this.state = 'running';
    this.ui.showToast('REVIVED!', 2.0);
    this.ui.render();
  }

  private finalizeRun(): void {
    this.state = 'gameover';
    const result = this.save.recordRunProgress({
      distanceMeters: this.world.distanceMeters,
      coinsCollected: this.world.coins,
      expEarned: this.world.exp,
      ringsPassed: this.world.ringsPassed,
      specialsUsed: this.world.player.specialsUsedCount,
      hopsAndDives: this.world.player.hopsAndDivesCount,
      isMegaRush: this.world.trackId === 'mega_rush',
    });

    this.ui.showFinishModal({
      exp: this.world.exp,
      coins: this.world.coins,
      distance: this.world.distanceMeters,
      rank: this.world.currentRank,
      promotedTo: result.promotedTo,
    });
  }

  private handleMoveLane(dir: -1 | 1): void {
    if (this.state !== 'running') return;
    if (this.world.player.moveLane(dir)) {
      this.sound.playLane();
    }
  }

  private handleHop(): void {
    if (this.state !== 'running') return;
    if (this.world.player.hop()) {
      this.sound.playHop();
    }
  }

  private handleDive(): void {
    if (this.state !== 'running') return;
    if (this.world.player.dive()) {
      this.sound.playDive();
    }
  }

  private handleUseSpecial(): void {
    if (this.state !== 'running') return;
    const sp = this.world.equippedSpecial;
    if (sp && this.world.useSpecialButton()) {
      this.sound.playSpecial();
      if (!this.specialConsumedThisRun && this.world.trackId !== 'training') {
        this.specialConsumedThisRun = true;
        this.save.data.specials[sp] = Math.max(0, this.save.data.specials[sp] - 1);
        this.save.save();
      }
      this.ui.showToast(`${sp.toUpperCase()} ACTIVATED!`, 2.0);
    }
  }

  private bindInputs(): void {
    window.addEventListener('resize', () => this.onResize());

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (this.state === 'running' || this.state === 'paused') {
          this.togglePause();
        }
        return;
      }
      if (this.state !== 'running') return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        this.handleMoveLane(-1);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        this.handleMoveLane(1);
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') {
        e.preventDefault();
        this.handleHop();
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        this.handleDive();
      } else if (e.key === 'e' || e.key === 'E' || e.key === 'Enter' || e.key === 'Shift') {
        this.handleUseSpecial();
      }
    });

    // Touch / pointer swipe support on the canvas
    this.renderer.domElement.addEventListener('pointerdown', (e) => {
      this.sound.unlock();
      this.touchStartX = e.clientX;
      this.touchStartY = e.clientY;
      this.touchActive = true;
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.touchActive || this.state !== 'running') return;
      const dx = e.clientX - this.touchStartX;
      const dy = e.clientY - this.touchStartY;
      const threshold = 28;
      if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;

      this.touchActive = false;
      if (Math.abs(dx) > Math.abs(dy)) {
        this.handleMoveLane(dx > 0 ? 1 : -1);
      } else if (dy < 0) {
        this.handleHop();
      } else {
        this.handleDive();
      }
    });

    window.addEventListener('pointerup', () => {
      this.touchActive = false;
    });
  }

  private onResize(): void {
    const w = window.innerWidth;
    const h = Math.max(1, window.innerHeight);
    this.cameraRig.resize(w / h);
    this.renderer.setSize(w, h);
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        window.setTimeout(cb, 80);
      }
    };
    window.setTimeout(poll, 5);
  }

  private startLoop(): void {
    const tick = () => {
      const rawDt = this.clock.getDelta();
      const dt = Math.min(0.05, Math.max(0.001, rawDt));
      this.elapsedSec += dt;

      if (this.state === 'home') {
        this.world.player.wheelSpin = (this.world.player.wheelSpin + dt * 6) % (Math.PI * 2);
        this.vehicleView.sync(this.world.player, false, false, this.elapsedSec);
        this.env3d.update(dt, 14, 0, 1000, [], [], this.elapsedSec);
        this.cameraRig.updateHome(dt);
      } else if (this.state === 'running') {
        this.world.update(dt, this.save.data.bestExp, {
          onCoin: () => this.sound.playCoin(),
          onRing: () => {
            this.sound.playRing();
            this.ui.showToast('RING BONUS · DOUBLE COINS (8s)!', 1.8);
          },
          onPowerup: (kind) => {
            this.sound.playPowerup();
            this.ui.showToast(`${kind.toUpperCase()} COLLECTED!`, 1.6);
          },
          onRankUp: (newRank) => {
            this.sound.playSpecial();
            this.ui.showToast(`CLASS UP → RANK ${newRank}!`, 2.5);
          },
          onBeatBest: () => {
            this.sound.playSpecial();
            this.ui.showToast('YOU BEAT YOUR BEST EXP!', 2.6);
          },
          onPortal: (worldIdx) => {
            this.env3d.applyWorldTheme(worldIdx, this.scene);
            const wName = WORLDS[worldIdx % WORLDS.length].name;
            this.ui.showToast(`ENTERING ${wName.toUpperCase()}`, 2.2);
          },
          onHeartLost: () => {
            this.sound.playCrash();
            this.ui.showToast('HULL HIT · SHIELDED BY HEART!', 1.8);
          },
          onAutoSpecial: (sp) => {
            this.sound.playSpecial();
            if (!this.specialConsumedThisRun && this.world.trackId !== 'training') {
              this.specialConsumedThisRun = true;
              this.save.data.specials[sp] = Math.max(0, this.save.data.specials[sp] - 1);
              this.save.save();
            }
            this.ui.showToast(`${sp.toUpperCase()} AUTO ACTIVATED!`, 2.4);
          },
          onCrashEnd: () => {
            this.sound.playCrash();
            if (this.world.revivesUsed < this.world.maxRevives) {
              this.state = 'revive';
              this.ui.openModal('revive');
            } else {
              this.finalizeRun();
            }
          },
          onTrackFinish: () => {
            this.sound.playSpecial();
            this.world.coins += 300;
            this.finalizeRun();
          },
        });

        this.vehicleView.sync(
          this.world.player,
          this.world.shieldTimer > 0,
          this.world.turboTimer > 0,
          this.elapsedSec
        );
        this.env3d.update(
          dt,
          this.world.roadSpeed,
          this.world.distanceMeters,
          this.world.nextPortalDist,
          this.world.obstacles,
          this.world.pickups,
          this.elapsedSec
        );
        this.cameraRig.updateRace(
          dt,
          this.world.player,
          this.world.roadSpeed,
          this.save.data.settings.cameraMotion
        );
        this.ui.updateHud(this.world, dt);
      }

      this.renderer.render(this.scene, this.cameraRig.camera);

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        requestAnimationFrame(tick);
      }
    };

    requestAnimationFrame(tick);
  }
}
