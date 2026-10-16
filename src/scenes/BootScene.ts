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

/**
 * Benannte 16-Bit-Pixel-Art-Frames aus Ancient Egyptian City B01 (768x768, 48px-Raster).
 */
export const CITY_B01_FRAMES: Record<string, [number, number, number, number]> = {
  // Sandstein-Pflasterböden
  floor_sandstone_1: [384, 0, 48, 48],
  floor_sandstone_2: [432, 0, 48, 48],
  floor_sandstone_3: [480, 0, 48, 48],
  floor_plaza_slab: [576, 0, 96, 96],
  // Tempel, Paläste & Bauwerke (96x96)
  temple_pylon: [384, 96, 96, 96],
  temple_ornate: [480, 96, 96, 96],
  temple_sanctum: [576, 96, 96, 96],
  temple_shrine: [672, 96, 96, 96],
  temple_courtyard: [384, 192, 96, 96],
  palace_colonnade: [384, 288, 96, 96],
  granary_compound: [288, 384, 96, 96],
  scribes_house: [96, 480, 96, 96],
  vizier_palace: [288, 480, 96, 96],
  // Kleinere Stufenpyramiden / Nebenpyramiden (96x96)
  pyramid_queen: [0, 192, 96, 96],
  pyramid_step: [192, 192, 96, 96],
  // Marktstände (48x48)
  stall_green: [480, 384, 48, 48],
  stall_cyan: [528, 384, 48, 48],
  stall_red: [480, 432, 48, 48],
  stall_blue: [480, 480, 48, 48],
  stall_striped: [528, 480, 48, 48],
  // Obelisken & Sphingen (48x96)
  obelisk_tall_1: [576, 384, 48, 96],
  obelisk_tall_2: [624, 384, 48, 96],
  sphinx_statue_1: [672, 384, 48, 96],
  sphinx_statue_2: [720, 384, 48, 96],
  // Authentische Nilschiffe (96x96)
  nile_felucca: [576, 480, 96, 96],
  nile_cargo_barge: [672, 480, 96, 96],
  // Götter- & Pharaonenstatuen (48x48)
  statue_anubis: [0, 576, 48, 48],
  statue_horus: [96, 576, 48, 48],
  statue_isis: [144, 576, 48, 48],
  statue_pharaoh: [288, 576, 48, 48],
  statue_lion_l: [480, 576, 48, 48],
  statue_lion_r: [528, 576, 48, 48],
  statue_thoth: [48, 624, 48, 48],
  statue_osiris: [192, 624, 48, 48],
  throne_gold: [96, 672, 48, 48],
  // Kanopen, Balsamierungstische, Sarkophage & Truhen (48x48)
  canopic_falcon: [192, 672, 48, 48],
  canopic_jackal: [240, 672, 48, 48],
  table_embalm: [288, 672, 48, 48],
  table_scribes: [336, 672, 48, 48],
  table_offering: [384, 672, 48, 48],
  papyrus_clump_tall: [576, 576, 48, 48],
  papyrus_planter: [624, 624, 48, 48],
  handcart_wood: [672, 576, 48, 48],
  sarcophagus_gold: [48, 720, 48, 48],
  sarcophagus_royal: [144, 720, 48, 48],
  sarcophagus_lapis: [240, 720, 48, 48],
  chest_sandstone: [288, 720, 48, 48],
  chest_turquoise: [336, 720, 48, 48],
  chest_crimson: [384, 720, 48, 48],
  chest_royal: [432, 720, 48, 48],
};

/**
 * Benannte 16-Bit-Pixel-Art-Frames aus Ancient Egyptian City B02 (768x768, 48px-Raster).
 */
