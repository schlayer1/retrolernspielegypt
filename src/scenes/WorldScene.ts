import Phaser from 'phaser';
import { sfx } from '../audio/sound';
import { EgyptBuildingDef, EgyptItemId } from '../data/items';
import { CROP_MS, DAY_MS, state } from '../systems/GameState';
import { FarmPlotState } from '../systems/SaveManager';

const TILE = 16;
const MAP_W = 50;
const MAP_H = 38;
const SPEED = 75;
const REACH = 44;
const REGROW_MS = 25_000;

// Nil-Flussbett in Kacheln
const NILE = { x: 38, y: 0, w: 12, h: 38 };

type Dir = 'down' | 'right' | 'up' | 'left';
type Kind =
  | 'plot'
  | 'build_site'
  | 'merchant'
  | 'egypt_senbi'
  | 'egypt_ameni'
  | 'egypt_kheti'
  | 'egypt_nefermaat'
  | 'egypt_ani'
  | 'egypt_hemiunu'
  | 'egypt_baki'
  | 'egypt_nilometer'
  | 'egypt_papyrus'
  | 'egypt_stick'
  | 'egypt_pebble'
  | 'egypt_campfire'
  | 'egypt_fish_spot'
  | 'egypt_palm'
  | 'egypt_mud'
  | 'egypt_nil_water'
  | 'egypt_kalkstein'
  | 'egypt_schaduf'
  | 'egypt_sphinx'
  | 'egypt_pyramid'
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

    // 1. Authentischer 16-Bit-Wüsten-, Kemet- und Nil-Boden
    this.buildEgyptGround();

    // 2. Natur, Siedlung & Monumente
    this.scatterEgyptNature();

    // 3. Rohstoffe für Kapitel 1 (Schilf, Akazienäste, Wüstenkiesel)
    this.placeEgyptResources();

    // 4. Gebäude- & Mentorenplätze
    this.placeEgyptBuildingsAndNPCs();

    // 5. Spieler-Spawn
    const startX = state.playerX || 490;
    const startY = state.playerY || 350;
    const texKey = state.playerGender === 'female' ? 'player_egypt_female' : 'player_egypt_male';

    this.player = this.physics.add.sprite(startX, startY, texKey, 0);
    this.player.body!.setSize(8, 6).setOffset(4, 24);
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
      const texKey = state.playerGender === 'female' ? 'player_egypt_female' : 'player_egypt_male';
      this.player.setTexture(texKey);
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

  // ---------------------------------------------------------------- Weltaufbau
  private buildEgyptGround(): void {
    const rt = this.add.renderTexture(0, 0, MAP_W * TILE, MAP_H * TILE).setOrigin(0).setDepth(0);

    for (let ty = 0; ty < MAP_H; ty++) {
      for (let tx = 0; tx < MAP_W; tx++) {
        const px = tx * TILE;
        const py = ty * TILE;

        // A. Westliches Wüstengebiet (tx: 0..27)
        if (tx < 28) {
          const r = (tx * 7 + ty * 13) % 100;
          let sandFrame = 'sand_1';
          if (r < 40) sandFrame = 'sand_1';
          else if (r < 75) sandFrame = 'sand_2';
          else if (r < 88) sandFrame = 'sand_dune_1';
          else if (r < 94) sandFrame = 'sand_dune_2';
          else sandFrame = 'sand_ripples';

          rt.drawFrame('desert_tileset', sandFrame, px, py);

          // Gelegentliche Kiesel- und Steinstreuung
          if ((tx * 11 + ty * 17) % 31 === 0 && tx > 2) {
            const rockDeco = (tx + ty) % 2 === 0 ? 'pebbles' : 'stone_flat';
            rt.drawFrame('desert_tileset', rockDeco, px, py);
          }
        }
        // B. Fruchtbares Nilufer (Kemet: schwarzer Nilschlamm-Boden, tx: 28..37)
        else if (tx >= 28 && tx <= 37) {
          if (tx === 28) {
            // Übergang Wüstensand zu dunklem Nilschlamm
            rt.drawFrame('desert_tileset', 'silt_transition_w', px, py);
          } else if (tx === 37) {
            // Sandiger Ufersaum direkt am Wasser (Autotile-Kante)
            rt.drawFrame('desert_tileset', 'shore_w', px, py);
          } else {
            // Satter, dunkler Nilschlamm
            const siltR = (tx * 5 + ty * 9) % 10;
            const siltFrame = siltR < 6 ? 'silt_dark' : siltR < 9 ? 'silt_patch' : 'silt_rich';
            rt.drawFrame('desert_tileset', siltFrame, px, py);
          }
        }
        // C. Der mächtige Nil (Wasserfläche, tx: 38..49)
        else {
          const waterR = (tx * 3 + ty * 7) % 10;
          const waterFrame = waterR === 0 ? 'water_shallow' : 'water_deep';
          rt.drawFrame('desert_tileset', waterFrame, px, py);
        }
      }
    }

    // Nil-Kollision (Spieler kann nicht in tiefes Wasser laufen)
    // Außer beim Holzsteg/Fischgrund bei y = 340..370
    const zoneN = this.add.zone(NILE.x * TILE + 8, 0, NILE.w * TILE, 330).setOrigin(0);
    this.physics.add.existing(zoneN, true);
    this.obstacles.add(zoneN);

    const zoneS = this.add.zone(NILE.x * TILE + 8, 380, NILE.w * TILE, MAP_H * TILE - 380).setOrigin(0);
    this.physics.add.existing(zoneS, true);
    this.obstacles.add(zoneS);
  }

  private scatterEgyptNature(): void {
    // 1. Fischer Senbis Hütte (48x48 Lehmziegel-Fischerhütte aus desert_houses.png)
    const hut = this.makeObstacle(490, 290, 'desert_houses', 'hut_senbi');
    // Nur das Fundament (untere 20px) ist eine Kollision, oben kann man vorbeilaufen!
    hut.body!.setSize(40, 20).setOffset(4, 26);
    hut.setDepth(290);
    this.addLabel(490, 260, '🛖 Fischer Senbis Hütte', '#ffe9b0');

    // 2. Animiertes Lagerfeuer zum Fischbraten (objects.png fire animation)
    const fire = this.physics.add.sprite(445, 345, 'objects', 'fire0');
    fire.anims.play('fire', true);
    fire.setDepth(345);
    const fireNode = this.addNode('egypt_campfire', 'objects', 'fire0', 445, 345);
    fireNode.label = this.addLabel(445, 325, '🔥 Lagerfeuer (Fisch braten)', '#f97316');

    // 3. Authentischer Holzsteg / Nilbarsch-Fischgrund am Nilufer
    const fishSpot = this.addNode('egypt_fish_spot', 'objects', 'pot', 605, 355);
    fishSpot.sprite.setDepth(355);
    fishSpot.label = this.addLabel(605, 335, '🎣 Nilbarsch-Fischgrund (E)', '#38bdf8');

    // 3b. Antikes Nilboot / Lastkahn am Fischersteg (aus MegaPropsPack)
    const boat = this.makeObstacle(628, 385, 'egypt_boat');
    boat.setDisplaySize(64, 52);
    boat.body!.setSize(44, 20).setOffset(10, 16);
    boat.setDepth(370);
    this.addLabel(628, 355, '⛵ Papyrus-Lastkahn', '#93c5fd');

    // 3c. Antikes Nilometer am Flussufer (Pegelmesser für die Nilschwemme ab Kap. 2)
    if (state.chapter >= 2) {
      const nilo = this.addNode('egypt_nilometer', 'nilometer_prop', undefined, 580, 275);
      nilo.sprite.setDepth(275);
      nilo.label = this.addLabel(580, 250, '📏 Nilometer (E)', '#67e8f9');
    }

    // 4. Echte 16-Bit-Dattelpalmen
    const palmPositions = [
      [390, 190],
      [440, 140],
      [430, 420],
      [550, 210],
      [540, 450],
      [380, 490],
      [500, 120],
      [360, 260],
    ];
    for (const [px, py] of palmPositions) {
      const p = this.makeObstacle(px, py, 'desert_tileset', 'palm_tree');
      p.body!.setSize(12, 8).setOffset(18, 54);
      p.setDepth(py + 30);
      const palmNode = this.addNode('egypt_palm', 'desert_tileset', 'palm_tree', px, py);
      palmNode.sprite.setVisible(false);
      palmNode.sprite.setPosition(px, py + 16);
    }

    // 5. Wüstensteine & Felsblöcke (desert_tileset)
    const rockClusters = [
      [80, 180],
      [240, 140],
      [110, 360],
      [270, 440],
      [180, 500],
    ];
    for (const [rx, ry] of rockClusters) {
      const r = this.makeObstacle(rx, ry, 'desert_tileset', 'rocks_large');
      r.body!.setSize(26, 16).setOffset(3, 14);
      r.setDepth(ry);
    }

    // 6. Kakteen & Wüstensträucher
    const desertPlants = [
      [60, 260],
      [140, 420],
      [210, 320],
      [310, 120],
      [300, 520],
    ];
    for (const [px, py] of desertPlants) {
      const p = this.makeObstacle(px, py, 'desert_tileset', 'cactus_tall');
      p.body!.setSize(10, 10).setOffset(3, 36);
      p.setDepth(py);
    }

    // 7. Monumente in der Ferne (Pyramide & Sphinx) – erst ab Kapitel 5 (Pyramiden-Epoche)
    if (state.chapter >= 5) {
      const pyr = this.makeObstacle(110, 85, 'egypt_pyramid');
      pyr.body!.setSize(120, 45).setOffset(36, 100);
      pyr.setDepth(85);
      this.addLabel(110, 20, '🔺 Große Pyramide (Gizeh)', '#fef08a');

      const sph = this.makeObstacle(190, 260, 'egypt_sphinx');
      sph.body!.setSize(64, 28).setOffset(8, 30);
      sph.setDepth(260);
      this.addLabel(190, 225, '🦁 Große Sphinx von Gizeh', '#fef08a');
    }
  }

  private placeEgyptResources(): void {
    // A. 4 Papyrus-Schilf-Bestände am sumpfigen Flussrand
    const reeds = [
      [590, 120],
      [595, 230],
      [590, 430],
      [595, 510],
    ];
    reeds.forEach(([x, y]) => {
      const n = this.addNode('egypt_papyrus', 'desert_tileset', 'bush_wide', x, y);
      n.sprite.setDepth(y);
    });

    // B. 3 Akazienäste / Stöcke am Übergang zur Wüste
    const sticks = [
      [380, 160],
      [400, 370],
      [350, 470],
    ];
    sticks.forEach(([x, y]) => {
      const n = this.addNode('egypt_stick', 'desert_tileset', 'bush_small', x, y);
      n.sprite.setDepth(y);
    });

    // C. 3 Wüstenkiesel am Ufersaum
    const pebbles = [
      [310, 210],
      [350, 330],
      [320, 450],
    ];
    pebbles.forEach(([x, y]) => {
      const n = this.addNode('egypt_pebble', 'desert_tileset', 'stone_flat', x, y);
      n.sprite.setDepth(y);
    });
  }

  private placeEgyptBuildingsAndNPCs(): void {
    // 1. Fischer Senbi (Mentor Kapitel 1) – Schilffischer am Nilufer
    const senbi = this.addNode('egypt_senbi', 'npc_senbi', 0, 530, 350);
    senbi.sprite.setDepth(350);
    senbi.label = this.addLabel(530, 325, '🐟 Fischer Senbi (Kap. 1)', '#38bdf8');

    // Weitere Mentoren erst ab ihrem jeweiligen Kapitel freischalten!
    if (state.chapter >= 2) {
      const ameni = this.addNode('egypt_ameni', 'npc_ameni', 0, 460, 185);
      ameni.sprite.setDepth(185);
      ameni.label = this.addLabel(460, 160, '🌾 Feldhüter Ameni (Kap. 2)', '#fde047');

      const kheti = this.addNode('egypt_kheti', 'npc_kheti', 0, 520, 185);
      kheti.sprite.setDepth(185);
      kheti.label = this.addLabel(520, 160, '👩‍🌾 Bäuerin Kheti', '#86efac');

      // Nil-Nutztiere (Pflugochse & Trampelziege zur Saat)
      const ox = this.physics.add.sprite(410, 260, 'animal_cow', 0);
      ox.setDepth(260);
      ox.anims.play('idle-cow', true);
      this.obstacles.add(ox);

      const goat1 = this.physics.add.sprite(430, 290, 'animal_goat', 0);
      goat1.setDepth(290);
      goat1.anims.play('idle-goat', true);
      this.obstacles.add(goat1);
    }

    if (state.chapter >= 3) {
      const wesir = this.addNode('egypt_nefermaat', 'npc_nefermaat', 0, 360, 200);
      wesir.sprite.setDepth(200);
      wesir.label = this.addLabel(360, 175, '👑 Wesir Nefermaat (Kap. 3)', '#f59e0b');
    }

    if (state.chapter >= 4) {
      const ani = this.addNode('egypt_ani', 'npc_ani', 0, 260, 160);
      ani.sprite.setDepth(160);
      ani.label = this.addLabel(260, 135, '📜 Ober-Schreiber Ani (Kap. 4)', '#a78bfa');
    }

    if (state.chapter >= 5) {
      const hemi = this.addNode('egypt_hemiunu', 'npc_hemiunu', 0, 130, 205);
      hemi.sprite.setDepth(205);
      hemi.label = this.addLabel(130, 180, '📐 Baumeister Hemiunu (Kap. 5)', '#fef08a');
    }

    if (state.chapter >= 6) {
      const baki = this.addNode('egypt_baki', 'npc_baki', 0, 560, 480);
      baki.sprite.setDepth(480);
      baki.label = this.addLabel(560, 455, '⚓ Hafenmeister Baki (Kap. 6)', '#60a5fa');
    }

    // Bauplätze: Nur anzeigen, wenn das Kapitel erreicht ist!
    for (const b of state.buildingsData) {
      if (state.chapter < b.unlockedInChapter) continue;

      const node = this.addNode('build_site', 'farm', 'sign_build', b.x, b.y);
      node.buildingDef = b;
      node.sprite.setDepth(b.y);
      if (state.hasBuilding(b.id)) {
        this.renderBuiltEgyptBuilding(node);
      } else {
        node.label = this.addLabel(b.x, b.y - 18, `🔨 Bauplatz: ${b.name}`, '#fef08a');
      }
    }

    // Ackerbeete am Nilufer erst ab Kapitel 2 (Nilschwemme & Ackerbau)
    if (state.chapter >= 2) {
      for (let i = 0; i < 6; i++) {
        const px = 430 + (i % 3) * 32;
        const py = 230 + Math.floor(i / 3) * 32;
        const node = this.addNode('plot', 'farm', 'soil_raw', px, py);
        node.plotId = i;
        node.sprite.setDepth(py);
        this.refreshPlotVisual(node);
      }
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
      this.add.image(b.x, b.y, 'desert_houses', 'house_mid').setDepth(b.y);
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

  // ---------------------------------------------------------------- Game Loop
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
    const currentSpeed = state.playerRole === 'fisher' && this.player.x > 380 ? SPEED * 1.2 : SPEED;

    if (vx !== 0 || vy !== 0) {
      const len = Math.hypot(vx, vy);
      this.player.setVelocity((vx / len) * currentSpeed, (vy / len) * currentSpeed);
      state.distanceMeters += (currentSpeed * (delta / 1000)) / 8;

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

    // Präzise Bildschirm-Synchronisation der World-Labels (wie im Steinzeitspiel)
    this.syncWorldLabels();

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

  /**
   * Berechnet gestochen scharfe Retina-DOM-Koordinaten für alle Beschriftungen
   * über getBoundingClientRect des Canvas. Verhindert jedes Zusammenstauchen im HUD.
   */
  private syncWorldLabels(): void {
    const canvas = this.game.canvas;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cam = this.cameras.main;
    const hideAll = state.modal;

    for (const lbl of this.domLabels) {
      if (hideAll) {
        lbl.el.style.display = 'none';
        continue;
      }
      const sx = ((lbl.x - cam.scrollX) / cam.width) * rect.width + rect.left;
      const sy = ((lbl.y - cam.scrollY) / cam.height) * rect.height + rect.top;

      if (sx < rect.left + 20 || sx > rect.right - 20 || sy < rect.top + 15 || sy > rect.bottom - 15) {
        lbl.el.style.display = 'none';
        continue;
      }

      // Verhindere Überlappung mit fixierten HUD-Elementen im oberen Bildschirmbereich
      const inQuestCard = sx < rect.left + 360 && sy < rect.top + 120;
      const inStatusCard = sx > rect.right - 240 && sy < rect.top + 120;
      const inTopButtons = sx > rect.left + rect.width * 0.28 && sx < rect.left + rect.width * 0.72 && sy < rect.top + 60;
      if (inQuestCard || inStatusCard || inTopButtons) {
        lbl.el.style.display = 'none';
        continue;
      }

      lbl.el.style.display = 'block';
      lbl.el.style.left = `${sx}px`;
      lbl.el.style.top = `${sy}px`;
    }
  }

  private updateNodes(): void {
    const now = Date.now();
    for (const n of this.nodes) {
      if (n.readyAt > 0 && now >= n.readyAt) {
        n.readyAt = 0;
        n.sprite.setAlpha(1);
        if (n.label) n.label.el.style.opacity = '1';
      }

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
      node.sprite.setFrame('soil_dry');
    } else if (p.stage === 'seeded' || p.stage === 'watered') {
      node.sprite.setFrame('soil_wet');
    } else if (p.stage === 'ripe') {
      node.sprite.setFrame('soil_wet');
      if (!node.cropSprite) {
        node.cropSprite = this.add.image(node.sprite.x, node.sprite.y - 8, 'farm', 'wheat_ripe').setDepth(node.sprite.y + 1);
      }
    }
  }

  private nearest(): Node | null {
    let best: Node | null = null;
    let minD = REACH;
    for (const n of this.nodes) {
      if (n.readyAt > 0) continue;
      // Dattelpalmen nur anvisieren, wenn man tatsächlich in Quest 7 (Datteln ernten) ist
      if (n.kind === 'egypt_palm' && !(state.chapter === 2 && state.quest === 7)) continue;

      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, n.sprite.x, n.sprite.y);
      if (d < minD) {
        minD = d;
        best = n;
      }
    }
    return best;
  }

  private hintFor(n: Node): string {
    switch (n.kind) {
      case 'egypt_senbi':
        return 'Drücke E: Mit Fischer Senbi sprechen';
      case 'egypt_ameni':
        return 'Drücke E: Mit Feldhüter Ameni sprechen (Kap. 2)';
      case 'egypt_kheti':
        return 'Drücke E: Mit Bäuerin Kheti sprechen';
      case 'egypt_nilometer':
        return 'Drücke E: Wasserstand am Nilometer ablesen';
      case 'egypt_palm':
        return state.chapter === 2 && state.quest === 7 ? 'Drücke E: Süße Datteln von der Palme pflücken' : 'Dattelpalme der fruchtbaren Nil-Oase';
      case 'egypt_papyrus':
        return 'Drücke E: Papyrus-Schilf schneiden';
      case 'egypt_stick':
        return 'Drücke E: Akazienast aufheben';
      case 'egypt_pebble':
        return 'Drücke E: Wüstenkiesel aufheben';
      case 'egypt_fish_spot':
        return state.count('fischreuse') > 0 ? 'Drücke E: Fischreuse auswerfen & Nilbarsch fangen' : 'Du benötigst eine geflochtene Fischreuse (Taste C)!';
      case 'egypt_campfire':
        return state.count('nilbarsch') > 0 ? 'Drücke E: Frischen Nilbarsch über dem Feuer braten' : 'Lagerfeuer (Spende Wärme & koche Nahrung)';
      case 'plot':
        return 'Drücke E: Ackerbeet bewirtschaften';
      case 'build_site':
        return 'Drücke E: Bauplatz inspizieren / bauen';
      default:
        return 'Drücke E zum Interagieren';
    }
  }

  private interact(n: Node): void {
    switch (n.kind) {
      case 'egypt_senbi':
        this.interactSenbi();
        break;

      case 'egypt_ameni':
        this.interactAmeni();
        break;

      case 'egypt_kheti':
        this.interactKheti();
        break;

      case 'egypt_nilometer':
        this.interactNilometer();
        break;

      case 'egypt_palm':
        this.interactPalm(n);
        break;

      case 'egypt_papyrus':
        state.add('papyrus_staengel', 1);
        state.bump('cut_papyrus', 1);
        sfx.pickup();
        state.emit('toast', '+1 Papyrus-Stängel geschnitten!');
        n.readyAt = Date.now() + REGROW_MS;
        n.sprite.setAlpha(0.35);
        if (n.label) n.label.el.style.opacity = '0.35';

        // Kapitel-1-Questfortschritt (3x Papyrus)
        if (state.chapter === 1 && state.quest === 1 && state.count('papyrus_staengel') >= 3) {
          state.quest = 2;
          sfx.quest();
          state.emit('toast', 'Ziel erreicht: Genug Schilf gesammelt! Finde nun Stöcke und Kiesel.');
        }
        state.persist();
        break;

      case 'egypt_stick':
        state.add('stock', 1);
        state.bump('found_sticks', 1);
        sfx.pickup();
        state.emit('toast', '+1 Akazienast aufgesammelt!');
        n.readyAt = Date.now() + REGROW_MS;
        n.sprite.setAlpha(0.35);
        if (n.label) n.label.el.style.opacity = '0.35';

        // Kapitel-1-Questfortschritt (2x Stöcke & 2x Kiesel)
        if (state.chapter === 1 && state.quest === 2 && state.count('stock') >= 2 && state.count('stein') >= 2) {
          state.quest = 3;
          sfx.quest();
          state.emit('toast', 'Ziel erreicht! Öffne Handwerk mit Taste C & flechte die Fischreuse.');
        }
        state.persist();
        break;

      case 'egypt_pebble':
        state.add('stein', 1);
        state.bump('found_stones', 1);
        sfx.pickup();
        state.emit('toast', '+1 Wüstenkiesel aufgesammelt!');
        n.readyAt = Date.now() + REGROW_MS;
        n.sprite.setAlpha(0.35);
        if (n.label) n.label.el.style.opacity = '0.35';

        // Kapitel-1-Questfortschritt (2x Stöcke & 2x Kiesel)
        if (state.chapter === 1 && state.quest === 2 && state.count('stock') >= 2 && state.count('stein') >= 2) {
          state.quest = 3;
          sfx.quest();
          state.emit('toast', 'Ziel erreicht! Öffne Handwerk mit Taste C & flechte die Fischreuse.');
        }
        state.persist();
        break;

      case 'egypt_fish_spot':
        if (state.count('fischreuse') <= 0) {
          state.openDialog({
            speaker: 'Fischer Senbi',
            nodes: [
              { text: 'Ohne Fischreuse wirst du in den schnellen Strudeln des Nils keinen Fisch fangen!\n\nFlechte zuerst eine Reuse im Handwerksmenü (Taste C).' },
            ],
          });
          return;
        }

        sfx.pickup();
        state.add('nilbarsch', 1);
        state.bump('caught_fish', 1);
        state.unlockLexicon('nil');
        state.emit('toast', 'Fischfang erfolgreich: +1 Frischer Nilbarsch!');

        // Kapitel-1-Questfortschritt (Fisch fangen)
        if (state.chapter === 1 && state.quest === 4) {
          state.quest = 5;
          sfx.quest();
          state.emit('toast', 'Ziel erreicht! Brate den Nilbarsch nun am knisternden Lagerfeuer.');
        }
        state.persist();
        break;

      case 'egypt_campfire':
        if (state.count('nilbarsch') > 0) {
          state.add('nilbarsch', -1);
          state.add('cooked_fish', 1);
          sfx.craft();
          state.emit('toast', 'Knusprig gebraten: +1 Gebratener Nilbarsch!');

          // Kapitel-1-Questfortschritt (Fisch braten)
          if (state.chapter === 1 && state.quest === 5) {
            state.quest = 6;
            sfx.quest();
            state.emit('toast', 'Ziel erreicht! Sprich nun mit Fischer Senbi zur Wissensprüfung.');
          }
          state.persist();
        } else {
          state.emit('toast', 'Das Feuer knistert warm. Bring frischen Fisch zum Braten mit!');
        }
        break;

      case 'plot':
        this.interactPlot(n);
        break;

      case 'build_site':
        this.interactBuilding(n);
        break;

      default:
        state.emit('toast', 'Ein interessanter Ort am Nil.');
        break;
    }
  }

  private interactNilometer(): void {
    sfx.pickup();
    state.bump('nilometer', 1);
    state.unlockLexicon('nilschwemme');
    state.openDialog({
      speaker: 'Antikes Nilometer',
      nodes: [
        { text: '📏 Du liest die eingemeißelten Ellen am Nilometer ab:\n\n„16 Ellen Pegelhöhe!“\n\nEin Jubel geht durch die Felder: Es ist die ideale Höhe für die gesegnete Nilschwemme (Akhet)!' },
        { text: 'Der dunkle Mineralschlamm aus den Bergen Äthiopiens lagert sich auf den Ufern ab. Nun müssen die Schöpfwerke vorbereitet werden!' },
      ],
      onDone: () => {
        if (state.chapter === 2 && state.quest === 1) {
          state.quest = 2;
          sfx.quest();
          state.emit('toast', 'Ziel erreicht! Zimmere nun den Schaduf-Hebelarm (Taste C).');
          state.persist();
        }
      },
    });
  }

  private interactPalm(n: Node): void {
    if (state.chapter !== 2 || state.quest !== 7) {
      state.emit('toast', 'Eine hohe Dattelpalme. Ihre Krone wiegt sich im Wüstenwind.');
      return;
    }
    state.add('datteln', 1);
    state.bump('datteln', 1);
    sfx.pickup();
    n.readyAt = Date.now() + REGROW_MS;
    state.emit('toast', `+1 Süße Dattel gepflückt! (${state.count('datteln')}/3)`);

    if (state.count('datteln') >= 3) {
      state.quest = 8;
      sfx.quest();
      state.emit('toast', 'Genug Datteln gesammelt! Schneide nun den reifen Emmer auf dem Feld mit der Sichel.');
    }
    state.persist();
  }

  private interactKheti(): void {
    state.openDialog({
      speaker: 'Bäuerin Kheti',
      nodes: [
        { text: 'Sei gegrüßt auf unseren Feldern! Sobald das Nilwasser zurückweicht, treiben wir die Ziegen und Ochsen über die Saat, damit die Körner fest in den Nilschlamm getrampelt werden.' },
        { text: 'Das Urgetreide Emmer ist widerstandsfähig gegen die Hitze. Mit künstlicher Bewässerung durch den Schaduf können wir doppelt so viel ernten!' },
      ],
    });
  }

  private interactAmeni(): void {
    const ch = state.chapters[2];
    const q = state.quest;

    if (state.chapter < 2) {
      state.openDialog({
        speaker: 'Feldhüter Ameni',
        nodes: [{ text: 'Ich bereite die Bewässerungsgräben für die Nilschwemme vor. Meistere erst Fischer Senbis Aufgaben am Fluss!' }],
      });
      return;
    }

    if (state.chapter > 2) {
      state.openDialog({
        speaker: 'Feldhüter Ameni',
        nodes: [{ text: 'Möge der Nil allzeit reiche Ernten schenken! Die Felder blühen dank deiner fleißigen Arbeit mit dem Schaduf.' }],
      });
      return;
    }

    // Kapitel 2 aktiv:
    if (q === 0) {
      state.openDialog({
        speaker: 'Feldhüter Ameni',
        nodes: [
          { text: 'Willkommen auf den Feldern von Kemet! Ich bin Ameni, der Vorsteher der Bewässerungskanäle.' },
          { text: 'Die Götter haben uns die Nilschwemme (Akhet) gesandt! Doch bevor wir säen können, müssen wir wissen, wie hoch das Wasser stieg.' },
          { text: 'Gehe zum Nilometer am Ufer und lies den Ellen-Pegelstand ab!' },
        ],
        onDone: () => {
          state.quest = 1;
          state.persist();
        },
      });
      return;
    }

    if (q === 8 && state.count('emmer') >= 1) {
      // Bereit für das Jahreszeiten-Quiz
      state.openDialog({
        speaker: 'Feldhüter Ameni – Wissensprüfung',
        nodes: ch.quiz as any,
        onDone: () => {
          state.quest = ch.quests.length - 1;
          state.unlockLexicon('schaduf');
          state.unlockLexicon('emmer');
          state.persist();
          state.emit('chapterDone', state.chapter);
        },
      });
      return;
    }

    if (state.isChapterComplete()) {
      state.openDialog({
        speaker: 'Feldhüter Ameni',
        nodes: [
          { text: 'Großartig! Du verstehst das Geheimnis der Nilschwemme und die Hebelkraft des Schadufs.' },
          { text: 'Nun ruft dich die Residenz: Wesir Nefermaat benötigt Ziegel und Speicher für den Vorrat des Pharaos!' },
        ],
        onDone: () => {
          state.startChapter(3);
        },
      });
      return;
    }

    // Aktuelle Aufgaben-Erinnerung
    const curHint = ch.hints[q] || ch.quests[q] || 'Erfülle deine aktuelle Aufgabe auf den Feldern!';
    state.openDialog({
      speaker: 'Feldhüter Ameni',
      nodes: [
        { text: `Deine aktuelle Aufgabe:\n${ch.quests[q]}` },
        { text: `Tipp:\n${curHint}` },
      ],
    });
  }

  private interactSenbi(): void {
    const ch = state.currentChapterDef;
    const q = state.quest;

    if (q === 0) {
      state.openDialog({
        speaker: 'Fischer Senbi',
        nodes: [
          { text: 'Sei gegrüßt, Wanderer! Die große Dürre trieb unsere Sippe aus der glühenden Sahara hierher an die Ufer des mächtigen Stroms.' },
          { text: 'Hier nennen wir das schwarze, fruchtbare Land „Kemet“. Der Fluss schenkt uns Nahrung, Wasser und Schilf.' },
          { text: 'Beweise mir, dass du am Nil überleben kannst! Schneide zuerst 3× Papyrus-Schilf am feuchten Ufersaum.' },
        ],
        onDone: () => {
          state.quest = 1;
          state.persist();
        },
      });
      return;
    }

    if (q === 6 || state.isReadyForQuiz()) {
      state.openDialog({
        speaker: 'Fischer Senbi – Wissensprüfung',
        nodes: ch.quiz as any,
        onDone: () => {
          state.quest = ch.quests.length - 1;
          state.unlockLexicon('kemet');
          state.unlockLexicon('deschret');
          state.unlockLexicon('nil');
          state.persist();
          state.emit('chapterDone', state.chapter);
        },
      });
      return;
    }

    if (state.isChapterComplete()) {
      state.openDialog({
        speaker: 'Fischer Senbi',
        nodes: [
          { text: 'Hervorragend! Du beherrschst das Leben am Nil. Aus Schilf und Flusssteinen sicherst du dein Überleben.' },
          { text: 'Bereit für das nächste Zeitalter? Die Nilschwemme naht und wir müssen die Kanäle mit dem Schaduf bewässern!' },
        ],
        onDone: () => {
          state.startChapter(2);
        },
      });
      return;
    }

    const curHint = ch.hints[q] || ch.quests[q] || 'Erfülle deine aktuelle Aufgabe!';
    state.openDialog({
      speaker: 'Fischer Senbi',
      nodes: [
        { text: `Deine aktuelle Aufgabe:\n${ch.quests[q]}` },
        { text: `Tipp:\n${curHint}` },
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
      sfx.craft();
      state.bump('seeded_plot', 1);
      state.emit('toast', 'Emmer-Saat in den feuchten Nilschlamm gesät!');

      if (state.chapter === 2 && state.quest === 5) {
        state.quest = 6;
        sfx.quest();
        state.emit('toast', 'Ziel erreicht! Bewässere nun das Saatbeet mit geschöpftem Nilwasser.');
      }
    } else if (p.stage === 'seeded') {
      if (state.count('wasser') <= 0) {
        state.emit('toast', 'Schöpfe erst Nilwasser am Ufer oder Schaduf!');
        return;
      }
      state.add('wasser', -1);
      p.stage = 'watered';
      p.wateredAt = Date.now();
      this.refreshPlotVisual(n);
      sfx.craft();
      state.bump('watered_plot', 1);
      state.emit('toast', 'Feld mit Nilwasser getränkt!');

      if (state.chapter === 2 && state.quest === 6) {
        state.quest = 7;
        sfx.quest();
        state.emit('toast', 'Ziel erreicht! Pflücke während des Wachstums 3× Datteln von den Oasenpalmen.');
      }
    } else if (p.stage === 'ripe') {
      p.stage = 'raw';
      if (n.cropSprite) {
        n.cropSprite.destroy();
        nodeCrop(n);
      }
      this.refreshPlotVisual(n);
      state.add('emmer', 3);
      state.bump('harvested_emmer', 1);
      state.unlockLexicon('emmer');
      sfx.pickup();
      state.emit('toast', 'Ernte eingebracht: +3 Emmer-Getreide!');

      if (state.chapter === 2 && state.quest === 8) {
        sfx.quest();
        state.emit('toast', 'Ziel erreicht! Tritt vor Feldhüter Ameni zur Prüfung über die Jahreszeiten.');
      }
    }
    state.persist();
  }

  private interactBuilding(n: Node): void {
    const b = n.buildingDef;
    if (!b) return;
    if (state.hasBuilding(b.id)) {
      if (b.id === 'schaduf') {
        // Wasser am Schaduf schöpfen!
        state.add('wasser', 1);
        state.bump('schaduf_water', 1);
        sfx.pickup();
        state.emit('toast', '+1 Krug frisches Nilwasser geschöpft!');

        if (state.chapter === 2 && state.quest === 4) {
          state.quest = 5;
          sfx.quest();
          state.emit('toast', 'Ziel erreicht! Lockere nun ein Ackerbeet auf und säe Emmer.');
        }
        state.persist();
      } else {
        state.emit('toast', `Hier steht bereits: ${b.name}`);
      }
      return;
    }

    if (!state.canAffordBuilding(b)) {
      const costStr = Object.entries(b.cost).map(([id, num]) => `${num}× ${id}`).join(', ');
      state.openDialog({
        speaker: `Bauplatz: ${b.name}`,
        nodes: [{ text: `${b.desc}\n\nBenötigte Baumaterialien:\n${costStr}` }],
      });
      return;
    }

    state.build(b);
    this.renderBuiltEgyptBuilding(n);
    state.emit('toast', `Errichtet: ${b.name}!`);

    if (state.chapter === 2 && state.quest === 3 && b.id === 'schaduf') {
      state.quest = 4;
      sfx.quest();
      state.emit('toast', 'Schaduf einsatzbereit! Schöpfe nun Nilwasser mit dem Hebelarm (Taste E).');
      state.persist();
    }
  }

  private onCraft(): void {
    // Wenn in Kapitel 1 die Fischreuse hergestellt wurde
    if (state.chapter === 1 && state.quest === 3 && state.count('fischreuse') > 0) {
      state.quest = 4;
      sfx.quest();
      state.emit('toast', 'Fischreuse fertig! Gehe zum Fischgrund am Wasser und wirf sie aus.');
    }

    // Wenn in Kapitel 2 der Schaduf-Hebelarm gezimmert wurde
    if (state.chapter === 2 && state.quest === 2 && state.count('schaduf_teil') > 0) {
      state.quest = 3;
      sfx.quest();
      state.emit('toast', 'Schaduf-Hebelarm fertig! Errichte nun das Schaduf am Bauplatz am Nilufer.');
    }
    this.persist();
  }

  private updateCompass(): void {
    const ch = state.chapter;
    const q = state.quest;
    const chDef = state.currentChapterDef;

    if (q === 0 || state.isReadyForQuiz() || state.isChapterComplete()) {
      const mentorKind = ch === 1 ? 'egypt_senbi' : ch === 2 ? 'egypt_ameni' : 'egypt_senbi';
      const mentorNode = this.nodes.find((n) => n.kind === mentorKind);
      if (mentorNode) {
        this.setCompassTarget(mentorNode, chDef.mentor);
      }
      return;
    }

    if (ch === 1) {
      if (q === 1) this.setCompassTargetByKind('egypt_papyrus', 'Papyrus-Schilf am Ufer');
      else if (q === 2) this.setCompassTargetByKind('egypt_stick', 'Akazienäste & Kiesel');
      else if (q === 3) state.compassText = '🔨 Drücke C -> Fischreuse flechten!';
      else if (q === 4) this.setCompassTargetByKind('egypt_fish_spot', 'Nilbarsch-Fischgrund');
      else if (q === 5) this.setCompassTargetByKind('egypt_campfire', 'Lagerfeuer (Fisch braten)');
      else this.setCompassTargetByKind('egypt_senbi', 'Fischer Senbi');
    } else if (ch === 2) {
      if (q === 1) this.setCompassTargetByKind('egypt_nilometer', 'Antikes Nilometer');
      else if (q === 2) state.compassText = '🔨 Drücke C -> Schaduf-Hebelarm zimmern!';
      else if (q === 3) this.setCompassTargetByBuilding('schaduf', 'Bauplatz Schaduf');
      else if (q === 4) this.setCompassTargetByBuilding('schaduf', 'Schaduf-Schöpfwerk');
      else if (q === 5 || q === 6 || q === 8) this.setCompassTargetByKind('plot', 'Ackerbeete');
      else if (q === 7) this.setCompassTargetByKind('egypt_palm', 'Dattelpalme');
      else this.setCompassTargetByKind('egypt_ameni', 'Feldhüter Ameni');
    } else {
      this.setCompassTargetByKind('egypt_senbi', 'Mentor');
    }
  }

  private setCompassTargetByBuilding(buildingId: string, label: string): void {
    const node = this.nodes.find((n) => n.buildingDef?.id === buildingId);
    if (node) this.setCompassTarget(node, label);
  }

  private setCompassTargetByKind(kind: Kind, label: string): void {
    const node = this.nodes.find((n) => n.kind === kind && n.readyAt === 0);
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

function nodeCrop(n: Node) {
  n.cropSprite = undefined;
}
