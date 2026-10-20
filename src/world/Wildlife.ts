import Phaser from 'phaser';

export interface RoamingAnimal {
  kind:
    | 'cow'
    | 'calf'
    | 'goat'
    | 'goat_baby'
    | 'chicken'
    | 'chick'
    | 'cat_bastet'
    | 'cat_village'
    | 'turtle'
    | 'ostrich'
    | 'ostrich_baby'
    | 'dog_tesem'
    | 'parrot';
  sprite: Phaser.GameObjects.Sprite;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  speed: number;
  state: 'idle' | 'walk' | 'special';
  timer: number;
  targetX: number;
  targetY: number;
  animPrefix?: string;
  idleAnim?: string;
  walkAnim?: string;
  specialAnim?: string;
  syncLabel?: (x: number, y: number) => void;
  labelOffsetY: number;
}

interface LakeDuck {
  sprite: Phaser.GameObjects.Sprite;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  speed: number;
  state: 'swim' | 'idle' | 'dive' | 'flap';
  timer: number;
  targetX: number;
  targetY: number;
}

interface LakeFish {
  sprite: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

interface AmbientButterfly {
  sprite: Phaser.GameObjects.Sprite;
  vx: number;
  vy: number;
  phase: number;
  baseY: number;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

interface NileFrog {
  sprite: Phaser.GameObjects.Sprite;
  startX: number;
  startY: number;
  state: 'sit' | 'jump' | 'underwater';
  timer: number;
}

/**
 * Steuert die gesamte lebendige Fauna & Ökologie im Alten Ägypten:
 * - 4-Richtungs-animierte Nutz- & Sakraltiere (Pflugochsen Hathors, Kälber, Schilfziegen, Zicklein,
 *   Dorfhühner, Küken, Heilige Bastet-Katzen, Speicherkatzen, Nil-Schildkröten, Strauße & Tesem-Jagdhunde)
 * - Nil-Ökosystem: Schwimmende, tauchende & flügelschlagende Nil-Enten sowie authentische Nilbarsch-Fischschatten
 * - Reaktive Nil-Fauna: Heqet-Frösche am Uferschilf (springen bei Annäherung ins Wasser) und Oasen-Schmetterlinge
 */
export class WildlifeManager {
  private scene: Phaser.Scene;
  private animals: RoamingAnimal[] = [];
  private ducks: LakeDuck[] = [];
  private fishes: LakeFish[] = [];
  private butterflies: AmbientButterfly[] = [];
  private frogs: NileFrog[] = [];
  private rng = new Phaser.Math.RandomDataGenerator(['egypt_wildlife_v1']);

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  public addAnimal(cfg: {
    kind: RoamingAnimal['kind'];
    sprite: Phaser.GameObjects.Sprite;
    bounds: { minX: number; maxX: number; minY: number; maxY: number };
    speed?: number;
    animPrefix?: string;
    idleAnim?: string;
    walkAnim?: string;
    specialAnim?: string;
    labelOffsetY?: number;
    syncLabel?: (x: number, y: number) => void;
  }): RoamingAnimal {
    const animal: RoamingAnimal = {
      kind: cfg.kind,
      sprite: cfg.sprite,
      bounds: cfg.bounds,
      speed: cfg.speed ?? 16,
      state: 'idle',
      timer: this.rng.realInRange(1.2, 3.2),
      targetX: cfg.sprite.x,
      targetY: cfg.sprite.y,
      animPrefix: cfg.animPrefix,
      idleAnim: cfg.idleAnim,
      walkAnim: cfg.walkAnim,
      specialAnim: cfg.specialAnim,
      syncLabel: cfg.syncLabel,
      labelOffsetY: cfg.labelOffsetY ?? -16,
    };
    if (animal.idleAnim && this.scene.anims.exists(animal.idleAnim)) {
      animal.sprite.play(animal.idleAnim, true);
    }
    this.animals.push(animal);
    return animal;
  }

  public removeBySprite(sprite: Phaser.GameObjects.Sprite): void {
    this.animals = this.animals.filter((a) => a.sprite !== sprite);
  }

