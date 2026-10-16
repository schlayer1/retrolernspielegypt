import Phaser from 'phaser';
import { sfx } from '../audio/sound';
import { EgyptBuildingDef } from '../data/items';
import { CROP_MS, DAY_MS, state } from '../systems/GameState';
import { FarmPlotState } from '../systems/SaveManager';

const TILE = 16;
const MAP_W = 50;
const MAP_H = 38;
const SPEED = 75;
const REACH = 32;
const REGROW_MS = 35_000;

const NILE = { x: 39, y: 0, w: 11, h: 38 };

type Dir = 'down' | 'right' | 'up' | 'left';
type Kind =
  | 'plot'
  | 'build_site'
  | 'merchant'
  | 'egypt_senbi'
  | 'egypt_ameni'
  | 'egypt_nefermaat'
  | 'egypt_ani'
  | 'egypt_hemiunu'
  | 'egypt_baki'
  | 'egypt_papyrus'
  | 'egypt_palm'
  | 'egypt_mud'
  | 'egypt_nil_water'
  | 'egypt_kalkstein'
  | 'egypt_acacia'
  | 'egypt_nilometer'
  | 'egypt_fish_spot'
  | 'egypt_schaduf'
  | 'egypt_sphinx'
  | 'egypt_pyramid'
  | 'egypt_obelisk'
  | 'egypt_boat';

interface DomLabel {
  x: number;
  y: number;
  el: HTMLElement;
  setText(t: string): DomLabel;
  setY(ny: number): DomLabel;
  setPosition(nx: number, ny: number): DomLabel;
}

interface Node {
  kind: Kind;
  sprite: Phaser.Physics.Arcade.Sprite;
  readyAt: number;
  placed?: { x: number; y: number; t: number };
  bubble?: Phaser.GameObjects.Image;
  glow?: Phaser.GameObjects.Arc;
  plotId?: number;
  cropSprite?: Phaser.GameObjects.Image;
  buildingDef?: EgyptBuildingDef;
  label?: DomLabel;
}