export const CITY_B02_FRAMES: Record<string, [number, number, number, number]> = {
  stonemason_yard: [288, 288, 96, 96],
  brick_drying_yard: [96, 288, 96, 96],
  palm_tall_1: [240, 384, 48, 96],
  palm_tall_2: [288, 384, 48, 96],
  water_basin_round: [144, 528, 48, 48],
  water_basin_square: [192, 528, 48, 48],
  market_table_pots: [384, 528, 48, 48],
  market_table_spices: [480, 528, 48, 48],
  market_table_fruits: [528, 528, 48, 48],
  cargo_wagon_full: [624, 528, 48, 48],
  stele_nilometer: [144, 576, 48, 48],
  stone_blocks_pile: [288, 576, 48, 48],
  pillar_sandstone_1: [528, 576, 48, 96],
  pillar_sandstone_2: [576, 576, 48, 96],
  amphora_red: [480, 624, 48, 48],
  clay_vat_mud: [528, 624, 48, 48],
  amphora_decorated: [192, 720, 48, 48],
  tool_shovel: [576, 720, 48, 48],
  tool_pickaxe: [624, 720, 48, 48],
};

/**
 * Benannte 16-Bit-Pixel-Art-Frames aus Ancient Egyptian City B03 (768x768, 48px-Raster).
 */
export const CITY_B03_FRAMES: Record<string, [number, number, number, number]> = {
  hieroglyph_altar: [288, 96, 96, 96],
  carpet_royal: [384, 336, 96, 48],
  table_grain_sacks: [192, 432, 96, 48],
  stall_fish_dates: [480, 432, 96, 96],
  stall_pottery: [576, 432, 96, 96],
  stall_linen: [672, 432, 96, 96],
  wall_brick_build: [192, 528, 96, 48],
  canopy_gold: [480, 576, 96, 96],
  canopy_red: [576, 576, 96, 96],
};

/**
 * Benannte 16-Bit-Pixel-Art-Frames aus Ancient Egyptian City B04 (768x768, 48px-Raster).
 */
export const CITY_B04_FRAMES: Record<string, [number, number, number, number]> = {
  kiln_dome: [48, 0, 48, 48],
  brick_kiln: [192, 0, 48, 48],
  furnace_square: [144, 48, 48, 48],
  // Bewässerungskanäle & Schleusen
  canal_h: [384, 480, 48, 48],
  canal_v: [192, 384, 48, 48],
  canal_sluice: [576, 384, 48, 48],
  canal_bridge: [576, 480, 48, 48],
  // Ernte, Säcke & Baustoffe
  grain_basket: [48, 576, 48, 48],
  grain_sack_bound: [144, 576, 48, 48],
  wheat_sheaf: [336, 576, 48, 48],
  grain_crate: [240, 672, 48, 48],
  limestone_blocks: [288, 720, 48, 48],
  timber_logs: [336, 720, 48, 48],
  workbench_craft: [528, 720, 48, 48],
  workbench_mortar: [576, 720, 48, 48],
};

/**
 * Benannte 16-Bit-Pixel-Art-Frames aus Ancient Egyptian City B05 (768x768, 48px-Raster).
 */
export const CITY_B05_FRAMES: Record<string, [number, number, number, number]> = {
  bazaar_grand_red: [576, 96, 96, 96],
  bazaar_punt_incense: [576, 192, 96, 96],
  bazaar_spice_tent: [672, 192, 96, 96],
  crate_wood: [288, 192, 48, 48],
  barrel_wood: [336, 240, 48, 48],
};

/**
 * Benannte 16-Bit-Pixel-Art-Frames aus Fishing Village Port (768x768, 48px-Raster).
 */
export const PORT_FRAMES: Record<string, [number, number, number, number]> = {
  fish_trap_wicker: [576, 96, 48, 48],
  fish_baskets_group: [624, 96, 48, 48],
  fishing_net_drying: [192, 96, 96, 96],
  drying_fish_rack: [288, 480, 96, 96],
  crane_beam_wood: [576, 192, 96, 96],
  port_bollard: [480, 624, 48, 48],
  fish_crate_full: [192, 528, 48, 48],
};

/**
 * Benannte 16-Bit-Pixel-Art-Frames aus Desert Natural Environment B01 (768x768).
 */