  /**
   * Spawnt das lebendige Nil-Ökosystem (Enten & Nilbarsche) und Oasen-Critters (Schmetterlinge & Heqet-Frösche).
   */
  public spawnAmbientFauna(mapW: number, mapH: number): void {
    // 1. Schmetterlinge über der Dattelpalmen-Oase & den Lotusbecken
    const butterflyAnims = ['critter-butterfly-1', 'critter-butterfly-2', 'critter-butterfly-3'];
    const oasisZones = [
      { minX: 430, maxX: 560, minY: 150, maxY: 260 }, // Ackerland & Palmen
      { minX: 470, maxX: 590, minY: 320, maxY: 440 }, // Nilufer-Schilf
      { minX: 320, maxX: 390, minY: 280, maxY: 340 }, // Lotusbecken beim Tempel
    ];
    for (let i = 0; i < 7; i++) {
      const zone = oasisZones[i % oasisZones.length];
      const x = this.rng.between(zone.minX, zone.maxX);
      const y = this.rng.between(zone.minY, zone.maxY);
      const animKey = butterflyAnims[i % butterflyAnims.length];
      const sprite = this.scene.add.sprite(x, y, 'sdv_critters', 128).setScale(1.0).setDepth(3500);
      if (this.scene.anims.exists(animKey)) sprite.play(animKey);
      const angle = this.rng.realInRange(0, Math.PI * 2);
      const spd = this.rng.realInRange(10, 16);
      this.butterflies.push({
        sprite,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd * 0.6,
        phase: this.rng.realInRange(0, 10),
        baseY: y,
        bounds: zone,
      });
    }

    // 2. Nil-Ökosystem (Nilwasser: x ~ 620..770, y ~ 120..460)
    const nileBounds = { minX: 624, maxX: 760, minY: 140, maxY: 460 };

    // 2.1 Nil-Enten auf dem Wasser (schwimmen, tauchen, flügelschlagen)
    const duckPositions = [
      { x: 652, y: 345 },
      { x: 686, y: 380 },
      { x: 642, y: 220 },
    ];
    for (const pos of duckPositions) {
      const duckSprite = this.scene.add.sprite(pos.x, pos.y, 'sdv_duck', 16).setScale(1.0).setDepth(pos.y + 6);
      if (this.scene.anims.exists('duck-swim-right')) duckSprite.play('duck-swim-right');
      this.ducks.push({
        sprite: duckSprite,
        bounds: nileBounds,
        speed: this.rng.realInRange(11, 16),
        state: 'swim',
        timer: this.rng.realInRange(2.5, 6.0),
        targetX: this.rng.between(nileBounds.minX, nileBounds.maxX),
        targetY: this.rng.between(nileBounds.minY, nileBounds.maxY),
      });
    }

    // 2.2 Nilbarsche & Tilapien unter der Wasseroberfläche
    for (let i = 0; i < 5; i++) {
      const fx = this.rng.between(nileBounds.minX + 25, nileBounds.maxX - 25);
      const fy = this.rng.between(nileBounds.minY + 25, nileBounds.maxY - 25);
      const g = this.scene.add.graphics().setDepth(fy + 2);
      this.fishes.push({
        sprite: g,
        x: fx,
        y: fy,
        vx: this.rng.pick([1, -1]) * this.rng.realInRange(8, 15),
        vy: this.rng.realInRange(-4, 4),
        phase: this.rng.realInRange(0, Math.PI * 2),
        bounds: nileBounds,
      });
    }

    // 2.3 Nil-Frösche (Heqet) am Schilfufer
    const frogBankSpawns = [
      { x: 606, y: 348 },
      { x: 610, y: 395 },
      { x: 595, y: 440 },
      { x: 602, y: 260 },
    ];
    frogBankSpawns.forEach((pos) => {
      const frogSprite = this.scene.add.sprite(pos.x, pos.y, 'sdv_critters', 280).setScale(1.0).setDepth(pos.y + 6);
      if (this.scene.anims.exists('critter-frog-idle')) frogSprite.play('critter-frog-idle');
      this.frogs.push({
        sprite: frogSprite,
        startX: pos.x,
        startY: pos.y,
        state: 'sit',
        timer: this.rng.realInRange(2.0, 5.0),
      });
    });
  }

