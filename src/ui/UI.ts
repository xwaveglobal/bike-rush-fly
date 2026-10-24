import {
  CARS,
  CarId,
  GraphicsQuality,
  RANKS,
  RankClass,
  SPECIALS,
  SpecialId,
  SPEED_LEVELS,
  SpeedLevelId,
  TRACKS,
  TrackId,
  VERSION,
  WORLDS,
} from '../config';
import { SoundEngine } from '../audio/Audio';
import { SaveStore } from '../core/Save';
import { World } from '../gameplay/World';

export type ModalKind =
  | null
  | 'play_setup'
  | 'garage'
  | 'shop'
  | 'missions'
  | 'daily'
  | 'ranks'
  | 'guide'
  | 'settings'
  | 'pause'
  | 'revive'
  | 'finish';

export interface UICallbacks {
  onStartRace: (trackId: TrackId, equippedSpecial: SpecialId | null) => void;
  onSelectCar: (carId: CarId) => void;
  onSelectSpeed: (speed: SpeedLevelId) => void;
  onMoveLane: (dir: -1 | 1) => void;
  onHop: () => void;
  onDive: () => void;
  onUseSpecial: () => void;
  onPauseToggle: () => void;
  onReviveAccept: () => void;
  onReviveDecline: () => void;
  onRestartRace: () => void;
  onQuitToHome: () => void;
  onSettingsChanged: () => void;
}

export class GameUI {
  private root: HTMLElement;
  private save: SaveStore;
  private sound: SoundEngine;
  private cb: UICallbacks;

  public mode: 'home' | 'race' = 'home';
  public activeModal: ModalKind = null;
  private pendingTrack: TrackId = 'endless';
  private toastText = '';
  private toastTimer = 0;

  private hudContainer: HTMLElement | null = null;
  private lastFinishStats: {
    exp: number;
    coins: number;
    distance: number;
    rank: RankClass;
    promotedTo: RankClass | null;
  } | null = null;

  constructor(mount: HTMLElement, save: SaveStore, sound: SoundEngine, cb: UICallbacks) {
    this.save = save;
    this.sound = sound;
    this.cb = cb;

    this.root = document.createElement('div');
    this.root.className = 'sr-ui-root';
    mount.appendChild(this.root);
    this.render();
  }

  public showToast(msg: string, duration = 2.2): void {
    this.toastText = msg;
    this.toastTimer = duration;
  }

  public showFinishModal(stats: {
    exp: number;
    coins: number;
    distance: number;
    rank: RankClass;
    promotedTo: RankClass | null;
  }): void {
    this.lastFinishStats = stats;
    this.activeModal = 'finish';
    this.render();
  }

  public openModal(modal: ModalKind): void {
    this.sound.playClick();
    this.activeModal = modal;
    this.render();
  }

  public render(): void {
    this.root.innerHTML = '';

    if (this.mode === 'home') {
      this.root.appendChild(this.buildHomeView());
    } else {
      this.hudContainer = this.buildRaceHud();
      this.root.appendChild(this.hudContainer);
    }

    if (this.activeModal) {
      this.root.appendChild(this.buildModalView(this.activeModal));
    }
  }

  private buildHomeView(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'sr-home';

    const rank = this.save.getPlayerRank();
    const rankDef = RANKS.find((r) => r.id === rank) ?? RANKS[0];
    const selectedCar = CARS.find((c) => c.id === this.save.data.selectedCar) ?? CARS[0];

    // Top bar: Profile + Wallet + Settings
    const top = document.createElement('div');
    top.className = 'sr-topbar sr-interactive';
    top.innerHTML = `
      <button class="sr-profile-chip" data-action="open-ranks" title="View Pilot Rank & Leaderboard">
        <span class="sr-rank-shield" style="background:${rankDef.color}">${rankDef.id}</span>
        <div style="text-align:left">
          <div style="font-size:13px;font-weight:800;color:#f8fafc">${this.save.data.pilotName}</div>
          <div class="tabular-nums" style="font-size:11px;color:#94a3b8">BEST ${this.save.data.bestExp.toLocaleString()} EXP · ${selectedCar.name}</div>
        </div>
      </button>
      <div class="sr-wallet-bar">
        <button class="sr-coin-btn tabular-nums" data-action="open-shop">
          <span>◎ ${this.save.data.coins.toLocaleString()}</span>
          <span style="color:#38bdf8;font-weight:800">+</span>
        </button>
        <button class="sr-icon-btn" data-action="open-settings" title="Settings">⚙</button>
      </div>
    `;
    wrap.appendChild(top);

    // Mid Area: Left & Right quick rails keeping center 3D car viewport 100% clear
    const mid = document.createElement('div');
    mid.className = 'sr-mid-area';
    mid.innerHTML = `
      <div class="sr-rail sr-interactive">
        <button class="sr-rail-tile" data-action="open-daily">
          <span class="ico">★</span>
          <span>Daily</span>
        </button>
        <button class="sr-rail-tile" data-action="open-ranks">
          <span class="ico">♛</span>
          <span>Ranks</span>
        </button>
        <button class="sr-rail-tile" data-action="start-bonus">
          <span class="ico">◈</span>
          <span>Bonus</span>
        </button>
      </div>
      <div class="sr-rail sr-interactive">
        <button class="sr-rail-tile" data-action="open-guide">
          <span class="ico">?</span>
          <span>Guide</span>
        </button>
        <button class="sr-rail-tile" data-action="start-training">
          <span class="ico">▶</span>
          <span>Train</span>
        </button>
        <button class="sr-rail-tile" data-action="share-link">
          <span class="ico">↗</span>
          <span>Share</span>
        </button>
      </div>
    `;
    wrap.appendChild(mid);

    // Bottom Dock: Speed selector + PLAY + Garage / Shop / Missions
    const bottom = document.createElement('div');
    bottom.className = 'sr-home-bottom sr-interactive';

    const speedHtml = (['easy', 'normal', 'hard'] as SpeedLevelId[])
      .map((sid) => {
        const cfg = SPEED_LEVELS[sid];
        const active = this.save.data.selectedSpeed === sid;
        return `
          <button class="sr-speed-btn ${active ? 'active' : ''}" data-speed="${sid}" style="${active ? `border-color:${cfg.color}` : ''}">
            <span style="color:${cfg.color}">${'★'.repeat(cfg.stars)} ${cfg.label}</span>
            <span class="tabular-nums" style="font-size:10px;color:#94a3b8">EXP ×${(cfg.expRate / 0.2).toFixed(2)} · Coins ×${cfg.coinMult}</span>
          </button>
        `;
      })
      .join('');

    bottom.innerHTML = `
      <div class="sr-speed-selector">${speedHtml}</div>
      <button class="sr-play-btn" data-action="open-play">
        <span>PLAY SKYWAY</span>
        <span>»</span>
      </button>
      <div class="sr-nav-row">
        <button class="sr-nav-btn" data-action="open-garage">Garage (${CARS.filter((c) => this.save.isCarUnlocked(c.id)).length}/${CARS.length})</button>
        <button class="sr-nav-btn" data-action="open-shop">Magic Bag & Shop</button>
        <button class="sr-nav-btn" data-action="open-missions">Missions</button>
      </div>
    `;
    wrap.appendChild(bottom);

    this.bindHomeEvents(wrap);
    return wrap;
  }