export const NATURE_FRAMES: Record<string, [number, number, number, number]> = {
  oasis_pool_small: [192, 384, 96, 96],
  oasis_pool_large: [192, 480, 144, 96],
  desert_outcrop: [576, 192, 144, 96],
  dune_large: [192, 0, 96, 96],
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

    // 1b. Ägyptische 16-Bit-Stadt-, Hafen- & Natur-Tilesets
    this.load.image('city_b01', 'assets/tilesets/city/egypt_city_b01.png');
    this.load.image('city_b02', 'assets/tilesets/city/egypt_city_b02.png');
    this.load.image('city_b03', 'assets/tilesets/city/egypt_city_b03.png');
    this.load.image('city_b04', 'assets/tilesets/city/egypt_city_b04.png');
    this.load.image('city_b05', 'assets/tilesets/city/egypt_city_b05.png');
    this.load.image('port_tiles', 'assets/tilesets/city/port_tiles.png');
    this.load.image('desert_nature', 'assets/tilesets/city/desert_nature_b01.png');
    this.load.image('desert_ruins', 'assets/tilesets/city/desert_ruins_b01.png');

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

    // 2b. Tiere des Nils & Fackelfeuer
    this.load.spritesheet('animal_cow', 'assets/gfx/cow.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('animal_goat', 'assets/gfx/goat.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('dungeon_fire', 'assets/egypt/dungeon_fire.png', { frameWidth: 32, frameHeight: 32 });

    // 3. Authentische Monumente
    this.load.image('egypt_pyramid', 'assets/egypt/Pyramid.png');
    this.load.image('egypt_sphinx', 'assets/egypt/LionSphinx.png');
    this.load.image('egypt_pillar', 'assets/egypt/Pillar.png');
    this.load.image('egypt_debris', 'assets/egypt/Debris.png');
    this.load.image('egypt_palm_alt', 'assets/egypt/PalmTree2.png');

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
    const registerFrames = (texKey: string, map: Record<string, [number, number, number, number]>) => {
      if (!this.textures.exists(texKey)) return;
      const tex = this.textures.get(texKey);
      for (const [name, [x, y, fw, fh]] of Object.entries(map)) {
        tex.add(name, 0, x, y, fw, fh);
      }
    };

    registerFrames('desert_tileset', DESERT_FRAMES);
    registerFrames('desert_houses', HOUSE_FRAMES);
    registerFrames('objects', OBJECT_FRAMES);
    registerFrames('farm', FARM_FRAMES);
    registerFrames('city_b01', CITY_B01_FRAMES);
    registerFrames('city_b02', CITY_B02_FRAMES);
    registerFrames('city_b03', CITY_B03_FRAMES);
    registerFrames('city_b04', CITY_B04_FRAMES);
    registerFrames('city_b05', CITY_B05_FRAMES);
    registerFrames('port_tiles', PORT_FRAMES);
    registerFrames('desert_nature', NATURE_FRAMES);

    // Filter-Modus für scharfe Retro-Icons
    for (const id of Object.keys(ITEMS)) {
      if (this.textures.exists(`icon-${id}`)) {
        this.textures.get(`icon-${id}`).setFilter(Phaser.Textures.FilterMode.LINEAR);
      }
    }

    this.createCustomSprites();
    this.extractPreviewImages();

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

    // NPC-Animationen (sanftes Atmen / Umsehen)
    const npcIds = ['senbi', 'ameni', 'kheti', 'nefermaat', 'ani', 'hemiunu', 'baki', 'guard', 'mummy'];
    npcIds.forEach((id) => {
      this.anims.create({
        key: `idle-${id}`,
        frames: [
          { key: `npc_${id}`, frame: 0 },
          { key: `npc_${id}`, frame: 1 },
          { key: `npc_${id}`, frame: 0 },
        ],
        frameRate: 1.5,
        repeat: -1,
      });
    });

    // Tier-Animationen (Nilkuh & Ziege)
    this.anims.create({
      key: 'idle-cow',
      frames: this.anims.generateFrameNumbers('animal_cow', { start: 0, end: 3 }),
      frameRate: 2.5,
      repeat: -1,
    });
    this.anims.create({
      key: 'walk-cow',
      frames: this.anims.generateFrameNumbers('animal_cow', { start: 4, end: 7 }),
      frameRate: 4,
      repeat: -1,
    });
    this.anims.create({
      key: 'idle-goat',
      frames: this.anims.generateFrameNumbers('animal_goat', { start: 0, end: 3 }),
      frameRate: 3,
      repeat: -1,
    });
    this.anims.create({
      key: 'walk-goat',
      frames: this.anims.generateFrameNumbers('animal_goat', { start: 4, end: 7 }),
      frameRate: 5,
      repeat: -1,
    });

    // Animiertes Lagerfeuer & Tempel-Feuerschalen
    this.anims.create({
      key: 'fire',
      frames: Array.from({ length: 7 }, (_, i) => ({ key: 'objects', frame: `fire${i}` })),
      frameRate: 10,
      repeat: -1,
    });
    this.anims.create({
      key: 'torch_fire',
      frames: this.anims.generateFrameNumbers('dungeon_fire', { start: 0, end: 2 }),
      frameRate: 8,
      repeat: -1,
    });

    const chParam = Number(params.get('kapitel'));
    if (chParam >= 1 && chParam <= 6) {
      state.startChapter(chParam);
    }

    this.scene.start('World');
  }

  private createCustomSprites(): void {
    // Detaillierter 16-Bit Pixel-Art Schaduf (Wippkran mit Lehm-Gegengewicht, Holzstütze & Wassereimer)
    const gs = this.add.graphics();
    // Steinsockel
    gs.fillStyle(0x8c734b, 1).fillRect(10, 32, 16, 8);
    gs.fillStyle(0xb59b6d, 1).fillRect(12, 33, 12, 5);
    // Aufrechter Akazien-Stützpfeiler mit Astgabel
    gs.fillStyle(0x5c3a21, 1).fillRect(16, 12, 4, 22);
    gs.fillStyle(0x7c4f2b, 1).fillRect(17, 13, 2, 20);
    gs.fillStyle(0x472b16, 1).fillRect(14, 10, 8, 3);
    // Langer schräger Wippbalken (Hebelarm)
    gs.fillStyle(0x8b5a2b, 1).fillRect(4, 9, 32, 3);
    gs.fillStyle(0xa8723d, 1).fillRect(5, 9, 30, 1);
    // Schweres Nilschlamm-Gegengewicht (links)
    gs.fillStyle(0x3b3530, 1).fillRect(2, 6, 8, 8);
    gs.fillStyle(0x574e47, 1).fillRect(3, 7, 6, 6);
    // Seil & gefüllter Schöpfeimer (rechts über dem Kanal)
    gs.fillStyle(0xd6c096, 1).fillRect(33, 12, 2, 14);
    gs.fillStyle(0x7c4f2b, 1).fillRect(30, 26, 8, 7);
    gs.fillStyle(0x38bdf8, 1).fillRect(31, 26, 6, 3);
    gs.generateTexture('schaduf_prop', 42, 42);
    gs.destroy();
  }

  /** Extrahiert scharfe Data-URLs der Spielgrafiken für den Start- und Pausescreen. */
  private extractPreviewImages(): void {
    const toDataUrl = (texKey: string, sx?: number, sy?: number, sw?: number, sh?: number): string => {
      if (!this.textures.exists(texKey)) return '';
      const src = this.textures.get(texKey).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
      if (!src) return '';
      const w = sw ?? src.width;
      const h = sh ?? src.height;
      const x = sx ?? 0;
      const y = sy ?? 0;
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(src, x, y, w, h, 0, 0, w, h);
      return c.toDataURL();
    };

    state.malePreviewUrl = toDataUrl('player_egypt_male', 0, 0, 16, 32);
    state.femalePreviewUrl = toDataUrl('player_egypt_female', 0, 0, 16, 32);

    state.showcaseSprites = {
      fish: 'assets/icons/nilbarsch.png',
      schaduf: 'assets/icons/schaduf_teil.png',
      brick: 'assets/icons/lehmziegel.png',
      papyrus: 'assets/icons/papyrusrolle.png',
      pyramid: 'assets/icons/kalkstein.png',
      boat: 'assets/icons/goldmaske.png',
    };
  }
}