  public update(deltaMs: number, playerX: number, playerY: number): void {
    const dt = deltaMs / 1000;

    // ---------------------------------------------------- 1. Land- & Ufertiere
    for (const a of this.animals) {
      if (!a.sprite || !a.sprite.active) continue;

      const distToPlayer = Phaser.Math.Distance.Between(a.sprite.x, a.sprite.y, playerX, playerY);

      // Scheue Annäherungspause: Wenn der Spieler sehr nah ist (< 26px), verharrt das Tier aufmerksam
      if (distToPlayer < 26 && a.state === 'walk') {
        a.state = 'idle';
        a.timer = 1.4;
        this.playIdleAnim(a);
        a.sprite.setDepth(a.sprite.y + 10);
        a.syncLabel?.(a.sprite.x, a.sprite.y + a.labelOffsetY);
        continue;
      }

      a.timer -= dt;
      if (a.state === 'idle' || a.state === 'special') {
        if (a.timer <= 0) {
          a.state = 'walk';
          a.timer = this.rng.realInRange(2.0, 4.8);
          a.targetX = this.rng.realInRange(a.bounds.minX, a.bounds.maxX);
          a.targetY = this.rng.realInRange(a.bounds.minY, a.bounds.maxY);
        } else {
          this.playIdleAnim(a);
        }
      } else if (a.state === 'walk') {
        const dx = a.targetX - a.sprite.x;
        const dy = a.targetY - a.sprite.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 4 || a.timer <= 0) {
          a.state = 'idle';
          a.timer = this.rng.realInRange(2.2, 5.2);
          // Zufällig Spezial-Animation (Grasen, Putzen, Picken, Federn schütteln)
          if (this.rng.frac() > 0.35 && a.specialAnim && this.scene.anims.exists(a.specialAnim)) {
            a.state = 'special';
            a.sprite.play(a.specialAnim, true);
          } else {
            this.playIdleAnim(a);
          }
        } else {
          const step = Math.min(dist, a.speed * dt);
          const nx = a.sprite.x + (dx / dist) * step;
          const ny = a.sprite.y + (dy / dist) * step;
          a.sprite.x = Phaser.Math.Clamp(nx, a.bounds.minX, a.bounds.maxX);
          a.sprite.y = Phaser.Math.Clamp(ny, a.bounds.minY, a.bounds.maxY);
          this.playDirectionAnim(a, dx, dy);
        }
      }

      a.sprite.setDepth(a.sprite.y + 10);
      a.syncLabel?.(a.sprite.x, a.sprite.y + a.labelOffsetY);
    }

    // ---------------------------------------------------- 2. Nil-Enten
    for (const d of this.ducks) {
      if (!d.sprite || !d.sprite.active) continue;
      d.timer -= dt;
      if (d.state === 'swim') {
        const dx = d.targetX - d.sprite.x;
        const dy = d.targetY - d.sprite.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 4 || d.timer <= 0) {
          d.state = this.rng.pick(['dive', 'flap', 'idle']);
          d.timer = this.rng.realInRange(2.0, 4.0);
          if (d.state === 'dive' && this.scene.anims.exists('duck-dive')) {
            d.sprite.play('duck-dive', true);
          } else if (d.state === 'flap' && this.scene.anims.exists('duck-flap')) {
            d.sprite.play('duck-flap', true);
          } else if (this.scene.anims.exists('duck-idle')) {
            d.sprite.play('duck-idle', true);
          }
        } else {
          const step = Math.min(dist, d.speed * dt);
          d.sprite.x += (dx / dist) * step;
          d.sprite.y += (dy / dist) * step;
          if (Math.abs(dx) >= Math.abs(dy)) {
            if (this.scene.anims.exists('duck-swim-right')) {
              d.sprite.play('duck-swim-right', true);
              d.sprite.setFlipX(dx < 0);
            }
          } else if (dy > 0) {
            if (this.scene.anims.exists('duck-swim-down')) {
              d.sprite.play('duck-swim-down', true);
              d.sprite.setFlipX(false);
            }
          } else {
            if (this.scene.anims.exists('duck-swim-up')) {
              d.sprite.play('duck-swim-up', true);
              d.sprite.setFlipX(false);
            }
          }
        }
      } else {
        if (d.timer <= 0) {
          d.state = 'swim';
          d.timer = this.rng.realInRange(3.5, 7.0);
          d.targetX = this.rng.between(d.bounds.minX, d.bounds.maxX);
          d.targetY = this.rng.between(d.bounds.minY, d.bounds.maxY);
        }
      }
      d.sprite.setDepth(d.sprite.y + 6);
    }

    // ---------------------------------------------------- 3. Nilbarsche unter Wasser
    for (const f of this.fishes) {
      f.phase += dt * 3.5;
      f.x += f.vx * dt;
      f.y += f.vy * dt + Math.sin(f.phase) * 0.2;
      if (f.x < f.bounds.minX + 15 || f.x > f.bounds.maxX - 15) f.vx = -f.vx;
      if (f.y < f.bounds.minY + 15 || f.y > f.bounds.maxY - 15) f.vy = -f.vy;

      f.sprite.clear();
      // Ägyptischer Nilbarsch / Tilapia: Transparenter Schatten unter der Nil-Wasseroberfläche
      f.sprite.fillStyle(0x0e4258, 0.42);
      f.sprite.fillEllipse(f.x, f.y, 8, 3.5);
      const tailX = f.vx > 0 ? f.x - 5 : f.x + 5;
      f.sprite.fillStyle(0x195773, 0.38);
      f.sprite.fillTriangle(tailX, f.y - 2, tailX, f.y + 2, f.x, f.y);
      if (Math.sin(f.phase * 2) > 0.85) {
        f.sprite.fillStyle(0xbbf2f6, 0.55);
        f.sprite.fillCircle(f.x + (f.vx > 0 ? 4 : -4), f.y - 2, 1.2);
      }
    }

