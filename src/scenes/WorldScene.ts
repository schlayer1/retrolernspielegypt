import Phaser from 'phaser';
import { sfx } from '../audio/sound';
import { EgyptBuildingDef, EgyptItemId } from '../data/items';
import { CROP_MS, DAY_MS, state } from '../systems/GameState';

const TILE = 16;
const MAP_W = 50; // 800 px
const MAP_H = 36; // 576 px
const SPEED = 95;
const REACH = 42;
const REGROW_MS = 22_000;
const LABEL_PROXIMITY_PX = 58;

/** Der Nil fließt im Osten der Karte von Süd nach Nord (Spalten 38..49). */
const NILE = { x: 38, y: 0, w: 12, h: MAP_H };

type Kind =
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
  | 'egypt_palm'
  | 'egypt_fish_spot'
  | 'egypt_campfire'
  | 'plot'
  | 'build_site'
  | 'egypt_mud'
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
  | 'egypt_bazaar_stall'
  | 'egypt_relic_skanabaeus'
  | 'egypt_relic_kanope'
  | 'egypt_relic_papyrusrolle'
  | 'egypt_relic_goldmaske'
  | 'egypt_relic_pinsel_tinte';

interface DomLabel {
  x: number;
  y: number;
  el: HTMLElement;
  alwaysVisible?: boolean;
  isQuestTarget?: boolean;
  setText(t: string): DomLabel;
  setColor(c: string): DomLabel;
  setY(ny: number): DomLabel;
  setPosition(nx: number, ny: number): DomLabel;
}

interface Node {
  kind: Kind;
  sprite: Phaser.GameObjects.Sprite;
  label?: DomLabel;
  readyAt: number;
  plotId?: number;
  buildingDef?: EgyptBuildingDef;
  cropSprite?: Phaser.GameObjects.Image;
  builtSprite?: Phaser.GameObjects.Image;
}

interface LightGlow {
  circle: Phaser.GameObjects.Arc;
  baseAlpha: number;
  phase: number;
}

