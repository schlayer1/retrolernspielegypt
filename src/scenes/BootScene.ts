import Phaser from 'phaser';
import { ITEMS } from '../data/items';
import { state } from '../systems/GameState';

/** Benannte 16x16 und Multi-Tile-Ausschnitte aus desert_tileset.png (224x208 = 14 cols x 13 rows). */
export const DESERT_FRAMES: Record<string, [number, number, number, number]> = {
  // 1. Wüstensand & Dünen (Basis-Böden)
  sand_1: [112, 0, 16, 16],          // (7, 0)
  sand_2: [128, 0, 16, 16],          // (8, 0)
  sand_dune_1: [144, 0, 16, 16],     // (9, 0)
  sand_dune_2: [160, 0, 16, 16],     // (10, 0)
  sand_ripples: [128, 16, 16, 16],   // (8, 1)
  sand_smooth: [144, 16, 16, 16],    // (9, 1)

  // 2. Nil-Wasser & Ufersäume (Autotile-Kanten Sand -> Wasser)
  water_deep: [32, 16, 16, 16],      // (2, 1)
  water_shallow: [48, 16, 16, 16],   // (3, 1)
  shore_w: [16, 16, 16, 16],         // (1, 1) - Westufer (Sand links, Wasser rechts)
  shore_e: [48, 16, 16, 16],         // (3, 1) - Ostufer (Wasser links, Sand rechts)
  shore_n: [32, 0, 16, 16],          // (2, 0) - Nordufer
  shore_s: [32, 32, 16, 16],         // (2, 2) - Südufer
  shore_corner_nw: [16, 0, 16, 16],  // (1, 0)
  shore_corner_ne: [48, 0, 16, 16],  // (3, 0)
  shore_corner_sw: [16, 32, 16, 16], // (1, 2)
  shore_corner_se: [48, 32, 16, 16], // (3, 2)

  // 3. Fruchtbarer Nilschlamm / Silt (Kemet: schwarzer/dunkler Flussboden)
  silt_dark: [0, 80, 16, 16],        // (0, 5)
  silt_patch: [16, 80, 16, 16],      // (1, 5)
  silt_rich: [32, 80, 16, 16],       // (2, 5)
  silt_transition_w: [16, 96, 16, 16], // (1, 6)
  silt_transition_e: [48, 96, 16, 16], // (3, 6)
  silt_transition_n: [32, 80, 16, 16], // (2, 5)
  silt_transition_s: [32, 112, 16, 16],// (2, 7)

  // 4. Wüstensteine & Geröll (Sammelstellen und Deko)
  pebbles: [32, 192, 16, 16],        // (2, 12) - kleine Wüstenkiesel
  stone_flat: [48, 176, 16, 16],     // (3, 11) - flacher Flussstein
  stone_pointy: [32, 176, 16, 16],   // (2, 11) - spitzer Kieselstein
  rocks_small: [0, 144, 32, 16],     // (0..1, 9) - Felsformation 32x16
  rocks_large: [0, 160, 32, 32],     // (0..1, 10..11) - großer Felsblock 32x32

  // 5. Wüsten- & Flussvegetation
  bush_small: [48, 160, 16, 16],     // (3, 10) - kleiner Wüstenstrauch
  bush_wide: [32, 144, 48, 16],      // (2..4, 9) - breites Schilf/Buschwerk 48x16
  cactus_tall: [64, 160, 16, 48],    // (4, 10..12) - hoher Kaktus 16x48
  cactus_small: [48, 192, 16, 16],   // (3, 12) - kleiner Kaktus

  // 6. Echte 16-Bit-Dattelpalme (48x64 px)
  palm_tree: [80, 144, 48, 64],      // (5..7, 9..12) - Palmkrone & Stamm 48x64!

  // 7. Sandstein-Klippenplateau
  cliff_tl: [128, 144, 16, 16],      // (8, 9)
  cliff_top: [144, 144, 16, 16],     // (9, 9)
  cliff_tr: [176, 144, 16, 16],      // (11, 9)
  cliff_l: [128, 160, 16, 16],       // (8, 10)
  cliff_r: [176, 160, 16, 16],       // (11, 10)
  cliff_bl: [128, 176, 16, 16],      // (8, 11)
  cliff_face: [144, 176, 16, 16],    // (9, 11)
  cliff_br: [176, 176, 16, 16],      // (11, 11)
};