    // ---------------------------------------------------- 4. Oasen-Schmetterlinge
    for (const b of this.butterflies) {
      b.phase += dt * 5;
      b.sprite.x += b.vx * dt;
      b.sprite.y = b.baseY + Math.sin(b.phase) * 6;
      if (b.sprite.x < b.bounds.minX || b.sprite.x > b.bounds.maxX) {
        b.vx = -b.vx;
        b.sprite.setFlipX(b.vx < 0);
      }
      if (b.baseY < b.bounds.minY || b.baseY > b.bounds.maxY) {
        b.vy = -b.vy;
      }
      b.baseY += b.vy * dt;
    }

    // ---------------------------------------------------- 5. Nil-Frösche von Heqet (reaktiv)
    for (const fr of this.frogs) {
      const dToP = Phaser.Math.Distance.Between(fr.sprite.x, fr.sprite.y, playerX, playerY);
      if (fr.state === 'sit') {
        if (dToP < 38) {
          // Spieler tritt zu nah -> Frosch springt ins Nilwasser!
          fr.state = 'jump';
          fr.timer = 0.55;
          if (this.scene.anims.exists('critter-frog-jump')) fr.sprite.play('critter-frog-jump', true);
        } else {
          fr.timer -= dt;
          if (fr.timer <= 0) {
            fr.timer = this.rng.realInRange(3.0, 7.0);
            if (this.scene.anims.exists('critter-frog-croak')) fr.sprite.play('critter-frog-croak', true);
          }
        }
      } else if (fr.state === 'jump') {
        fr.timer -= dt;
        // Bogenförmiger Sprung ostwärts ins Nilwasser
        fr.sprite.x += 38 * dt;
        fr.sprite.y -= 12 * Math.sin(fr.timer * Math.PI) * dt;
        if (fr.timer <= 0) {
          fr.state = 'underwater';
          fr.sprite.setVisible(false);
          fr.timer = this.rng.realInRange(8.0, 16.0);
        }
      } else if (fr.state === 'underwater') {
        fr.timer -= dt;
        if (fr.timer <= 0 && dToP > 55) {
          fr.state = 'sit';
          fr.sprite.setPosition(fr.startX, fr.startY);
          fr.sprite.setVisible(true);
          if (this.scene.anims.exists('critter-frog-idle')) fr.sprite.play('critter-frog-idle', true);
        }
      }
    }
  }

  private playDirectionAnim(a: RoamingAnimal, dx: number, dy: number): void {
    const prefix = a.animPrefix;
    if (!prefix) {
      if (a.walkAnim && this.scene.anims.exists(a.walkAnim)) a.sprite.play(a.walkAnim, true);
      a.sprite.setFlipX(dx < 0);
      return;
    }

    if (Math.abs(dx) >= Math.abs(dy)) {
      const rightKey = `${prefix}-walk-right`;
      const hopRightKey = `${prefix}-hop-right`;
      if (this.scene.anims.exists(rightKey)) {
        a.sprite.play(rightKey, true);
      } else if (this.scene.anims.exists(hopRightKey)) {
        a.sprite.play(hopRightKey, true);
      } else if (a.walkAnim && this.scene.anims.exists(a.walkAnim)) {
        a.sprite.play(a.walkAnim, true);
      }
      a.sprite.setFlipX(dx < 0);
    } else if (dy > 0) {
      const downKey = `${prefix}-walk-down`;
      const hopDownKey = `${prefix}-hop-down`;
      if (this.scene.anims.exists(downKey)) {
        a.sprite.play(downKey, true);
      } else if (this.scene.anims.exists(hopDownKey)) {
        a.sprite.play(hopDownKey, true);
      } else if (a.walkAnim && this.scene.anims.exists(a.walkAnim)) {
        a.sprite.play(a.walkAnim, true);
      }
      a.sprite.setFlipX(false);
    } else {
      const upKey = `${prefix}-walk-up`;
      const hopUpKey = `${prefix}-hop-up`;
      if (this.scene.anims.exists(upKey)) {
        a.sprite.play(upKey, true);
      } else if (this.scene.anims.exists(hopUpKey)) {
        a.sprite.play(hopUpKey, true);
      } else if (a.walkAnim && this.scene.anims.exists(a.walkAnim)) {
        a.sprite.play(a.walkAnim, true);
      }
      a.sprite.setFlipX(false);
    }
  }

  private playIdleAnim(a: RoamingAnimal): void {
    if (a.idleAnim && this.scene.anims.exists(a.idleAnim)) {
      a.sprite.play(a.idleAnim, true);
    } else if (a.animPrefix) {
      const defaultIdle = `${a.animPrefix}-idle`;
      if (this.scene.anims.exists(defaultIdle)) {
        a.sprite.play(defaultIdle, true);
      }
    }
  }
}