export class WorldScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private facing: 'down' | 'up' | 'left' | 'right' = 'down';
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
    E: Phaser.Input.Keyboard.Key;
    SPACE: Phaser.Input.Keyboard.Key;
  };
  private obstacles!: Phaser.Physics.Arcade.StaticGroup;
  private nodes: Node[] = [];
  private domLabels: DomLabel[] = [];
  private labelLayer!: HTMLElement;
  private nightOverlay!: Phaser.GameObjects.Rectangle;
  private lightGlows: LightGlow[] = [];
  private waterShimmers: Phaser.GameObjects.Rectangle[] = [];
  private wanderingAnimals: {
    sprite: Phaser.GameObjects.Sprite;
    homeX: number;
    homeY: number;
    vx: number;
    vy: number;
    timer: number;
    walkAnim: string;
    idleAnim: string;
  }[] = [];
  private saveTimer = 0;
  private sleeping = false;
  private playerLabel?: DomLabel;

  constructor() {
    super('World');
  }

  create(): void {
    this.nodes = [];
    this.domLabels = [];
    this.lightGlows = [];
    this.waterShimmers = [];
    this.wanderingAnimals = [];
    this.sleeping = false;

    const existingLayer = document.getElementById('world-labels');
    this.labelLayer = existingLayer ?? document.createElement('div');
    this.labelLayer.id = 'world-labels';
    if (!existingLayer) document.body.appendChild(this.labelLayer);
    this.labelLayer.innerHTML = '';

    const saved = state.saves.load();
    if (saved) state.loadFrom(saved);

    this.obstacles = this.physics.add.staticGroup();

    // 1. Authentischer 16-Bit-Wüsten-, Kemet-, Kanal-, Palast- und Nil-Boden
    this.buildEgyptGround();

    // 2. Natur, Siedlung, Tempel, Basar & Monumente
    this.scatterEgyptNature();

    // 3. Rohstoffe (Schilf, Akazienäste, Wüstenkiesel, Nilschlamm)
    this.placeEgyptResources();

    // 4. Gebäude- & Mentorenplätze
    this.placeEgyptBuildingsAndNPCs();

    // 5. Antike Relikte & Sakrale Schätze
    this.placeEgyptRelics();

    // 6. Spieler-Spawn
    const startX = state.playerX || 490;
    const startY = state.playerY || 350;
    const texKey = state.playerGender === 'female' ? 'player_egypt_female' : 'player_egypt_male';

    this.player = this.physics.add.sprite(startX, startY, texKey, 0);
    this.player.body!.setSize(8, 6).setOffset(4, 24);
    this.player.setCollideWorldBounds(true);
    this.physics.world.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE);
    this.physics.add.collider(this.player, this.obstacles);
    this.playerLabel = this.addLabel(startX, startY - 22, state.playerName, '#fde047', true);

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
    state.on('relicFound', this.onRelicFound, this);

    this.events.once('shutdown', () => {
      state.off('craft', this.onCraft, this);
      state.off('chapterChanged', this.onChapterChanged, this);
      state.off('profileChanged', this.onProfileChanged, this);
      state.off('relicFound', this.onRelicFound, this);
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
    this.scene.restart();
  }

  private onRelicFound(relicId: string): void {
    const kindMap: Record<string, Kind> = {
      skanabaeus: 'egypt_relic_skanabaeus',
      kanope: 'egypt_relic_kanope',
      papyrusrolle: 'egypt_relic_papyrusrolle',
      goldmaske: 'egypt_relic_goldmaske',
      pinsel_tinte: 'egypt_relic_pinsel_tinte',
    };
    const targetKind = kindMap[relicId];
    if (!targetKind) return;
    const n = this.nodes.find((item) => item.kind === targetKind);
    if (n) {
      n.sprite.setVisible(false);
      if (n.label) n.label.el.style.display = 'none';
    }
  }

  // ---------------------------------------------------------------- Weltaufbau & Themenböden
  private buildEgyptGround(): void {
    const rt = this.add.renderTexture(0, 0, MAP_W * TILE, MAP_H * TILE).setOrigin(0).setDepth(0);

    const bayer4 = [
      [0, 8, 2, 10],
      [12, 4, 14, 6],
      [3, 11, 1, 9],
      [15, 7, 13, 5],
    ];

    const distToSeg = (px: number, py: number, x1: number, y1: number, x2: number, y2: number): number => {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const l2 = dx * dx + dy * dy;
      if (l2 === 0) return Math.hypot(px - x1, py - y1);
      const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2));
      return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
    };

    for (let ty = 0; ty < MAP_H; ty++) {
      // Organisch geschwungene Uferlinien statt starrer vertikaler Spalten
      const siltBorder = 27.2 + Math.sin(ty * 0.24) * 1.45 + Math.cos(ty * 0.52) * 0.55;
      const nileBorder = 37.1 + Math.sin(ty * 0.19 + 1.1) * 0.95 + Math.cos(ty * 0.43) * 0.35;

      for (let tx = 0; tx < MAP_W; tx++) {
        const px = tx * TILE;
        const py = ty * TILE;
        const bayerVal = bayer4[ty % 4][tx % 4] / 16;

        // A. Der mächtige Nil (Iteru) mit sanfter Uferkante
        if (tx > nileBorder + 0.45) {
          const waterR = (tx * 3 + ty * 7) % 12;
          const waterFrame = waterR === 0 || tx < nileBorder + 1.3 ? 'water_shallow' : 'water_deep';
          rt.drawFrame('desert_tileset', waterFrame, px, py);
          continue;
        }

        if (Math.abs(tx - nileBorder) <= 0.65) {
          rt.drawFrame('desert_tileset', 'shore_w', px, py);
          continue;
        }

        // B. Übergangszone & Fruchtbares Nilufer (Kemet vs. Deschret mit 4x4 Bayer-Dithering)
        const siltDelta = tx - siltBorder;
        const isKemet = siltDelta > 1.35 || (siltDelta > -1.35 && (siltDelta + 1.35) / 2.7 > bayerVal);

        if (isKemet) {
          if (Math.abs(siltDelta) < 0.55 && (tx + ty) % 2 === 0) {
            rt.drawFrame('desert_tileset', 'silt_transition_w', px, py);
          } else {
            const siltR = (tx * 5 + ty * 9) % 10;
            const siltFrame = siltR < 6 ? 'silt_dark' : siltR < 9 ? 'silt_patch' : 'silt_rich';
            rt.drawFrame('desert_tileset', siltFrame, px, py);
          }
        } else {
          // Westliches Wüstengebiet (Deschret) mit organischen Karawanenpfaden
          const dPath1 = distToSeg(tx, ty, 31, 20, 22, 11); // Nilufer -> Wesirpalast -> Gizeh
          const dPath2 = distToSeg(tx, ty, 22, 11, 8, 9);   // Wesir -> Pyramidenplateau
          const dPath3 = distToSeg(tx, ty, 31, 21, 14, 22); // Nilufer -> Tempelbezirk & Oase
          const dPath = Math.min(dPath1, dPath2, dPath3);

          const r = (tx * 7 + ty * 13) % 100;
          let sandFrame = 'sand_1';
          if (dPath < 1.35 && bayerVal < 0.75) {
            sandFrame = (tx + ty) % 2 === 0 ? 'sand_ripples' : 'sand_2';
          } else if (r < 42) {
            sandFrame = 'sand_1';
          } else if (r < 76) {
            sandFrame = 'sand_2';
          } else if (r < 88) {
            sandFrame = 'sand_dune_1';
          } else if (r < 95) {
            sandFrame = 'sand_dune_2';
          } else {
            sandFrame = 'sand_ripples';
          }

          rt.drawFrame('desert_tileset', sandFrame, px, py);

          // Dezente Kiesel- und Steinstreuung in der freien Wüste & an Pfadrändern
          if (((tx * 11 + ty * 17) % 33 === 0 || (Math.abs(dPath - 1.5) < 0.35 && (tx + ty) % 5 === 0)) && tx > 2 && ty > 4) {
            const rockDeco = (tx + ty) % 2 === 0 ? 'pebbles' : 'stone_flat';
            rt.drawFrame('desert_tileset', rockDeco, px, py);
          }
        }
      }
    }

    // D. Natürliche Wüstenoase im Südwesten (sorgt für lebendigen Kontrast in der Deschret)
    this.add
      .image(210, 465, 'desert_nature', 'oasis_pool_small')
      .setScale(0.75)
      .setDepth(2);

    // E. Kapitelweise wachsende Themen-Böden (Kanäle, Palasthof, Tempelhof, Baustellenweg, Hafenpier)
    const gFloor = this.add.graphics().setDepth(1);

    // 1) Fischer-Holzsteg am Nilufer (ab Kapitel 1)
    gFloor.fillStyle(0x5c3a21, 1).fillRect(592, 342, 30, 22);
    gFloor.fillStyle(0x8b5a2b, 1).fillRect(594, 344, 26, 18);
    for (let sx = 595; sx < 618; sx += 5) {
      gFloor.fillStyle(0x472b16, 1).fillRect(sx, 344, 1, 18);
    }

    // 2) Gemauerte Bewässerungskanäle entlang der Ackerbeete (ab Kapitel 2)
    if (state.chapter >= 2) {
      // Hauptkanal vom Schaduf (x=548) nach Westen bis zu den Feldern (x=415..515)
      gFloor.fillStyle(0xb59b6d, 1).fillRect(416, 204, 144, 12);
      gFloor.fillStyle(0x0284c7, 1).fillRect(418, 206, 140, 8);
      gFloor.fillStyle(0x38bdf8, 0.65).fillRect(420, 208, 136, 3);
      // Zweigkanal zwischen den Ackerreihen
      gFloor.fillStyle(0xb59b6d, 1).fillRect(514, 206, 10, 68);
      gFloor.fillStyle(0x0284c7, 1).fillRect(516, 208, 6, 64);
      // Kleine Holzbrücke über den Kanal
      gFloor.fillStyle(0x7c4f2b, 1).fillRect(454, 202, 18, 16);
      gFloor.fillStyle(0x9a6538, 1).fillRect(456, 204, 14, 12);
    }

    // 3) Königlicher Sandstein-Palasthof des Wesirs (ab Kapitel 3)
    if (state.chapter >= 3) {
      for (let cx = 316; cx <= 388; cx += 36) {
        for (let cy = 152; cy <= 212; cy += 36) {
          this.add.image(cx, cy, 'city_b01', 'floor_sandstone_1').setScale(0.75).setAlpha(0.88).setDepth(1);
        }
      }
      // Königlicher Läufer-Teppich vor dem Wesir
      this.add.image(360, 202, 'city_b03', 'carpet_royal').setScale(0.6).setDepth(2);
    }

    // 4) Heiliger Tempelbezirk & Haus des Lebens (ab Kapitel 4)
    if (state.chapter >= 4) {
      this.add.image(235, 345, 'city_b01', 'floor_plaza_slab').setScale(0.95).setAlpha(0.85).setDepth(1);
      this.add.image(185, 375, 'city_b01', 'floor_sandstone_2').setScale(0.9).setAlpha(0.82).setDepth(1);
    }

    // 5) Gizeh-Plateau & geschlämmte Transport-Gleitbahn (ab Kapitel 5)
    if (state.chapter >= 5) {
      // Feuchte Lehm-Schlittenrampe vom Steinbruch bis zur Pyramide
      gFloor.fillStyle(0x8c734b, 0.9).fillRect(102, 118, 28, 78);
      gFloor.fillStyle(0x574c3f, 0.85).fillRect(106, 120, 20, 74);
      for (let ry = 122; ry < 192; ry += 6) {
        gFloor.fillStyle(0x78502b, 1).fillRect(105, ry, 22, 2);
      }
    }

    // 6) Gepflasterter Nilhafen & Basarplatz im Süden (ab Kapitel 6)
    if (state.chapter >= 6) {
      for (let bx = 436; bx <= 580; bx += 36) {
        for (let by = 466; by <= 526; by += 36) {
          this.add.image(bx, by, 'city_b01', 'floor_sandstone_3').setScale(0.75).setAlpha(0.85).setDepth(1);
        }
      }
      // Breiter Holzpier für die römische Frachtbarke am Nilufer
      gFloor.fillStyle(0x472b16, 1).fillRect(584, 468, 42, 34);
      gFloor.fillStyle(0x7c4f2b, 1).fillRect(586, 470, 38, 30);
      for (let px = 588; px < 622; px += 6) {
        gFloor.fillStyle(0x3b2311, 1).fillRect(px, 470, 2, 30);
      }
    }

    // Animiertes Nilwasser-Glitzern (erzeugt lebendige Flussbewegung)
    for (let i = 0; i < 18; i++) {
      const wx = 615 + ((i * 37) % 170);
      const wy = 30 + ((i * 53) % 520);
      const shimmer = this.add
        .rectangle(wx, wy, 6, 2, 0xbae6fd, 0.45)
        .setDepth(2);
      this.waterShimmers.push(shimmer);
    }

    // Nil-Kollision (Spieler kann nicht in tiefes Wasser laufen, außer auf Stegen)
    const zoneN = this.add.zone(NILE.x * TILE + 12, 0, NILE.w * TILE, 336).setOrigin(0);
    this.physics.add.existing(zoneN, true);
    this.obstacles.add(zoneN);

    const zoneM = this.add.zone(NILE.x * TILE + 12, 372, NILE.w * TILE, 92).setOrigin(0);
    this.physics.add.existing(zoneM, true);
    this.obstacles.add(zoneM);

    const zoneS = this.add.zone(NILE.x * TILE + 12, 506, NILE.w * TILE, MAP_H * TILE - 506).setOrigin(0);
    this.physics.add.existing(zoneS, true);
    this.obstacles.add(zoneS);
  }

  /**
   * Erzeugt ein 16-Bit-Prop mit einer exakt definierten Fuß-Kollisionsbox,
   * damit keinerlei unsichtbare Sperrzonen um Grafiken entstehen.
   */
  private placeProp(
    x: number,
    y: number,
    tex: string,
    frame?: string | number,
    opts: {
      scale?: number;
      hitW?: number;
      hitH?: number;
      hitOffsetY?: number;
      depthOffset?: number;
    } = {},
  ): Phaser.GameObjects.Image {
    const img = this.add.image(x, y, tex, frame);
    if (opts.scale) img.setScale(opts.scale);
    img.setDepth(y + (opts.depthOffset ?? 0));

    if (opts.hitW && opts.hitH) {
      this.addFootprintZone(x, y + (opts.hitOffsetY ?? 10), opts.hitW, opts.hitH);
    }
    return img;
  }

  private addFootprintZone(cx: number, cy: number, w: number, h: number): void {
    const z = this.add.zone(cx, cy, w, h);
    this.physics.add.existing(z, true);
    this.obstacles.add(z);
  }

  private addTorchWithGlow(x: number, y: number, scale = 0.75): void {
    const glow = this.add.circle(x, y - 4, 28 * scale, 0xfbbf24, 0.18).setDepth(y - 1);
    this.lightGlows.push({ circle: glow, baseAlpha: 0.18, phase: (x + y) * 0.05 });

    const fire = this.add.sprite(x, y, 'dungeon_fire', 0).setScale(scale).setDepth(y + 2);
    fire.anims.play('torch_fire', true);
  }

  // ---------------------------------------------------------------- Natur, Siedlung & Epochen-Monumente
  private scatterEgyptNature(): void {
    // =========================================================================
    // 1. KAPITEL 1+: FISCHERDORF AM NILUFER (Senbi)
    // =========================================================================
    this.placeProp(490, 290, 'desert_houses', 'hut_senbi', {
      hitW: 36,
      hitH: 14,
      hitOffsetY: 14,
    });
    this.addLabel(490, 260, '🛖 Fischer Senbis Hütte', '#ffe9b0');

    // Fisch-Trockengestell & Weidenkörbe am Fischerlager
    this.placeProp(528, 292, 'port_tiles', 'drying_fish_rack', {
      scale: 0.5,
      hitW: 28,
      hitH: 10,
      hitOffsetY: 12,
    });
    this.placeProp(462, 304, 'port_tiles', 'fish_baskets_group', { scale: 0.55 });

    // Animiertes Lagerfeuer zum Fischbraten mit warmem Lichtkegel
    const campGlow = this.add.circle(445, 345, 30, 0xf97316, 0.22).setDepth(343);
    this.lightGlows.push({ circle: campGlow, baseAlpha: 0.22, phase: 1.2 });
    const fireNode = this.addNode('egypt_campfire', 'objects', 'fire0', 445, 345);
    fireNode.sprite.anims.play('fire', true);
    fireNode.sprite.setDepth(345);
    fireNode.label = this.addLabel(445, 325, '🔥 Lagerfeuer (Fisch braten)', '#f97316');

    // Echter 16-Bit-Fischgrund mit geflochtener Reuse am Holzsteg
    const fishSpot = this.addNode('egypt_fish_spot', 'port_tiles', 'fish_trap_wicker', 606, 353);
    fishSpot.sprite.setScale(0.6);
    fishSpot.sprite.setDepth(354);
    fishSpot.label = this.addLabel(606, 332, '🎣 Nilbarsch-Fischgrund (E)', '#38bdf8');

    // Authentisches 16-Bit-Nil-Segelboot (Feluke) am Steg
    this.placeProp(636, 386, 'city_b01', 'nile_felucca', {
      scale: 0.68,
      hitW: 36,
      hitH: 14,
      hitOffsetY: 12,
    });
    this.addLabel(636, 356, '⛵ Nil-Feluke', '#93c5fd');

    // =========================================================================
    // 2. KAPITEL 2+: NILSCHWEMME, NILOMETER & OASE (Ameni)
    // =========================================================================
    if (state.chapter >= 2) {
      const nilo = this.addNode('egypt_nilometer', 'city_b02', 'stele_nilometer', 582, 274);
      nilo.sprite.setScale(0.75);
      nilo.sprite.setDepth(274);
      nilo.label = this.addLabel(582, 248, '📏 Antikes Nilometer (E)', '#67e8f9');

      // Erntekörbe, Kornsäcke, Weizengarben & Wasseramphoren am Feldrand
      this.placeProp(402, 224, 'city_b04', 'wheat_sheaf', { scale: 0.65 });
      this.placeProp(402, 246, 'city_b04', 'grain_basket', { scale: 0.65 });
      this.placeProp(532, 222, 'city_b02', 'amphora_red', { scale: 0.6 });
      this.placeProp(532, 256, 'city_b02', 'water_basin_square', { scale: 0.6 });
    }

    // Echte 16-Bit-Dattelpalmen (mit schlanker Stamm-Fußkollision)
    const palmPositions = [
      [390, 190],
      [440, 140],
      [430, 420],
      [550, 210],
      [540, 445],
      [380, 490],
      [500, 120],
      [360, 265],
      [185, 455],
      [235, 470],
    ];
    for (const [px, py] of palmPositions) {
      this.placeProp(px, py, 'desert_tileset', 'palm_tree', {
        hitW: 10,
        hitH: 8,
        hitOffsetY: 24,
        depthOffset: 24,
      });
      const palmNode = this.addNode('egypt_palm', 'desert_tileset', 'palm_tree', px, py + 18);
      palmNode.sprite.setVisible(false);
    }

    // Wüstensteine & Felsblöcke (mit kompakter Fuß-Kollision)
    const rockClusters = [
      [80, 260],
      [65, 360],
      [110, 380],
      [280, 440],
      [150, 510],
    ];
    for (const [rx, ry] of rockClusters) {
      this.placeProp(rx, ry, 'desert_tileset', 'rocks_large', {
        hitW: 22,
        hitH: 12,
        hitOffsetY: 6,
      });
    }

    // Kakteen & Wüstensträucher
    const desertPlants = [
      [55, 310],
      [135, 435],
      [95, 465],
      [310, 115],
      [305, 525],
    ];
    for (const [px, py] of desertPlants) {
      this.placeProp(px, py, 'desert_tileset', 'cactus_tall', {
        hitW: 8,
        hitH: 8,
        hitOffsetY: 16,
      });
    }

    // =========================================================================
    // 3. KAPITEL 3+: PALASTHOF DES WESIRS & VORRATSWIRTSCHAFT (Nefermaat)
    // =========================================================================
    if (state.chapter >= 3) {
      // Palast-Säulenkolonnade & Pharaonenthron im Norden des Hofes
      this.placeProp(360, 132, 'city_b01', 'palace_colonnade', {
        scale: 0.72,
        hitW: 58,
        hitH: 18,
        hitOffsetY: 16,
      });
      this.placeProp(322, 165, 'egypt_pillar', undefined, {
        scale: 0.5,
        hitW: 12,
        hitH: 10,
        hitOffsetY: 20,
      });
      this.placeProp(398, 165, 'egypt_pillar', undefined, {
        scale: 0.5,
        hitW: 12,
        hitH: 10,
        hitOffsetY: 20,
      });
      this.placeProp(360, 160, 'city_b01', 'throne_gold', { scale: 0.65 });
      this.placeProp(306, 195, 'city_b01', 'statue_lion_l', { scale: 0.65 });
      this.placeProp(412, 195, 'city_b01', 'statue_lion_r', { scale: 0.65 });
      this.addTorchWithGlow(336, 168, 0.65);
      this.addTorchWithGlow(384, 168, 0.65);
      this.addLabel(360, 108, '🏛️ Königlicher Hof des Wesirs', '#f59e0b');
    }

    // =========================================================================
    // 4. KAPITEL 4+: TEMPELBEZIRK, SCHREIBER & BALSAMIERUNG (Ani)
    // =========================================================================
    if (state.chapter >= 4) {
      // Großer Tempel-Pylon mit Hieroglyphen-Inschriften
      this.placeProp(235, 285, 'city_b01', 'temple_ornate', {
        scale: 0.75,
        hitW: 60,
        hitH: 20,
        hitOffsetY: 18,
      });
      this.addLabel(235, 255, '📜 Heiliger Tempel & Hieroglyphenwand', '#a78bfa');

      // Götterstatuen (Anubis & Thot), Opfertisch, Kanopenkrüge & Gold-Sarkophag
      this.placeProp(200, 312, 'city_b01', 'statue_thoth', { scale: 0.72 });
      this.placeProp(270, 312, 'city_b01', 'statue_anubis', { scale: 0.72 });
      this.placeProp(235, 318, 'city_b01', 'table_offering', { scale: 0.65 });
      this.placeProp(158, 355, 'city_b01', 'canopic_falcon', { scale: 0.62 });
      this.placeProp(218, 355, 'city_b01', 'canopic_jackal', { scale: 0.62 });
      this.addTorchWithGlow(208, 298, 0.65);
      this.addTorchWithGlow(262, 298, 0.65);

      const sarcNode = this.addNode('egypt_sarcophagus', 'city_b01', 'sarcophagus_gold', 155, 390);
      sarcNode.sprite.setScale(0.78);
      sarcNode.sprite.setDepth(390);
      sarcNode.label = this.addLabel(155, 364, '⚱️ Königlicher Sarkophag (E)', '#c084fc');
    }

    // =========================================================================
    // 5. KAPITEL 5+: GROSSBAUSTELLE GIZEH, STEINBRUCH & SPHINX (Hemiunu)
    // =========================================================================
    if (state.chapter >= 5) {
      // Stufenpyramide im westlichen Hintergrund + Große Cheops-Pyramide
      this.placeProp(48, 62, 'city_b01', 'pyramid_step', {
        scale: 0.62,
        hitW: 44,
        hitH: 18,
        hitOffsetY: 12,
      });

      this.placeProp(116, 78, 'egypt_pyramid', undefined, {
        scale: 0.62,
        hitW: 88,
        hitH: 28,
        hitOffsetY: 22,
      });
      this.addLabel(116, 32, '🔺 Große Pyramide von Gizeh (E)', '#fef08a');
      const pyrNode = this.addNode('egypt_pyramid', 'desert_tileset', 'stone_flat', 116, 108);
      pyrNode.sprite.setVisible(false);

      // Die Große Sphinx von Gizeh (mit exakter Fuß-Hitbox)
      this.placeProp(195, 255, 'egypt_sphinx', undefined, {
        scale: 0.48,
        hitW: 68,
        hitH: 22,
        hitOffsetY: 18,
      });
      this.addLabel(195, 218, '🦁 Große Sphinx von Gizeh (E)', '#fef08a');
      const sphNode = this.addNode('egypt_sphinx', 'desert_tileset', 'stone_flat', 195, 266);
      sphNode.sprite.setVisible(false);

      // 16-Bit-Sonnen-Obelisken
      this.placeProp(175, 92, 'city_b01', 'obelisk_tall_1', {
        scale: 0.68,
        hitW: 16,
        hitH: 12,
        hitOffsetY: 20,
      });

      // Tura-Kalksteinbrüche mit behauenen Quadern & Spitzhacke
      const q1 = this.addNode('egypt_quarry', 'city_b04', 'limestone_blocks', 66, 142);
      q1.sprite.setScale(0.78);
      q1.sprite.setDepth(142);
      q1.label = this.addLabel(66, 118, '⛏️ Tura-Kalksteinbruch (E)', '#fde047');
      this.placeProp(46, 148, 'city_b02', 'tool_pickaxe', { scale: 0.55 });

      const q2 = this.addNode('egypt_quarry', 'city_b02', 'stone_blocks_pile', 60, 198);
      q2.sprite.setScale(0.78);
      q2.sprite.setDepth(198);
      q2.label = this.addLabel(60, 174, '⛏️ Tura-Kalksteinbruch (E)', '#fde047');

      // Gestapeltes Bauholz & Rollbalken (echte Holzstämme statt Palme!)
      const t1 = this.addNode('egypt_timber', 'city_b04', 'timber_logs', 92, 224);
      t1.sprite.setScale(0.8);
      t1.sprite.setDepth(224);
      t1.label = this.addLabel(92, 200, '🪓 Bauholz & Rollbalken (E)', '#b45309');

      // Baustellenrampe mit Transportschlitten auf der Lehmbahn
      const ramp = this.addNode('egypt_sledge_ramp', 'city_b02', 'cargo_wagon_full', 116, 168);
      ramp.sprite.setScale(0.75);
      ramp.sprite.setDepth(168);
      ramp.label = this.addLabel(116, 144, '🪵 Baustellenrampe & Schlitten (E)', '#60a5fa');
    }

    // =========================================================================
    // 6. KAPITEL 6+: NILHAFEN, FERNHANDELSBASAR & SCHATZKAMMER (Baki)
    // =========================================================================
    if (state.chapter >= 6) {
      // Große 16-Bit-Frachtbarke am Hafenpier
      const barge = this.addNode('egypt_cargo_barge', 'city_b01', 'nile_cargo_barge', 632, 486);
      barge.sprite.setScale(0.82);
      barge.sprite.setDepth(486);
      barge.label = this.addLabel(632, 452, '⛵ Römische Getreidebarke (E)', '#93c5fd');

      // Hafenkran, Fässer & Frachtkisten am Pier
      this.placeProp(600, 452, 'port_tiles', 'crane_beam_wood', {
        scale: 0.55,
        hitW: 20,
        hitH: 12,
        hitOffsetY: 14,
      });
      this.placeProp(578, 508, 'city_b05', 'crate_wood', { scale: 0.6 });
      this.placeProp(560, 514, 'city_b05', 'barrel_wood', { scale: 0.6 });

      // Interaktiver Haupt-Basarstand (öffnet bei E direkt das Handelsmenü!)
      const bazaarNode = this.addNode('egypt_bazaar_stall', 'city_b05', 'bazaar_punt_incense', 490, 488);
      bazaarNode.sprite.setScale(0.68);
      bazaarNode.sprite.setDepth(488);
      this.addFootprintZone(490, 498, 44, 16);
      bazaarNode.label = this.addLabel(490, 454, '🏺 Fernhandels-Basar (E / H)', '#f59e0b');

      // Lebendige Markt-Umgebung: Gewürztische, Leinenstand, Beduinenzelt & Schatztruhen
      this.placeProp(432, 492, 'city_b03', 'canopy_gold', {
        scale: 0.62,
        hitW: 40,
        hitH: 16,
        hitOffsetY: 14,
      });
      this.placeProp(452, 526, 'city_b02', 'market_table_spices', { scale: 0.68 });
      this.placeProp(488, 526, 'city_b02', 'market_table_fruits', { scale: 0.68 });
      this.placeProp(462, 466, 'city_b01', 'chest_turquoise', {
        scale: 0.68,
        hitW: 22,
        hitH: 12,
        hitOffsetY: 6,
      });
      this.placeProp(438, 466, 'city_b01', 'statue_pharaoh', { scale: 0.68 });
      this.addTorchWithGlow(522, 468, 0.65);
      this.addLabel(462, 444, '👑 Königliche Schatzkammer', '#fde047');
    }
  }

  private placeEgyptResources(): void {
    // A. 4 Papyrus-Schilf-Bestände am sumpfigen Flussrand (echte hohe Papyrusstauden)
    const reeds = [
      [590, 120],
      [595, 230],
      [590, 430],
      [595, 535],
    ];
    reeds.forEach(([x, y]) => {
      const n = this.addNode('egypt_papyrus', 'city_b01', 'papyrus_clump_tall', x, y);
      n.sprite.setScale(0.68);
      n.sprite.setDepth(y);
      n.label = this.addLabel(x, y - 20, '🌿 Papyrus-Schilf (E)', '#86efac');
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
      n.label = this.addLabel(x, y - 16, '🪵 Akazienast (E)', '#fcd34d');
    });

    // C. 3 Wüstenkiesel am Ufersaum
    const pebbles = [
      [310, 225],
      [350, 330],
      [320, 450],
    ];
    pebbles.forEach(([x, y]) => {
      const n = this.addNode('egypt_pebble', 'desert_tileset', 'stone_flat', x, y);
      n.sprite.setDepth(y);
      n.label = this.addLabel(x, y - 16, '🪨 Wüstenkiesel (E)', '#cbd5e1');
    });

    // D. Fruchtbarer Nilschlamm am Flussufer (echte Ton-Schlammgrube & Schaufel statt flachem Tile!)
    const mudSpots = [
      [580, 206],
      [584, 308],
    ];
    mudSpots.forEach(([x, y]) => {
      const n = this.addNode('egypt_mud', 'city_b02', 'clay_vat_mud', x, y);
      n.sprite.setScale(0.62);
      n.sprite.setDepth(y);
      this.placeProp(x - 14, y + 4, 'city_b02', 'tool_shovel', { scale: 0.5 });
      n.label = this.addLabel(x, y - 20, '🌊 Nilschlamm-Stich (E)', '#a3e635');
    });
  }

  private placeEgyptBuildingsAndNPCs(): void {
    const ch = state.chapter;

    // 1. Fischer Senbi (Mentor Kapitel 1)
    const senbi = this.addNode('egypt_senbi', 'npc_senbi', 0, 530, 350);
    senbi.sprite.setDepth(350);
    senbi.sprite.anims.play('idle-senbi', true);
    senbi.label = this.addLabel(530, 325, '🐟 Fischer Senbi (Kap. 1)', '#38bdf8', ch === 1);

    // 2. Kapitel 2+: Feldhüter Ameni, Bäuerin Kheti & wandernde Nil-Nutztiere
    if (ch >= 2) {
      const ameni = this.addNode('egypt_ameni', 'npc_ameni', 0, 460, 182);
      ameni.sprite.setDepth(182);
      ameni.sprite.anims.play('idle-ameni', true);
      ameni.label = this.addLabel(460, 157, '🌾 Feldhüter Ameni (Kap. 2)', '#fde047', ch === 2);

      const kheti = this.addNode('egypt_kheti', 'npc_kheti', 0, 520, 182);
      kheti.sprite.setDepth(182);
      kheti.sprite.anims.play('idle-kheti', true);
      kheti.label = this.addLabel(520, 157, '👩‍🌾 Bäuerin Kheti', '#86efac');

      // Belebte Nil-Nutztiere (Pflugochse, Ziege & Dorfhuhn - maßstabsgerecht & animiert)
      const ox = this.add.sprite(388, 295, 'animal_cow', 0).setScale(0.42).setDepth(295);
      ox.anims.play('idle-cow', true);
      this.wanderingAnimals.push({
        sprite: ox,
        homeX: 388,
        homeY: 295,
        vx: 0,
        vy: 0,
        timer: 2000,
        walkAnim: 'walk-cow',
        idleAnim: 'idle-cow',
      });

      const goat1 = this.add.sprite(418, 312, 'animal_goat', 0).setScale(0.38).setDepth(312);
      goat1.anims.play('idle-goat', true);
      this.wanderingAnimals.push({
        sprite: goat1,
        homeX: 418,
        homeY: 312,
        vx: 0,
        vy: 0,
        timer: 1400,
        walkAnim: 'walk-goat',
        idleAnim: 'idle-goat',
      });

      const chicken1 = this.add.sprite(442, 296, 'animal_chicken', 0).setScale(0.28).setDepth(296);
      chicken1.anims.play('idle-chicken', true);
      this.wanderingAnimals.push({
        sprite: chicken1,
        homeX: 442,
        homeY: 296,
        vx: 0,
        vy: 0,
        timer: 1600,
        walkAnim: 'walk-chicken',
        idleAnim: 'idle-chicken',
      });
    }

    // 3. Kapitel 3+: Wesir Nefermaat & Palastwache
    if (ch >= 3) {
      const wesir = this.addNode('egypt_nefermaat', 'npc_nefermaat', 0, 360, 195);
      wesir.sprite.setDepth(195);
      wesir.sprite.anims.play('idle-nefermaat', true);
      wesir.label = this.addLabel(360, 170, '👑 Wesir Nefermaat (Kap. 3)', '#f59e0b', ch === 3);

      const guard = this.addNode('egypt_kheti', 'npc_guard', 0, 326, 195);
      guard.sprite.setDepth(195);
      guard.sprite.anims.play('idle-guard', true);
      guard.label = this.addLabel(326, 170, '🛡️ Königliche Palastwache', '#fbbf24');
    }

    // 4. Kapitel 4+: Ober-Schreiber Ani & Einbalsamierer
    if (ch >= 4) {
      const ani = this.addNode('egypt_ani', 'npc_ani', 0, 240, 345);
      ani.sprite.setDepth(345);
      ani.sprite.anims.play('idle-ani', true);
      ani.label = this.addLabel(240, 320, '📜 Ober-Schreiber Ani (Kap. 4)', '#a78bfa', ch === 4);

      const mum = this.addNode('egypt_kheti', 'npc_mummy', 0, 162, 362);
      mum.sprite.setDepth(362);
      mum.sprite.anims.play('idle-mummy', true);
      mum.label = this.addLabel(162, 337, '⚰️ Balsamierer des Anubis', '#cbd5e1');
    }

    // 5. Kapitel 5+: Baumeister Hemiunu
    if (ch >= 5) {
      const hemi = this.addNode('egypt_hemiunu', 'npc_hemiunu', 0, 136, 205);
      hemi.sprite.setDepth(205);
      hemi.sprite.anims.play('idle-hemiunu', true);
      hemi.label = this.addLabel(136, 180, '📐 Baumeister Hemiunu (Kap. 5)', '#fef08a', ch === 5);
    }

    // 6. Kapitel 6+: Hafenmeister Baki, Phönizischer Holzhändler & Römischer Senator
    if (ch >= 6) {
      const baki = this.addNode('egypt_baki', 'npc_baki', 0, 558, 480);
      baki.sprite.setDepth(480);
      baki.sprite.anims.play('idle-baki', true);
      baki.label = this.addLabel(558, 455, '⚓ Hafenmeister Baki (Kap. 6)', '#60a5fa', ch === 6);

      const trader = this.addNode('egypt_cedar_trader', 'npc_senbi', 0, 588, 522);
      trader.sprite.setDepth(522);
      trader.sprite.anims.play('idle-senbi', true);
      trader.label = this.addLabel(588, 497, '🌲 Phönizischer Holzhändler (E)', '#38bdf8');

      const envoy = this.addNode('egypt_roman_envoy', 'npc_guard', 0, 524, 512);
      envoy.sprite.setDepth(512);
      envoy.sprite.anims.play('idle-guard', true);
      envoy.label = this.addLabel(524, 487, '🏛️ Senator Cornelius aus Rom (E)', '#f87171');
    }

    // Bauplätze: Nur anzeigen, wenn das Kapitel erreicht ist
    for (const b of state.buildingsData) {
      if (state.chapter < b.unlockedInChapter) continue;

      const node = this.addNode('build_site', 'farm', 'sign_build', b.x, b.y);
      node.buildingDef = b;
      node.sprite.setDepth(b.y);
      node.label = this.addLabel(b.x, b.y - 22, `🔨 Bauplatz: ${b.name} (E)`, '#fef08a');
      if (state.hasBuilding(b.id)) {
        this.renderBuiltEgyptBuilding(node);
      }
    }

    // Ackerbeete am Bewässerungskanal (ab Kapitel 2)
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

    // Authentische ägyptische Tierwelt (Fauna des Nils, Tempels & der Wüste)
    this.placeEgyptianFauna();
  }

  /**
   * Platziert authentische Fauna des Alten Ägypten:
   * - Schwimmende Nil-Enten & Reihervögel am Nilufer (ab Kap. 1)
   * - Rosa-Flamingos auf der Sandbank im Nilwasser (ab Kap. 1)
   * - Heiliger Ibis von Thoth am Schilfgürtel (ab Kap. 1)
   * - Heiliger Pavian des Thoth & Horus-Falke am Tempel (ab Kap. 4)
   * - Dorcas-Wüstengazellen in den Dünen bei Gizeh (ab Kap. 5)
   */
  private placeEgyptianFauna(): void {
    const ch = state.chapter;

    // A. Nil-Enten (schwimmen friedlich im Flusswasser)
    const duck1 = this.add.sprite(646, 348, 'animal_duck', 0).setScale(1.0).setDepth(348);
    duck1.anims.play('swim-duck', true);
    this.wanderingAnimals.push({
      sprite: duck1,
      homeX: 646,
      homeY: 348,
      vx: 0,
      vy: 0,
      timer: 1800,
      walkAnim: 'swim-duck',
      idleAnim: 'swim-duck',
    });

    const duck2 = this.add.sprite(678, 376, 'animal_duck', 0).setScale(1.0).setDepth(376);
    duck2.anims.play('swim-duck', true);
    this.wanderingAnimals.push({
      sprite: duck2,
      homeX: 678,
      homeY: 376,
      vx: 0,
      vy: 0,
      timer: 2400,
      walkAnim: 'swim-duck',
      idleAnim: 'swim-duck',
    });

    // B. Nil-Singvogel / Reihervogel (pickt am Schilfrand)
    const bird1 = this.add.sprite(525, 345, 'animal_bird', 0).setScale(1.0).setDepth(345);
    bird1.anims.play('idle-bird', true);

    // C. Heiliger Ibis von Thoth (weißes Schilf-Wasservogel am Papyrusdickicht)
    this.add.image(575, 362, 'zoo_b02', 'ibis_r').setScale(0.52).setDepth(362);

    // D. Rosa-Flamingos (waten in der seichten Sandbank am Nilufer)
    this.add.image(612, 425, 'zoo_b02', 'flamingo_r').setScale(0.55).setDepth(425);
    this.add.image(628, 422, 'zoo_b02', 'flamingo_l').setScale(0.52).setDepth(422);

    // E. Tempel-Fauna (ab Kap. 4: Horus-Falke auf dem Pylon & Pavian im Hof)
    if (ch >= 4) {
      this.add.image(380, 140, 'zoo_b02', 'falcon_1').setScale(0.5).setDepth(145);
      this.add.image(285, 338, 'zoo_b02', 'baboon_seated').setScale(0.5).setDepth(338);
    }

    // F. Wüsten-Fauna (ab Kap. 5: Dorcas-Gazellenbock & Gazellenkuh an den offenen Gizeh-Dünen)
    if (ch >= 5) {
      this.add.image(65, 75, 'zoo_b02', 'gazelle_buck').setScale(0.55).setDepth(75);
      this.add.image(82, 80, 'zoo_b02', 'gazelle_doe').setScale(0.5).setDepth(80);
    }
  }

  private placeEgyptRelics(): void {
    const ch = state.chapter;

    // 1. Skarabäus-Amulett (ab Kapitel 1 am Schilfufer)
    if (ch >= 1 && !state.relicsFound.includes('skanabaeus')) {
      const n = this.addNode('egypt_relic_skanabaeus', 'relic_skanabaeus', undefined, 574, 396);
      n.sprite.setScale(0.7);
      n.sprite.setDepth(396);
      n.label = this.addLabel(574, 372, '🪲 Skarabäus-Amulett (E)', '#fde047');
    }

    // 2. Kanopenkrug (ab Kapitel 4 nahe der Balsamierungshalle)
    if (ch >= 4 && !state.relicsFound.includes('kanope')) {
      const n = this.addNode('egypt_relic_kanope', 'relic_kanope', undefined, 195, 325);
      n.sprite.setScale(0.7);
      n.sprite.setDepth(325);
      n.label = this.addLabel(195, 301, '🏺 Kanopenkrug (E)', '#fde047');
    }

    // 3. Papyrus-Totenbuchrolle (ab Kapitel 4 beim Haus des Lebens)
    if (ch >= 4 && !state.relicsFound.includes('papyrusrolle')) {
      const n = this.addNode('egypt_relic_papyrusrolle', 'relic_papyrusrolle', undefined, 265, 360);
      n.sprite.setScale(0.7);
      n.sprite.setDepth(360);
      n.label = this.addLabel(265, 336, '📜 Papyrus-Totenbuch (E)', '#fde047');
    }

    // 4. Goldene Totenmaske (ab Kapitel 5 auf dem Gizeh-Plateau)
    if (ch >= 5 && !state.relicsFound.includes('goldmaske')) {
      const n = this.addNode('egypt_relic_goldmaske', 'relic_goldmaske', undefined, 80, 95);
      n.sprite.setScale(0.7);
      n.sprite.setDepth(95);
      n.label = this.addLabel(80, 71, '👑 Goldene Totenmaske (E)', '#fde047');
    }

    // 5. Königliche Schreiberpalette (ab Kapitel 6 am Nilhafen-Basar)
    if (ch >= 6 && !state.relicsFound.includes('pinsel_tinte')) {
      const n = this.addNode('egypt_relic_pinsel_tinte', 'relic_pinsel_tinte', undefined, 445, 450);
      n.sprite.setScale(0.7);
      n.sprite.setDepth(450);
      n.label = this.addLabel(445, 426, '🖌️ Schreiberpalette (E)', '#fde047');
    }
  }

  /**
   * Ersetzt das Bauschild durch echte 16-Bit-Pixel-Art-Bauwerke aus Ancient Egyptian City
   * und aktualisiert das bestehende Schild ohne Dopplung!
   */
  private renderBuiltEgyptBuilding(node: Node): void {
    const b = node.buildingDef!;
    node.readyAt = 0;
    node.sprite.setVisible(false);
    if (node.builtSprite) {
      node.builtSprite.destroy();
    }

    if (b.id === 'schaduf') {
      node.builtSprite = this.add.image(b.x, b.y - 4, 'schaduf_prop').setDepth(b.y);
      if (node.label) {
        node.label.setText('💧 Schaduf-Schöpfwerk (E: Wasser)').setColor('#86efac').setY(b.y - 28);
      }
    } else if (b.id === 'ziegelei') {
      node.builtSprite = this.add
        .image(b.x, b.y - 4, 'city_b04', 'brick_kiln')
        .setScale(0.85)
        .setDepth(b.y);
      this.addTorchWithGlow(b.x, b.y + 2, 0.55);
      if (node.label) {
        node.label.setText('🧱 Königliche Lehmziegelei').setColor('#f59e0b').setY(b.y - 28);
      }
    } else if (b.id === 'speicher') {
      node.builtSprite = this.add
        .image(b.x, b.y - 8, 'city_b01', 'granary_compound')
        .setScale(0.62)
        .setDepth(b.y);
      if (node.label) {
        node.label.setText('🌾 Königlicher Kornspeicher').setColor('#fde047').setY(b.y - 34);
      }
    } else if (b.id === 'schreiberhaus') {
      node.builtSprite = this.add
        .image(b.x, b.y - 8, 'city_b01', 'scribes_house')
        .setScale(0.62)
        .setDepth(b.y);
      if (node.label) {
        node.label.setText('📜 Haus des Lebens (Per Ankh)').setColor('#a78bfa').setY(b.y - 34);
      }
    } else if (b.id === 'wabet') {
      node.builtSprite = this.add
        .image(b.x, b.y - 8, 'city_b01', 'temple_shrine')
        .setScale(0.6)
        .setDepth(b.y);
      if (node.label) {
        node.label.setText('⚱️ Balsamierung (Wabet)').setColor('#c084fc').setY(b.y - 34);
      }
    } else if (b.id === 'steinmetz') {
      node.builtSprite = this.add
        .image(b.x, b.y - 6, 'city_b02', 'stonemason_yard')
        .setScale(0.6)
        .setDepth(b.y);
      if (node.label) {
        node.label.setText('🏗️ Bauhütte der Großbaustelle').setColor('#fef08a').setY(b.y - 32);
      }
    }
  }

  private addNode(kind: Kind, tex: string, frame: string | number | undefined, x: number, y: number): Node {
    const s = this.physics.add.staticSprite(x, y, tex, frame as any);
    // Deaktiviere den automatischen Physik-Body von Interaktions-Nodes,
    // damit Nodes niemals versehentlich unsichtbare Mauern erzeugen!
    if (s.body) {
      s.body.enable = false;
    }
    s.setDepth(y);
    const n: Node = { kind, sprite: s, readyAt: 0 };
    this.nodes.push(n);
    return n;
  }

  private addLabel(x: number, y: number, text: string, color = '#ffe9b0', alwaysVisible = false): DomLabel {
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
      alwaysVisible,
      isQuestTarget: false,
      setText(t: string) {
        el.textContent = t;
        return this;
      },
      setColor(c: string) {
        el.style.borderColor = c;
        el.style.color = c;
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
  update(t: number, delta: number): void {
    if (this.sleeping) return;

    if (!state.modal) {
      const prevDay = state.dayTime;
      state.dayTime = (state.dayTime + delta / DAY_MS) % 1;
      if (state.dayTime < prevDay) {
        state.daysSurvived += 1;
      }
      const angle = state.dayTime * Math.PI * 2;
      const darkness = Math.max(0, -Math.sin(angle));
      this.nightOverlay.setAlpha(darkness * 0.68);
      state.playTimeSec += delta / 1000;

      // Sanftes Flackern der Fackeln & Lagerfeuer (besonders stimmungsvoll in der Dämmerung)
      for (const lg of this.lightGlows) {
        const flicker = Math.sin(t * 0.008 + lg.phase) * 0.05;
        const nightBoost = darkness * 0.22;
        lg.circle.setAlpha(Math.max(0.1, lg.baseAlpha + nightBoost + flicker));
      }

      // Sanftes Nilwasser-Glitzern
      for (let i = 0; i < this.waterShimmers.length; i++) {
        const sh = this.waterShimmers[i];
        sh.setAlpha(0.2 + 0.35 * Math.abs(Math.sin(t * 0.003 + i)));
      }

      // Sanfte Bewegung der Nil-Nutztiere auf der Uferweide
      for (const a of this.wanderingAnimals) {
        a.timer -= delta;
        if (a.timer <= 0) {
          if (a.vx !== 0 || a.vy !== 0) {
            a.vx = 0;
            a.vy = 0;
            a.timer = 2200 + Math.random() * 2000;
            a.sprite.anims.play(a.idleAnim, true);
          } else {
            const dx = a.homeX - a.sprite.x;
            const dy = a.homeY - a.sprite.y;
            const dirAngle = Math.hypot(dx, dy) > 22 ? Math.atan2(dy, dx) : Math.random() * Math.PI * 2;
            a.vx = Math.cos(dirAngle) * 10;
            a.vy = Math.sin(dirAngle) * 10;
            a.timer = 1200 + Math.random() * 1200;
            a.sprite.setFlipX(a.vx < 0);
            a.sprite.anims.play(a.walkAnim, true);
          }
        }
        a.sprite.x += (a.vx * delta) / 1000;
        a.sprite.y += (a.vy * delta) / 1000;
        a.sprite.setDepth(a.sprite.y);
      }
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

    this.updateNodes();
    this.updateCompass();
    this.syncWorldLabels();

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
   * Berechnet gestochen scharfe Retina-DOM-Koordinaten für alle Beschriftungen.
   * Mentoren, Spielername und das aktuelle Quest-Ziel sind immer sichtbar;
   * alle anderen Schilder blenden sich sanft ein, sobald man sich ihnen nähert!
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

      const distToPlayer = Phaser.Math.Distance.Between(this.player.x, this.player.y, lbl.x, lbl.y + 18);
      const shouldShow = Boolean(lbl.alwaysVisible || lbl.isQuestTarget || distToPlayer <= LABEL_PROXIMITY_PX);
      if (!shouldShow) {
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
        return 'Drücke E: Mit den Bewohnern sprechen';
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
        return state.chapter === 5 && state.quest === 5 ? 'Drücke E: Deckstein (Pyramidion) auf die Spitze setzen' : 'Drücke E: Große Pyramide von Gizeh bestaunen';
      case 'egypt_sphinx':
        return state.chapter === 5 && state.quest === 7 ? 'Drücke E: Blick der Sphinx gen Osten zur Morgensonne ausrichten' : 'Drücke E: Große Sphinx von Gizeh inspizieren';
      case 'egypt_sarcophagus':
        return 'Drücke E: Königlichen Gold-Sarkophag betrachten';
      case 'egypt_bazaar_stall':
        return 'Drücke E: Fernhandels-Basar öffnen (Tauschhandel)';
      case 'egypt_cargo_barge':
        return state.chapter === 6 && state.quest === 5 ? 'Drücke E: Römische Frachtbarke mit 3 Getreidesäcken beladen' : 'Drücke E: Römische Getreidebarke am Hafen inspizieren';
      case 'egypt_roman_envoy':
        return 'Drücke E: Mit Senator Cornelius aus Rom verhandeln';
      case 'egypt_cedar_trader':
        return 'Drücke E: Leinen gegen Libanon-Zedernholz tauschen';
      case 'egypt_fish_spot':
        return state.count('fischreuse') > 0 ? 'Drücke E: Fischreuse auswerfen & Nilbarsch fangen' : 'Du benötigst eine geflochtene Fischreuse (Taste C)!';
      case 'egypt_campfire':
        return state.count('nilbarsch') > 0 ? 'Drücke E: Frischen Nilbarsch über dem Feuer braten' : 'Lagerfeuer (Spende Wärme & brate frischen Nilbarsch)';
      case 'plot': {
        if (n.plotId !== undefined) {
          const st = state.plots[n.plotId]?.stage;
          if (st === 'raw') return 'Drücke E: Ackerboden mit der Hacke auflockern (Schritt 1/3)';
          if (st === 'tilled') return 'Drücke E: Emmer-Saat in die Furchen säen (Schritt 2/3)';
          if (st === 'seeded') return 'Drücke E: Saatbeet mit Nilwasser begießen (Schritt 3/3)';
          if (st === 'watered') return 'Emmer-Getreide wächst im feuchten Nilschlamm ...';
          if (st === 'ripe') return 'Drücke E: Reifes Emmer-Getreide mit der Sichel ernten!';
        }
        return 'Drücke E: Ackerbeet bewirtschaften';
      }
      case 'build_site': {
        const b = n.buildingDef;
        if (b && state.hasBuilding(b.id)) {
          if (b.id === 'schaduf') return 'Drücke E: Frisches Nilwasser mit dem Schaduf schöpfen';
          if (b.id === 'speicher' && state.chapter === 4 && state.quest === 4) {
            return 'Drücke E: Getreidevorräte & Steuern auf Papyrus notieren';
          }
          return `${b.name} (bereits errichtet)`;
        }
        return `Drücke E: ${b?.name ?? 'Bauwerk'} errichten`;
      }
      case 'egypt_relic_skanabaeus':
        return 'Drücke E: Heiliges Skarabäus-Amulett des Khepri bergen!';
      case 'egypt_relic_kanope':
        return 'Drücke E: Alabaster-Kanopenkrug des Duamutef untersuchen!';
      case 'egypt_relic_papyrusrolle':
        return 'Drücke E: Papyrus-Totenbuchrolle des Ani entrollen!';
      case 'egypt_relic_goldmaske':
        return 'Drücke E: Goldene Totenmaske des Pharaos bergen!';
      case 'egypt_relic_pinsel_tinte':
        return 'Drücke E: Königliche Schreiberpalette erforschen!';
      default:
        return 'Drücke E zum Interagieren';
    }
  }

  private collectRelic(id: string, n: Node): void {
    n.sprite.setVisible(false);
    if (n.label) n.label.el.style.display = 'none';
    state.emit('openRelicQuiz', id);
  }

  private interact(n: Node): void {
    switch (n.kind) {
      case 'egypt_relic_skanabaeus':
        this.collectRelic('skanabaeus', n);
        break;
      case 'egypt_relic_kanope':
        this.collectRelic('kanope', n);
        break;
      case 'egypt_relic_papyrusrolle':
        this.collectRelic('papyrusrolle', n);
        break;
      case 'egypt_relic_goldmaske':
        this.collectRelic('goldmaske', n);
        break;
      case 'egypt_relic_pinsel_tinte':
        this.collectRelic('pinsel_tinte', n);
        break;
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
      case 'egypt_sarcophagus':
        state.openDialog({
          speaker: 'Königlicher Gold-Sarkophag',
          nodes: [
            {
              text: '⚰️ In diesem reich verzierten Sarkophag ruht die einbalsamierte Mumie, geschützt durch Zaubersprüche des Totenbuchs und den Herz-Skarabäus.',
            },
          ],
        });
        break;
      case 'egypt_bazaar_stall':
        sfx.click();
        state.emit('openTrade');
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
        state.bump('trap', 1);
        state.unlockLexicon('nil');
        state.emit('toast', 'Fischfang erfolgreich: +1 Frischer Nilbarsch!');
        state.persist();
        break;
      case 'egypt_campfire':
        if (state.count('nilbarsch') > 0) {
          state.add('nilbarsch', -1);
          state.add('cooked_fish', 1);
          state.bump('cooked_fish', 1);
          state.bump('cooked', 1);
          sfx.craft();
          state.emit('toast', 'Knusprig gebraten: +1 Gebratener Nilbarsch!');
          state.persist();
        } else {
          state.emit('toast', 'Das Feuer knistert warm. Bring frischen Nilbarsch zum Braten mit!');
        }
        break;
      case 'plot':
        this.interactPlot(n);
        break;
      case 'build_site':
        this.interactBuilding(n);
        break;
      default:
        state.emit('toast', 'Ein geschichtsträchtiger Ort am Nil.');
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
        {
          text: '📏 <strong>Pegelstand: 16 ägyptische Ellen!</strong>\n\nDas ist die ideale Höhe für die Nilschwemme (Akhet): Unter 12 Ellen droht Dürre, über 18 Ellen zerstören Fluten die Lehmdörfer.',
        },
        {
          text: 'Die Priester und Beamten wissen nun: Es wird ein fruchtbares Erntejahr! Jetzt können wir den Schaduf errichten und die Felder bestellen.',
        },
      ],
    });
    state.persist();
  }

  private interactPalm(n: Node): void {
    state.add('datteln', 1);
    state.bump('datteln', 1);
    sfx.pickup();
    state.emit('toast', '+1 Süße Datteln von der Palme gepflückt!');
    n.readyAt = Date.now() + REGROW_MS;
    state.persist();
  }

  private interactKheti(): void {
    state.openDialog({
      speaker: 'Bäuerin Kheti',
      nodes: [
        {
          text: 'Herodot nannte Ägypten „ein Geschenk des Nils“. Ohne den schwarzen Schlamm (Kemet) wäre hier nur glühende Wüste!',
        },
        {
          text: 'Wenn du ein Feld zweimal mit E bearbeitest (erst auflockern, dann Emmer säen) und es danach mit Nilwasser gießt, wächst das goldene Korn im Nu!',
        },
      ],
    });
  }

  private interactAmeni(): void {
    const ch = state.chapters[2];
    const q = state.quest;

    if (state.chapter < 2) {
      state.openDialog({
        speaker: 'Feldhüter Ameni',
        nodes: [
          {
            text: 'Sei gegrüßt! Hilf zuerst Fischer Senbi weiter südlich am Ufer (Kapitel 1), bevor wir hier im Norden die großen Bewässerungskanäle öffnen.',
          },
        ],
      });
      return;
    }

    if (state.chapter > 2) {
      state.openDialog({
        speaker: 'Feldhüter Ameni',
        nodes: [
          {
            text: 'Dank deiner Hilfe blühen die Felder von Kemet! Die Kanäle führen reichlich Wasser und die Ernte sichert das ganze Reich.',
          },
        ],
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
              { text: 'Bist du bereit für das große Finale: <strong>Kapitel 6: Basare, Nilflotte & Kornkammer Roms</strong>?' },
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
          { text: 'Beginne damit, Weihrauchharz aus Punt auf dem Basar einzutauschen (Taste H oder drücke E am Basarstand).' },
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
      state.emit('toast', 'Ackerboden aufgelockert! Drücke nochmals E zum Einsäen.');
    } else if (p.stage === 'tilled') {
      p.stage = 'seeded';
      this.refreshPlotVisual(n);
      sfx.craft();
      state.bump('seeded_plot', 1);
      state.emit('toast', 'Emmer-Saat in den feuchten Nilschlamm gesät!');
    } else if (p.stage === 'seeded') {
      if (state.count('wasser') <= 0) {
        state.emit('toast', 'Schöpfe erst Nilwasser am Schaduf (drücke E am Schaduf)!');
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
      const costStr = Object.entries(state.getBuildingCost(b))
        .map(([id, num]) => {
          const itemDef = state.itemsData[id as EgyptItemId];
          return `${num}× ${itemDef ? itemDef.name : id}`;
        })
        .join(', ');
      state.openDialog({
        speaker: `Bauplatz: ${b.name}`,
        nodes: [{ text: `${b.desc}\n\nBenötigte Baumaterialien:\n<strong>${costStr}</strong>` }],
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

    // Alle bisherigen Quest-Markierungen auf den Labels zurücksetzen
    for (const lbl of this.domLabels) {
      lbl.isQuestTarget = false;
    }

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
      else if (q === 3) this.setCompassTargetByKind('egypt_timber', 'Bauholz & Rollbalken');
      else if (q === 4) this.setCompassTargetByKind('egypt_sledge_ramp', 'Baustellenrampe (mit Schlammwasser befeuchten)');
      else if (q === 5) this.setCompassTargetByKind('egypt_pyramid', 'Große Cheops-Pyramide (Deckstein setzen)');
      else if (q === 6 || q === 7) this.setCompassTargetByKind('egypt_sphinx', 'Große Sphinx von Gizeh');
      else this.setCompassTargetByKind('egypt_hemiunu', 'Baumeister Hemiunu');
    } else if (ch === 6) {
      if (q === 1) this.setCompassTargetByKind('egypt_bazaar_stall', 'Fernhandels-Basar (Weihrauch tauschen)');
      else if (q === 2) this.setCompassTargetByKind('egypt_cedar_trader', 'Phönizischer Holzhändler am Hafen');
      else if (q === 3) state.compassText = '🔨 Drücke C -> Goldene Totenmaske schmieden!';
      else if (q === 4) state.compassText = '🔨 Drücke C -> 3× Getreidesäcke schnüren!';
      else if (q === 5) this.setCompassTargetByKind('egypt_cargo_barge', 'Römische Frachtbarke am Hafen');
      else if (q === 6) this.setCompassTargetByKind('egypt_roman_envoy', 'Senator Cornelius aus Rom');
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
    if (targetNode.label) {
      targetNode.label.isQuestTarget = true;
    }
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