export class WorldScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'W' | 'A' | 'S' | 'D' | 'E' | 'SPACE', Phaser.Input.Keyboard.Key>;
  private facing: Dir = 'down';
  private obstacles!: Phaser.Physics.Arcade.StaticGroup;
  private nodes: Node[] = [];
  private domLabels: DomLabel[] = [];
  private labelLayer!: HTMLElement;
  private nightOverlay!: Phaser.GameObjects.Rectangle;
  private saveTimer = 0;
  private sleeping = false;
  private playerLabel?: DomLabel;

  constructor() {
    super('World');
  }

  create(): void {
    this.nodes = [];
    this.domLabels = [];
    this.sleeping = false;

    const existingLayer = document.getElementById('world-labels');
    this.labelLayer = existingLayer ?? document.createElement('div');
    this.labelLayer.id = 'world-labels';
    if (!existingLayer) document.body.appendChild(this.labelLayer);
    this.labelLayer.innerHTML = '';

    const saved = state.saves.load();
    if (saved) state.loadFrom(saved);

    this.obstacles = this.physics.add.staticGroup();

    this.buildEgyptGround();
    this.buildEgyptNile();
    this.scatterEgyptNature();
    this.placeEgyptResources();
    this.placeEgyptBuildingsAndNPCs();

    const startX = state.playerX || 440;
    const startY = state.playerY || 320;
    const texKey = state.playerGender === 'female' ? 'player_egypt_female' : 'player_egypt_male';

    this.player = this.physics.add.sprite(startX, startY, texKey, 0);
    this.player.body!.setSize(8, 6).setOffset(4, 20);
    this.player.setCollideWorldBounds(true);
    this.physics.world.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE);
    this.physics.add.collider(this.player, this.obstacles);
    this.playerLabel = this.addLabel(startX, startY - 22, state.playerName, '#fde047');

    this.cameras.main.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE);
    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);
    this.cameras.main.setRoundPixels(true);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D,E,SPACE') as typeof this.wasd;

    this.nightOverlay = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x050e24, 0)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(8000);

    if (!this.scene.isActive('UI')) this.scene.launch('UI');
    state.on('craft', this.onCraft, this);
    state.on('chapterChanged', this.onChapterChanged, this);
    state.on('profileChanged', this.onProfileChanged, this);

    this.events.once('shutdown', () => {
      state.off('craft', this.onCraft, this);
      state.off('chapterChanged', this.onChapterChanged, this);
      state.off('profileChanged', this.onProfileChanged, this);
    });
    window.addEventListener('beforeunload', () => this.persist());
  }

  private onProfileChanged(): void {
    if (this.player) {
      const gPrefix = state.playerGender === 'female' ? 'egypt-female' : 'egypt-male';
      this.player.anims.play(`idle-${gPrefix}-${this.facing}`, true);
    }
    if (this.playerLabel) {
      this.playerLabel.el.textContent = state.playerName;
    }
  }

  private onChapterChanged(): void {
    this.persist();
    this.scene.restart();
  }

  private buildEgyptGround(): void {
    const rt = this.add.renderTexture(0, 0, MAP_W * TILE, MAP_H * TILE).setOrigin(0).setDepth(0);
    const g = this.add.graphics();
    g.fillStyle(0xdfb878, 1).fillRect(0, 0, MAP_W * TILE, MAP_H * TILE);
    g.fillStyle(0x54402b, 1).fillRect(18 * TILE, 0, 21 * TILE, MAP_H * TILE);
    g.fillStyle(0x91734a, 0.75).fillRect(16 * TILE, 0, 3 * TILE, MAP_H * TILE);
    g.fillStyle(0xca9d5b, 0.6);
    g.fillEllipse(100, 180, 160, 90);
    g.fillEllipse(120, 420, 190, 100);
    g.fillEllipse(220, 520, 170, 70);
    rt.draw(g, 0, 0);
    g.destroy();
  }

  private buildEgyptNile(): void {
    const rx = NILE.x * TILE;
    const rw = NILE.w * TILE;
    const rh = NILE.h * TILE;

    const g = this.add.graphics();
    g.fillStyle(0x195785, 1).fillRect(rx, 0, rw, rh);
    g.fillStyle(0x2774a3, 1).fillRect(rx, 0, 8, rh);
    g.fillStyle(0x358dbf, 0.8).fillRect(rx + 4, 0, 4, rh);
    g.fillStyle(0xffffff, 0.15);
    for (let y = 16; y < rh; y += 24) {
      g.fillRect(rx + 20 + ((y * 7) % 80), y, 16, 2);
    }

    const zone1 = this.add.zone(rx + 16, 0, rw - 16, 460).setOrigin(0);
    this.physics.add.existing(zone1, true);
    this.obstacles.add(zone1);

    const zone2 = this.add.zone(rx + 16, 540, rw - 16, rh - 540).setOrigin(0);
    this.physics.add.existing(zone2, true);
    this.obstacles.add(zone2);
  }

  private scatterEgyptNature(): void {
    const pyr = this.makeObstacle(140, 100, 'egypt_pyramid');
    pyr.setDepth(100);
    this.addNode('egypt_pyramid', 'egypt_pyramid', undefined, 140, 140);
    this.addLabel(140, 45, '🔺 Große Pyramide (Cheops)', '#fef08a');

    const sph = this.makeObstacle(200, 220, 'egypt_sphinx');
    sph.setDepth(220);
    this.addNode('egypt_sphinx', 'egypt_sphinx', undefined, 200, 240);
    this.addLabel(200, 160, '🦁 Große Sphinx von Gizeh', '#fef08a');

    const ob = this.makeObstacle(270, 80, 'egypt_obelisk');
    ob.setDepth(80);
    this.addNode('egypt_obelisk', 'egypt_obelisk', undefined, 270, 120);
    this.addLabel(270, 20, '☀️ Obelisk des Sonnengottes Ra', '#fef08a');

    const oasis = this.makeObstacle(420, 210, 'egypt_oasis_pool');
    oasis.setDepth(210);
    this.addLabel(420, 165, '🌴 Oasenteich & Schattengarten', '#86efac');

    const boat = this.makeObstacle(640, 490, 'egypt_papyrus_boat');
    boat.setDepth(490);
    this.addNode('egypt_boat', 'egypt_papyrus_boat', undefined, 640, 510);
    this.addLabel(640, 445, '⛵ Nilbarke (Getreidelieferung nach Rom)', '#93c5fd');

    const stall = this.makeObstacle(340, 490, 'egypt_market_stall');
    stall.setDepth(490);
    this.addNode('merchant', 'egypt_market_stall', undefined, 340, 510);
    this.addLabel(340, 440, '🏺 Basar am Nil-Hafen (Nubien & Punt)', '#fde047');

    const tent = this.makeObstacle(250, 490, 'egypt_bedouin_tent');
    tent.setDepth(490);

    const palmPositions = [
      [360, 180], [470, 170], [460, 250], [380, 260],
      [570, 110], [580, 210], [560, 360], [580, 430],
      [110, 270], [80, 370]
    ];
    for (const [px, py] of palmPositions) {
      const palm = this.makeObstacle(px, py, 'egypt_date_palm');
      palm.setDepth(py + 30);
    }
  }

  private placeEgyptResources(): void {
    const reeds = [
      [600, 80], [605, 150], [600, 270], [605, 330], [595, 400]
    ];
    reeds.forEach(([x, y]) => {
      const n = this.addNode('egypt_papyrus', 'egypt_papyrus_reed', undefined, x, y);
      n.sprite.setDepth(y);
      n.label = this.addLabel(x, y - 18, '🌿 Papyrus-Schilf', '#86efac');
    });

    const datePalms = [
      [440, 160], [400, 270]
    ];
    datePalms.forEach(([x, y]) => {
      const n = this.addNode('egypt_palm', 'objects', 'stump', x, y);
      n.sprite.setVisible(false);
      n.label = this.addLabel(x, y - 20, '🌴 Dattelpalme', '#fde047');
    });

    const mudSpots = [
      [580, 170], [575, 300]
    ];
    mudSpots.forEach(([x, y]) => {
      const n = this.addNode('egypt_mud', 'clay_pile', undefined, x, y);
      n.sprite.setDepth(y);
      n.label = this.addLabel(x, y - 14, '🌾 Fruchtbarer Nilschlamm', '#d97706');
    });

    const n = this.addNode('egypt_nil_water', 'objects', 'bubble_excl', 590, 230);
    n.sprite.setVisible(false);
    n.label = this.addLabel(590, 215, '💧 Nil-Wasserstelle', '#93c5fd');

    const nilo = this.addNode('egypt_nilometer', 'nilometer_prop', undefined, 590, 360);
    nilo.sprite.setDepth(360);
    nilo.label = this.addLabel(590, 340, '📏 Nilometer (Pegel)', '#e2e8f0');

    const fish = this.addNode('egypt_fish_spot', 'fish_trap', undefined, 600, 440);
    fish.sprite.setDepth(440);
    fish.label = this.addLabel(600, 424, '🐟 Nilbarsch-Fischgrund', '#60a5fa');

    const quarry = [
      [80, 60], [180, 50], [100, 130]
    ];
    quarry.forEach(([x, y]) => {
      const stoneNode = this.addNode('egypt_kalkstein', 'objects', 'bigrock', x, y);
      stoneNode.sprite.setDepth(y);
      stoneNode.label = this.addLabel(x, y - 18, '⛏️ Tura-Kalksteinbruch', '#fef08a');
    });

    const acacia = [
      [270, 290], [330, 150]
    ];
    acacia.forEach(([x, y]) => {
      const acNode = this.addNode('egypt_acacia', 'objects', 'stump', x, y);
      acNode.sprite.setDepth(y);
      acNode.label = this.addLabel(x, y - 16, '🪵 Akazienholz', '#d97706');
    });
  }

  private placeEgyptBuildingsAndNPCs(): void {
    const senbi = this.addNode('egypt_senbi', 'npc', 0, 560, 260);
    senbi.sprite.setDepth(260);
    this.addLabel(560, 238, '🎣 Fischer Senbi (Kap. 1)', '#86efac');

    const ameni = this.addNode('egypt_ameni', 'npc', 1, 480, 240);
    ameni.sprite.setDepth(240);
    this.addLabel(480, 218, '🌾 Feldhüter Ameni (Kap. 2)', '#fde047');

    const wesir = this.addNode('egypt_nefermaat', 'npc', 2, 350, 210);
    wesir.sprite.setDepth(210);
    this.addLabel(350, 188, '👑 Wesir Nefermaat (Kap. 3)', '#f59e0b');

    const ani = this.addNode('egypt_ani', 'npc', 3, 230, 170);
    ani.sprite.setDepth(170);
    this.addLabel(230, 148, '📜 Ober-Schreiber Ani (Kap. 4)', '#a78bfa');

    const hemi = this.addNode('egypt_hemiunu', 'npc', 0, 140, 120);
    hemi.sprite.setDepth(120);
    this.addLabel(140, 98, '📐 Baumeister Hemiunu (Kap. 5)', '#fef08a');

    const baki = this.addNode('egypt_baki', 'npc', 1, 570, 480);
    baki.sprite.setDepth(480);
    this.addLabel(570, 458, '⚓ Hafenmeister Baki (Kap. 6)', '#60a5fa');

    for (const b of state.buildingsData) {
      const node = this.addNode('build_site', 'farm', 'sign_build', b.x, b.y);
      node.buildingDef = b;
      node.sprite.setDepth(b.y);
      if (state.hasBuilding(b.id)) {
        this.renderBuiltEgyptBuilding(node);
      } else {
        node.label = this.addLabel(b.x, b.y - 18, `🔨 Bauplatz: ${b.name}`, '#fef08a');
      }
    }

    for (let i = 0; i < 6; i++) {
      const px = 450 + (i % 3) * 32;
      const py = 320 + Math.floor(i / 3) * 32;
      const node = this.addNode('plot', 'farm', 'soil_raw', px, py);
      node.plotId = i;
      node.sprite.setDepth(py);
      this.refreshPlotVisual(node);
    }
  }

  private renderBuiltEgyptBuilding(node: Node): void {
    const b = node.buildingDef!;
    node.readyAt = 0;
    node.sprite.setTexture('objects', 'bubble_excl').setVisible(false);
    if (b.id === 'schaduf') {
      this.add.image(b.x, b.y, 'schaduf_prop').setDepth(b.y);
      this.addLabel(b.x, b.y - 24, '💧 Schaduf-Schöpfwerk', '#86efac');
    } else if (b.id === 'ziegelei') {
      this.add.image(b.x, b.y, 'kiln').setDepth(b.y);
      this.addLabel(b.x, b.y - 24, '🧱 Lehmziegelei', '#f59e0b');
    } else if (b.id === 'speicher') {
      this.add.image(b.x, b.y, 'overworld', 'speicher_hut').setDepth(b.y);
      this.addLabel(b.x, b.y - 24, '🌾 Königlicher Kornspeicher', '#fde047');
    } else if (b.id === 'schreiberhaus') {
      this.add.image(b.x, b.y, 'loom').setDepth(b.y);
      this.addLabel(b.x, b.y - 24, '📜 Haus des Lebens', '#a78bfa');
    } else if (b.id === 'wabet') {
      this.add.image(b.x, b.y, 'smelter').setDepth(b.y);
      this.addLabel(b.x, b.y - 24, '⚱️ Balsamierung (Wabet)', '#c084fc');
    } else if (b.id === 'steinmetz') {
      this.add.image(b.x, b.y, 'forge').setDepth(b.y);
      this.addLabel(b.x, b.y - 24, '🏗️ Bauhütte der Pyramide', '#fef08a');
    }
  }

  private makeObstacle(x: number, y: number, tex: string, frame?: string): Phaser.Physics.Arcade.Sprite {
    const s = this.physics.add.staticSprite(x, y, tex, frame as any);
    this.obstacles.add(s);
    return s;
  }

  private addNode(kind: Kind, tex: string, frame: string | number | undefined, x: number, y: number): Node {
    const s = this.physics.add.staticSprite(x, y, tex, frame as any);
    s.setDepth(y);
    const n: Node = { kind, sprite: s, readyAt: 0 };
    this.nodes.push(n);
    return n;
  }

  private addLabel(x: number, y: number, text: string, color = '#ffe9b0'): DomLabel {
    const el = document.createElement('div');
    el.className = 'world-label';
    el.textContent = text;
    el.style.borderColor = color;
    el.style.color = color;
    this.labelLayer.appendChild(el);
    const label: DomLabel = {
      x,
      y,
      el,
      setText(t: string) {
        el.textContent = t;
        return this;
      },
      setY(ny: number) {
        label.y = ny;
        return this;
      },
      setPosition(nx: number, ny: number) {
        label.x = nx;
        label.y = ny;
        return this;
      },
    };
    this.domLabels.push(label);
    return label;
  }

  update(_t: number, delta: number): void {
    if (this.sleeping) return;

    if (!state.modal) {
      state.dayTime = (state.dayTime + delta / DAY_MS) % 1;
      const angle = state.dayTime * Math.PI * 2;
      const darkness = Math.max(0, -Math.sin(angle));
      this.nightOverlay.setAlpha(darkness * 0.72);
      state.playTimeSec += delta / 1000;
    }

    let vx = 0;
    let vy = 0;

    const left = this.cursors.left.isDown || this.wasd.A.isDown;
    const right = this.cursors.right.isDown || this.wasd.D.isDown;
    const up = this.cursors.up.isDown || this.wasd.W.isDown;
    const down = this.cursors.down.isDown || this.wasd.S.isDown;

    if (!state.modal) {
      if (left) vx -= 1;
      if (right) vx += 1;
      if (up) vy -= 1;
      if (down) vy += 1;

      if (state.touch && state.touch.vector.lengthSq() > 0.05) {
        vx = state.touch.vector.x;
        vy = state.touch.vector.y;
      }
    }

    const gPrefix = state.playerGender === 'female' ? 'egypt-female' : 'egypt-male';

    if (vx !== 0 || vy !== 0) {
      const len = Math.hypot(vx, vy);
      this.player.setVelocity((vx / len) * SPEED, (vy / len) * SPEED);
      state.distanceMeters += (SPEED * (delta / 1000)) / 8;

      if (Math.abs(vx) > Math.abs(vy)) {
        this.facing = vx > 0 ? 'right' : 'left';
      } else {
        this.facing = vy > 0 ? 'down' : 'up';
      }
      this.player.anims.play(`walk-${gPrefix}-${this.facing}`, true);
    } else {
      this.player.setVelocity(0, 0);
      this.player.anims.play(`idle-${gPrefix}-${this.facing}`, true);
    }

    this.player.setDepth(this.player.y);

    if (this.playerLabel) {
      this.playerLabel.setPosition(this.player.x, this.player.y - 22);
    }

    const cam = this.cameras.main;
    const sx = this.scale.displayScale.x;
    const sy = this.scale.displayScale.y;
    const cw = this.scale.width;
    const ch = this.scale.height;

    for (const dl of this.domLabels) {
      const screenX = (dl.x - cam.scrollX) * sx;
      const screenY = (dl.y - cam.scrollY) * sy;
      const isVisible = dl.x >= cam.scrollX - 20 && dl.x <= cam.scrollX + cw + 20 &&
                        dl.y >= cam.scrollY - 20 && dl.y <= cam.scrollY + ch + 20;

      if (isVisible) {
        dl.el.style.display = 'block';
        dl.el.style.transform = `translate3d(${screenX}px, ${screenY}px, 0)`;
      } else {
        dl.el.style.display = 'none';
      }
    }

    this.updateNodes();
    this.updateCompass();

    const n = this.nearest();
    state.hint = n ? this.hintFor(n) : '';

    const ePressed = Phaser.Input.Keyboard.JustDown(this.wasd.E) || Phaser.Input.Keyboard.JustDown(this.wasd.SPACE);
    const touchAction = Boolean(state.touch && state.touch.consumeAction());

    if ((ePressed || touchAction) && !state.modal && n) {
      this.interact(n);
    }

    this.saveTimer += delta;
    if (this.saveTimer > 4000) {
      this.saveTimer = 0;
      this.persist();
    }
  }

  private updateNodes(): void {
    const now = Date.now();
    for (const n of this.nodes) {
      if (n.kind === 'plot' && n.plotId !== undefined) {
        const p = state.plots[n.plotId];
        if (p.stage === 'watered' && now - p.wateredAt > CROP_MS) {
          p.stage = 'ripe';
          this.refreshPlotVisual(n);
          state.emit('toast', 'Emmer-Getreide am Nil ist reif zur Ernte (E)!');
        }
      }
    }
  }

  private refreshPlotVisual(node: Node): void {
    if (node.plotId === undefined) return;
    const p = state.plots[node.plotId];
    if (p.stage === 'raw') {
      node.sprite.setFrame('soil_raw');
    } else if (p.stage === 'tilled') {
      node.sprite.setFrame('soil_tilled');
    } else if (p.stage === 'seeded') {
      node.sprite.setFrame('soil_seeded');
    } else if (p.stage === 'watered') {
      node.sprite.setFrame('soil_watered');
    } else if (p.stage === 'ripe') {
      node.sprite.setFrame('soil_watered');
      if (!node.cropSprite) {
        node.cropSprite = this.add.image(node.sprite.x, node.sprite.y - 6, 'farm', 'wheat_ripe');
        node.cropSprite.setDepth(node.sprite.y + 2);
      }
    }
  }

  private nearest(): Node | null {
    let best: Node | null = null;
    let dist = REACH;
    for (const n of this.nodes) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, n.sprite.x, n.sprite.y);
      if (d < dist) {
        dist = d;
        best = n;
      }
    }
    return best;
  }

  private hintFor(n: Node): string {
    const now = Date.now();
    switch (n.kind) {
      case 'egypt_senbi':
      case 'egypt_ameni':
      case 'egypt_nefermaat':
      case 'egypt_ani':
      case 'egypt_hemiunu':
      case 'egypt_baki':
        return `[E] Sprechen (${n.label?.el.textContent ?? 'Mentor'})`;
      case 'egypt_papyrus':
        return now < n.readyAt ? 'Papyrus wächst nach...' : '[E] Papyrus-Schilf schneiden';
      case 'egypt_palm':
        return now < n.readyAt ? 'Datteln reifen nach...' : '[E] Dattelpalme schütteln';
      case 'egypt_mud':
        return now < n.readyAt ? 'Nilschlamm lagert sich ab...' : '[E] Nilschlamm bergen';
      case 'egypt_nil_water':
        return '[E] Frisches Nilwasser schöpfen';
      case 'egypt_nilometer':
        return '[E] Nilometer-Pegel ablesen';
      case 'egypt_fish_spot':
        return '[E] Reuse prüfen / Fischen';
      case 'egypt_kalkstein':
        return now < n.readyAt ? 'Steinbruch arbeitet...' : '[E] Kalkstein brechen';
      case 'egypt_acacia':
        return now < n.readyAt ? 'Akazien wachsen nach...' : '[E] Akazienholz sammeln';
      case 'egypt_sphinx':
        return '[E] Große Sphinx betrachten';
      case 'egypt_pyramid':
        return '[E] Große Pyramide untersuchen';
      case 'egypt_boat':
        return '[E] Nilbarke beladen';
      case 'merchant':
        return '[E] Basar öffnen (Tauschhandel)';
      case 'plot': {
        const p = state.plots[n.plotId ?? 0];
        if (p.stage === 'raw') return '[E] Boden mit Hacke lockern';
        if (p.stage === 'tilled') return '[E] Emmer säen';
        if (p.stage === 'seeded') return '[E] Mit Nilwasser gießen';
        if (p.stage === 'watered') return 'Getreide wächst heran...';
        if (p.stage === 'ripe') return '[E] Reifes Getreide ernten';
        return '';
      }
      case 'build_site':
        return state.hasBuilding(n.buildingDef?.id ?? '') ? '' : `[E] Errichten: ${n.buildingDef?.name}`;
      default:
        return '[E] Interagieren';
    }
  }

  private interact(n: Node): void {
    const now = Date.now();
    switch (n.kind) {
      case 'egypt_senbi':
      case 'egypt_ameni':
      case 'egypt_nefermaat':
      case 'egypt_ani':
      case 'egypt_hemiunu':
      case 'egypt_baki':
        this.interactMentor(n);
        break;
      case 'egypt_papyrus': {
        if (now < n.readyAt) return;
        state.add('papyrus_staengel', 2);
        state.unlockLexicon('papyrus');
        state.bump('papyrus_staengel', 2);
        state.emit('toast', '+2 Papyrus-Stängel');
        n.readyAt = now + REGROW_MS;
        break;
      }
      case 'egypt_palm': {
        if (now < n.readyAt) return;
        state.add('datteln', 3);
        state.unlockLexicon('dattelpalme');
        state.bump('datteln', 3);
        state.emit('toast', '+3 Süße Datteln');
        n.readyAt = now + REGROW_MS;
        break;
      }
      case 'egypt_mud': {
        if (now < n.readyAt) return;
        state.add('nilschlamm', 2);
        state.unlockLexicon('kemet');
        state.bump('nilschlamm', 2);
        state.emit('toast', '+2 Fruchtbarer Nilschlamm');
        n.readyAt = now + REGROW_MS;
        break;
      }
      case 'egypt_nil_water': {
        state.add('wasser', 1);
        state.unlockLexicon('nil');
        state.bump('schaduf_water', 1);
        state.emit('toast', '+1 Krug frisches Nilwasser');
        break;
      }
      case 'egypt_nilometer': {
        state.unlockLexicon('nilometer');
        state.bump('nilometer', 1);
        state.openDialog({
          speaker: 'Nilometer am Ufer',
          nodes: [
            { text: 'Pegelstand: 16 Ellen! Die Priester verkünden: Ein gesegnetes Jahr der Akhet-Flut steht bevor!' },
          ],
        });
        break;
      }
      case 'egypt_fish_spot': {
        if (state.count('fischreuse') <= 0 && state.count('nilbarsch') === 0) {
          state.emit('toast', 'Flechte zuerst eine Schilf-Reuse im Handwerk (C)!');
          return;
        }
        state.add('nilbarsch', 1);
        state.bump('fisch_fang', 1);
        state.bump('trap', 1);
        state.bump('cooked', 1);
        state.emit('toast', '+1 Frischer Nilbarsch gefangen!');
        break;
      }
      case 'egypt_kalkstein': {
        if (now < n.readyAt) return;
        state.add('kalkstein', 2);
        state.bump('kalkstein_mined', 2);
        state.unlockLexicon('pyramiden');
        state.emit('toast', '+2 Tura-Kalksteinquader');
        n.readyAt = now + REGROW_MS;
        break;
      }
      case 'egypt_acacia': {
        if (now < n.readyAt) return;
        state.add('holz', 2);
        state.add('stock', 2);
        state.bump('holz_chopped', 2);
        state.bump('stock', 2);
        state.emit('toast', '+2 Akazienholz, +2 Stöcke');
        n.readyAt = now + REGROW_MS;
        break;
      }
      case 'egypt_sphinx': {
        state.unlockLexicon('sphinx');
        state.bump('sphinx_visited', 1);
        state.bump('sphinx_aligned', 1);
        state.openDialog({
          speaker: 'Die Große Sphinx',
          nodes: [
            { text: 'Der gigantische Löwe mit dem Antlitz des Pharao blickt unerschütterlich nach Osten zur aufgehenden Sonne (Ra)!' },
          ],
        });
        break;
      }
      case 'egypt_pyramid': {
        state.unlockLexicon('pyramiden');
        state.bump('stone_delivered', 1);
        state.openDialog({
          speaker: 'Große Pyramide (Cheops)',
          nodes: [
            { text: 'Über 2,3 Millionen Steinblöcke fügen sich fugenlos aneinander. Das ewige Haus des göttlichen Pharao!' },
          ],
        });
        break;
      }
      case 'egypt_boat': {
        state.bump('boat_loaded', 1);
        state.openDialog({
          speaker: 'Königlich-Römische Nilbarke',
          nodes: [
            { text: 'Die Frachtluken sind gefüllt: Säcke mit Emmer, Leinenballen und Trockenfisch für die Flotte nach Rom!' },
          ],
        });
        break;
      }
      case 'merchant': {
        state.emit('openTrade');
        break;
      }
      case 'plot': {
        this.interactPlot(n);
        break;
      }
      case 'build_site': {
        this.interactBuilding(n);
        break;
      }
    }
  }

  private interactMentor(n: Node): void {
    const ch = state.currentChapterDef;
    const q = state.quest;

    if (q === 0) {
      state.openDialog({
        speaker: ch.title,
        nodes: ch.intro as any,
        onDone: () => {
          state.quest = 1;
          state.persist();
          state.emit('quest');
          state.emit('toast', 'Erste Aufgabe gestartet!');
        },
      });
      return;
    }

    if (state.isReadyForQuiz()) {
      state.openDialog({
        speaker: `Prüfung: ${ch.title}`,
        nodes: ch.quiz as any,
        onDone: () => {
          state.quest = ch.quests.length - 1;
          state.persist();
          state.emit('chapterDone', state.chapter);
        },
      });
      return;
    }

    if (state.isChapterComplete()) {
      if (state.chapter < 6) {
        state.openDialog({
          speaker: ch.title,
          nodes: [
            { text: `Großartig gemacht! Du hast ${ch.title} erfolgreich gemeistert!` },
            { text: 'Bereit für das nächste historische Zeitalter? Weiter geht die Reise!' },
          ],
          onDone: () => {
            state.startChapter(state.chapter + 1);
          },
        });
      } else {
        state.openDialog({
          speaker: ch.title,
          nodes: [
            { text: 'Heil dir! Du hast das gesamte Ägypten-Abenteuer vollendet!' },
            { text: 'Drücke Taste U, um deine prachtvolle königliche Pharaonen-Urkunde zu drucken!' },
          ],
        });
      }
      return;
    }

    const curHint = ch.hints[q] || ch.quests[q] || 'Erfülle deine aktuelle Aufgabe!';
    state.openDialog({
      speaker: ch.title,
      nodes: [
        { text: `Deine aktuelle Aufgabe:\n${ch.quests[q]}` },
        { text: `Tipp des Mentors:\n${curHint}` },
      ],
    });
  }

  private interactPlot(n: Node): void {
    if (n.plotId === undefined) return;
    const p = state.plots[n.plotId];
    if (p.stage === 'raw') {
      p.stage = 'tilled';
      this.refreshPlotVisual(n);
      sfx.craft();
      state.emit('toast', 'Ackerboden am Nil aufgelockert!');
    } else if (p.stage === 'tilled') {
      p.stage = 'seeded';
      this.refreshPlotVisual(n);
      state.bump('seeded_plot', 1);
      sfx.craft();
      state.emit('toast', 'Emmer-Saat in den feuchten Nilschlamm gesät!');
    } else if (p.stage === 'seeded') {
      if (state.count('wasser') <= 0) {
        state.emit('toast', 'Schöpfe erst Nilwasser am Ufer oder Schaduf!');
        return;
      }
      state.add('wasser', -1);
      p.stage = 'watered';
      p.wateredAt = Date.now();
      this.refreshPlotVisual(n);
      state.bump('watered_plot', 1);
      sfx.craft();
      state.emit('toast', 'Feld mit Nilwasser getränkt!');
    } else if (p.stage === 'ripe') {
      p.stage = 'raw';
      if (n.cropSprite) {
        n.cropSprite.destroy();
        n.cropSprite = undefined;
      }
      this.refreshPlotVisual(n);
      state.add('emmer', 3);
      state.bump('harvested_emmer', 3);
      state.unlockLexicon('emmer');
      sfx.pickup();
      state.emit('toast', 'Ernte eingebracht: +3 Emmer-Getreide!');
    }
    state.persist();
  }

  private interactBuilding(n: Node): void {
    const b = n.buildingDef;
    if (!b) return;
    if (state.hasBuilding(b.id)) {
      state.emit('toast', `Hier steht bereits: ${b.name}`);
      return;
    }

    if (!state.canAffordBuilding(b)) {
      const costStr = Object.entries(b.cost).map(([id, num]) => `${num}× ${id}`).join(', ');
      state.openDialog({
        speaker: `Bauplatz: ${b.name}`,
        nodes: [
          { text: `${b.desc}\n\nBenötigte Baumaterialien:\n${costStr}` },
        ],
      });
      return;
    }

    state.build(b);
    this.renderBuiltEgyptBuilding(n);
    state.emit('toast', `Errichtet: ${b.name}!`);
  }

  private onCraft(): void {
    this.persist();
  }

  private updateCompass(): void {
    const ch = state.chapter;
    const q = state.quest;
    const chDef = state.currentChapterDef;

    if (q === 0 || state.isReadyForQuiz() || state.isChapterComplete()) {
      const mentorKind =
        ch === 1 ? 'egypt_senbi' : ch === 2 ? 'egypt_ameni' : ch === 3 ? 'egypt_nefermaat' : ch === 4 ? 'egypt_ani' : ch === 5 ? 'egypt_hemiunu' : 'egypt_baki';
      const targetNode = this.nodes.find((n) => n.kind === mentorKind);
      if (targetNode) {
        this.setCompassTarget(targetNode, chDef.title);
      }
      return;
    }

    if (ch === 1) {
      if (q === 1) this.setCompassTargetByKind('egypt_papyrus', 'Papyrus-Schilf am Ufer');
      else if (q === 2) this.setCompassTargetByKind('egypt_acacia', 'Stöcke & Steine');
      else if (q === 3) state.compassText = '🔨 Drücke C -> Fischreuse flechten!';
      else if (q === 4) this.setCompassTargetByKind('egypt_fish_spot', 'Nilbarsch-Fischgrund');
      else this.setCompassTargetByKind('egypt_senbi', 'Fischer Senbi');
    } else if (ch === 2) {
      if (q === 1) this.setCompassTargetByKind('egypt_nilometer', 'Nilometer-Pegel');
      else if (q === 2) state.compassText = '🔨 Drücke C -> Schaduf-Hebelarm zimmern!';
      else if (q === 3) this.setCompassTargetByKind('build_site', 'Bauplatz: Schaduf');
      else if (q === 4) this.setCompassTargetByKind('egypt_nil_water', 'Nil-Wasser schöpfen');
      else if (q === 5 || q === 6) this.setCompassTargetByKind('plot', 'Ackerbeet');
      else if (q === 7) this.setCompassTargetByKind('egypt_palm', 'Dattelpalme');
      else this.setCompassTargetByKind('egypt_ameni', 'Feldhüter Ameni');
    } else if (ch === 3) {
      if (q === 1) this.setCompassTargetByKind('build_site', 'Bauplatz: Lehmziegelei');
      else if (q === 2) state.compassText = '🔨 Drücke C -> Lehmziegel formen!';
      else if (q === 3) this.setCompassTargetByKind('build_site', 'Bauplatz: Kornspeicher');
      else this.setCompassTargetByKind('egypt_nefermaat', 'Wesir Nefermaat');
    } else if (ch === 4) {
      if (q === 1) this.setCompassTargetByKind('build_site', 'Bauplatz: Schreiberhaus');
      else if (q === 2) state.compassText = '📜 Drücke C -> Papyrusrolle pressen!';
      else this.setCompassTargetByKind('egypt_ani', 'Ober-Schreiber Ani');
    } else if (ch === 5) {
      if (q === 1) this.setCompassTargetByKind('build_site', 'Bauhütte der Pyramide');
      else if (q === 2) this.setCompassTargetByKind('egypt_kalkstein', 'Tura-Kalksteinbruch');
      else if (q === 6 || q === 7) this.setCompassTargetByKind('egypt_sphinx', 'Große Sphinx');
      else this.setCompassTargetByKind('egypt_pyramid', 'Große Pyramide');
    } else {
      if (q === 1 || q === 2) this.setCompassTargetByKind('merchant', 'Basar / Fernhändler');
      else if (q === 4) this.setCompassTargetByKind('egypt_boat', 'Nilbarke für Rom');
      else this.setCompassTargetByKind('egypt_baki', 'Hafenmeister Baki');
    }
  }

  private setCompassTargetByKind(kind: Kind, label: string): void {
    const node = this.nodes.find((n) => n.kind === kind);
    if (node) this.setCompassTarget(node, label);
  }

  private setCompassTarget(targetNode: Node, label: string): void {
    const dx = targetNode.sprite.x - this.player.x;
    const dy = targetNode.sprite.y - this.player.y;
    const distPx = Math.hypot(dx, dy);
    if (distPx < 32) {
      state.compassText = `📍 Ziel direkt vor dir: ${label} (drücke E)`;
      return;
    }
    const meters = Math.max(2, Math.round(distPx / 8));
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    let dirStr = '→ Osten';
    if (angle >= -112.5 && angle < -67.5) dirStr = '↑ Norden';
    else if (angle >= -67.5 && angle < -22.5) dirStr = '↗ Nordosten';
    else if (angle >= -22.5 && angle < 22.5) dirStr = '→ Osten';
    else if (angle >= 22.5 && angle < 67.5) dirStr = '↘ Südosten';
    else if (angle >= 67.5 && angle < 112.5) dirStr = '↓ Süden';
    else if (angle >= 112.5 && angle < 157.5) dirStr = '↙ Südwesten';
    else if (angle >= -157.5 && angle < -112.5) dirStr = '↖ Nordwesten';
    else dirStr = '← Westen';

    state.compassText = `🧭 ${label}: ${dirStr} (${meters} m)`;
  }

  private persist(): void {
    state.playerX = Math.round(this.player.x);
    state.playerY = Math.round(this.player.y);
    state.persist();
  }
}
