/**
 * Kinoreife 16-Bit Kapitel-Einblendung (ChapterBanner.ts)
 * Blendet bei Kapitelwechsel oder Betreten markanter Distrikte einen eleganten
 * Retro-Banner mit Goldakzenten und Sound-Chime ein (Chrono-Trigger-Style).
 */

import { sfx } from '../audio/sound';

export interface BannerInfo {
  icon?: string;
  chapterNumber?: number;
  title: string;
  subtitle?: string;
}

export class ChapterBanner {
  private el: HTMLElement;
  private timeoutId: any = null;

  constructor() {
    const existing = document.getElementById('chapter-banner-overlay');
    if (existing) {
      this.el = existing;
    } else {
      this.el = document.createElement('div');
      this.el.id = 'chapter-banner-overlay';
      this.el.className = 'chapter-banner';
      this.el.style.display = 'none';
      document.body.appendChild(this.el);
    }
    this.injectStyles();
  }

  public show(info: BannerInfo): void {
    if (this.timeoutId) clearTimeout(this.timeoutId);

    const cleanTitle = info.title.replace(/^Kapitel\s*\d+\s*:\s*/i, '');
    const chapterPrefix = info.chapterNumber !== undefined 
      ? `KAPITEL ${info.chapterNumber}: ` 
      : '';

    this.el.innerHTML = `
      <div class="banner-inner">
        <div class="banner-icon">${info.icon || '🏛️'}</div>
        <div class="banner-text">
          <div class="banner-main">${chapterPrefix}${cleanTitle}</div>
          ${info.subtitle ? `<div class="banner-sub">${info.subtitle}</div>` : ''}
        </div>
      </div>
      <div class="banner-glow-line"></div>
    `;

    this.el.style.display = 'flex';
    this.el.classList.remove('banner-hide');
    this.el.classList.add('banner-show');

    try {
      sfx.door();
    } catch (e) {}

    this.timeoutId = setTimeout(() => {
      this.el.classList.remove('banner-show');
      this.el.classList.add('banner-hide');
      setTimeout(() => {
        this.el.style.display = 'none';
      }, 500);
    }, 2800);
  }

  private injectStyles(): void {
    if (document.getElementById('chapter-banner-styles')) return;

    const style = document.createElement('style');
    style.id = 'chapter-banner-styles';
    style.textContent = `
      .chapter-banner {
        position: fixed;
        top: 48px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 45;
        pointer-events: none;
        display: flex;
        flex-direction: column;
        align-items: center;
        transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .banner-show {
        opacity: 1;
        transform: translate(-50%, 0);
      }
      .banner-hide {
        opacity: 0;
        transform: translate(-50%, -18px);
      }
      .banner-inner {
        background: linear-gradient(180deg, rgba(20, 16, 32, 0.95) 0%, rgba(12, 10, 20, 0.98) 100%);
        border: 2px solid #d97706;
        border-radius: 8px;
        padding: 10px 24px;
        display: flex;
        align-items: center;
        gap: 14px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.75), 0 0 20px rgba(217, 119, 6, 0.3);
        backdrop-filter: blur(6px);
      }
      .banner-icon {
        font-size: 24px;
      }
      .banner-text {
        text-align: left;
      }
      .banner-main {
        font-family: 'Cinzel', serif, system-ui;
        font-size: 14px;
        font-weight: 800;
        letter-spacing: 0.08em;
        color: #fef3c7;
        text-transform: uppercase;
        text-shadow: 0 2px 4px rgba(0,0,0,0.8);
      }
      .banner-sub {
        font-size: 11px;
        color: #f59e0b;
        margin-top: 2px;
      }
      .banner-glow-line {
        width: 85%;
        height: 2px;
        background: linear-gradient(90deg, transparent 0%, #fbbf24 50%, transparent 100%);
        box-shadow: 0 0 8px #fbbf24;
        margin-top: -1px;
      }
    `;
    document.head.appendChild(style);
  }
}