  private bindHomeEvents(container: HTMLElement): void {
    container.querySelectorAll<HTMLElement>('[data-speed]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const spd = btn.dataset.speed as SpeedLevelId;
        this.sound.playClick();
        this.cb.onSelectSpeed(spd);
        this.render();
      });
    });

    const onAction = (action: string | undefined) => {
      if (!action) return;
      if (action === 'open-play') {
        this.pendingTrack = 'endless';
        this.openModal('play_setup');
      } else if (action === 'start-bonus') {
        this.pendingTrack = 'bonus';
        this.openModal('play_setup');
      } else if (action === 'start-training') {
        this.sound.playClick();
        this.cb.onStartRace('training', 'roadster');
      } else if (action === 'open-garage') {
        this.openModal('garage');
      } else if (action === 'open-shop') {
        this.openModal('shop');
      } else if (action === 'open-missions') {
        this.openModal('missions');
      } else if (action === 'open-daily') {
        this.openModal('daily');
      } else if (action === 'open-ranks') {
        this.openModal('ranks');
      } else if (action === 'open-guide') {
        this.openModal('guide');
      } else if (action === 'open-settings') {
        this.openModal('settings');
      } else if (action === 'share-link') {
        this.sound.playClick();
        if (navigator.clipboard) {
          navigator.clipboard.writeText(window.location.href).catch(() => {});
        }
        this.openModal('ranks');
      }
    };

    container.querySelectorAll<HTMLElement>('[data-action]').forEach((el) => {
      el.addEventListener('click', () => onAction(el.dataset.action));
    });
  }

  private buildRaceHud(): HTMLElement {
    const hud = document.createElement('div');
    hud.className = 'sr-hud';
    hud.innerHTML = `
      <div class="sr-hud-top">
        <div class="sr-hud-card tabular-nums">
          <div style="display:flex;align-items:center;gap:8px">
            <span id="hud-rank-badge" class="sr-rank-shield" style="background:#38bdf8">D</span>
            <div>
              <div id="hud-exp" style="font-size:18px;font-weight:800">0 EXP</div>
              <div id="hud-next-rank" style="font-size:11px;color:#94a3b8">NEXT: C (3,000)</div>
            </div>
          </div>
          <div id="hud-world-line" style="margin-top:4px;font-size:11px;color:#38bdf8;font-weight:700">Future City · 0 m</div>
        </div>

        <div class="sr-hud-right sr-interactive">
          <div style="display:flex;align-items:center;gap:8px">
            <div class="sr-hud-card tabular-nums" style="padding:6px 10px;font-size:13px;font-weight:700">
              <span id="hud-coins" style="color:#fde68a">◎ 0</span>
              <span style="margin:0 5px;color:#475569">·</span>
              <span id="hud-speed">76 km/h</span>
            </div>
            <button class="sr-icon-btn" id="hud-pause-btn" title="Pause (Esc)">⏸</button>
          </div>
          <div id="hud-hearts" class="sr-hearts-row">♥</div>
          <button id="hud-special-btn" class="sr-special-trigger" style="display:none">SOS READY</button>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;align-items:center;gap:8px">
        <div id="hud-toast" class="sr-toast-banner" style="display:none"></div>
        <div id="hud-danger" class="sr-danger-banner" style="display:none"></div>
        <div id="hud-powerups" class="tabular-nums" style="font-size:12px;font-weight:700;color:#38bdf8"></div>
      </div>

      <div class="sr-hud-bottom sr-interactive">
        <div class="sr-touch-pad">
          <button class="sr-touch-btn" data-move="left">← LEFT</button>
          <button class="sr-touch-btn" data-move="up">↑ HOP</button>
          <button class="sr-touch-btn" data-move="down">↓ DIVE</button>
          <button class="sr-touch-btn" data-move="right">RIGHT →</button>
        </div>
      </div>
    `;

    hud.querySelector('#hud-pause-btn')?.addEventListener('click', () => {
      this.sound.playClick();
      this.cb.onPauseToggle();
    });

    hud.querySelector('#hud-special-btn')?.addEventListener('click', () => {
      this.cb.onUseSpecial();
    });

    hud.querySelectorAll<HTMLElement>('[data-move]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const m = btn.dataset.move;
        if (m === 'left') this.cb.onMoveLane(-1);
        else if (m === 'right') this.cb.onMoveLane(1);
        else if (m === 'up') this.cb.onHop();
        else if (m === 'down') this.cb.onDive();
      });
    });

    return hud;
  }

  public updateHud(world: World, dt: number): void {
    if (this.mode !== 'race' || !this.hudContainer) return;

    const expEl = this.hudContainer.querySelector('#hud-exp');
    const rankBadge = this.hudContainer.querySelector('#hud-rank-badge') as HTMLElement | null;
    const nextEl = this.hudContainer.querySelector('#hud-next-rank');
    const worldEl = this.hudContainer.querySelector('#hud-world-line');
    const coinsEl = this.hudContainer.querySelector('#hud-coins');
    const speedEl = this.hudContainer.querySelector('#hud-speed');
    const heartsEl = this.hudContainer.querySelector('#hud-hearts');
    const specialBtn = this.hudContainer.querySelector('#hud-special-btn') as HTMLElement | null;
    const dangerEl = this.hudContainer.querySelector('#hud-danger') as HTMLElement | null;
    const toastEl = this.hudContainer.querySelector('#hud-toast') as HTMLElement | null;
    const powerupsEl = this.hudContainer.querySelector('#hud-powerups');

    if (expEl) expEl.textContent = `${world.exp.toLocaleString()} EXP`;

    const rankDef = RANKS.find((r) => r.id === world.currentRank) ?? RANKS[0];
    if (rankBadge) {
      rankBadge.textContent = rankDef.id;
      rankBadge.style.background = rankDef.color;
    }

    if (nextEl) {
      const idx = RANKS.findIndex((r) => r.id === world.currentRank);
      const nextR = RANKS[idx + 1];
      if (nextR) {
        const needed = Math.max(0, nextR.exp - world.exp);
        nextEl.textContent = `NEXT ${nextR.id} · ${needed.toLocaleString()} EXP`;
      } else {
        nextEl.textContent = `MAX CLASS REACHED`;
      }
    }

    const wTheme = WORLDS[world.worldIndex % WORLDS.length];
    if (worldEl) {
      worldEl.textContent = `${wTheme.name} · ${Math.floor(world.distanceMeters).toLocaleString()} m`;
    }
    if (coinsEl) coinsEl.textContent = `◎ ${world.coins.toLocaleString()}`;
    if (speedEl) speedEl.textContent = `${Math.round(world.roadSpeed * 3.6)} km/h`;
    if (heartsEl) heartsEl.textContent = '♥'.repeat(world.hearts);

    if (specialBtn) {
      if (world.equippedSpecial && world.specialCharges > 0) {
        const sp = SPECIALS[world.equippedSpecial];
        specialBtn.style.display = 'inline-block';
        specialBtn.style.borderColor = sp.color;
        specialBtn.textContent = `${sp.shortName} ×${world.specialCharges} [E]`;
      } else {
        specialBtn.style.display = 'none';
      }
    }

    if (dangerEl) {
      if (this.save.data.settings.dangerArrows && world.dangerHint) {
        const map: Record<string, string> = {
          up: '↑ HOP NOW',
          down: '↓ DIVE UNDER',
          left: '← MOVE LEFT',
          right: 'MOVE RIGHT →',
          sos: 'TAP SPECIAL [E]',
        };
        dangerEl.style.display = 'block';
        dangerEl.textContent = map[world.dangerHint] ?? '';
      } else {
        dangerEl.style.display = 'none';
      }
    }

    if (this.toastTimer > 0) {
      this.toastTimer = Math.max(0, this.toastTimer - dt);
      if (toastEl) {
        toastEl.style.display = 'block';
        toastEl.textContent = this.toastText;
      }
    } else if (toastEl) {
      toastEl.style.display = 'none';
    }

    if (powerupsEl) {
      const parts: string[] = [];
      if (world.shieldTimer > 0) parts.push(`SHIELD ${world.shieldTimer.toFixed(1)}s`);
      if (world.turboTimer > 0) parts.push(`TURBO ${world.turboTimer.toFixed(1)}s`);
      if (world.magnetTimer > 0) parts.push(`MAGNET ${world.magnetTimer.toFixed(1)}s`);
      if (world.doubleCoinsTimer > 0) parts.push(`COINS ×2 ${world.doubleCoinsTimer.toFixed(1)}s`);
      powerupsEl.textContent = parts.join(' · ');
    }
  }

  private buildModalView(kind: Exclude<ModalKind, null>): HTMLElement {
    const backdrop = document.createElement('div');
    backdrop.className = 'sr-modal-backdrop sr-interactive';

    const panel = document.createElement('div');
    panel.className = 'sr-modal-panel';
    backdrop.appendChild(panel);

    if (kind === 'play_setup') {
      this.populatePlaySetupModal(panel);
    } else if (kind === 'garage') {
      this.populateGarageModal(panel);
    } else if (kind === 'shop') {
      this.populateShopModal(panel);
    } else if (kind === 'missions') {
      this.populateMissionsModal(panel);
    } else if (kind === 'daily') {
      this.populateDailyModal(panel);
    } else if (kind === 'ranks') {
      this.populateRanksModal(panel);
    } else if (kind === 'guide') {
      this.populateGuideModal(panel);
    } else if (kind === 'settings') {
      this.populateSettingsModal(panel);
    } else if (kind === 'pause') {
      this.populatePauseModal(panel);
    } else if (kind === 'revive') {
      this.populateReviveModal(panel);
    } else if (kind === 'finish') {
      this.populateFinishModal(panel);
    }

    panel.querySelector('[data-close-modal]')?.addEventListener('click', () => {
      this.sound.playClick();
      this.activeModal = null;
      this.render();
    });

    return backdrop;
  }

  private populatePlaySetupModal(panel: HTMLElement): void {
    // v4.5 Magic Bag auto-equips one owned special when slot is empty
    if (!this.save.data.equippedSpecial) {
      const owned = (['roadster', 'hyper', 'sos'] as SpecialId[]).filter(
        (id) => this.save.data.specials[id] > 0
      );
      if (owned.length > 0) {
        this.save.data.equippedSpecial = owned[0];
      }
    }

    const tracksHtml = TRACKS.map((t) => {
      const reqIdx = this.save.getRankIndex(t.requiredRank);
      const unlocked = this.save.getRankIndex() >= reqIdx;
      const selected = this.pendingTrack === t.id;
      return `
        <div class="sr-item-row" style="${selected ? `border-color:${t.accent}` : ''}">
          <div>
            <div style="font-weight:800;font-size:14px;color:${t.accent}">${t.name}</div>
            <div style="font-size:11px;color:#94a3b8">${t.subtitle}</div>
          </div>
          ${
            unlocked
              ? `<button class="sr-action-btn ${selected ? '' : 'secondary'}" data-pick-track="${t.id}">${selected ? 'Selected' : 'Select'}</button>`
              : `<span style="font-size:11px;color:#f97316;font-weight:700">Reach ${t.requiredRank}</span>`
          }
        </div>
      `;
    }).join('');

    const specialsHtml = (['sos', 'roadster', 'hyper'] as SpecialId[])
      .map((sid) => {
        const sp = SPECIALS[sid];
        const count = this.save.data.specials[sid];
        const equipped = this.save.data.equippedSpecial === sid;
        return `
          <div class="sr-item-row" style="${equipped ? `border-color:${sp.color}` : ''}">
            <div>
              <div style="font-weight:800;font-size:13px;color:${sp.color}">${sp.name} (Owned: ${count})</div>
              <div style="font-size:11px;color:#94a3b8">${sp.description}</div>
            </div>
            ${
              count > 0
                ? `<button class="sr-action-btn ${equipped ? '' : 'secondary'}" data-equip-special="${sid}">${equipped ? 'Equipped' : 'Equip'}</button>`
                : `<button class="sr-action-btn secondary" data-buy-special="${sid}">◎ ${sp.price}</button>`
            }
          </div>
        `;
      })
      .join('');

    panel.innerHTML = `
      <div class="sr-modal-header">
        <h3 class="sr-modal-title">Track & Magic Bag</h3>
        <button class="sr-icon-btn" data-close-modal>✕</button>
      </div>
      <div style="font-size:12px;font-weight:700;color:#cbd5e1">1. Choose Skyway Track</div>
      <div class="sr-card-list">${tracksHtml}</div>
      <div style="font-size:12px;font-weight:700;color:#cbd5e1">2. Magic Bag Special (Consumed Only When Used)</div>
      <div class="sr-card-list">${specialsHtml}</div>
      <div style="display:flex;gap:8px;margin-top:4px">
        <button class="sr-action-btn secondary" id="btn-launch-no-special" style="flex:1">Race Without Special</button>
        <button class="sr-action-btn" id="btn-launch-race" style="flex:2;font-size:14px">LAUNCH RACE »</button>
      </div>
    `;

    panel.querySelectorAll<HTMLElement>('[data-pick-track]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.sound.playClick();
        this.pendingTrack = btn.dataset.pickTrack as TrackId;
        this.populatePlaySetupModal(panel);
      });
    });

    panel.querySelectorAll<HTMLElement>('[data-equip-special]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.sound.playClick();
        const sid = btn.dataset.equipSpecial as SpecialId;
        this.save.data.equippedSpecial = sid;
        this.save.save();
        this.populatePlaySetupModal(panel);
      });
    });

    panel.querySelectorAll<HTMLElement>('[data-buy-special]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sid = btn.dataset.buySpecial as SpecialId;
        const sp = SPECIALS[sid];
        if (this.save.data.coins >= sp.price) {
          this.sound.playCoin();
          this.save.data.coins -= sp.price;
          this.save.data.specials[sid] += 1;
          this.save.data.equippedSpecial = sid;
          this.save.save();
          this.populatePlaySetupModal(panel);
        } else {
          this.openModal('shop');
        }
      });
    });

    panel.querySelector('#btn-launch-no-special')?.addEventListener('click', () => {
      this.sound.playClick();
      this.activeModal = null;
      this.cb.onStartRace(this.pendingTrack, null);
    });

    panel.querySelector('#btn-launch-race')?.addEventListener('click', () => {
      this.sound.playClick();
      const eq = this.save.data.equippedSpecial;
      const validSpecial = eq && this.save.data.specials[eq] > 0 ? eq : null;
      this.activeModal = null;
      this.cb.onStartRace(this.pendingTrack, validSpecial);
    });
  }

  private populateGarageModal(panel: HTMLElement): void {
    const cardsHtml = CARS.map((c) => {
      const unlocked = this.save.isCarUnlocked(c.id);
      const selected = this.save.data.selectedCar === c.id;
      const hex = `#${c.bodyColor.toString(16).padStart(6, '0')}`;
      return `
        <div class="sr-car-card ${selected ? 'selected' : ''}" data-car-id="${c.id}">
          <div class="sr-car-swatch" style="background:${unlocked ? hex : '#050811'};color:${unlocked ? '#04071a' : '#475569'}">
            ${unlocked ? 'XWAVE X1 3D' : `LOCKED · CLASS ${c.requiredRank}`}
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-weight:800;font-size:13px">${c.name}</span>
            <span style="font-size:11px;font-weight:700;color:${c.rarityColor}">${c.rarity}</span>
          </div>
          <div style="font-size:11px;color:#94a3b8">${c.tagline}</div>
          <div style="font-size:11px;font-weight:700;color:${unlocked ? '#38bdf8' : '#f97316'}">
            ${selected ? '✓ Active Roadster' : unlocked ? 'Tap to Drive' : `Unlocks at Class ${c.requiredRank}`}
          </div>
        </div>
      `;
    }).join('');

    panel.innerHTML = `
      <div class="sr-modal-header">
        <h3 class="sr-modal-title">XWAVE Garage · Class Trophies</h3>
        <button class="sr-icon-btn" data-close-modal>✕</button>
      </div>
      <div style="font-size:12px;color:#94a3b8">Cars unlock permanently by reaching their Pilot Class. Locked cars preview as dark silhouettes in 3D.</div>
      <div class="sr-car-grid">${cardsHtml}</div>
    `;

    panel.querySelectorAll<HTMLElement>('[data-car-id]').forEach((card) => {
      card.addEventListener('click', () => {
        const cid = card.dataset.carId as CarId;
        this.sound.playClick();
        if (this.save.isCarUnlocked(cid)) {
          this.save.data.selectedCar = cid;
          this.save.save();
          this.cb.onSelectCar(cid);
          this.populateGarageModal(panel);
        } else {
          this.cb.onSelectCar(cid);
        }
      });
    });
  }

  private populateShopModal(panel: HTMLElement): void {
    const specialsHtml = (['sos', 'roadster', 'hyper'] as SpecialId[])
      .map((sid) => {
        const sp = SPECIALS[sid];
        return `
          <div class="sr-item-row">
            <div>
              <div style="font-weight:800;font-size:13px;color:${sp.color}">${sp.name} (Bag: ${this.save.data.specials[sid]})</div>
              <div style="font-size:11px;color:#94a3b8">${sp.description}</div>
            </div>
            <button class="sr-action-btn tabular-nums" data-exchange="${sid}">◎ ${sp.price.toLocaleString()}</button>
          </div>
        `;
      })
      .join('');

    const coinPacks = [
      { coins: 1500, label: 'Starter Coin Pack (Demo Free)' },
      { coins: 5000, label: 'Squadron Treasury (Demo Free)' },
    ];

    const packsHtml = coinPacks
      .map(
        (p) => `
        <div class="sr-item-row">
          <div>
            <div style="font-weight:800;font-size:13px;color:#fde68a">+${p.coins.toLocaleString()} Energy Coins</div>
            <div style="font-size:11px;color:#94a3b8">${p.label}</div>
          </div>
          <button class="sr-action-btn secondary" data-grant-coins="${p.coins}">Claim Demo</button>
        </div>
      `
      )
      .join('');

    panel.innerHTML = `
      <div class="sr-modal-header">
        <h3 class="sr-modal-title">Shop & Magic Bag · ◎ ${this.save.data.coins.toLocaleString()}</h3>
        <button class="sr-icon-btn" data-close-modal>✕</button>
      </div>
      <div style="font-size:12px;font-weight:700;color:#cbd5e1">Exchange Coins for Specials</div>
      <div class="sr-card-list">${specialsHtml}</div>
      <div style="font-size:12px;font-weight:700;color:#cbd5e1">Energy Coin Packs</div>
      <div class="sr-card-list">${packsHtml}</div>
    `;

    panel.querySelectorAll<HTMLElement>('[data-exchange]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sid = btn.dataset.exchange as SpecialId;
        const sp = SPECIALS[sid];
        if (this.save.data.coins >= sp.price) {
          this.sound.playCoin();
          this.save.data.coins -= sp.price;
          this.save.data.specials[sid] += 1;
          this.save.save();
          this.populateShopModal(panel);
        }
      });
    });

    panel.querySelectorAll<HTMLElement>('[data-grant-coins]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const amt = Number(btn.dataset.grantCoins);
        this.sound.playCoin();
        this.save.data.coins += amt;
        this.save.save();
        this.populateShopModal(panel);
      });
    });
  }

  private populateMissionsModal(panel: HTMLElement): void {
    const rows = this.save.data.missions
      .map((m) => {
        const done = m.progress >= m.target;
        return `
          <div class="sr-item-row">
            <div>
              <div style="font-weight:700;font-size:13px">${m.title}</div>
              <div class="tabular-nums" style="font-size:11px;color:#94a3b8">${m.progress.toLocaleString()} / ${m.target.toLocaleString()} · Reward ◎ ${m.rewardCoins}</div>
            </div>
            ${
              m.claimed
                ? `<span style="font-size:11px;color:#22c55e;font-weight:700">Claimed</span>`
                : done
                  ? `<button class="sr-action-btn" data-claim-mission="${m.id}">Claim ◎ ${m.rewardCoins}</button>`
                  : `<span style="font-size:11px;color:#64748b">In Progress</span>`
            }
          </div>
        `;
      })
      .join('');

    panel.innerHTML = `
      <div class="sr-modal-header">
        <h3 class="sr-modal-title">Daily Pilot Missions</h3>
        <button class="sr-icon-btn" data-close-modal>✕</button>
      </div>
      <div class="sr-card-list">${rows}</div>
    `;

    panel.querySelectorAll<HTMLElement>('[data-claim-mission]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.claimMission;
        const m = this.save.data.missions.find((item) => item.id === id);
        if (m && !m.claimed && m.progress >= m.target) {
          this.sound.playCoin();
          m.claimed = true;
          this.save.data.coins += m.rewardCoins;
          this.save.save();
          this.populateMissionsModal(panel);
        }
      });
    });
  }

  private populateDailyModal(panel: HTMLElement): void {
    const canClaim = this.save.canClaimDaily();
    const curDay = this.save.data.dailyDay;
    const rewards = [
      'Day 1: ◎ 150',
      'Day 2: ◎ 200',
      'Day 3: ◎ 250',
      'Day 4: ◎ 300 + Roadster Jump',
      'Day 5: ◎ 350',
      'Day 6: ◎ 400',
      'Day 7: ◎ 600 + HYPER JUMP',
    ];

    const listHtml = rewards
      .map((label, idx) => {
        const dayNum = idx + 1;
        const isCurrent = dayNum === curDay;
        return `
          <div class="sr-item-row" style="${isCurrent ? 'border-color:#38bdf8' : ''}">
            <span style="font-weight:700;font-size:13px">${label}</span>
            <span style="font-size:11px;color:${isCurrent ? '#38bdf8' : '#64748b'}">${isCurrent ? (canClaim ? 'Ready Today' : 'Next Tomorrow') : dayNum < curDay ? 'Done' : 'Upcoming'}</span>
          </div>
        `;
      })
      .join('');

    panel.innerHTML = `
      <div class="sr-modal-header">
        <h3 class="sr-modal-title">7-Day Pilot Check-In</h3>
        <button class="sr-icon-btn" data-close-modal>✕</button>
      </div>
      <div class="sr-card-list">${listHtml}</div>
      ${
        canClaim
          ? `<button class="sr-action-btn" id="btn-claim-daily" style="padding:12px">Claim Day ${curDay} Reward</button>`
          : `<div style="text-align:center;font-size:12px;color:#94a3b8">Today's check-in claimed. Come back tomorrow!</div>`
      }
    `;

    panel.querySelector('#btn-claim-daily')?.addEventListener('click', () => {
      this.sound.playCoin();
      this.save.claimDaily();
      this.populateDailyModal(panel);
    });
  }

  private populateRanksModal(panel: HTMLElement): void {
    const rivals = [
      { name: 'KAI-X99', exp: 44200, rank: 'AAA' as RankClass },
      { name: 'NOVA-V8', exp: 29400, rank: 'AA' as RankClass },
      { name: 'AERO-PULSE', exp: 18200, rank: 'A' as RankClass },
      { name: 'SKY-DRIFTER', exp: 9600, rank: 'B' as RankClass },
      { name: 'LYRA-07', exp: 4100, rank: 'C' as RankClass },
      {
        name: `${this.save.data.pilotName} (YOU)`,
        exp: Math.max(this.save.data.bestExp, this.save.data.exp2Best),
        rank: this.save.getPlayerRank(),
        isYou: true,
      },
    ].sort((a, b) => b.exp - a.exp);

    const boardHtml = rivals
      .map((r, i) => {
        const rDef = RANKS.find((def) => def.id === r.rank) ?? RANKS[0];
        return `
          <div class="sr-item-row" style="${'isYou' in r ? 'border-color:#38bdf8;background:rgba(14,116,144,0.28)' : ''}">
            <div style="display:flex;align-items:center;gap:10px">
              <span class="tabular-nums" style="font-weight:800;width:24px">#${i + 1}</span>
              <span class="sr-rank-shield" style="background:${rDef.color}">${r.rank}</span>
              <span style="font-weight:700;font-size:13px">${r.name}</span>
            </div>
            <span class="tabular-nums" style="font-weight:800;font-size:13px">${r.exp.toLocaleString()} EXP</span>
          </div>
        `;
      })
      .join('');

    const ladderHtml = RANKS.map(
      (r) => `
        <div class="sr-item-row">
          <div style="display:flex;align-items:center;gap:8px">
            <span class="sr-rank-shield" style="background:${r.color}">${r.id}</span>
            <div>
              <div style="font-weight:700;font-size:12px">${r.title}</div>
              <div style="font-size:11px;color:#94a3b8">${r.unlockNote}</div>
            </div>
          </div>
          <span class="tabular-nums" style="font-size:12px;font-weight:700">${r.exp.toLocaleString()} EXP</span>
        </div>
      `
    ).join('');

    panel.innerHTML = `
      <div class="sr-modal-header">
        <h3 class="sr-modal-title">Weekly Skyway Standings & Class Ladder</h3>
        <button class="sr-icon-btn" data-close-modal>✕</button>
      </div>
      <div class="sr-card-list">${boardHtml}</div>
      <div style="font-size:12px;font-weight:700;color:#cbd5e1;margin-top:4px">Class Thresholds & Unlocks</div>
      <div class="sr-card-list">${ladderHtml}</div>
    `;
  }

  private populateGuideModal(panel: HTMLElement): void {
    panel.innerHTML = `
      <div class="sr-modal-header">
        <h3 class="sr-modal-title">Pilot Manual · Sky Roadster v${VERSION}</h3>
        <button class="sr-icon-btn" data-close-modal>✕</button>
      </div>
      <div class="sr-card-list" style="font-size:12px;line-height:1.5;color:#cbd5e1">
        <div class="sr-item-row"><span><strong>Steer Lanes:</strong> Swipe ← / → or press A / D / Arrow Keys</span></div>
        <div class="sr-item-row"><span><strong>Sky Hop (Jump Barriers & Crates):</strong> Swipe ↑ or press W / Space / Up</span></div>
        <div class="sr-item-row"><span><strong>Aero Dive (Duck Under Beams & High Lasers):</strong> Swipe ↓ or press S / Down</span></div>
        <div class="sr-item-row"><span><strong>Special Boost (SOS / Roadster / HYPER):</strong> Tap HUD button or press E / Enter</span></div>
        <div class="sr-item-row"><span><strong>Energy Rings:</strong> Fly through golden rings for 8s of Double Coins (×2)</span></div>
        <div class="sr-item-row"><span><strong>Rank Progression:</strong> Your best single-run EXP determines your Pilot Class (D → SSS)</span></div>
      </div>
    `;
  }

  private populateSettingsModal(panel: HTMLElement): void {
    const s = this.save.data.settings;
    panel.innerHTML = `
      <div class="sr-modal-header">
        <h3 class="sr-modal-title">Settings · v${VERSION}</h3>
        <button class="sr-icon-btn" data-close-modal>✕</button>
      </div>
      <div class="sr-card-list">
        <div class="sr-item-row">
          <span>Sound Effects (SFX)</span>
          <button class="sr-action-btn ${s.sound ? '' : 'secondary'}" id="tog-sound">${s.sound ? 'ON' : 'OFF'}</button>
        </div>
        <div class="sr-item-row">
          <span>Synthwave Music</span>
          <button class="sr-action-btn ${s.music ? '' : 'secondary'}" id="tog-music">${s.music ? 'ON' : 'OFF'}</button>
        </div>
        <div class="sr-item-row">
          <div>
            <div>Camera Motion</div>
            <div style="font-size:11px;color:#94a3b8">${s.cameraMotion ? 'Dynamic Chase Camera' : 'Fixed Center Road View (v4.6 Default)'}</div>
          </div>
          <button class="sr-action-btn ${s.cameraMotion ? '' : 'secondary'}" id="tog-cam">${s.cameraMotion ? 'ON' : 'OFF'}</button>
        </div>
        <div class="sr-item-row">
          <span>Danger Hint Arrows</span>
          <button class="sr-action-btn ${s.dangerArrows ? '' : 'secondary'}" id="tog-arrows">${s.dangerArrows ? 'ON' : 'OFF'}</button>
        </div>
        <div class="sr-item-row">
          <span>Graphics Quality</span>
          <button class="sr-action-btn" id="tog-gfx">${s.graphics.toUpperCase()}</button>
        </div>
      </div>
    `;

    panel.querySelector('#tog-sound')?.addEventListener('click', () => {
      s.sound = !s.sound;
      this.save.save();
      this.cb.onSettingsChanged();
      this.populateSettingsModal(panel);
    });
    panel.querySelector('#tog-music')?.addEventListener('click', () => {
      s.music = !s.music;
      this.save.save();
      this.cb.onSettingsChanged();
      this.populateSettingsModal(panel);
    });
    panel.querySelector('#tog-cam')?.addEventListener('click', () => {
      s.cameraMotion = !s.cameraMotion;
      this.save.save();
      this.cb.onSettingsChanged();
      this.populateSettingsModal(panel);
    });
    panel.querySelector('#tog-arrows')?.addEventListener('click', () => {
      s.dangerArrows = !s.dangerArrows;
      this.save.save();
      this.cb.onSettingsChanged();
      this.populateSettingsModal(panel);
    });
    panel.querySelector('#tog-gfx')?.addEventListener('click', () => {
      const order: GraphicsQuality[] = ['low', 'medium', 'high'];
      s.graphics = order[(order.indexOf(s.graphics) + 1) % order.length];
      this.save.save();
      this.cb.onSettingsChanged();
      this.populateSettingsModal(panel);
    });
  }

  private populatePauseModal(panel: HTMLElement): void {
    panel.innerHTML = `
      <div class="sr-modal-header">
        <h3 class="sr-modal-title">Race Paused</h3>
      </div>
      <div style="font-size:12px;color:#94a3b8">Take a breather — your roadster stays locked in position until you resume.</div>
      <div class="sr-card-list">
        <button class="sr-action-btn" id="btn-pause-resume" style="padding:12px">Resume Race</button>
        <button class="sr-action-btn secondary" id="btn-pause-restart" style="padding:12px">Restart Race</button>
        <button class="sr-action-btn secondary" id="btn-pause-home" style="padding:12px">Finish & Return Home</button>
      </div>
    `;

    panel.querySelector('#btn-pause-resume')?.addEventListener('click', () => {
      this.sound.playClick();
      this.cb.onPauseToggle();
    });
    panel.querySelector('#btn-pause-restart')?.addEventListener('click', () => {
      this.sound.playClick();
      this.activeModal = null;
      this.cb.onRestartRace();
    });
    panel.querySelector('#btn-pause-home')?.addEventListener('click', () => {
      this.sound.playClick();
      this.activeModal = null;
      this.cb.onQuitToHome();
    });
  }

  private populateReviveModal(panel: HTMLElement): void {
    panel.innerHTML = `
      <div class="sr-modal-header">
        <h3 class="sr-modal-title">Hull Impact — Revive & Continue?</h3>
      </div>
      <div style="font-size:13px;color:#cbd5e1">Keep your current EXP run alive with an instant shockwave clear.</div>
      <div style="display:flex;gap:8px;margin-top:6px">
        <button class="sr-action-btn secondary" id="btn-revive-no" style="flex:1;padding:12px">End Run</button>
        <button class="sr-action-btn" id="btn-revive-yes" style="flex:2;padding:12px">REVIVE NOW (FREE DEMO)</button>
      </div>
    `;

    panel.querySelector('#btn-revive-yes')?.addEventListener('click', () => {
      this.sound.playSpecial();
      this.activeModal = null;
      this.cb.onReviveAccept();
    });
    panel.querySelector('#btn-revive-no')?.addEventListener('click', () => {
      this.sound.playClick();
      this.activeModal = null;
      this.cb.onReviveDecline();
    });
  }

  private populateFinishModal(panel: HTMLElement): void {
    const st = this.lastFinishStats ?? {
      exp: 0,
      coins: 0,
      distance: 0,
      rank: 'D' as RankClass,
      promotedTo: null,
    };
    const rDef = RANKS.find((r) => r.id === st.rank) ?? RANKS[0];

    panel.innerHTML = `
      <div class="sr-modal-header">
        <h3 class="sr-modal-title">RACE FINISH</h3>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;background:rgba(15,23,42,0.95);padding:14px;border-radius:12px;border:1px solid ${rDef.color}">
        <div>
          <div style="font-size:11px;color:#94a3b8;font-weight:700">RACE RANK</div>
          <div style="font-size:20px;font-weight:800;color:${rDef.color}">Class ${rDef.id} · ${rDef.title}</div>
          <div class="tabular-nums" style="font-size:13px;color:#f8fafc;margin-top:2px">${st.exp.toLocaleString()} EXP · ${Math.round(st.distance).toLocaleString()} m</div>
        </div>
        <span class="sr-rank-shield" style="background:${rDef.color};width:44px;height:44px;font-size:18px">${rDef.id}</span>
      </div>
      ${
        st.promotedTo
          ? `<div style="background:rgba(22,163,74,0.2);border:1px solid #22c55e;padding:10px;border-radius:10px;font-size:12px;font-weight:700;color:#bbf7d0">★ PROMOTED TO CLASS ${st.promotedTo}! Check Garage & Magic Bag for rewards.</div>`
          : ''
      }
      <div class="sr-item-row tabular-nums">
        <span>Coins Collected</span>
        <span style="color:#fde68a;font-weight:800">+◎ ${st.coins.toLocaleString()}</span>
      </div>
      <div style="display:flex;gap:8px;margin-top:4px">
        <button class="sr-action-btn secondary" id="btn-finish-home" style="flex:1;padding:12px">Home</button>
        <button class="sr-action-btn" id="btn-finish-restart" style="flex:2;padding:12px">Restart Race »</button>
      </div>
    `;

    panel.querySelector('#btn-finish-home')?.addEventListener('click', () => {
      this.sound.playClick();
      this.activeModal = null;
      this.cb.onQuitToHome();
    });
    panel.querySelector('#btn-finish-restart')?.addEventListener('click', () => {
      this.sound.playClick();
      this.activeModal = null;
      this.cb.onRestartRace();
    });
  }
}
