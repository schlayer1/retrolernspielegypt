import Phaser from 'phaser';
import { ITEMS } from '../data/items';
import { state } from '../systems/GameState';

export const OVERWORLD_FRAMES: Record<string, [number, number, number, number]> = {
  grass: [0, 0, 16, 16],
  water: [48, 48, 16, 16],
  rocks: [68, 24, 24, 22],
  bush: [81, 256, 30, 26],
  speicher_hut: [208, 64, 32, 48],
};

export const OBJECT_FRAMES: Record<string, [number, number, number, number]> = {
  stump: [0, 160, 32, 32],
  bigrock: [320, 4, 32, 30],
  bubble_excl: [32, 128, 16, 16],
  ...Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`fire${i}`, [64 + 16 * i, 48, 16, 16]])),
};

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

    this.load.image('overworld', 'assets/gfx/Overworld.png');
    this.load.image('objects', 'assets/gfx/objects.png');
    this.load.image('farm', 'assets/gfx/farm.png');
    this.load.spritesheet('player', 'assets/gfx/character.png', { frameWidth: 16, frameHeight: 32 });
    this.load.spritesheet('npc', 'assets/gfx/NPC_test.png', { frameWidth: 16, frameHeight: 32 });

    // Ägypten 16-Bit-Grafiken
    this.load.image('egypt_pyramid', 'assets/egypt/pyramid.png');
    this.load.image('egypt_sphinx', 'assets/egypt/sphinx.png');
    this.load.image('egypt_obelisk', 'assets/egypt/obelisk.png');
    this.load.image('egypt_oasis_pool', 'assets/egypt/oasis_pool.png');
    this.load.image('egypt_papyrus_boat', 'assets/egypt/boat.png');
    this.load.image('egypt_market_stall', 'assets/egypt/market_stall.png');
    this.load.image('egypt_bedouin_tent', 'assets/egypt/tent.png');
    this.load.image('egypt_date_palm', 'assets/egypt/palm.png');
    this.load.image('egypt_papyrus_reed', 'assets/egypt/papyrus.png');
  }

  create(): void {
    const params = new URLSearchParams(location.search);
    if (params.has('neu')) state.saves.clear();
    state.hasHadExistingSaveOnBoot = state.saves.hasSave();
    state.skipStartScreen = params.has('kapitel') || params.has('direkt');

    const ow = this.textures.get('overworld');
    for (const [name, [x, y, fw, fh]] of Object.entries(OVERWORLD_FRAMES)) ow.add(name, 0, x, y, fw, fh);
    const ob = this.textures.get('objects');
    for (const [name, [x, y, fw, fh]] of Object.entries(OBJECT_FRAMES)) ob.add(name, 0, x, y, fw, fh);
    const fm = this.textures.get('farm');
    for (const [name, [x, y, fw, fh]] of Object.entries(FARM_FRAMES)) fm.add(name, 0, x, y, fw, fh);

    this.createCustomSprites();
    this.createFemaleCharacterSheet();

    const dirs = ['down', 'right', 'up', 'left'];
    dirs.forEach((dir, row) => {
      const start = row * 17;
      // Male animations
      this.anims.create({
        key: `walk-egypt-male-${dir}`,
        frames: this.anims.generateFrameNumbers('player', { start, end: start + 3 }),
        frameRate: 8,
        repeat: -1,
      });
      this.anims.create({
        key: `idle-egypt-male-${dir}`,
        frames: [{ key: 'player', frame: start }],
        frameRate: 1,
      });

      // Female animations
      this.anims.create({
        key: `walk-egypt-female-${dir}`,
        frames: this.anims.generateFrameNumbers('player_female', { start, end: start + 3 }),
        frameRate: 8,
        repeat: -1,
      });
      this.anims.create({
        key: `idle-egypt-female-${dir}`,
        frames: [{ key: 'player_female', frame: start }],
        frameRate: 1,
      });
    });

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

  private createFemaleCharacterSheet(): void {
    const srcImg = this.textures.get('player').getSourceImage() as HTMLImageElement;
    const w = srcImg.width;
    const h = srcImg.height;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(srcImg, 0, 0);

    const imgData = ctx.getImageData(0, 0, w, h);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      if (r > 130 && g < 100 && b < 100) {
        d[i] = Math.min(255, Math.round(b * 0.9 + 25));
        d[i + 1] = Math.min(255, Math.round(r * 0.68));
        d[i + 2] = Math.min(255, Math.round(r * 1.05));
      }
    }
    ctx.putImageData(imgData, 0, 0);

    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        const fx = col * 16;
        const fy = row * 32;
        ctx.fillStyle = '#f2c94c';
        ctx.fillRect(fx + 5, fy + 9, 6, 1);
        ctx.fillStyle = '#5a3420';
        if (row === 0 || row === 2) {
          ctx.fillRect(fx + 2, fy + 14, 2, 6);
          ctx.fillRect(fx + 12, fy + 14, 2, 6);
          ctx.fillStyle = '#f2c94c';
          ctx.fillRect(fx + 2, fy + 19, 1, 1);
          ctx.fillRect(fx + 13, fy + 19, 1, 1);
        } else if (row === 1) {
          ctx.fillRect(fx + 2, fy + 13, 2, 7);
          ctx.fillStyle = '#f2c94c';
          ctx.fillRect(fx + 2, fy + 19, 1, 1);
        } else if (row === 3) {
          ctx.fillRect(fx + 12, fy + 13, 2, 7);
          ctx.fillStyle = '#f2c94c';
          ctx.fillRect(fx + 13, fy + 19, 1, 1);
        }
      }
    }

    this.textures.addSpriteSheet('player_female', canvas as unknown as HTMLImageElement, {
      frameWidth: 16,
      frameHeight: 32,
    });
    this.textures.addSpriteSheet('player_egypt_female', canvas as unknown as HTMLImageElement, {
      frameWidth: 16,
      frameHeight: 32,
    });
    this.textures.addSpriteSheet(
      'player_egypt_male',
      this.textures.get('player').getSourceImage() as HTMLImageElement,
      { frameWidth: 16, frameHeight: 32 },
    );
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

    // 3. Fischreuse
    const gf = this.add.graphics();
    gf.fillStyle(0x8a703b, 1).fillEllipse(8, 8, 14, 8);
    gf.fillStyle(0x4a3b1d, 1).fillEllipse(8, 8, 10, 4);
    gf.generateTexture('fish_trap', 16, 16);
    gf.destroy();

    // 4. Nilschlamm-Haufen
    const gc = this.add.graphics();
    gc.fillStyle(0x3d2817, 1).fillEllipse(8, 11, 14, 6);
    gc.fillStyle(0x593d25, 1).fillEllipse(8, 9, 10, 5);
    gc.generateTexture('clay_pile', 16, 16);
    gc.destroy();

    // 5. Ziegelei-Ofen (kiln)
    const gk = this.add.graphics();
    gk.fillStyle(0x78350f, 1).fillRect(2, 6, 28, 24);
    gk.fillStyle(0xd97706, 1).fillRect(6, 10, 20, 16);
    gk.fillStyle(0x1e1b18, 1).fillRect(10, 16, 12, 10);
    gk.fillStyle(0xf59e0b, 1).fillRect(12, 18, 8, 6);
    gk.generateTexture('kiln', 32, 32);
    gk.destroy();

    // 6. Schreiber-Webstuhl (loom)
    const gl = this.add.graphics();
    gl.fillStyle(0x6b4226, 1).fillRect(2, 4, 28, 4).fillRect(4, 8, 4, 20).fillRect(24, 8, 4, 20);
    gl.fillStyle(0xf8fafc, 1).fillRect(8, 10, 16, 14);
    gl.generateTexture('loom', 32, 32);
    gl.destroy();

    // 7. Balsamierungs-Ofen (smelter)
    const gm = this.add.graphics();
    gm.fillStyle(0x475569, 1).fillRect(4, 6, 24, 24);
    gm.fillStyle(0x94a3b8, 1).fillRect(8, 10, 16, 16);
    gm.fillStyle(0x9333ea, 1).fillRect(12, 14, 8, 8);
    gm.generateTexture('smelter', 32, 32);
    gm.destroy();

    // 8. Bauhütte/Steinmetz (forge)
    const gp = this.add.graphics();
    gp.fillStyle(0x334155, 1).fillRect(4, 8, 32, 24);
    gp.fillStyle(0xfde047, 1).fillRect(8, 12, 24, 16);
    gp.generateTexture('forge', 40, 36);
    gp.destroy();
  }
}
