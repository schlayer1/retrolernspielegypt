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
  | 'egypt_quarry'
  | 'egypt_timber'
  | 'egypt_sledge_ramp'
  | 'egypt_schaduf'
  | 'egypt_sphinx'
  | 'egypt_pyramid'
  | 'egypt_boat'
  | 'egypt_cargo_barge'
  | 'egypt_roman_envoy'
  | 'egypt_cedar_trader'
  | 'egypt_sarcophagus'
  | 'egypt_bazaar_stall';

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

    // 7. Epochenspezifische Zonen & Monumente
    // A. Palasthof des Wesirs (Kapitel 3+)
    if (state.chapter >= 3) {
      const p1 = this.makeObstacle(330, 165, 'egypt_pillar');
      p1.setDisplaySize(24, 56);
      p1.body!.setSize(16, 16).setOffset(4, 40);
      p1.setDepth(165);

      const p2 = this.makeObstacle(390, 165, 'egypt_pillar');
      p2.setDisplaySize(24, 56);
      p2.body!.setSize(16, 16).setOffset(4, 40);
      p2.setDepth(165);
      this.addLabel(360, 150, '🏛️ Hof des Wesirs', '#f59e0b');
    }

    // B. Tempelbezirk & Balsamierung (Kapitel 4+)
    if (state.chapter >= 4) {
      const hWall = this.makeObstacle(230, 85, 'egypt_hieroglyph_wall');
      hWall.setDisplaySize(64, 54);
      hWall.body!.setSize(56, 20).setOffset(4, 30);
      hWall.setDepth(85);
      this.addLabel(230, 60, '📜 Heilige Hieroglyphenwand', '#a78bfa');

      const sarcNode = this.addNode('egypt_sarcophagus', 'egypt_sarcophagus', undefined, 180, 150);
      sarcNode.sprite.setDisplaySize(44, 44);
      sarcNode.sprite.setDepth(150);
      sarcNode.label = this.addLabel(180, 125, '⚱️ Totenstadt & Sarkophag', '#c084fc');
    }

    // C. Großbaustelle Gizeh, Steinbruch & Monumente (Kapitel 5+)
    if (state.chapter >= 5) {
      const pyr = this.makeObstacle(110, 85, 'egypt_pyramid');
      pyr.body!.setSize(120, 45).setOffset(36, 100);
      pyr.setDepth(85);
      this.addLabel(110, 20, '🔺 Große Pyramide (Gizeh)', '#fef08a');
      const pyrNode = this.addNode('egypt_pyramid', 'desert_tileset', 'stone_flat', 110, 115);
      pyrNode.sprite.setVisible(false);

      const sph = this.makeObstacle(190, 260, 'egypt_sphinx');
      sph.body!.setSize(64, 28).setOffset(8, 30);
      sph.setDepth(260);
      this.addLabel(190, 225, '🦁 Große Sphinx von Gizeh', '#fef08a');
      const sphNode = this.addNode('egypt_sphinx', 'desert_tileset', 'stone_flat', 190, 260);
      sphNode.sprite.setVisible(false);

      const obelisk = this.makeObstacle(210, 100, 'egypt_obelisk');
      obelisk.setDisplaySize(28, 60);
      obelisk.body!.setSize(16, 16).setOffset(6, 42);
      obelisk.setDepth(100);

      // Tura-Kalksteinbrüche
      const q1 = this.addNode('egypt_quarry', 'desert_tileset', 'rocks_large', 70, 140);
      q1.sprite.setDepth(140);
      q1.label = this.addLabel(70, 115, '⛏️ Tura-Kalksteinbruch (E)', '#fde047');

      const q2 = this.addNode('egypt_quarry', 'desert_tileset', 'rocks_large', 60, 200);
      q2.sprite.setDepth(200);
      q2.label = this.addLabel(60, 175, '⛏️ Tura-Kalksteinbruch (E)', '#fde047');

      // Bauholz & Akazien
      const t1 = this.addNode('egypt_timber', 'desert_tileset', 'palm_tree', 100, 220);
      t1.sprite.setDepth(220);
      t1.label = this.addLabel(100, 195, '🪓 Bauholz & Schlitten (E)', '#b45309');

      // Baustellenrampe mit Schlammwasser
      const ramp = this.addNode('egypt_sledge_ramp', 'desert_tileset', 'silt_patch', 120, 175);
      ramp.sprite.setDepth(175);
      ramp.label = this.addLabel(120, 155, '🪵 Baustellenrampe (E)', '#60a5fa');
    }

    // D. Nilhafen & Basar (Kapitel 6+)
    if (state.chapter >= 6) {
      const barge = this.addNode('egypt_cargo_barge', 'egypt_cargo_ship', undefined, 635, 485);
      barge.sprite.setDisplaySize(80, 64);
      barge.sprite.setDepth(485);
      barge.label = this.addLabel(635, 455, '⛵ Römische Getreidebarke (E)', '#93c5fd');

      const stall = this.makeObstacle(490, 490, 'egypt_market_stall');
      stall.setDisplaySize(60, 60);
      stall.body!.setSize(48, 24).setOffset(6, 32);
      stall.setDepth(490);
      this.addLabel(490, 460, '🏺 Basar am Nilhafen (Taste H)', '#f59e0b');

      const tent = this.makeObstacle(430, 520, 'egypt_tent');
      tent.setDisplaySize(60, 56);
      tent.body!.setSize(48, 24).setOffset(6, 28);
      tent.setDepth(520);

      const chest = this.makeObstacle(460, 490, 'egypt_treasure_chest');
      chest.setDisplaySize(28, 28);
      chest.body!.setSize(20, 14).setOffset(4, 12);
      chest.setDepth(490);
      this.addLabel(460, 470, '👑 Schatzkammer', '#fde047');
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

    // D. Fruchtbarer Nilschlamm am Flussufer
    const mudSpots = [
      [580, 210],
      [585, 305],
    ];
    mudSpots.forEach(([x, y]) => {
      const n = this.addNode('egypt_mud', 'desert_tileset', 'silt_dark', x, y);
      n.sprite.setDepth(y);
      n.label = this.addLabel(x, y - 18, '🌊 Schlammufer (E)', '#a3e635');
    });
  }

  private placeEgyptBuildingsAndNPCs(): void {
    // 1. Fischer Senbi (Mentor Kapitel 1) – Schilffischer am Nilufer
    const senbi = this.addNode('egypt_senbi', 'npc_senbi', 0, 530, 350);
    senbi.sprite.setDepth(350);
    senbi.label = this.addLabel(530, 325, '🐟 Fischer Senbi (Kap. 1)', '#38bdf8');

    // Weitere Mentoren & epochenspezifische NPCs
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

      const guard = this.addNode('egypt_kheti', 'npc_guard', 0, 330, 200);
      guard.sprite.setDepth(200);
      guard.label = this.addLabel(330, 175, '🛡️ Palastwache', '#fbbf24');
    }

    if (state.chapter >= 4) {
      const ani = this.addNode('egypt_ani', 'npc_ani', 0, 260, 160);
      ani.sprite.setDepth(160);
      ani.label = this.addLabel(260, 135, '📜 Ober-Schreiber Ani (Kap. 4)', '#a78bfa');

      const mum = this.addNode('egypt_kheti', 'npc_mummy', 0, 160, 150);
      mum.sprite.setDepth(150);
      mum.label = this.addLabel(160, 125, '⚰️ Einbalsamierer', '#cbd5e1');
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

      const trader = this.addNode('egypt_cedar_trader', 'npc_senbi', 0, 590, 520);
      trader.sprite.setDepth(520);
      trader.label = this.addLabel(590, 495, '🌲 Holzhändler (E)', '#38bdf8');

      const envoy = this.addNode('egypt_roman_envoy', 'npc_guard', 0, 520, 510);
      envoy.sprite.setDepth(510);
      envoy.label = this.addLabel(520, 485, '🏛️ Gesandter aus Rom (E)', '#f87171');
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
      this.add.image(b.x, b.y, 'desert_houses', 'house_large').setDepth(b.y);
      this.addLabel(b.x, b.y - 24, '📜 Haus des Lebens', '#a78bfa');
    } else if (b.id === 'wabet') {
      this.add.image(b.x, b.y, 'egypt_sarcophagus').setDisplaySize(48, 48).setDepth(b.y);
      this.addLabel(b.x, b.y - 24, '⚱️ Balsamierung (Wabet)', '#c084fc');
    } else if (b.id === 'steinmetz') {
      this.add.image(b.x, b.y, 'forge').setDepth(b.y);
      this.addLabel(b.x, b.y - 24, '🏗️ Bauhütte der Großbaustelle', '#fef08a');
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
        return 'Drücke E: Mit Fischer Senbi sprechen (Kap. 1)';
      case 'egypt_ameni':
        return 'Drücke E: Mit Feldhüter Ameni sprechen (Kap. 2)';
      case 'egypt_kheti':
        return 'Drücke E: Mit Bäuerin Kheti sprechen';
      case 'egypt_nefermaat':
        return 'Drücke E: Mit Wesir Nefermaat sprechen (Kap. 3)';
      case 'egypt_ani':
        return 'Drücke E: Mit Ober-Schreiber Ani sprechen (Kap. 4)';
      case 'egypt_hemiunu':
        return 'Drücke E: Mit Baumeister Hemiunu sprechen (Kap. 5)';
      case 'egypt_baki':
        return 'Drücke E: Mit Hafenmeister Baki sprechen (Kap. 6)';
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
      case 'egypt_mud':
        return 'Drücke E: Fruchtbaren Nilschlamm ausgraben';
      case 'egypt_quarry':
        return 'Drücke E: Weiße Tura-Kalksteinquader brechen';
      case 'egypt_timber':
        return 'Drücke E: Schweres Bauholz & Rollbalken schlagen';
      case 'egypt_sledge_ramp':
        return 'Drücke E: Baustellenrampe mit Schlammwasser befeuchten';
      case 'egypt_pyramid':
        return state.chapter === 5 && state.quest === 5 ? 'Drücke E: Deckstein (Pyramidion) auf die Spitze setzen' : 'Die Große Pyramide von Gizeh';
      case 'egypt_sphinx':
        return state.chapter === 5 && state.quest === 7 ? 'Drücke E: Blick der Sphinx gen Osten zur Morgensonne ausrichten' : 'Die Große Sphinx von Gizeh';
      case 'egypt_cargo_barge':
        return state.chapter === 6 && state.quest === 5 ? 'Drücke E: Römische Frachtbarke beladen' : 'Römische Getreidebarke am Hafen';
      case 'egypt_roman_envoy':
        return 'Drücke E: Mit dem Gesandten aus Rom verhandeln';
      case 'egypt_cedar_trader':
        return 'Drücke E: Leinen gegen Libanon-Zedernholz tauschen';
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
      case 'egypt_nefermaat':
        this.interactNefermaat();
        break;
      case 'egypt_ani':
        this.interactAni();
        break;
      case 'egypt_hemiunu':
        this.interactHemiunu();
        break;
      case 'egypt_baki':
        this.interactBaki();
        break;
      case 'egypt_nilometer':
        this.interactNilometer();
        break;
      case 'egypt_palm':
        this.interactPalm(n);
        break;
      case 'egypt_mud':
        this.interactMud(n);
        break;
      case 'egypt_quarry':
        this.interactQuarry(n);
        break;
      case 'egypt_timber':
        this.interactTimber(n);
        break;
      case 'egypt_sledge_ramp':
        this.interactSledgeRamp();
        break;
      case 'egypt_pyramid':
        this.interactPyramid();
        break;
      case 'egypt_sphinx':
        this.interactSphinx();
        break;
      case 'egypt_cargo_barge':
        this.interactCargoBarge();
        break;
      case 'egypt_roman_envoy':
        this.interactRomanEnvoy();
        break;
      case 'egypt_cedar_trader':
        this.interactCedarTrader();
        break;
      case 'egypt_papyrus':
        state.add('papyrus_staengel', 1);
        state.bump('cut_papyrus', 1);
        sfx.pickup();
        state.emit('toast', '+1 Papyrus-Stängel geschnitten!');
        n.readyAt = Date.now() + REGROW_MS;
        n.sprite.setAlpha(0.35);
        if (n.label) n.label.el.style.opacity = '0.35';
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
        state.persist();
        break;
      case 'egypt_campfire':
        if (state.count('nilbarsch') > 0) {
          state.add('nilbarsch', -1);
          state.add('cooked_fish', 1);
          sfx.craft();
          state.emit('toast', 'Knusprig gebraten: +1 Gebratener Nilbarsch!');
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

  private interactMud(n: Node): void {
    state.add('nilschlamm', 1);
    state.bump('dug_mud', 1);
    sfx.pickup();
    state.unlockLexicon('kemet');
    state.emit('toast', '+1 Fruchtbarer Nilschlamm ausgegraben!');
    n.readyAt = Date.now() + 15_000;
    n.sprite.setAlpha(0.35);
    if (n.label) n.label.el.style.opacity = '0.35';
    state.persist();
  }

  private interactQuarry(n: Node): void {
    if (state.chapter < 5) {
      state.emit('toast', 'Der Tura-Steinbruch wird erst im Pyramidenzeitalter (Kapitel 5) erschlossen.');
      return;
    }
    state.add('kalkstein', 1);
    state.bump('kalkstein_mined', 1);
    sfx.craft();
    state.unlockLexicon('pyramiden');
    state.emit('toast', '+1 Tura-Kalksteinquader gebrochen!');
    n.readyAt = Date.now() + 15_000;
    n.sprite.setAlpha(0.35);
    if (n.label) n.label.el.style.opacity = '0.35';
    state.persist();
  }

  private interactTimber(n: Node): void {
    if (state.chapter < 5) {
      state.emit('toast', 'Schwere Akazienstämme für Baufahrzeuge werden in Kapitel 5 benötigt.');
      return;
    }
    state.add('stock', 2);
    state.bump('timber_chopped', 1);
    sfx.craft();
    state.emit('toast', '+2 Bauholz & Rollbalken geschlagen!');
    n.readyAt = Date.now() + 15_000;
    n.sprite.setAlpha(0.35);
    if (n.label) n.label.el.style.opacity = '0.35';
    state.persist();
  }

  private interactSledgeRamp(): void {
    if (state.chapter !== 5 || state.quest !== 4) {
      state.openDialog({
        speaker: 'Baustellenrampe der Großen Pyramide',
        nodes: [
          { text: 'Auf dieser geneigten Erdrampe ziehen Kolonnen freier Arbeiter tonnenschwere Kalksteinblöcke auf Holzschlitten empor.' },
          { text: 'Ein Arbeiter gießt Wasser vor die Kufen: Der nasse Wüstensand halbiert die Reibung und spart die Kraft von Dutzenden Männern!' },
        ],
      });
      return;
    }
    if (state.count('wasser') <= 0) {
      state.emit('toast', 'Du benötigst einen Krug Nilwasser zum Befeuchten der Kufenbahn!');
      return;
    }
    state.add('wasser', -1);
    state.bump('ramp_watered', 1);
    sfx.craft();
    state.openDialog({
      speaker: 'Baustellenrampe der Cheops-Pyramide',
      nodes: [
        { text: '💧 <strong>Gleitbahn befeuchtet!</strong>\n\nDas Schlammwasser verringert die Reibung der Holzschlitten drastisch. Mit vereinten Kräften gleiten die 2,5-Tonnen-Quader zügig bergan!' },
      ],
    });
    state.persist();
  }

  private interactPyramid(): void {
    if (state.chapter === 5 && state.quest === 5) {
      if (state.count('kalkstein') <= 0) {
        state.emit('toast', 'Bringe einen polierten Tura-Kalksteinquader als Deckstein mit!');
        return;
      }
      state.add('kalkstein', -1);
      state.bump('pyramidion_delivered', 1);
      sfx.fanfare();
      state.openDialog({
        speaker: 'Horizont des Cheops – Große Pyramide',
        nodes: [
          { text: '🔺 <strong>Der Schlussstein ist gesetzt!</strong>\n\nDas vergoldete Pyramidion glänzt im Morgenlicht auf 146 Metern Höhe. Über 2,3 Millionen Blöcke stehen in geometrischer Vollkommenheit!' },
          { text: 'Ein ewiges Monument des Pharao und der Baukunst freier Menschen.' },
        ],
      });
      state.persist();
      return;
    }
    state.openDialog({
      speaker: 'Die Große Pyramide von Gizeh',
      nodes: [
        { text: 'Erbaut für Pharao Cheops (ca. 2.550 v. Chr.). Mit 146 Metern Höhe für fast vier Jahrtausende das höchste Bauwerk der Erde.' },
      ],
    });
  }

  private interactSphinx(): void {
    if (state.chapter === 5 && state.quest === 6) {
      state.bump('sphinx_visited', 1);
      sfx.quest();
      state.openDialog({
        speaker: 'Die Große Sphinx von Gizeh',
        nodes: [
          { text: '🦁 Du trittst vor die 73 Meter lange Kolossalstatue mit dem Körper eines Löwen und dem Antlitz des Pharao Chephren.' },
          { text: 'Ihre Achse muss exakt gen Osten ausgerichtet sein, damit ihr Blick am Tag der Tagundnachtgleiche die aufgehende Morgensonne trifft!' },
        ],
      });
      state.persist();
      return;
    }
    if (state.chapter === 5 && state.quest === 7) {
      state.bump('sphinx_aligned', 1);
      sfx.fanfare();
      state.openDialog({
        speaker: 'Die Große Sphinx von Gizeh',
        nodes: [
          { text: '☀️ <strong>Ausrichtung vollendet!</strong>\n\nDer steinerne Wächter blickt nun exakt 90° gen Osten. Er hütet die Königsgräber und trotzt den Sandstürmen der Jahrtausende.' },
        ],
      });
      state.persist();
      return;
    }
    state.openDialog({
      speaker: 'Die Große Sphinx von Gizeh',
      nodes: [
        { text: '„Wächter des Horizonts“ – Halb Mensch, halb Löwe schützt die Sphinx die heilige Nekropole von Gizeh.' },
      ],
    });
  }

  private interactCargoBarge(): void {
    if (state.chapter === 6 && state.quest === 5) {
      if (state.count('getreidesack') < 3) {
        state.emit('toast', `Du hast erst ${state.count('getreidesack')}/3 Getreidesäcke! Schnüre weitere im Handwerksmenü (Taste C).`);
        return;
      }
      state.add('getreidesack', -3);
      state.bump('barge_loaded', 1);
      sfx.fanfare();
      state.openDialog({
        speaker: 'Nilhafen – Römische Frachtbarke',
        nodes: [
          { text: '⛵ <strong>Die Frachtbarke ist beladen!</strong>\n\nDrei prall gefüllte, königlich versiegelte Getreidesäcke lagern im Schiffsbauch.' },
          { text: 'Der Nilhafen verbindet Ägypten über Alexandria mit Rom. Sprich nun mit dem römischen Gesandten am Hafenpier!' },
        ],
      });
      state.persist();
      return;
    }
    state.openDialog({
      speaker: 'Große Nil-Frachtbarke',
      nodes: [
        { text: 'Diese schweren Holzschiffe transportieren Getreide, Steine und Weihrauch nilabwärts bis ans Mittelmeer.' },
      ],
    });
  }

  private interactRomanEnvoy(): void {
    if (state.chapter === 6 && state.quest === 6) {
      state.bump('treaty_signed', 1);
      sfx.quest();
      state.openDialog({
        speaker: 'Senator Cornelius – Gesandter aus Rom',
        nodes: [
          { text: 'Ave, hoher Baumeister! Der Senat und Kaiser Augustus danken für die pünktliche Getreidelieferung aus Alexandria.' },
          { text: '„Ohne das ägyptische Korn würde die Millionenstadt Rom verhungern.“ Ägypten ist wahrlich die unersetzliche Kornkammer unseres Reiches!' },
          { text: 'Der Vertrag ist besiegelt! Tritt nun vor Hafenmeister Baki, um deine meisterhafte Krönungsurkunde zu empfangen!' },
        ],
      });
      state.persist();
      return;
    }
    state.openDialog({
      speaker: 'Senator Cornelius – Gesandter aus Rom',
      nodes: [
        { text: 'Rom blickt mit Ehrfurcht auf die Jahrtausende alte Kultur am Nil. Möge der Handel zwischen Kemet und Rom ewig blühen!' },
      ],
    });
  }

  private interactCedarTrader(): void {
    if (state.chapter === 6 && state.quest === 2) {
      if (state.count('leinen') <= 0) {
        state.openDialog({
          speaker: 'Phönizischer Fernhändler aus Byblos',
          nodes: [
            { text: 'Salam! Unsere Schiffe brachten duftendes Zedernholz aus den Bergen des Libanon.' },
            { text: 'Wir tauschen 1 Ballen feines weißes ägyptisches Leinen gegen 2 Stämme Zedernholz!' },
          ],
        });
        return;
      }
      state.add('leinen', -1);
      state.add('zedernholz', 2);
      state.bump('trade_zedernholz', 1);
      sfx.craft();
      state.openDialog({
        speaker: 'Phönizischer Fernhändler aus Byblos',
        nodes: [
          { text: '🤝 <strong>Handel besiegelt!</strong>\n\n+2 Libanon-Zedernholz erhalten! Zedernholz ist harzreich und fault im Nilwasser nicht – unentbehrlich für die königliche Flotte.' },
        ],
      });
      state.persist();
      return;
    }
    state.openDialog({
      speaker: 'Phönizischer Fernhändler',
      nodes: [
        { text: 'Wir handeln mit Zedernholz, Purpur und Kupfer aus Byblos und Tyros.' },
      ],
    });
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

    if (q === 9 || state.isReadyForQuiz()) {
      state.openDialog({
        speaker: 'Feldhüter Ameni – Wissensprüfung',
        nodes: ch.quiz as any,
        onDone: () => {
          state.quest = ch.quests.length;
          state.unlockLexicon('schaduf');
          state.unlockLexicon('emmer');
          state.unlockLexicon('nilschwemme');
          state.persist();
          state.emit('chapterDone', 2);

          state.openDialog({
            speaker: 'Feldhüter Ameni – Kapitel 2 gemeistert!',
            nodes: [
              { text: '🎉 <strong>Ausgezeichnet!</strong> Du verstehst die Geheimnisse der Nilschwemme und die Hebelkraft des Schadufs.' },
              { text: 'Die Dörfer wachsen zu Städten heran. Nun ruft dich der königliche Hof: <strong>Wesir Nefermaat</strong> benötigt sonnengetrocknete Lehmziegel und Kornspeicher für die Vorräte des Reiches!' },
              { text: 'Bist du bereit für <strong>Kapitel 3: Der Pharao, sein Wesir & der Kornspeicher</strong>? Weiter geht\'s!' },
            ],
            onDone: () => {
              state.startChapter(3);
              state.emit('toast', 'Kapitel 3 hat begonnen! Begib dich zu Wesir Nefermaat.');
            },
          });
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
          state.quest = ch.quests.length;
          state.unlockLexicon('kemet');
          state.unlockLexicon('deschret');
          state.unlockLexicon('nil');
          state.persist();
          state.emit('chapterDone', 1);

          state.openDialog({
            speaker: 'Fischer Senbi – Kapitel 1 gemeistert!',
            nodes: [
              { text: '🎉 <strong>Ausgezeichnet!</strong> Du hast die Wissensprüfung von Kapitel 1 mit Bravour bestanden!' },
              { text: 'Aus einfachen Schilffischern werden nun sesshafte Bauern: Weiter nördlich wartet <strong>Feldhüter Ameni</strong> auf dich. Er zeigt dir das Geheimnis der künstlichen Bewässerung mit dem <strong>Schaduf</strong>!' },
              { text: 'Bist du bereit für <strong>Kapitel 2: Die Nilschwemme & das Wunder des Schadufs</strong>? Auf geht\'s zum nächsten Zeitalter!' },
            ],
            onDone: () => {
              state.startChapter(2);
              state.emit('toast', 'Kapitel 2 hat begonnen! Begib dich nach Norden zu Feldhüter Ameni.');
            },
          });
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

  private interactNefermaat(): void {
    const ch = state.chapters[3];
    const q = state.quest;

    if (state.chapter < 3) {
      state.openDialog({
        speaker: 'Wesir Nefermaat',
        nodes: [{ text: 'Der Hof des Gottkönigs empfängt nur erfahrene Baumeister. Meistere erst Feldhüter Amenis Aufgaben in Kapitel 2!' }],
      });
      return;
    }

    if (state.chapter > 3) {
      state.openDialog({
        speaker: 'Wesir Nefermaat',
        nodes: [{ text: 'Die königlichen Speicher sind gefüllt mit Emmer und Bier. Dein Dienst für die Staatsverwaltung bleibt unvergessen!' }],
      });
      return;
    }

    if (q === 0) {
      state.openDialog({
        speaker: 'Wesir Nefermaat',
        nodes: [
          { text: 'Sei gegrüßt im Namen des Pharao! Ein Staat entsteht nicht von allein: Tausende Menschen müssen ernährt, Deiche gepflegt und Vorräte gelagert werden.' },
          { text: 'Als oberster Wesir organisiere ich die Arbeit. Wir brauchen sonnengetrocknete Ziegel für Kornspeicher und frisches Brot für unsere Arbeiter!' },
          { text: 'Grabe zuerst fruchtbaren dunklen Nilschlamm am Flussufer aus (Taste E).' },
        ],
        onDone: () => {
          state.quest = 1;
          state.persist();
        },
      });
      return;
    }

    if (q === 8 || state.isReadyForQuiz()) {
      state.openDialog({
        speaker: 'Wesir Nefermaat – Wissensprüfung',
        nodes: ch.quiz as any,
        onDone: () => {
          state.quest = ch.quests.length;
          state.unlockLexicon('pharao');
          state.unlockLexicon('wesir');
          state.unlockLexicon('hochkultur');
          state.persist();
          state.emit('chapterDone', 3);

          state.openDialog({
            speaker: 'Wesir Nefermaat – Kapitel 3 gemeistert!',
            nodes: [
              { text: '🎉 <strong>Ausgezeichnete Staatsarbeit!</strong> Die Vorratsverwaltung und der Städtebau stehen auf sicherem Fundament.' },
              { text: 'Doch ein Reich ohne Schrift kann keine Steuern und Gesetze festhalten! Im Haus des Lebens wartet <strong>Ober-Schreiber Ani</strong> auf dich.' },
              { text: 'Bist du bereit für <strong>Kapitel 4: Das Haus der Schreiber & das Pantheon der Götter</strong>? Lass uns aufbrechen!' },
            ],
            onDone: () => {
              state.startChapter(4);
              state.emit('toast', 'Kapitel 4 hat begonnen! Begib dich zu Ober-Schreiber Ani.');
            },
          });
        },
      });
      return;
    }

    if (state.isChapterComplete()) {
      state.openDialog({
        speaker: 'Wesir Nefermaat',
        nodes: [{ text: 'Bist du bereit für Kapitel 4: Das Haus der Schreiber & die Götter? Weiter geht\'s!' }],
        onDone: () => state.startChapter(4),
      });
      return;
    }

    const curHint = ch.hints[q] || ch.quests[q] || 'Erfülle deine Aufgaben für den Wesir!';
    state.openDialog({
      speaker: 'Wesir Nefermaat',
      nodes: [
        { text: `Deine aktuelle Aufgabe:\n${ch.quests[q]}` },
        { text: `Tipp:\n${curHint}` },
      ],
    });
  }

  private interactAni(): void {
    const ch = state.chapters[4];
    const q = state.quest;

    if (state.chapter < 4) {
      state.openDialog({
        speaker: 'Ober-Schreiber Ani',
        nodes: [{ text: 'Die heiligen Zeichen (Medu Netjer) erfordern Disziplin und Weisheit. Meistere erst Wesir Nefermaats Aufgaben in Kapitel 3!' }],
      });
      return;
    }

    if (state.chapter > 4) {
      state.openDialog({
        speaker: 'Ober-Schreiber Ani',
        nodes: [{ text: 'Deine Hieroglyphen und Totenbuch-Rollen ehren Gott Thot! Das Haus des Lebens steht dir immer offen.' }],
      });
      return;
    }

    if (q === 0) {
      state.openDialog({
        speaker: 'Ober-Schreiber Ani',
        nodes: [
          { text: 'Sei willkommen im Haus des Lebens! „Wer schreibt, der bleibt“ – Schreiber sind die angesehensten Männer Ägyptens.' },
          { text: 'Wir zeichnen heilige Hieroglyphen, berechnen Steuern und bewahren das Totenbuch für das Gericht des Osiris.' },
          { text: 'Errichte zuerst das Schreiberhaus (Haus des Lebens) am Bauplatz (drücke E).' },
        ],
        onDone: () => {
          state.quest = 1;
          state.persist();
        },
      });
      return;
    }

    if (q === 8 || state.isReadyForQuiz()) {
      state.openDialog({
        speaker: 'Ober-Schreiber Ani – Wissensprüfung',
        nodes: ch.quiz as any,
        onDone: () => {
          state.quest = ch.quests.length;
          state.unlockLexicon('schreiber');
          state.unlockLexicon('hieroglyphen');
          state.unlockLexicon('polytheismus');
          state.unlockLexicon('mumifizierung');
          state.persist();
          state.emit('chapterDone', 4);

          state.openDialog({
            speaker: 'Ober-Schreiber Ani – Kapitel 4 gemeistert!',
            nodes: [
              { text: '🎉 <strong>Meisterhaft!</strong> Du beherrschst die heiligen Schriftzeichen und die Geheimnisse des Jenseits.' },
              { text: 'Nun ruft dich die größte Baustelle der Menschheitsgeschichte: Am westlichen Wüstenplateau leitet <strong>Königlicher Baumeister Hemiunu</strong> den Bau der Großen Pyramide!' },
              { text: 'Bist du bereit für <strong>Kapitel 5: Die Baumeister von Gizeh – Pyramiden für die Ewigkeit</strong>?' },
            ],
            onDone: () => {
              state.startChapter(5);
              state.emit('toast', 'Kapitel 5 hat begonnen! Begib dich zu Baumeister Hemiunu am Wüstenhang.');
            },
          });
        },
      });
      return;
    }

    if (state.isChapterComplete()) {
      state.openDialog({
        speaker: 'Ober-Schreiber Ani',
        nodes: [{ text: 'Bist du bereit für Kapitel 5: Die Pyramiden von Gizeh? Auf geht\'s zur Baustelle!' }],
        onDone: () => state.startChapter(5),
      });
      return;
    }

    const curHint = ch.hints[q] || ch.quests[q] || 'Erfülle deine Aufgaben im Haus des Lebens!';
    state.openDialog({
      speaker: 'Ober-Schreiber Ani',
      nodes: [
        { text: `Deine aktuelle Aufgabe:\n${ch.quests[q]}` },
        { text: `Tipp:\n${curHint}` },
      ],
    });
  }

  private interactHemiunu(): void {
    const ch = state.chapters[5];
    const q = state.quest;

    if (state.chapter < 5) {
      state.openDialog({
        speaker: 'Baumeister Hemiunu',
        nodes: [{ text: 'Die Großbaustelle der Ewigkeit duldet nur eingeweihte Gelehrte. Meistere erst Kapitel 4 bei Schreiber Ani!' }],
      });
      return;
    }

    if (state.chapter > 5) {
      state.openDialog({
        speaker: 'Baumeister Hemiunu',
        nodes: [{ text: 'Die Große Pyramide und die Sphinx überdauern Jahrtausende! Ein Triumph der menschlichen Schöpferkraft.' }],
      });
      return;
    }

    if (q === 0) {
      state.openDialog({
        speaker: 'Baumeister Hemiunu',
        nodes: [
          { text: 'Tritt heran an den Horizont des Cheops! Ich bin Hemiunu, oberster Baumeister des Königs.' },
          { text: 'Über 2,3 Millionen Kalksteinblöcke, jeder 2,5 Tonnen schwer, fügen wir hier empor – erbaut von freien Bauern und Steinmetzen während der Flutzeit!' },
          { text: 'Errichte zuerst die Bauhütte und Werkstatt am Fuße des Plateaus (drücke E am Bauplatz).' },
        ],
        onDone: () => {
          state.quest = 1;
          state.persist();
        },
      });
      return;
    }

    if (q === 8 || state.isReadyForQuiz()) {
      state.openDialog({
        speaker: 'Baumeister Hemiunu – Wissensprüfung',
        nodes: ch.quiz as any,
        onDone: () => {
          state.quest = ch.quests.length;
          state.unlockLexicon('pyramiden');
          state.unlockLexicon('sphinx');
          state.unlockLexicon('steinmetze');
          state.persist();
          state.emit('chapterDone', 5);

          state.openDialog({
            speaker: 'Baumeister Hemiunu – Kapitel 5 gemeistert!',
            nodes: [
              { text: '🎉 <strong>Unvergänglich!</strong> Die Pyramide von Gizeh und die Große Sphinx stehen vollendet im Sonnenlicht!' },
              { text: 'Das Reich erblüht zu ungekanntem Reichtum. Am Nilhafen bereitet <strong>Hafenmeister Baki</strong> die großen Handelsbarken für Expeditionen nach Punt und in den Libanon vor.' },
              { text: 'Bist du bereit für das große Finale: <strong>Kapitel 6: Der Hafen des Pharao & der Schatz des Tutanchamun</strong>?' },
            ],
            onDone: () => {
              state.startChapter(6);
              state.emit('toast', 'Kapitel 6 hat begonnen! Begib dich nach Süden zum Hafen.');
            },
          });
        },
      });
      return;
    }

    if (state.isChapterComplete()) {
      state.openDialog({
        speaker: 'Baumeister Hemiunu',
        nodes: [{ text: 'Bist du bereit für Kapitel 6: Der Hafen des Pharao? Weiter geht\'s zum Nilhafen!' }],
        onDone: () => state.startChapter(6),
      });
      return;
    }

    const curHint = ch.hints[q] || ch.quests[q] || 'Erfülle deine Aufgaben auf der Großbaustelle!';
    state.openDialog({
      speaker: 'Baumeister Hemiunu',
      nodes: [
        { text: `Deine aktuelle Aufgabe:\n${ch.quests[q]}` },
        { text: `Tipp:\n${curHint}` },
      ],
    });
  }

  private interactBaki(): void {
    const ch = state.chapters[6];
    const q = state.quest;

    if (state.chapter < 6) {
      state.openDialog({
        speaker: 'Hafenmeister Baki',
        nodes: [{ text: 'Die Hochsee-Expeditionen laufen erst an, wenn die großen Monumente stehen. Meistere zuerst Kapitel 5 bei Baumeister Hemiunu!' }],
      });
      return;
    }

    if (q === 0) {
      state.openDialog({
        speaker: 'Hafenmeister Baki',
        nodes: [
          { text: 'Willkommen am Nilhafen von Kemet! Unsere Schiffe segeln nilaufwärts nach Nubien für Gold und über das Meer nach Byblos für Zedernholz.' },
          { text: 'Im reinen Tauschhandel sichern wir dem Reich Weihrauch, Metalle und Kunstschätze.' },
          { text: 'Beginne damit, Weihrauchharz aus Punt auf dem Basar einzutauschen (Taste H).' },
        ],
        onDone: () => {
          state.quest = 1;
          state.persist();
        },
      });
      return;
    }

    if (q === 7 || state.isReadyForQuiz()) {
      state.openDialog({
        speaker: 'Hafenmeister Baki – Abschluss-Prüfung',
        nodes: ch.quiz as any,
        onDone: () => {
          state.quest = ch.quests.length;
          state.unlockLexicon('handelsreisen');
          state.unlockLexicon('kleopatra');
          state.unlockLexicon('kornkammer_roms');
          state.unlockLexicon('stein_von_rosetta');
          state.persist();
          state.emit('chapterDone', 6);

          state.openDialog({
            speaker: 'Hafenmeister Baki – Vollendung der Hochkultur!',
            nodes: [
              { text: '🏆 <strong>Glorreich vollbracht!</strong> Du hast alle 6 Epochen des Alten Ägypten gemeistert – von den ersten Schilffischern bis zur Weltmacht am Nil!' },
              { text: 'Dein Name wird nun für alle Zeiten in die königlichen Annalen gemeißelt.' },
              { text: 'Hier ist deine offizielle <strong>Königliche Pharaonen-Meister-Urkunde</strong> der Heimbürgeschule Kahla!' },
            ],
            onDone: () => {
              state.emit('openCertificate');
            },
          });
        },
      });
      return;
    }

    if (state.isChapterComplete()) {
      state.openDialog({
        speaker: 'Hafenmeister Baki',
        nodes: [
          { text: 'Du hast alle sechs Zeitalter gemeistert! Schau dir jederzeit deine Meister-Urkunde an (Taste U).' },
        ],
        onDone: () => {
          state.emit('openCertificate');
        },
      });
      return;
    }

    const curHint = ch.hints[q] || ch.quests[q] || 'Erfülle deine Aufgaben am Hafen!';
    state.openDialog({
      speaker: 'Hafenmeister Baki',
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
    } else if (p.stage === 'seeded') {
      if (state.count('wasser') <= 0) {
        state.emit('toast', 'Schöpfe erst Nilwasser am Schaduf oder Ufer!');
        return;
      }
      state.add('wasser', -1);
      p.stage = 'watered';
      p.wateredAt = Date.now();
      this.refreshPlotVisual(n);
      sfx.craft();
      state.bump('watered_plot', 1);
      state.emit('toast', 'Feld mit geschöpftem Nilwasser getränkt!');
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
    }
    state.persist();
  }

  private interactBuilding(n: Node): void {
    const b = n.buildingDef;
    if (!b) return;
    if (state.hasBuilding(b.id)) {
      if (b.id === 'schaduf') {
        state.add('wasser', 1);
        state.bump('schaduf_water', 1);
        sfx.pickup();
        state.emit('toast', '+1 Krug frisches Nilwasser geschöpft!');
        state.persist();
      } else if (b.id === 'speicher' && state.chapter === 4 && state.quest === 4) {
        if (state.count('papyrusrolle') > 0 && state.count('pinsel_tinte') > 0) {
          state.bump('tax_recorded', 1);
          sfx.craft();
          state.openDialog({
            speaker: 'Königlicher Kornspeicher – Steuerliste',
            nodes: [
              { text: '📜 <strong>Steuererhebung festgehalten!</strong>\n\nMit Rußtinte und Binsenpinsel notierst du auf Papyrus:\n„100 Scheffel Emmer, 40 Krüge Henket-Bier, 12 Rinder.“\n\nDie staatliche Buchführung sichert die Versorgung aller Arbeiter!' },
            ],
          });
          state.persist();
        } else {
          state.openDialog({
            speaker: 'Königlicher Kornspeicher',
            nodes: [
              { text: 'Um die Getreidesteuern aufzuzeichnen, benötigst du eine Papyrusrolle und ein Binsenpinsel-Schreibset (Taste C im Handwerk)!' },
            ],
          });
        }
      } else {
        state.emit('toast', `Hier steht bereits: ${b.name}`);
      }
      return;
    }

    if (!state.canAffordBuilding(b)) {
      const costStr = Object.entries(state.getBuildingCost(b)).map(([id, num]) => `${num}× ${id}`).join(', ');
      state.openDialog({
        speaker: `Bauplatz: ${b.name}`,
        nodes: [{ text: `${b.desc}\n\nBenötigte Baumaterialien:\n${costStr}` }],
      });
      return;
    }

    state.build(b);
    this.renderBuiltEgyptBuilding(n);
    state.emit('toast', `Errichtet: ${b.name}!`);
    state.persist();
  }

  private onCraft(): void {
    this.persist();
  }

  private updateCompass(): void {
    const ch = state.chapter;
    const q = state.quest;
    const chDef = state.currentChapterDef;

    if (q === 0 || state.isReadyForQuiz() || state.isChapterComplete()) {
      const mentorKinds: Record<number, Kind> = {
        1: 'egypt_senbi',
        2: 'egypt_ameni',
        3: 'egypt_nefermaat',
        4: 'egypt_ani',
        5: 'egypt_hemiunu',
        6: 'egypt_baki',
      };
      const mentorKind = mentorKinds[ch] || 'egypt_senbi';
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
      else if (q === 5 || q === 6) this.setCompassTargetByKind('plot', 'Ackerbeete');
      else if (q === 7) this.setCompassTargetByKind('egypt_palm', 'Dattelpalme');
      else if (q === 8) this.setCompassTargetByKind('plot', 'Reifes Emmerfeld');
      else this.setCompassTargetByKind('egypt_ameni', 'Feldhüter Ameni');
    } else if (ch === 3) {
      if (q === 1) this.setCompassTargetByKind('egypt_mud', 'Fruchtbarer Nilschlamm am Flussufer');
      else if (q === 2) this.setCompassTargetByBuilding('ziegelei', 'Bauplatz Königliche Lehmziegelei');
      else if (q === 3) state.compassText = '🔨 Drücke C -> 3× Lehmziegel streichen!';
      else if (q === 4) this.setCompassTargetByBuilding('speicher', 'Bauplatz Königlicher Kornspeicher');
      else if (q === 5) state.compassText = '🔨 Drücke C -> Vorratstopf brennen!';
      else if (q === 6) state.compassText = '🔨 Drücke C -> Feines Leinentuch weben!';
      else if (q === 7) state.compassText = '🔨 Drücke C -> 2× Brot & 1× Bier herstellen!';
      else this.setCompassTargetByKind('egypt_nefermaat', 'Wesir Nefermaat');
    } else if (ch === 4) {
      if (q === 1) this.setCompassTargetByBuilding('schreiberhaus', 'Bauplatz Haus des Lebens');
      else if (q === 2) state.compassText = '🔨 Drücke C -> Papyrusrolle pressen!';
      else if (q === 3) state.compassText = '🔨 Drücke C -> Binsenpinsel & Tinte herstellen!';
      else if (q === 4) this.setCompassTargetByBuilding('speicher', 'Kornspeicher (Steuerliste notieren)');
      else if (q === 5) this.setCompassTargetByBuilding('wabet', 'Bauplatz Balsamierungswerkstatt');
      else if (q === 6) state.compassText = '🏺 Basar (Taste H) -> Salz tauschen & Kanope meißeln (C)!';
      else if (q === 7) state.compassText = '🔨 Drücke C -> Herz-Skarabäus formen!';
      else this.setCompassTargetByKind('egypt_ani', 'Ober-Schreiber Ani');
    } else if (ch === 5) {
      if (q === 1) this.setCompassTargetByBuilding('steinmetz', 'Bauplatz Bauhütte der Großbaustelle');
      else if (q === 2) this.setCompassTargetByKind('egypt_quarry', 'Tura-Kalksteinbruch');
      else if (q === 3) this.setCompassTargetByKind('egypt_timber', 'Bauholz & Akazien');
      else if (q === 4) this.setCompassTargetByKind('egypt_sledge_ramp', 'Baustellenrampe (mit Schlammwasser befeuchten)');
      else if (q === 5) this.setCompassTargetByKind('egypt_pyramid', 'Große Cheops-Pyramide (Deckstein setzen)');
      else if (q === 6 || q === 7) this.setCompassTargetByKind('egypt_sphinx', 'Große Sphinx von Gizeh');
      else this.setCompassTargetByKind('egypt_hemiunu', 'Baumeister Hemiunu');
    } else if (ch === 6) {
      if (q === 1) state.compassText = '🏺 Öffne Basar (Taste H) -> Punt-Weihrauch ertauschen!';
      else if (q === 2) this.setCompassTargetByKind('egypt_cedar_trader', 'Phönizischer Holzhändler am Hafen');
      else if (q === 3) state.compassText = '🔨 Drücke C -> Goldene Totenmaske schmieden!';
      else if (q === 4) state.compassText = '🔨 Drücke C -> 3× Getreidesäcke schnüren!';
      else if (q === 5) this.setCompassTargetByKind('egypt_cargo_barge', 'Römische Frachtbarke am Hafen');
      else if (q === 6) this.setCompassTargetByKind('egypt_roman_envoy', 'Gesandter aus Rom');
      else this.setCompassTargetByKind('egypt_baki', 'Hafenmeister Baki');
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
