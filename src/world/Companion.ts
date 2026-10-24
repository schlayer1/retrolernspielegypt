/**
 * Secret-of-Evermore Begleiter-KI (Companion.ts)
 * Verwaltet den treuen Tierbegleiter des Spielers (Tesem, Molosser, Wolfshund, Schäferhund).
 */

import Phaser from 'phaser';
import { sfx } from '../audio/sound';
import { state } from '../systems/GameState';

export interface CompanionConfig {
  key: string;              // 'sdv_dog_tesem'
  animPrefix?: string;      // 'dog-tesem'
  name: string;             // 'Anubis'
  historicalBreed: string;  // 'Altägyptischer Tesem-Windhund'
  unlockedChapter: number;
}

export class CompanionManager {
  private scene: Phaser.Scene;
  private sprite: Phaser.GameObjects.Sprite | null = null;
  private config: CompanionConfig;
  private state: 'following' | 'idle' | 'sniffing' | 'petting' = 'following';
  private idleTimer: number = 0;
  private alertCooldown: number = 0;
  private isUnlocked: boolean = false;

  constructor(scene: Phaser.Scene, config: CompanionConfig) {
    this.scene = scene;
    this.config = config;
  }

  private get prefix(): string {
    return this.config.animPrefix || this.config.key;
  }

  public unlock(startX: number, startY: number): void {
    if (this.isUnlocked && this.sprite) return;
    this.isUnlocked = true;

    this.sprite = this.scene.add.sprite(startX, startY, this.config.key, 4)
      .setOrigin(0.5, 0.85)
      .setDepth(15);

    this.sprite.setInteractive({ useHandCursor: true });
    this.sprite.on('pointerdown', () => this.pet());

    console.log(`🐾 Begleiter aktiv: ${this.config.name} (${this.config.historicalBreed})`);
  }

  public getSprite(): Phaser.GameObjects.Sprite | null {
    return this.sprite;
  }

  public isAvailable(): boolean {
    return Boolean(this.isUnlocked && this.sprite && this.sprite.active);
  }

  public getDistanceTo(x: number, y: number): number {
    if (!this.isUnlocked || !this.sprite) return Infinity;
    return Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, x, y);
  }

  public update(player: Phaser.GameObjects.Sprite, targets: any[], deltaMs: number): void {
    if (!this.isUnlocked || !this.sprite) return;

    const dog = this.sprite;
    const distToPlayer = Phaser.Math.Distance.Between(dog.x, dog.y, player.x, player.y);

    if (this.alertCooldown > 0) this.alertCooldown -= deltaMs;

    // 1. Spürsinn (Secret of Evermore Scent Radar): Prüfe vergrabene Relikte / Schätze in der Nähe (< 60px)
    if (this.alertCooldown <= 0 && this.state !== 'petting' && targets) {
      for (const t of targets) {
        const tx = t.x ?? t.sprite?.x;
        const ty = t.y ?? t.sprite?.y;
        const isVisible = t.sprite ? t.sprite.visible : !t.discovered;
        if (isVisible && tx !== undefined && ty !== undefined && (t.kind?.includes('relic') || t.isRelic)) {
          const distToTarget = Phaser.Math.Distance.Between(dog.x, dog.y, tx, ty);
          if (distToTarget < 58) {
            this.triggerAlert();
            return;
          }
        }
      }
    }

    // 2. Folgen oder Rasten
    if (this.state === 'petting') return;

    if (distToPlayer > 32) {
      this.state = 'following';
      const angle = Phaser.Math.Angle.Between(dog.x, dog.y, player.x, player.y);
      const speed = distToPlayer > 80 ? 115 : 75;
      dog.x += Math.cos(angle) * speed * (deltaMs / 1000);
      dog.y += Math.sin(angle) * speed * (deltaMs / 1000);

      const deg = Phaser.Math.RadToDeg(angle);
      if (Math.abs(deg) < 45) {
        dog.setFlipX(false);
        this.playAnim(`${this.prefix}-walk-right`);
      } else if (Math.abs(deg) > 135) {
        dog.setFlipX(true);
        this.playAnim(`${this.prefix}-walk-right`);
      } else if (deg > 45 && deg <= 135) {
        dog.play(`${this.prefix}-walk-down`, true);
      } else {
        dog.play(`${this.prefix}-walk-up`, true);
      }
      dog.setDepth(dog.y);
      this.idleTimer = 0;
    } else {
      this.idleTimer += deltaMs;
      if (this.idleTimer > 2500) {
        this.playAnim(`${this.prefix}-sit`);
      } else {
        this.playAnim(`${this.prefix}-idle`);
      }
    }
  }

  private playAnim(key: string): void {
    if (!this.sprite) return;
    if (this.scene.anims.exists(key)) {
      this.sprite.play(key, true);
    }
  }

  private triggerAlert(): void {
    if (!this.sprite) return;
    this.state = 'sniffing';
    this.alertCooldown = 12000;

    this.playAnim(`${this.prefix}-sniff`);
    try { sfx.step(); } catch (e) {}

    this.showEmote('🐾 Wuff! Hier liegt etwas verborgen!');
  }

  public pet(): void {
    if (!this.sprite || this.state === 'petting') return;
    this.state = 'petting';

    this.playAnim(`${this.prefix}-wag`);
    try { sfx.pet(); } catch (e) {}

    this.showEmote('❤️ *Wedel! Freut sich über deine Zuwendung*');
    state.emit('toast', `🐕 Du streichelst deinen treuen ${this.config.historicalBreed} ${this.config.name}! ❤️ *Wedel*`);

    this.scene.time.delayedCall(2200, () => {
      this.state = 'following';
    });
  }

  private showEmote(text: string): void {
    if (!this.sprite) return;
    const el = document.createElement('div');
    el.className = 'companion-emote-bubble';
    el.innerHTML = text;
    el.style.cssText = `
      position: fixed;
      transform: translate(-50%, -100%);
      background: rgba(15, 23, 42, 0.92);
      border: 1.5px solid #fbbf24;
      border-radius: 9999px;
      padding: 4px 10px;
      font-size: 11.5px;
      font-weight: 700;
      color: #fef08a;
      white-space: nowrap;
      pointer-events: none;
      z-index: 50;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      transition: opacity 0.3s;
    `;
    document.body.appendChild(el);

    const updatePos = () => {
      if (!this.sprite) return;
      const canvas = this.scene.game.canvas;
      const cam = this.scene.cameras.main;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const sx = ((this.sprite.x - cam.scrollX) / cam.width) * rect.width + rect.left;
        const sy = ((this.sprite.y - 20 - cam.scrollY) / cam.height) * rect.height + rect.top;
        el.style.left = `${sx}px`;
        el.style.top = `${sy}px`;
      }
    };

    updatePos();
    el.style.opacity = '1';

    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 400);
    }, 2400);
  }
}