/** Authentische ägyptische Lehmziegelhäuser (144x48 = 3 Häuser à 48x48 px). */
export const HOUSE_FRAMES: Record<string, [number, number, number, number]> = {
  hut_senbi: [0, 0, 48, 48],         // Fischer-Hütte aus Nilschlamm-Ziegeln
  house_mid: [48, 0, 48, 48],        // Lehmziegelhaus mit Sonnendach
  house_large: [96, 0, 48, 48],      // 2-stöckiges Palasthaus mit Dachterrasse
};

/** Benannte Ausschnitte aus gfx/objects.png. */
export const OBJECT_FRAMES: Record<string, [number, number, number, number]> = {
  stump: [0, 160, 32, 32],
  bigrock: [320, 4, 32, 30],
  bubble_excl: [32, 128, 16, 16],
  pot: [64, 96, 16, 16],
  ...Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`fire${i}`, [64 + 16 * i, 48, 16, 16]])),
};

/** Benannte Ausschnitte aus gfx/farm.png. */
export const FARM_FRAMES: Record<string, [number, number, number, number]> = {
  soil_raw: [144, 96, 16, 16],
  soil_dry: [176, 48, 16, 16],
  soil_wet: [32, 96, 16, 16],
  wheat_ripe: [288, 0, 16, 32],
  sign_build: [288, 96, 16, 16],
};

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const bar = this.add.rectangle(w / 2 - 60, h / 2, 0, 6, 0xe8c170).setOrigin(0, 0.5);
    this.load.on('progress', (p: number) => (bar.width = 120 * p));

    // 1. Authentische 16-Bit-Tilesets der Epoche
    this.load.image('desert_tileset', 'assets/tilesets/desert_tileset.png');
    this.load.image('desert_houses', 'assets/tilesets/desert_houses.png');
    this.load.image('objects', 'assets/gfx/objects.png');
    this.load.image('farm', 'assets/gfx/farm.png');

    // 2. Ägyptische Spielfiguren & NPCs (16x32 Spritesheets, 4-Wege-Animationen)
    this.load.spritesheet('player_egypt_male', 'assets/gfx/player_egypt_male.png', { frameWidth: 16, frameHeight: 32 });
    this.load.spritesheet('player_egypt_female', 'assets/gfx/player_egypt_female.png', { frameWidth: 16, frameHeight: 32 });
    this.load.spritesheet('npc_senbi', 'assets/gfx/npcs/npc_senbi.png', { frameWidth: 16, frameHeight: 32 });
    this.load.spritesheet('npc_ameni', 'assets/gfx/npcs/npc_ameni.png', { frameWidth: 16, frameHeight: 32 });
    this.load.spritesheet('npc_kheti', 'assets/gfx/npcs/npc_kheti.png', { frameWidth: 16, frameHeight: 32 });
    this.load.spritesheet('npc_nefermaat', 'assets/gfx/npcs/npc_nefermaat.png', { frameWidth: 16, frameHeight: 32 });
    this.load.spritesheet('npc_ani', 'assets/gfx/npcs/npc_ani.png', { frameWidth: 16, frameHeight: 32 });
    this.load.spritesheet('npc_hemiunu', 'assets/gfx/npcs/npc_hemiunu.png', { frameWidth: 16, frameHeight: 32 });
    this.load.spritesheet('npc_baki', 'assets/gfx/npcs/npc_baki.png', { frameWidth: 16, frameHeight: 32 });
    this.load.spritesheet('npc_guard', 'assets/gfx/npcs/npc_guard.png', { frameWidth: 16, frameHeight: 32 });
    this.load.spritesheet('npc_mummy', 'assets/gfx/npcs/npc_mummy.png', { frameWidth: 16, frameHeight: 32 });

    // 2b. Tiere des Nils (Pflugochse & Ziege)
    this.load.spritesheet('animal_cow', 'assets/gfx/cow.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('animal_goat', 'assets/gfx/goat.png', { frameWidth: 32, frameHeight: 32 });

    // 3. Authentische Monumente, Schiffe & City-Tiles
    this.load.image('egypt_pyramid', 'assets/egypt/Pyramid.png');
    this.load.image('egypt_sphinx', 'assets/egypt/LionSphinx.png');
    this.load.image('egypt_pillar', 'assets/egypt/Pillar.png');
    this.load.image('egypt_debris', 'assets/egypt/Debris.png');
    this.load.image('egypt_palm_alt', 'assets/egypt/PalmTree2.png');
    this.load.image('city_b01', 'assets/tilesets/city/egypt_city_b01.png');
    this.load.image('city_b04', 'assets/tilesets/city/egypt_city_b04.png');
    this.load.image('egypt_boat', 'assets/egypt/papyrus_boat.png');

    // 4. Didaktische 16-Bit-Item-Icons
    for (const id of Object.keys(ITEMS)) {
      this.load.image(`icon-${id}`, `assets/icons/${id}.png`);
    }
  }

  create(): void {
    const params = new URLSearchParams(location.search);
    if (params.has('neu')) state.saves.clear();
    state.hasHadExistingSaveOnBoot = state.saves.hasSave();
    state.skipStartScreen = params.has('kapitel') || params.has('direkt');

    // Frame-Zuschnitte registrieren
    const dt = this.textures.get('desert_tileset');
    for (const [name, [x, y, fw, fh]] of Object.entries(DESERT_FRAMES)) dt.add(name, 0, x, y, fw, fh);

    const dh = this.textures.get('desert_houses');
    for (const [name, [x, y, fw, fh]] of Object.entries(HOUSE_FRAMES)) dh.add(name, 0, x, y, fw, fh);

    const ob = this.textures.get('objects');
    for (const [name, [x, y, fw, fh]] of Object.entries(OBJECT_FRAMES)) ob.add(name, 0, x, y, fw, fh);

    const fm = this.textures.get('farm');
    for (const [name, [x, y, fw, fh]] of Object.entries(FARM_FRAMES)) fm.add(name, 0, x, y, fw, fh);

    // Filter-Modus für scharfe Retro-Icons
    for (const id of Object.keys(ITEMS)) {
      if (this.textures.exists(`icon-${id}`)) {
        this.textures.get(`icon-${id}`).setFilter(Phaser.Textures.FilterMode.LINEAR);
      }
    }

    this.createCustomSprites();

    // 4-Wege-Animationen für Nakht (Male) und Merit (Female)
    const dirs = ['down', 'right', 'up', 'left'];
    dirs.forEach((dir, row) => {
      const start = row * 4;

      // Male animations (Nakht)
      this.anims.create({
        key: `walk-egypt-male-${dir}`,
        frames: this.anims.generateFrameNumbers('player_egypt_male', { start, end: start + 3 }),
        frameRate: 8,
        repeat: -1,
      });
      this.anims.create({
        key: `idle-egypt-male-${dir}`,
        frames: [{ key: 'player_egypt_male', frame: start }],
        frameRate: 1,
      });

      // Female animations (Merit)
      this.anims.create({
        key: `walk-egypt-female-${dir}`,
        frames: this.anims.generateFrameNumbers('player_egypt_female', { start, end: start + 3 }),
        frameRate: 8,
        repeat: -1,
      });
      this.anims.create({
        key: `idle-egypt-female-${dir}`,
        frames: [{ key: 'player_egypt_female', frame: start }],
        frameRate: 1,
      });
    });

    // NPC-Idle-Animationen
    const npcIds = ['senbi', 'ameni', 'kheti', 'nefermaat', 'ani', 'hemiunu', 'baki', 'guard', 'mummy'];
    npcIds.forEach((id) => {
      this.anims.create({
        key: `idle-${id}`,
        frames: [{ key: `npc_${id}`, frame: 0 }],
        frameRate: 1,
      });
    });

    // Tier-Animationen (Nilkuh & Ziege)
    this.anims.create({
      key: 'idle-cow',
      frames: [{ key: 'animal_cow', frame: 0 }],
      frameRate: 1,
    });
    this.anims.create({
      key: 'walk-cow',
      frames: this.anims.generateFrameNumbers('animal_cow', { start: 4, end: 7 }),
      frameRate: 4,
      repeat: -1,
    });
    this.anims.create({
      key: 'idle-goat',
      frames: [{ key: 'animal_goat', frame: 0 }],
      frameRate: 1,
    });
    this.anims.create({
      key: 'walk-goat',
      frames: this.anims.generateFrameNumbers('animal_goat', { start: 4, end: 7 }),
      frameRate: 5,
      repeat: -1,
    });

    // Animiertes Lagerfeuer
    this.anims.create({
      key: 'fire',
      frames: Array.from({ length: 7 }, (_, i) => ({ key: 'objects', frame: `fire${i}` })),
      frameRate: 10,
      repeat: -1,
    });

    const chParam = Number(params.get('kapitel'));
    if (chParam >= 1 && chParam <= 6) {
      state.startChapter(chParam);
    }

    this.scene.start('World');
  }

  private createCustomSprites(): void {
    // 1. Schaduf-Schöpfwerk
    const gs = this.add.graphics();
    gs.fillStyle(0x6b4226, 1).fillRect(14, 12, 4, 18);
    gs.fillStyle(0x8b5a2b, 1).fillRect(4, 8, 24, 3);
    gs.fillStyle(0x3e3d47, 1).fillRect(4, 5, 6, 6);
    gs.fillStyle(0x358dbf, 1).fillRect(24, 14, 2, 8);
    gs.fillStyle(0x2774a3, 1).fillRect(23, 22, 4, 4);
    gs.generateTexture('schaduf_prop', 32, 32);
    gs.destroy();

    // 2. Nilometer
    const gn = this.add.graphics();
    gn.fillStyle(0xd9c298, 1).fillRect(2, 4, 12, 28);
    gn.fillStyle(0x8c734b, 1).fillRect(2, 4, 12, 2).fillRect(2, 30, 12, 2);
    gn.fillStyle(0x1e293b, 1);
    for (let y = 8; y < 28; y += 4) {
      gn.fillRect(4, y, 8, 2);
    }
    gn.generateTexture('nilometer_prop', 16, 32);
    gn.destroy();

    // 3. Ziegelei-Ofen (kiln)
    const gk = this.add.graphics();
    gk.fillStyle(0x78350f, 1).fillRect(2, 6, 28, 24);
    gk.fillStyle(0xd97706, 1).fillRect(6, 10, 20, 16);
    gk.fillStyle(0x1e1b18, 1).fillRect(10, 16, 12, 10);
    gk.fillStyle(0xf59e0b, 1).fillRect(12, 18, 8, 6);
    gk.generateTexture('kiln', 32, 32);
    gk.destroy();

    // 4. Schreiber-Webstuhl (loom)
    const gl = this.add.graphics();
    gl.fillStyle(0x6b4226, 1).fillRect(2, 4, 28, 4).fillRect(4, 8, 4, 20).fillRect(24, 8, 4, 20);
    gl.fillStyle(0xf8fafc, 1).fillRect(8, 10, 16, 14);
    gl.generateTexture('loom', 32, 32);
    gl.destroy();

    // 5. Balsamierungs-Ofen (smelter)
    const gm = this.add.graphics();
    gm.fillStyle(0x475569, 1).fillRect(4, 6, 24, 24);
    gm.fillStyle(0x94a3b8, 1).fillRect(8, 10, 16, 16);
    gm.fillStyle(0x9333ea, 1).fillRect(12, 14, 8, 8);
    gm.generateTexture('smelter', 32, 32);
    gm.destroy();

    // 6. Bauhütte/Steinmetz (forge)
    const gp = this.add.graphics();
    gp.fillStyle(0x334155, 1).fillRect(4, 8, 32, 24);
    gp.fillStyle(0xfde047, 1).fillRect(8, 12, 24, 16);
    gp.generateTexture('forge', 40, 36);
    gp.destroy();
  }
}
