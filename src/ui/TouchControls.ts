import Phaser from 'phaser';

export class TouchControls {
  vector = new Phaser.Math.Vector2(0, 0);
  actionPressed = false;

  private base: Phaser.GameObjects.Arc;
  private knob: Phaser.GameObjects.Arc;
  private button: Phaser.GameObjects.Arc;
  private label: Phaser.GameObjects.Text;
  private stickPointerId: number | null = null;
  private origin = new Phaser.Math.Vector2();
  private readonly radius = 28;

  constructor(scene: Phaser.Scene, private isModal?: () => boolean) {
    const w = scene.scale.width;
    const h = scene.scale.height;

    this.base = scene.add.circle(0, 0, this.radius, 0xffffff, 0.15).setStrokeStyle(1, 0xffffff, 0.5);
    this.knob = scene.add.circle(0, 0, 11, 0xffffff, 0.45);
    this.button = scene.add.circle(w - 40, h - 40, 22, 0xe8c170, 0.45).setStrokeStyle(1, 0xffffff, 0.7);
    this.label = scene.add.text(w - 40, h - 40, 'E', { fontFamily: 'monospace', fontSize: '16px', color: '#fff' }).setOrigin(0.5);
    [this.base, this.knob, this.button, this.label].forEach((o) => o.setScrollFactor(0).setDepth(1000));
    this.base.setVisible(false);
    this.knob.setVisible(false);

    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.isModal && this.isModal()) return;
      if (Phaser.Math.Distance.Between(p.x, p.y, this.button.x, this.button.y) < 30) {
        this.actionPressed = true;
        return;
      }
      // Menü-Schaltflächen oben rechts nicht als Joystick werten
      if (p.y < 60 && p.x > w - 120) return;
      if (p.x < w * 0.55 && this.stickPointerId === null) {
        this.stickPointerId = p.id;
        this.origin.set(p.x, p.y);
        this.base.setPosition(p.x, p.y).setVisible(true);
        this.knob.setPosition(p.x, p.y).setVisible(true);
      }
    });
    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.id !== this.stickPointerId) return;
      const d = new Phaser.Math.Vector2(p.x - this.origin.x, p.y - this.origin.y);
      const len = Math.min(d.length(), this.radius);
      if (len > 0) d.setLength(len);
      this.knob.setPosition(this.origin.x + d.x, this.origin.y + d.y);
      this.vector.set(d.x / this.radius, d.y / this.radius);
      if (this.vector.length() < 0.2) this.vector.set(0, 0);
    });
    const release = (p: Phaser.Input.Pointer) => {
      if (p.id === this.stickPointerId) {
        this.stickPointerId = null;
        this.vector.set(0, 0);
        this.base.setVisible(false);
        this.knob.setVisible(false);
      }
    };
    scene.input.on('pointerup', release);
    scene.input.on('pointerupoutside', release);

    // Auf Desktop ohne Touch Button ausblenden
    const isTouch = scene.sys.game.device.input.touch;
    this.button.setVisible(isTouch);
    this.label.setVisible(isTouch);
  }

  /** Liefert true genau einmal pro Tipp auf den Aktionsbutton. */
  consumeAction(): boolean {
    const v = this.actionPressed;
    this.actionPressed = false;
    return v;
  }
}
