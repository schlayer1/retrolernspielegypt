import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { WorldScene } from './scenes/WorldScene';
import { UIScene } from './scenes/UIScene';

// 16-Bit-Auflösung (16:9). Wird ganzzahlig-nah auf jedes Gerät skaliert.
export const GAME_W = 480;
export const GAME_H = 270;

import { state } from './systems/GameState';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#1e1b18',
  pixelArt: true,
  roundPixels: true,
  physics: { default: 'arcade', arcade: { debug: false } },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: { activePointers: 3 },
  scene: [BootScene, WorldScene, UIScene],
});

(window as unknown as { game: Phaser.Game; state: typeof state }).game = game;
(window as unknown as { game: Phaser.Game; state: typeof state }).state = state;
