import Phaser from 'phaser';
import { sfx } from '../audio/sound';
import { EgyptBuildingDef, EgyptItemId } from '../data/items';
import { CHAPTERS } from '../data/chapters';
import { CROP_MS, DAY_MS, state } from '../systems/GameState';
import { WildlifeManager } from '../world/Wildlife';
import { ChapterBanner } from '../ui/ChapterBanner';
import { CompanionManager } from '../world/Companion';

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

interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Sperrliste für wandernde Weidetiere gemäß snes-history-game Skill (§ 1.1).
 * Verhindert, dass Tiere in Gebäude, Kanäle, das Lagerfeuer oder ins Wasser laufen.
 */
const BUILDING_OBSTACLES: BoundingBox[] = [
  // Fischerhütte Senbi & Fischtrockengestell
  { minX: 456, maxX: 546, minY: 260, maxY: 320 },
  // Lagerfeuer (Fisch braten) - Schutzkreis gegen Tierbrand
  { minX: 420, maxX: 470, minY: 320, maxY: 370 },
  // Bewässerungskanäle
  { minX: 412, maxX: 564, minY: 200, maxY: 218 },
  { minX: 510, maxX: 526, minY: 204, maxY: 278 },
  // Bauten: Lehmziegelei, Speicher, Palast, Schreiberhaus, Balsamierung, Steinmetzhütte
  { minX: 295, maxX: 335, minY: 215, maxY: 255 },
  { minX: 380, maxX: 430, minY: 115, maxY: 160 },
  { minX: 330, maxX: 390, minY: 105, maxY: 155 },
  { minX: 280, maxX: 320, minY: 330, maxY: 370 },
  { minX: 170, maxX: 210, minY: 370, maxY: 410 },
  { minX: 130, maxX: 170, minY: 130, maxY: 170 },
  // Nilufer-Kante für Landtiere (Wasser-Sperre)
  { minX: 605, maxX: 800, minY: 0, maxY: 800 },
];

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
  private wildlife!: WildlifeManager;
  private banner!: ChapterBanner;
  private companion!: CompanionManager;
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
    this.wildlife = new WildlifeManager(this);
    this.banner = new ChapterBanner();
    const saved = state.saves.load();
    if (saved) state.loadFrom(saved);

    const chDef = CHAPTERS[state.chapter] || CHAPTERS[1];
    if (chDef) {
      this.banner.show({
        chapterNumber: state.chapter,
        title: chDef.title,
        subtitle: `${chDef.period} · Mentor: ${chDef.mentor}`
      });
    }
    this.sleeping = false;

    const existingLayer = document.getElementById('world-labels');
    this.labelLayer = existingLayer ?? document.createElement('div');
    this.labelLayer.id = 'world-labels';
    if (!existingLayer) document.body.appendChild(this.labelLayer);
    this.labelLayer.innerHTML = '';

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

    // 5b. Lebendige Nil-Ökologie & Umgebungs-Critters
    this.wildlife.spawnAmbientFauna(MAP_W * TILE, MAP_H * TILE);

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

    this.companion = new CompanionManager(this, {
      key: 'sdv_dog_tesem',
      animPrefix: 'dog-tesem',
      name: 'Anubis',
      historicalBreed: 'Altägyptischer Tesem-Windhund',
      unlockedChapter: 1
    });
    if (state.chapter >= 1) {
      this.companion.unlock(startX - 24, startY);
    }

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
      this.tweens.killTweensOf(n.sprite);
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
    this.placeProp(488, 276, 'desert_houses', 'hut_senbi', {
      scale: 1.75,
      hitW: 64,
      hitH: 22,
      hitOffsetY: 24,
    });
    this.addLabel(488, 232, '🛖 Fischer Senbis Hütte', '#ffe9b0');

    // Fisch-Trockengestell & Weidenkörbe am Fischerlager
    this.placeProp(554, 316, 'port_tiles', 'drying_fish_rack', {
      scale: 0.5,
      hitW: 28,
      hitH: 10,
      hitOffsetY: 12,
    });
    this.placeProp(436, 316, 'port_tiles', 'fish_baskets_group', { scale: 0.40 });

    // Animiertes Lagerfeuer zum Fischbraten mit warmem Lichtkegel
    const campGlow = this.add.circle(445, 348, 30, 0xf97316, 0.22).setDepth(346);
    this.lightGlows.push({ circle: campGlow, baseAlpha: 0.22, phase: 1.2 });
    const fireNode = this.addNode('egypt_campfire', 'objects', 'fire0', 445, 348);
    fireNode.sprite.anims.play('fire', true);
    fireNode.sprite.setDepth(348);
    fireNode.label = this.addLabel(445, 326, '🔥 Lagerfeuer (Fisch braten)', '#f97316');

    // Echter 16-Bit-Fischgrund mit geflochtener Reuse am Holzsteg
    const fishSpot = this.addNode('egypt_fish_spot', 'port_tiles', 'fish_trap_wicker', 602, 348);
    fishSpot.sprite.setScale(0.6);
    fishSpot.sprite.setDepth(349);
    fishSpot.label = this.addLabel(602, 326, '🎣 Nilbarsch-Fischgrund (E)', '#38bdf8');

    // Authentisches 16-Bit-Nil-Segelboot (Feluke) am Steg
    this.placeProp(652, 396, 'city_b01', 'nile_felucca', {
      scale: 0.68,
      hitW: 36,
      hitH: 14,
      hitOffsetY: 12,
    });
    this.addLabel(652, 366, '⛵ Nil-Feluke', '#93c5fd');

    // =========================================================================
    // 2. KAPITEL 2+: NILSCHWEMME, NILOMETER & OASE (Ameni)
    // =========================================================================
    if (state.chapter >= 2) {
      const nilo = this.addNode('egypt_nilometer', 'city_b02', 'stele_nilometer', 588, 276);
      nilo.sprite.setScale(0.75);
      nilo.sprite.setDepth(276);
      nilo.label = this.addLabel(588, 250, '📏 Antikes Nilometer (E)', '#67e8f9');

      // Erntekörbe, Kornsäcke, Weizengarben & Wasseramphoren am Feldrand
      this.placeProp(396, 232, 'city_b04', 'wheat_sheaf', { scale: 0.42 });
      this.placeProp(396, 254, 'city_b04', 'grain_basket', { scale: 0.38 });
      this.placeProp(548, 198, 'city_b02', 'amphora_red', { scale: 0.38 });
      this.placeProp(494, 192, 'city_b02', 'water_basin_square', { scale: 0.48 });

      // Hochdetaillierte Dorf- und Acker-Props (aus Steinzeit-Adaption)
      this.placeProp(402, 282, 'prop_haystack', undefined, { scale: 0.65, hitW: 22, hitH: 12, hitOffsetY: 8 });
      this.placeProp(432, 278, 'prop_water_trough', undefined, { scale: 0.6, hitW: 20, hitH: 10, hitOffsetY: 6 });
      this.placeProp(542, 272, 'prop_pots_group', undefined, { scale: 0.6, hitW: 18, hitH: 10, hitOffsetY: 6 });
      this.placeProp(566, 344, 'prop_clay_pile', undefined, { scale: 0.6, hitW: 20, hitH: 10, hitOffsetY: 6 });
    }

    // Echte 16-Bit-Dattelpalmen (mit schlanker Stamm-Fußkollision & Ernte-Interaktion)
    const palmPositions = [
      [446, 122],
      [500, 120],
      [548, 148],
      [356, 302],
      [434, 382],
      [358, 476],
      [185, 475],
      [242, 488],
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
      palmNode.label = this.addLabel(px, py - 10, '🌴 Dattelpalme (E)', '#fde047');
    }

    // Wüstensteine & Felsblöcke (mit kompakter Fuß-Kollision)
    const rockClusters = [
      [74, 268],
      [65, 360],
      [82, 392],
      [274, 462],
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
      [88, 442],
      [95, 485],
      [296, 48],
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
      this.placeProp(356, 102, 'city_b01', 'palace_colonnade', {
        scale: 0.92,
        hitW: 72,
        hitH: 22,
        hitOffsetY: 20,
      });
      this.placeProp(298, 156, 'egypt_pillar', undefined, {
        scale: 0.5,
        hitW: 12,
        hitH: 10,
        hitOffsetY: 20,
      });
      this.placeProp(414, 156, 'egypt_pillar', undefined, {
        scale: 0.5,
        hitW: 12,
        hitH: 10,
        hitOffsetY: 20,
      });
      this.placeProp(356, 138, 'city_b01', 'throne_gold', { scale: 0.65 });
      this.placeProp(268, 198, 'city_b01', 'statue_lion_l', { scale: 0.65 });
      this.placeProp(422, 198, 'city_b01', 'statue_lion_r', { scale: 0.65 });
      this.addTorchWithGlow(332, 162, 0.65);
      this.addTorchWithGlow(380, 162, 0.65);
      this.placeProp(368, 218, 'prop_pots_group', undefined, { scale: 0.65, hitW: 18, hitH: 10, hitOffsetY: 6 });
      this.placeProp(272, 224, 'prop_wood_stack', undefined, { scale: 0.65, hitW: 20, hitH: 10, hitOffsetY: 6 });
      this.addLabel(356, 70, '🏛️ Königlicher Hof des Wesirs', '#f59e0b');
    }

    // =========================================================================
    // 4. KAPITEL 4+: TEMPELBEZIRK, SCHREIBER & BALSAMIERUNG (Ani)
    // =========================================================================
    if (state.chapter >= 4) {
      // Großer Tempel-Pylon mit Hieroglyphen-Inschriften
      this.placeProp(248, 276, 'city_b01', 'temple_ornate', {
        scale: 0.95,
        hitW: 76,
        hitH: 24,
        hitOffsetY: 22,
      });
      this.addLabel(248, 238, '📜 Heiliger Tempel & Hieroglyphenwand', '#a78bfa');

      // Götterstatuen (Anubis & Thot), Opfertisch, Kanopenkrüge & Gold-Sarkophag
      this.placeProp(186, 336, 'city_b01', 'statue_thoth', { scale: 0.72 });
      this.placeProp(310, 336, 'city_b01', 'statue_anubis', { scale: 0.72 });
      this.placeProp(248, 338, 'city_b01', 'table_offering', { scale: 0.58 });
      this.placeProp(134, 350, 'city_b01', 'canopic_falcon', { scale: 0.38 });
      this.placeProp(134, 372, 'city_b01', 'canopic_jackal', { scale: 0.38 });
      this.addTorchWithGlow(216, 298, 0.65);
      this.addTorchWithGlow(280, 298, 0.65);

      const sarcNode = this.addNode('egypt_sarcophagus', 'city_b01', 'sarcophagus_gold', 134, 416);
      sarcNode.sprite.setScale(0.75);
      sarcNode.sprite.setDepth(416);
      sarcNode.label = this.addLabel(134, 390, '⚱️ Königlicher Sarkophag (E)', '#c084fc');
    }

    // =========================================================================
    // 5. KAPITEL 5+: GROSSBAUSTELLE GIZEH, STEINBRUCH & SPHINX (Hemiunu)
    // =========================================================================
    if (state.chapter >= 5) {
      // Stufenpyramide im westlichen Hintergrund + Große Cheops-Pyramide
      this.placeProp(36, 54, 'city_b01', 'pyramid_step', {
        scale: 0.48,
        hitW: 38,
        hitH: 14,
        hitOffsetY: 12,
      });

      this.placeProp(118, 66, 'egypt_pyramid', undefined, {
        scale: 0.52,
        hitW: 78,
        hitH: 24,
        hitOffsetY: 20,
      });
      this.addLabel(116, 26, '🔺 Große Pyramide von Gizeh (E)', '#fef08a');
      const pyrNode = this.addNode('egypt_pyramid', 'desert_tileset', 'stone_flat', 116, 98);
      pyrNode.sprite.setVisible(false);

      // Die Große Sphinx von Gizeh (mit exakter Fuß-Hitbox)
      this.placeProp(162, 226, 'egypt_sphinx', undefined, {
        scale: 0.38,
        hitW: 56,
        hitH: 18,
        hitOffsetY: 16,
      });
      this.addLabel(162, 194, '🦁 Große Sphinx von Gizeh (E)', '#fef08a');
      const sphNode = this.addNode('egypt_sphinx', 'desert_tileset', 'stone_flat', 162, 236);
      sphNode.sprite.setVisible(false);

      // 16-Bit-Sonnen-Obelisken
      this.placeProp(188, 72, 'city_b01', 'obelisk_tall_1', {
        scale: 0.68,
        hitW: 16,
        hitH: 12,
        hitOffsetY: 20,
      });

      // Tura-Kalksteinbrüche mit behauenen Quadern & Spitzhacke
      const q1 = this.addNode('egypt_quarry', 'city_b04', 'limestone_blocks', 64, 134);
      q1.sprite.setScale(0.75);
      q1.sprite.setDepth(134);
      q1.label = this.addLabel(64, 110, '⛏️ Tura-Kalksteinbruch (E)', '#fde047');
      this.placeProp(36, 134, 'city_b02', 'tool_pickaxe', { scale: 0.38 });

      const q2 = this.addNode('egypt_quarry', 'city_b02', 'stone_blocks_pile', 54, 186);
      q2.sprite.setScale(0.75);
      q2.sprite.setDepth(186);
      q2.label = this.addLabel(54, 162, '⛏️ Tura-Kalksteinbruch (E)', '#fde047');

      // Gestapeltes Bauholz & Rollbalken (echte Holzstämme statt Palme!)
      const t1 = this.addNode('egypt_timber', 'city_b04', 'timber_logs', 86, 214);
      t1.sprite.setScale(0.75);
      t1.sprite.setDepth(214);
      t1.label = this.addLabel(86, 190, '🪓 Bauholz & Rollbalken (E)', '#b45309');

      // Baustellenrampe mit Transportschlitten auf der Lehmbahn
      const ramp = this.addNode('egypt_sledge_ramp', 'city_b02', 'cargo_wagon_full', 102, 166);
      ramp.sprite.setScale(0.65);
      ramp.sprite.setDepth(166);
      ramp.label = this.addLabel(102, 142, '🪵 Baustellenrampe & Schlitten (E)', '#60a5fa');
      this.placeProp(112, 248, 'prop_wood_stack', undefined, { scale: 0.65, hitW: 22, hitH: 12, hitOffsetY: 8 });
    }

    // =========================================================================
    // 6. KAPITEL 6+: NILHAFEN, FERNHANDELSBASAR & SCHATZKAMMER (Baki)
    // =========================================================================
    if (state.chapter >= 6) {
      // Große 16-Bit-Frachtbarke am Hafenpier
      const barge = this.addNode('egypt_cargo_barge', 'city_b01', 'nile_cargo_barge', 648, 486);
      barge.sprite.setScale(0.78);
      barge.sprite.setDepth(486);
      barge.label = this.addLabel(648, 452, '⛵ Römische Getreidebarke (E)', '#93c5fd');

      // Fässer & Frachtkisten am Pier
      this.placeProp(582, 534, 'city_b05', 'crate_wood', { scale: 0.40 });
      this.placeProp(560, 534, 'city_b05', 'barrel_wood', { scale: 0.40 });

      // Interaktiver Haupt-Basarstand (öffnet bei E direkt das Handelsmenü!)
      const bazaarNode = this.addNode('egypt_bazaar_stall', 'city_b05', 'bazaar_punt_incense', 492, 482);
      bazaarNode.sprite.setScale(0.65);
      bazaarNode.sprite.setDepth(482);
      this.addFootprintZone(492, 492, 44, 16);
      bazaarNode.label = this.addLabel(492, 448, '🏺 Fernhandels-Basar (E / H)', '#f59e0b');

      // Lebendige Markt-Umgebung: Gewürztische, Leinenstand, Beduinenzelt & Schatztruhen
      this.placeProp(408, 506, 'city_b03', 'canopy_gold', {
        scale: 0.58,
        hitW: 40,
        hitH: 16,
        hitOffsetY: 14,
      });
      this.placeProp(454, 532, 'city_b02', 'market_table_spices', { scale: 0.55 });
      this.placeProp(492, 532, 'city_b02', 'market_table_fruits', { scale: 0.55 });
      this.placeProp(448, 448, 'city_b01', 'chest_turquoise', {
        scale: 0.42,
        hitW: 18,
        hitH: 10,
        hitOffsetY: 4,
      });
      this.placeProp(416, 438, 'city_b01', 'statue_pharaoh', { scale: 0.58 });
      this.addTorchWithGlow(524, 462, 0.65);
      this.addLabel(432, 418, '👑 Königliche Schatzkammer', '#fde047');
    }
  }

  private placeEgyptResources(): void {
    // A. 4 Papyrus-Schilf-Bestände am sumpfigen Flussrand (echte hohe Papyrusstauden)
    const reeds = [
      [590, 120],
      [596, 218],
      [590, 422],
      [608, 542],
    ];
    reeds.forEach(([x, y]) => {
      const n = this.addNode('egypt_papyrus', 'city_b01', 'papyrus_clump_tall', x, y);
      n.sprite.setScale(0.68);
      n.sprite.setDepth(y);
      n.label = this.addLabel(x, y - 20, '🌿 Papyrus-Schilf (E)', '#86efac');
    });

    // B. 3 Akazienäste / Stöcke am Übergang zur Wüste
    const sticks = [
      [478, 156],
      [400, 370],
      [392, 456],
    ];
    sticks.forEach(([x, y]) => {
      const n = this.addNode('egypt_stick', 'desert_tileset', 'bush_small', x, y);
      n.sprite.setDepth(y);
      n.label = this.addLabel(x, y - 16, '🪵 Akazienast (E)', '#fcd34d');
    });

    // C. 3 Wüstenkiesel am Ufersaum
    const pebbles = [
      [226, 202],
      [386, 336],
      [308, 462],
    ];
    pebbles.forEach(([x, y]) => {
      const n = this.addNode('egypt_pebble', 'desert_tileset', 'stone_flat', x, y);
      n.sprite.setDepth(y);
      n.label = this.addLabel(x, y - 16, '🪨 Wüstenkiesel (E)', '#cbd5e1');
    });

    // D. Fruchtbarer Nilschlamm am Flussufer (echter dunkler Lehm-Haufen & Schaufel)
    const mudSpots = [
      [580, 186],
      [588, 318],
    ];
    mudSpots.forEach(([x, y]) => {
      const n = this.addNode('egypt_mud', 'prop_clay_pile', undefined, x, y);
      n.sprite.setScale(1.1);
      n.sprite.setDepth(y);
      this.placeProp(x - 18, y + 2, 'city_b02', 'tool_shovel', { scale: 0.38 });
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
      const ameni = this.addNode('egypt_ameni', 'npc_ameni', 0, 464, 182);
      ameni.sprite.setDepth(182);
      ameni.sprite.anims.play('idle-ameni', true);
      ameni.label = this.addLabel(464, 157, '🌾 Feldhüter Ameni (Kap. 2)', '#fde047', ch === 2);

      const kheti = this.addNode('egypt_kheti', 'npc_kheti', 0, 520, 182);
      kheti.sprite.setDepth(182);
      kheti.sprite.anims.play('idle-kheti', true);
      kheti.label = this.addLabel(520, 157, '👩‍🌾 Bäuerin Kheti', '#86efac');

      // 16-Bit Nil-Nutztiere der Bauern: Hathor-Pflugochse, Jungkalb, Schilfziegen & Dorfhühner
      const ox = this.add.sprite(380, 290, 'sdv_cow', 4).setScale(1.0).setDepth(290);
      const oxLbl = this.addLabel(380, 270, '🐂 Pflugochse', '#fef08a');
      this.wildlife.addAnimal({
        kind: 'cow',
        sprite: ox,
        bounds: { minX: 360, maxX: 410, minY: 280, maxY: 330 },
        speed: 14,
        animPrefix: 'cow',
        idleAnim: 'cow-idle',
        walkAnim: 'cow-walk-right',
        specialAnim: 'cow-graze',
        labelOffsetY: -20,
        syncLabel: (nx, ny) => oxLbl.setPosition(nx, ny),
      });

      const calf = this.add.sprite(395, 315, 'sdv_calf', 4).setScale(0.85).setDepth(315);
      this.wildlife.addAnimal({
        kind: 'calf',
        sprite: calf,
        bounds: { minX: 365, maxX: 410, minY: 285, maxY: 330 },
        speed: 15,
        animPrefix: 'calf',
        idleAnim: 'calf-idle',
        walkAnim: 'calf-walk-right',
        specialAnim: 'calf-graze',
      });

      const goat1 = this.add.sprite(425, 298, 'sdv_goat', 4).setScale(1.0).setDepth(298);
      const goatLbl = this.addLabel(425, 280, '🐐 Schilfziege', '#bbf7d0');
      this.wildlife.addAnimal({
        kind: 'goat',
        sprite: goat1,
        bounds: { minX: 410, maxX: 450, minY: 280, maxY: 330 },
        speed: 16,
        animPrefix: 'goat',
        idleAnim: 'goat-idle',
        walkAnim: 'goat-walk-right',
        specialAnim: 'goat-graze',
        labelOffsetY: -18,
        syncLabel: (nx, ny) => goatLbl.setPosition(nx, ny),
      });

      const goatBaby = this.add.sprite(438, 320, 'sdv_goat_baby', 4).setScale(0.85).setDepth(320);
      this.wildlife.addAnimal({
        kind: 'goat_baby',
        sprite: goatBaby,
        bounds: { minX: 415, maxX: 450, minY: 285, maxY: 330 },
        speed: 15,
        animPrefix: 'goat-baby',
        idleAnim: 'goat-baby-idle',
        walkAnim: 'goat-baby-walk-right',
        specialAnim: 'goat-baby-play',
      });

      const chicken1 = this.add.sprite(460, 290, 'sdv_chicken', 4).setScale(1.0).setDepth(290);
      this.wildlife.addAnimal({
        kind: 'chicken',
        sprite: chicken1,
        bounds: { minX: 445, maxX: 480, minY: 280, maxY: 325 },
        speed: 16,
        animPrefix: 'chicken',
        idleAnim: 'chicken-idle',
        walkAnim: 'chicken-walk-right',
        specialAnim: 'chicken-peck',
      });

      const chick1 = this.add.sprite(470, 305, 'sdv_chick', 4).setScale(0.85).setDepth(305);
      this.wildlife.addAnimal({
        kind: 'chick',
        sprite: chick1,
        bounds: { minX: 448, maxX: 480, minY: 282, maxY: 325 },
        speed: 15,
        animPrefix: 'chick',
        idleAnim: 'chick-idle',
        walkAnim: 'chick-walk-right',
        specialAnim: 'chick-peck',
      });
    }

    // 3. Kapitel 3+: Wesir Nefermaat & Palastwache
    if (ch >= 3) {
      const wesir = this.addNode('egypt_nefermaat', 'npc_nefermaat', 0, 356, 192);
      wesir.sprite.setDepth(192);
      wesir.sprite.anims.play('idle-nefermaat', true);
      wesir.label = this.addLabel(356, 167, '👑 Wesir Nefermaat (Kap. 3)', '#f59e0b', ch === 3);

      const guard = this.addNode('egypt_kheti', 'npc_guard', 0, 324, 192);
      guard.sprite.setDepth(192);
      guard.sprite.anims.play('idle-guard', true);
      guard.label = this.addLabel(324, 174, '🛡️ Königliche Palastwache', '#fbbf24');

      // Flinke Katze am königlichen Getreidespeicher (schützt die Kornkammern vor Mäusen)
      const storageCat = this.add.sprite(412, 168, 'sdv_cat_village', 4).setScale(1.0).setDepth(168);
      const storageCatLbl = this.addLabel(412, 150, '🐈 Speicherkatze', '#fed7aa');
      this.wildlife.addAnimal({
        kind: 'cat_village',
        sprite: storageCat,
        bounds: { minX: 388, maxX: 435, minY: 155, maxY: 185 },
        speed: 18,
        animPrefix: 'cat-village',
        idleAnim: 'cat-village-idle',
        walkAnim: 'cat-village-walk-right',
        specialAnim: 'cat-village-lick',
        labelOffsetY: -18,
        syncLabel: (nx, ny) => storageCatLbl.setPosition(nx, ny),
      });
    }

    // 4. Kapitel 4+: Ober-Schreiber Ani & Einbalsamierer
    if (ch >= 4) {
      const ani = this.addNode('egypt_ani', 'npc_ani', 0, 222, 356);
      ani.sprite.setDepth(356);
      ani.sprite.anims.play('idle-ani', true);
      ani.label = this.addLabel(222, 331, '📜 Ober-Schreiber Ani (Kap. 4)', '#a78bfa', ch === 4);

      const mum = this.addNode('egypt_kheti', 'npc_mummy', 0, 162, 356);
      mum.sprite.setDepth(356);
      mum.sprite.anims.play('idle-mummy', true);
      mum.label = this.addLabel(162, 338, '⚰️ Balsamierer des Anubis', '#cbd5e1');

      // Heilige Bastet-Katze im Tempel-Innenhof
      const bastetCat = this.add.sprite(345, 315, 'sdv_cat_bastet', 4).setScale(1.0).setDepth(315);
      const bastetLbl = this.addLabel(345, 297, '🐱 Heilige Bastet-Katze', '#fde047');
      this.wildlife.addAnimal({
        kind: 'cat_bastet',
        sprite: bastetCat,
        bounds: { minX: 330, maxX: 375, minY: 285, maxY: 335 },
        speed: 15,
        animPrefix: 'cat-bastet',
        idleAnim: 'cat-bastet-idle',
        walkAnim: 'cat-bastet-walk-right',
        specialAnim: 'cat-bastet-lick',
        labelOffsetY: -18,
        syncLabel: (nx, ny) => bastetLbl.setPosition(nx, ny),
      });

      // Ägyptischer Tesem-Jagdhund (Wachhund am Tempel-Pylon)
      const tesemDog = this.add.sprite(290, 275, 'sdv_dog_tesem', 4).setScale(1.0).setDepth(275);
      const tesemLbl = this.addLabel(290, 257, '🐕 Tesem-Jagdhund', '#fef08a');
      this.wildlife.addAnimal({
        kind: 'dog_tesem',
        sprite: tesemDog,
        bounds: { minX: 270, maxX: 310, minY: 260, maxY: 295 },
        speed: 17,
        animPrefix: 'dog-tesem',
        idleAnim: 'dog-tesem-idle',
        walkAnim: 'dog-tesem-walk-right',
        specialAnim: 'dog-tesem-wag',
        labelOffsetY: -18,
        syncLabel: (nx, ny) => tesemLbl.setPosition(nx, ny),
      });
    }

    // 5. Kapitel 5+: Baumeister Hemiunu
    if (ch >= 5) {
      const hemi = this.addNode('egypt_hemiunu', 'npc_hemiunu', 0, 116, 204);
      hemi.sprite.setDepth(204);
      hemi.sprite.anims.play('idle-hemiunu', true);
      hemi.label = this.addLabel(116, 179, '📐 Baumeister Hemiunu (Kap. 5)', '#fef08a', ch === 5);

      // Schnelle Afrikanische Strauße auf den offenen Gizeh-Wüstendünen
      const ostrich = this.add.sprite(90, 440, 'sdv_ostrich', 4).setScale(1.0).setDepth(440);
      const ostrichLbl = this.addLabel(90, 422, '🪶 Wüstenstrauß', '#fde68a');
      this.wildlife.addAnimal({
        kind: 'ostrich',
        sprite: ostrich,
        bounds: { minX: 60, maxX: 150, minY: 410, maxY: 480 },
        speed: 22,
        animPrefix: 'ostrich',
        idleAnim: 'ostrich-idle',
        walkAnim: 'ostrich-walk-right',
        specialAnim: 'ostrich-peck',
        labelOffsetY: -18,
        syncLabel: (nx, ny) => ostrichLbl.setPosition(nx, ny),
      });

      const babyOstrich = this.add.sprite(120, 450, 'sdv_ostrich_baby', 4).setScale(0.85).setDepth(450);
      this.wildlife.addAnimal({
        kind: 'ostrich_baby',
        sprite: babyOstrich,
        bounds: { minX: 65, maxX: 145, minY: 415, maxY: 480 },
        speed: 20,
        animPrefix: 'ostrich-baby',
        idleAnim: 'ostrich-baby-idle',
        walkAnim: 'ostrich-baby-walk-right',
        specialAnim: 'ostrich-baby-peck',
      });
    }

    // 6. Kapitel 6+: Hafenmeister Baki, Phönizischer Holzhändler & Römischer Senator
    if (ch >= 6) {
      const baki = this.addNode('egypt_baki', 'npc_baki', 0, 552, 474);
      baki.sprite.setDepth(474);
      baki.sprite.anims.play('idle-baki', true);
      baki.label = this.addLabel(552, 449, '⚓ Hafenmeister Baki (Kap. 6)', '#60a5fa', ch === 6);

      const trader = this.addNode('egypt_cedar_trader', 'npc_senbi', 0, 576, 498);
      trader.sprite.setDepth(498);
      trader.sprite.anims.play('idle-senbi', true);
      trader.label = this.addLabel(576, 473, '🌲 Phönizischer Holzhändler (E)', '#38bdf8');

      const envoy = this.addNode('egypt_roman_envoy', 'npc_enki', 0, 536, 516);
      envoy.sprite.setDepth(516);
      envoy.sprite.anims.play('idle-enki', true);
      envoy.label = this.addLabel(536, 491, '🏛️ Senator Cornelius aus Rom (E)', '#f87171');

      // Exotischer Punt-Papagei am Nilhafen-Basar
      const puntParrot = this.add.sprite(575, 505, 'sdv_parrot', 4).setScale(1.0).setDepth(505);
      const parrotLbl = this.addLabel(575, 487, '🦜 Punt-Papagei', '#f43f5e');
      this.wildlife.addAnimal({
        kind: 'parrot',
        sprite: puntParrot,
        bounds: { minX: 565, maxX: 605, minY: 490, maxY: 535 },
        speed: 14,
        animPrefix: 'parrot',
        idleAnim: 'parrot-idle',
        walkAnim: 'parrot-hop-right',
        specialAnim: 'parrot-flap',
        labelOffsetY: -18,
        syncLabel: (nx, ny) => parrotLbl.setPosition(nx, ny),
      });
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
        const node = this.addNode('plot', 'farm_soil_raw', undefined, px, py);
        node.plotId = i;
        node.sprite.setDisplaySize(24, 24).setDepth(py);
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
    // A. Nil-Schildkröte (sonnt sich auf der Sandbank am Nilufer & schwimmt im Schilfwasser)
    const turtle = this.add.sprite(616, 360, 'sdv_turtle', 4).setScale(1.0).setDepth(360);
    const turtleLbl = this.addLabel(616, 342, '🐢 Nil-Schildkröte', '#86efac');
    this.wildlife.addAnimal({
      kind: 'turtle',
      sprite: turtle,
      bounds: { minX: 606, maxX: 645, minY: 335, maxY: 395 },
      speed: 10,
      animPrefix: 'turtle',
      idleAnim: 'turtle-idle',
      walkAnim: 'turtle-walk-right',
      specialAnim: 'turtle-peek',
      labelOffsetY: -18,
      syncLabel: (nx, ny) => turtleLbl.setPosition(nx, ny),
    });

    // B. Nil-Singvogel / Reihervogel (pickt am Schilfrand)
    const bird1 = this.add.sprite(568, 340, 'animal_bird', 0).setScale(1.0).setDepth(340);
    bird1.anims.play('idle-bird', true);
  }

  private placeEgyptRelics(): void {
    const ch = state.chapter;

    const spawnRelic = (kind: Kind, x: number, y: number, labelText: string) => {
      // In-World-Entdeckungsmarker gemäß snes-history-game Skill (§ 2.6)
      const n = this.addNode(kind, 'relic_marker_glow', undefined, x, y);
      n.sprite.setOrigin(0.5, 0.8).setScale(0.85).setDepth(y);
      this.tweens.add({
        targets: n.sprite,
        y: y - 4,
        scale: 0.95,
        alpha: 0.85,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      n.label = this.addLabel(x, y - 24, labelText, '#fde047');
      return n;
    };

    // 1. Skarabäus-Amulett (ab Kapitel 1 am Schilfufer)
    if (ch >= 1 && !state.relicsFound.includes('skanabaeus')) {
      spawnRelic('egypt_relic_skanabaeus', 574, 396, '🪲 Skarabäus-Amulett (E)');
    }

    // 2. Kanopenkrug (ab Kapitel 4 nahe der Balsamierungshalle & Sarkophag, entzerrt von Tempelpylon)
    if (ch >= 4 && !state.relicsFound.includes('kanope')) {
      spawnRelic('egypt_relic_kanope', 155, 425, '🏺 Kanopenkrug (E)');
    }

    // 3. Papyrus-Totenbuchrolle (ab Kapitel 4 auf dem offenen Platz südlich des Tempels, entzerrt von Hauswänden)
    if (ch >= 4 && !state.relicsFound.includes('papyrusrolle')) {
      spawnRelic('egypt_relic_papyrusrolle', 235, 415, '📜 Papyrus-Totenbuch (E)');
    }

    // 4. Goldene Totenmaske (ab Kapitel 5 auf dem Gizeh-Plateau)
    if (ch >= 5 && !state.relicsFound.includes('goldmaske')) {
      spawnRelic('egypt_relic_goldmaske', 80, 95, '👑 Goldene Totenmaske (E)');
    }

    // 5. Königliche Schreiberpalette (ab Kapitel 6 am Nilhafen-Basar)
    if (ch >= 6 && !state.relicsFound.includes('pinsel_tinte')) {
      spawnRelic('egypt_relic_pinsel_tinte', 445, 450, '🖌️ Schreiberpalette (E)');
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
        .setScale(1.15)
        .setDepth(b.y);
      this.addTorchWithGlow(b.x, b.y + 2, 0.55);
      if (node.label) {
        node.label.setText('🧱 Königliche Lehmziegelei').setColor('#f59e0b').setY(b.y - 34);
      }
    } else if (b.id === 'speicher') {
      node.builtSprite = this.add
        .image(b.x, b.y - 8, 'city_b01', 'granary_compound')
        .setScale(0.85)
        .setDepth(b.y);
      if (node.label) {
        node.label.setText('🌾 Königlicher Kornspeicher').setColor('#fde047').setY(b.y - 44);
      }
    } else if (b.id === 'schreiberhaus') {
      node.builtSprite = this.add
        .image(b.x, b.y - 8, 'city_b01', 'scribes_house')
        .setScale(0.85)
        .setDepth(b.y);
      if (node.label) {
        node.label.setText('📜 Haus des Lebens (Per Ankh)').setColor('#a78bfa').setY(b.y - 44);
      }
    } else if (b.id === 'wabet') {
      node.builtSprite = this.add
        .image(b.x, b.y - 8, 'city_b01', 'temple_shrine')
        .setScale(0.85)
        .setDepth(b.y);
      if (node.label) {
        node.label.setText('⚱️ Balsamierung (Wabet)').setColor('#c084fc').setY(b.y - 44);
      }
    } else if (b.id === 'steinmetz') {
      node.builtSprite = this.add
        .image(b.x, b.y - 6, 'city_b02', 'stonemason_yard')
        .setScale(0.75)
        .setDepth(b.y);
      if (node.label) {
        node.label.setText('🏗️ Bauhütte der Großbaustelle').setColor('#fef08a').setY(b.y - 38);
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

      // Lebendige Nil-Ökologie & wandernde Fauna
      if (!state.modal && !this.sleeping && this.player) {
        this.wildlife.update(delta, this.player.x, this.player.y);
        if (this.companion) {
          this.companion.update(this.player, this.nodes, delta);
        }
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
    const dogDist = this.companion?.getDistanceTo(this.player.x, this.player.y) ?? Infinity;
    if (n) {
      state.hint = this.hintFor(n);
    } else if (dogDist < 44) {
      state.hint = '🐕 Anubis (E: Streicheln)';
    } else {
      state.hint = '';
    }

    const ePressed = Phaser.Input.Keyboard.JustDown(this.wasd.E) || Phaser.Input.Keyboard.JustDown(this.wasd.SPACE);
    const touchAction = Boolean(state.touch && state.touch.consumeAction());

    if ((ePressed || touchAction) && !state.modal) {
      if (n) {
        this.interact(n);
      } else if (dogDist < 44) {
        this.companion?.pet();
      }
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

    // Single-Proximity DOM-Label Rule (Skill § 1.2 / 2.5):
    // Nur das EINE nächstgelegene Umgebungs-Schild (< 44px) gleichzeitig einblenden!
    let bestProxLbl: DomLabel | null = null;
    let bestProxDist = 44;
    if (!hideAll) {
      for (const lbl of this.domLabels) {
        if (lbl.alwaysVisible || lbl.isQuestTarget) continue;
        const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, lbl.x, lbl.y + 18);
        if (d < bestProxDist) {
          bestProxDist = d;
          bestProxLbl = lbl;
        }
      }
    }

    for (const lbl of this.domLabels) {
      if (hideAll) {
        lbl.el.style.display = 'none';
        continue;
      }

      const shouldShow = Boolean(lbl.alwaysVisible || lbl.isQuestTarget || lbl === bestProxLbl);
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
    if (!p) return;
    if (node.cropSprite) {
      node.cropSprite.destroy();
      node.cropSprite = undefined;
    }

    if (p.stage === 'raw') {
      node.sprite.setTexture('farm_soil_raw').setDisplaySize(24, 24).setOrigin(0.5, 0.5).setAlpha(1);
    } else if (p.stage === 'tilled') {
      node.sprite.setTexture('farm_soil_dry').setDisplaySize(24, 24).setOrigin(0.5, 0.5).setAlpha(1);
    } else if (p.stage === 'seeded') {
      node.sprite.setTexture('farm_soil_seeded').setDisplaySize(24, 24).setOrigin(0.5, 0.5).setAlpha(1);
    } else if (p.stage === 'watered') {
      node.sprite.setTexture('farm_soil_wet').setDisplaySize(24, 24).setOrigin(0.5, 0.5).setAlpha(1);
    } else if (p.stage === 'ripe') {
      // Reifer Emmer-Weizen wächst stolz aus der Erde hervor (48x54 nativ -> 24x27 im Spiel, wie im Steinzeit-Projekt)
      node.sprite.setTexture('farm_wheat_ripe').setDisplaySize(24, 27).setOrigin(0.5, 0.56).setAlpha(1);
    }
  }

  private nearest(): Node | null {
    let best: Node | null = null;
    let minD = REACH;
    for (const n of this.nodes) {
      if (n.readyAt > 0) continue;

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
        return 'Drücke E: Süße Datteln von der Palme pflücken';
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
    this.tweens.killTweensOf(n.sprite);
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
    if (n.label) n.label.el.style.opacity = '0.35';
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
    const ameniBriefings: Record<number, Array<{ text: string }>> = {
      1: [
        { text: 'Die alljährliche Nilflut (<strong>Akhet</strong>) geht zu Ende! Aber wie viel fruchtbaren Schlamm und Wasser hat uns der Strom gebracht?' },
        { text: 'Gehe zum antiken <strong>Nilometer</strong> am Ufer und lies den Pegelstand ab (Taste E).\n\nSteigt das Wasser auf 16 Ellen, erwartet uns ein Rekordjahr! Zu wenig Wasser bringt Hunger, zu viel reißt unsere Hütten fort.' },
      ],
      2: [
        { text: 'Die Flut weicht zurück, doch unsere Felder liegen höher als der Fluss. Wasser fließt niemals von allein bergauf!' },
        { text: 'Deshalb erfanden wir den <strong>Schaduf</strong>: Einen genialen Schwinghebel mit einem schweren Gegengewicht aus Nilschlamm und Stein.' },
        { text: 'Öffne dein <strong>Handwerksmenü (Taste C)</strong> und zimmere den Schaduf-Hebelarm!' },
      ],
      3: [
        { text: 'Der Hebelarm ist perfekt gezimmert! Tritt an den Bauplatz an der Uferböschung und errichte das <strong>Schaduf-Schöpfwerk (Taste E)</strong>.' },
      ],
      4: [
        { text: 'Sieh nur, wie leicht der Hebelarm schwingt! Drücke Taste E am errichteten Schaduf.' },
        { text: 'Das schwere Gegengewicht zieht den gefüllten Eimer fast ohne menschlichen Kraftaufwand nach oben. Fülle deinen Tonkrug mit frischem Flusswasser!' },
      ],
      5: [
        { text: 'Der feuchte Nilschlamm auf unseren Feldern ist der nährstoffreichste Boden der Welt!' },
        { text: 'Tritt an eines der Ackerbeete: Lockere mit Taste E den Boden auf und drücke die wertvollen <strong>Emmer-Saat-Körner</strong> hinein.' },
      ],
      6: [
        { text: 'Die glühende Sonne trocknet den Boden rasch aus. Ohne Wasser verbrennt der Keimling im Sand!' },
        { text: 'Gieße dein frisch gesästes Beet nun mit dem geschöpften Nilwasserkrug (Taste E).' },
      ],
      7: [
        { text: 'Während das Getreide heranreift, stärken wir uns mit der süßen Gabe der Oase: <strong>Datteln</strong>!' },
        { text: 'Dattelpalmen schenken uns energiereiche Früchte, die sich monatelang lagern lassen. Pflücke 3× Datteln von den Oasenpalmen (Taste E).' },
      ],
      8: [
        { text: 'Schau hinaus auf die Felder: Die Ähren wiegen sich goldgelb im Wind!' },
        { text: '<strong>Emmer</strong> ist das wichtigste Urgetreide Ägyptens. Nimm deine Erntesichel und schneide das reife Korn ab (Taste E)!' },
      ],
    };

    const ameniNodes = ameniBriefings[q] || [
      { text: `Deine aktuelle Aufgabe:\n${ch.quests[q]}` },
      { text: `Tipp:\n${curHint}` },
    ];
    state.openDialog({
      speaker: 'Feldhüter Ameni',
      nodes: ameniNodes,
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
        nodes: [
          { text: 'Großartig gefischt und gesammelt! Du beweist, dass du die Natur des Nilufers verstehst.' },
          { text: 'Nun wollen wir prüfen, was du über das Land Kemet und die Lebensader des Nils gelernt hast. Tritt vor zur Wissensprüfung!' },
          ...(ch.quiz as any),
        ],
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
    const senbiBriefings: Record<number, Array<{ text: string }>> = {
      1: [
        { text: 'Sieh dir das hohe Schilf am Flussufer an! Die Ägypter nennen es <strong>Papyrus</strong>.' },
        { text: 'Für uns Flussnomaden ist es das wertvollste Geschenk des Nils: Wir flechten daraus Körbe, Matten, feste Stricke und bauen sogar ganze Boote daraus!' },
        { text: 'Schneide <strong>3× Papyrus-Schilf</strong> am sumpfigen Flussrand mit der Taste E.' },
      ],
      2: [
        { text: 'Ein Fischer ohne Werkzeug bleibt am Nil hungrig! Mit bloßen Händen fängt man im schnellen Strom keine Beute.' },
        { text: 'Suche am sandigen Ufer nach <strong>2 glatten Wüstenkieseln</strong> als Senkgewichte und sammle <strong>2 Akazienstöcke</strong> am Wüstenrand (E).' },
      ],
      3: [
        { text: 'Jetzt binden wir die Reuse! Aus den Stöcken, Steinen und zähen Papyrusfasern flechten wir einen kegelförmigen Korb.' },
        { text: 'Der Fisch schwimmt hinein, findet aber durch die nach innen zeigenden Schilfspitzen nicht mehr heraus. Öffne dein <strong>Handwerksmenü (Taste C)</strong> und stelle die Fischreuse her!' },
      ],
      4: [
        { text: 'Deine Reuse ist meisterhaft geflochten! Nun ab ans Wasser.' },
        { text: 'Gehe zum Holzsteg am Nilufer und platziere die Reuse am <strong>Nilbarsch-Fischgrund (Taste E)</strong>. Die Fische hier sind groß und nahrhaft!' },
      ],
      5: [
        { text: 'Ein herrlicher Fang! Doch in der brennenden Wüstensonne verdirbt roher Fisch binnen Stunden.' },
        { text: 'Tritt an unser <strong>Lagerfeuer (Taste E)</strong> und brate den Fisch knusprig. Gebratener Fisch spendet dir Lebenskraft!' },
      ],
    };

    const senbiNodes = senbiBriefings[q] || [
      { text: `Deine aktuelle Aufgabe:\n${ch.quests[q]}` },
      { text: `Tipp:\n${curHint}` },
    ];
    state.openDialog({
      speaker: 'Fischer Senbi',
      nodes: senbiNodes,
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
        speaker: 'Wesir Nefermaat – Königliche Abgabe & Wissensprüfung',
        nodes: [
          { text: 'Wunderbar! Du bringst die königlichen Lohnrationen: 2 knusprige Emmerbrote und den Krug dickes Gerstenbier.' },
          { text: 'Damit ist die Entlohnung unserer Bauleute am Kornspeicher gesichert. Brot und Bier sind das Fundament unseres Staates – kein Arbeiter in Kemet muss darben!' },
          { text: 'Nun wollen wir prüfen, ob du die Grundpfeiler des Pharaonenstaates, der Vorratswirtschaft und des Arbeiterlohns verstanden hast. Tritt vor zur Wissensprüfung!' },
          ...(ch.quiz as any),
        ],
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
    const nefermaatBriefings: Record<number, Array<{ text: string }>> = {
      1: [
        { text: 'Als oberster Wesir organisiere ich den Staat für den Gottkönig. Doch um Städte und Speicher zu errichten, fehlt uns Holz in der Wüste.' },
        { text: 'Dafür schenkt uns der Nil einen unerschöpflichen Schatz: <strong>Fruchtbaren Nilschlamm</strong>!\n\nGehe an das Flussufer und grabe mit der Schaufel fetten Schlamm aus (Taste E).' },
      ],
      2: [
        { text: 'Aus feuchtem Schlick allein kann man keine stabilen Wände errichten. Wir müssen den Schlamm mit gehäckseltem Stroh mischen und in Holzformen pressen.' },
        { text: 'Errichte die <strong>Königliche Lehmziegelei</strong> am Bauplatz nördlich der Felder (Taste E)!' },
      ],
      3: [
        { text: 'Das Geheimnis der ägyptischen Ziegel: Wir brauchen kein Holzfeuer zum Brennen!\n\nDie glühende Sonne Kemets trocknet die Schlammziegel steinhart. Öffne das Handwerksmenü (Taste C) und streiche <strong>3× sonnengetrocknete Lehmziegel</strong>.' },
      ],
      4: [
        { text: 'Ein weiser Herrscher sorgt vor! In fruchtbaren Jahren füllen wir gewaltige runde Silos, um Hungersnöte in Dürrejahren abzuwenden.' },
        { text: 'Errichte den <strong>Königlichen Kornspeicher</strong> hier am Palasthof (Taste E)!' },
      ],
      5: [
        { text: 'Getreide muss vor Feuchtigkeit, Käfern und Wüstenmäusen geschützt werden.' },
        { text: 'Auf der Töpferscheibe formen wir dichte Vorratskrüge. Brenne einen <strong>gebrannten Vorratstopf</strong> im Handwerksmenü (Taste C)!' },
      ],
      6: [
        { text: 'Im heißen Klima Ägyptens ist schwere Schafwolle unerträglich. Wir bauen Flachs an und spinnen daraus schneeweißes, kühles <strong>Leinentuch</strong>.' },
        { text: 'Es ist das edle Gewand der Priester, Beamten und Schreiber. Webe feines Leinentuch im Handwerk (Taste C)!' },
      ],
      7: [
        { text: 'Hör gut zu, junger Baumeister! Das ist eine der wichtigsten Lektionen über das Alte Ägypten:' },
        { text: 'In unserem gesamten Reich gibt es <strong>kein Münzgeld</strong>! Es gibt weder Gold- noch Silbermünzen.' },
        { text: 'Aber wie entlohnen wir die Zehntausende von Zimmerleuten, Deichbauern und Steinmetzen für ihre schwere Arbeit?\n\nDie Antwort lautet: <strong>Mit Naturalien als Arbeiterlohn (*Depu*)!</strong>' },
        { text: 'Die staatliche Währung und das tägliche Zahlungsmittel sind <strong>Emmerbrot</strong> und nahrhaftes, dickflüssiges <strong>Gerstenbier</strong>. Ein Handwerker erhält feste Tagesrationen – typischerweise 5 Brote und 2 Krüge Bier am Tag!' },
        { text: 'Brot und Bier sind Nahrung und Geld in einem: Wer Rationen spart, kann sie auf dem Markt gegen Töpfe, Sandalen oder Fisch eintauschen.' },
        { text: 'Backe nun am Feuer <strong>2× Emmerbrot</strong> und braue <strong>1× dickes Bier</strong> (Taste C), um die Entlohnung für unsere Speicherbauer vorzubereiten!' },
      ],
    };

    const nefermaatNodes = nefermaatBriefings[q] || [
      { text: `Deine aktuelle Aufgabe:\n${ch.quests[q]}` },
      { text: `Tipp:\n${curHint}` },
    ];
    state.openDialog({
      speaker: 'Wesir Nefermaat',
      nodes: nefermaatNodes,
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
        nodes: [
          { text: 'Meisterhaft! Du hast das Totenbuch, die heiligen Kanopen und den Schutzskarabäus vorbereitet.' },
          { text: 'Nun prüfen wir dein Wissen über die Hieroglyphen, die Götterwelt und das Totengericht des Osiris!' },
          ...(ch.quiz as any),
        ],
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
    const aniBriefings: Record<number, Array<{ text: string }>> = {
      1: [
        { text: 'Willkommen im Tempelbezirk! Die Ägypter sagen: „Schreiber sein ist das schönste Los auf Erden.“' },
        { text: 'Ein Schreiber muss keine schweren Steine schleppen und keinen Pflug führen. Er dient Gott Thot, dem Schutzpatron der Weisheit.\n\nErrichte das <strong>Haus des Lebens (Per Ankh)</strong> am Bauplatz (Taste E)!' },
      ],
      2: [
        { text: 'Auf Stein zu meißeln dauert Tage. Deshalb erfand Ägypten das erste Papier der Menschheit: <strong>Papyrus</strong>!' },
        { text: 'Wir schneiden das weiße Innenmark der Papyrusstängel in dünne Streifen, legen sie kreuzweise übereinander und pressen sie fest zusammen. Der Pflanzensaft klebt sie untrennbar aneinander.' },
        { text: 'Presse eine <strong>saubere Papyrusrolle</strong> im Handwerksmenü (Taste C)!' },
      ],
      3: [
        { text: 'Zum Schreiben schneiden wir ein zähes Binsenrohr schräg an und kauen die Spitze faserig wie einen feinen Haarpinsel.' },
        { text: 'Die schwarze Rußtinte rühren wir aus Lampenruß, Wasser und Gummiarabikum an. Sie verblasst selbst nach Jahrtausenden nicht!\n\nStelle <strong>Binsenpinsel und Rußtinte</strong> her (Taste C).' },
      ],
      4: [
        { text: 'Die wichtigste Pflicht des Schreibers im Staat: Gerechtigkeit und Ordnung (<strong>Maat</strong>).' },
        { text: 'Gehe zum königlichen Kornspeicher und notiere die Maße des abgelieferten Getreides in den Steuerrollen (Taste E)!' },
      ],
      5: [
        { text: 'Für uns Ägypter ist der Tod nicht das Ende, sondern die Pforte zum ewigen Leben im Reich des Osiris.' },
        { text: 'Damit die Seele (Ka und Ba) weiterleben kann, muss der Körper vor der Verwesung bewahrt werden!\n\nErrichte die <strong>Balsamierungswerkstatt (Wabet)</strong> des Gottes Anubis am westlichen Wüstenrand (Taste E).' },
      ],
      6: [
        { text: '70 Tage lang wird der Körper in reinem <strong>Natronsalz</strong> aus den Wüstenseen getrocknet.' },
        { text: 'Die 4 inneren Organe – Magen, Leber, Lunge und Darm – werden entnommen und in geweihten <strong>Kanopenkrügen</strong> mit den Köpfen der Horussöhne bestattet.' },
        { text: 'Tausche Natronsalz am Basar und meißle einen Kanopenkrug im Handwerk (Taste C)!' },
      ],
      7: [
        { text: 'Das Herz aber bleibt im Körper! Denn beim <strong>Totengericht des Osiris</strong> wiegt Anubis das Herz gegen die Feder der Göttin Maat.' },
        { text: 'War der Mensch gerecht, ist das Herz federleicht. Damit das Herz vor Gericht keine Verfehlungen gesteht, legen wir einen <strong>Herz-Skarabäus</strong> auf die Brust.\n\nForme das Schutzamulett im Handwerk (Taste C)!' },
      ],
    };

    const aniNodes = aniBriefings[q] || [
      { text: `Deine aktuelle Aufgabe:\n${ch.quests[q]}` },
      { text: `Tipp:\n${curHint}` },
    ];
    state.openDialog({
      speaker: 'Ober-Schreiber Ani',
      nodes: aniNodes,
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
        nodes: [
          { text: 'Die Große Pyramide ragt in den Himmel und die Sphinx wacht über die Ewigkeit!' },
          { text: 'Tritt vor zur großen Architekten-Prüfung über Baulogistik, Physik und die Monumente von Gizeh.' },
          ...(ch.quiz as any),
        ],
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
    const hemiunuBriefings: Record<number, Array<{ text: string }>> = {
      1: [
        { text: 'Ich bin Hemiunu, oberster Baumeister des Gottkönigs Cheops. Hier auf dem Wüstenplateau von Gizeh errichten wir das gewaltigste Bauwerk der Menschheit!' },
        { text: 'Vergiss alle Märchen über Sklavenpeitschen: Zehntausende freie Bauern und Steinmetze erbauen die Pyramide während der Flutzeit mit Stolz und werden bestens mit Fleisch, Brot und Bier versorgt!' },
        { text: 'Errichte zuerst die <strong>Bauhütte und Steinmetzwerkstatt</strong> am Fuße des Plateaus (Taste E).' },
      ],
      2: [
        { text: 'Für die glatte Außenhülle nutzen wir feinsten, blendend weißen <strong>Tura-Kalkstein</strong>.' },
        { text: 'Unsere Steinmetze treiben trockene Holzkeile in die Felsspalten und gießen Wasser darauf. Das quellende Holz sprengt selbst 10-Tonnen-Quader ab!\n\nBrich 3× Kalksteinquader im Steinbruch (Taste E).' },
      ],
      3: [
        { text: 'Räder würden im tiefen Wüstensand versinken und unter 2,5 Tonnen Quadergewicht zerbrechen!' },
        { text: 'Deshalb ziehen wir die Blöcke auf gewaltigen <strong>Holzschlitten</strong> über befestigte Rampen. Schlage schweres Bauholz für Schlitten und Rollbalken (Taste E).' },
      ],
      4: [
        { text: 'Nun kommt unser größter physikalischer Trick: Wenn wir Nilschlamm und Wasser direkt vor die Schlittenkufen gießen, verflüssigt sich der Sand – <strong>die benötigte Zugkraft halbiert sich</strong>!' },
        { text: 'Befeuchte die Baustellenrampe mit Schlammwasser (Taste E).' },
      ],
      5: [
        { text: 'Das <strong>Pyramidion</strong> – der glänzende Deckstein – krönt die Spitze der Pyramide.' },
        { text: 'Es fängt die ersten Strahlen des Sonnengottes Ra ein. Liefere den polierten Deckstein zur Großen Pyramide (Taste E)!' },
      ],
      6: [
        { text: 'Am Fuße des Aufwegs wacht der König als mächtiger Wüstenlöwe: <strong>Die Große Sphinx von Gizeh</strong>!' },
        { text: 'Aus einem natürlichen Kalksteinfelsen gehauen, beschützt sie die Grabanlage vor bösen Mächten. Tritt heran (Taste E).' },
      ],
      7: [
        { text: 'Die Sphinx blickt unverwandt exakt nach Osten – dorthin, wo am Tag der Tagundnachtgleiche die Sonne über dem Horizont aufsteigt.' },
        { text: 'Vollende die astronomische Ausrichtung der Sphinx (Taste E)!' },
      ],
    };

    const hemiunuNodes = hemiunuBriefings[q] || [
      { text: `Deine aktuelle Aufgabe:\n${ch.quests[q]}` },
      { text: `Tipp:\n${curHint}` },
    ];
    state.openDialog({
      speaker: 'Baumeister Hemiunu',
      nodes: hemiunuNodes,
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
        nodes: [
          { text: 'Das Getreideabkommen ist besiegelt und die Getreidebarke segelt nach Rom!' },
          { text: 'Nun tritt vor zur großen Abschlussprüfung über den Welthandel, die Kornkammer Roms und das Ende der Pharaonenzeit.' },
          ...(ch.quiz as any),
        ],
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
    const bakiBriefings: Record<number, Array<{ text: string }>> = {
      1: [
        { text: 'Ich bin Hafenmeister Baki! Der Nil ist unsere Lebensader, aber das Meer öffnet uns den Welthandel.' },
        { text: 'Bereits Königin Hatschepsut sandte Expeditionen in das geheimnisvolle Land Punt, um aromatischen Weihrauch für die Göttertempel zu erhandeln.' },
        { text: 'Öffne den Basar (Taste H oder Taste E am Basarstand) und erhandle seltenes <strong>Punt-Weihrauchharz</strong> gegen unser Getreide!' },
      ],
      2: [
        { text: 'Ägypten hat Palmen, aber Palmenholz biegt sich und taugt nicht für seetüchtige Schiffe.' },
        { text: 'Phönizische Seefahrer aus Byblos bringen uns die mächtigen, duftenden <strong>Zedern des Libanon</strong>. Tausche am Hafenanleger Leinen gegen Zedernholz (Taste E)!' },
      ],
      3: [
        { text: 'Aus den Minen Nubiens holen Karawanen glänzendes Gold – für uns das „Fleisch der Götter“, weil es niemals rostet.' },
        { text: 'Daraus schmieden wir das ewige Antlitz des Herrschers, wie die Goldmaske des Tutanchamun. Schmiede eine <strong>goldene Totenmaske</strong> im Handwerk (Taste C)!' },
      ],
      4: [
        { text: 'Im Westen wächst eine neue Großmacht heran: Das Römische Reich!' },
        { text: 'Rom ist eine Millionenstadt und benötigt täglich unvorstellbare Mengen Korn. Ägypten wird zur lebenswichtigen <strong>„Kornkammer Roms“</strong>!\n\nSchnüre <strong>3× versiegelte Getreidesäcke</strong> im Handwerk (Taste C).' },
      ],
      5: [
        { text: 'Die königliche Frachtbarke liegt am Pier vertäut. Ihre Segel fangen den Nordwind ein, um das Korn meerabwärts zu transportieren.' },
        { text: 'Verlade das ägyptische Getreide auf die Nilbarke (Taste E)!' },
      ],
      6: [
        { text: 'Am Pier wartet Senator Cornelius, Abgesandter des römischen Senats.' },
        { text: 'Besiegle das Getreide- und Friedensabkommen mit Rom (Taste E), um den Wohlstand beider Völker zu sichern!' },
      ],
    };

    const bakiNodes = bakiBriefings[q] || [
      { text: `Deine aktuelle Aufgabe:\n${ch.quests[q]}` },
      { text: `Tipp:\n${curHint}` },
    ];
    state.openDialog({
      speaker: 'Hafenmeister Baki',
      nodes: bakiNodes,
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
      else if (q === 7) {
        this.setCompassTargetByKind('egypt_nefermaat', 'Wesir Nefermaat (Arbeiterlohn-Kontext)');
        state.compassText = '👑 Wesir Nefermaat: Erklärung Arbeiterlohn & Taste C (Brot & Bier)';
      }
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
