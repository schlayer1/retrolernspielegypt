import Phaser from 'phaser';
import { bgm, sfx } from '../audio/sound';
import {
  CHAPTERS,
  EPOCH_COMPARISON,
  HIGHLIGHT_TERMS,
  LEXICON,
  EpochComparisonRow,
  LexiconEntry,
} from '../data/chapters';
import {
  BUILDINGS,
  ITEMS,
  RECIPES,
  TRADES,
  EgyptBuildingDef,
  EgyptItemId,
  EgyptRecipe,
  EgyptTradeOffer,
} from '../data/items';
import { DialogSpec, EGYPT_ROLES, PlayerRole, state } from '../systems/GameState';
import { PlayerGender } from '../systems/SaveManager';
import { TouchControls } from '../ui/TouchControls';
import { EGYPT_RELICS, RelicDef } from '../data/relics';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const TERM_REGEX = new RegExp(
  `(${[...HIGHLIGHT_TERMS]
    .sort((a, b) => b.length - a.length)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')})`,
  'gi',
);

function highlightTerms(text: string): string {
  if (!text) return '';
  const escaped = escapeHtml(text)
    .replace(/&lt;strong&gt;/gi, '<strong>')
    .replace(/&lt;\/strong&gt;/gi, '</strong>')
    .replace(/&lt;b&gt;/gi, '<b>')
    .replace(/&lt;\/b&gt;/gi, '</b>')
    .replace(/&lt;em&gt;/gi, '<em>')
    .replace(/&lt;\/em&gt;/gi, '</em>')
    .replace(/&lt;i&gt;/gi, '<i>')
    .replace(/&lt;\/i&gt;/gi, '</i>')
    .replace(/&lt;br\s*\/?&gt;/gi, '<br>')
    .replace(/\n/g, '<br>');
  return escaped.replace(TERM_REGEX, '<span class="didactic-term">$1</span>');
}

type ActivePanel =
  | 'none'
  | 'start'
  | 'pause'
  | 'relic'
  | 'bag'
  | 'craft'
  | 'trade'
  | 'lexicon'
  | 'timeline'
  | 'cert';

export class UIScene extends Phaser.Scene {
  private root!: HTMLElement;
  private titleEl!: HTMLElement;
  private questEl!: HTMLElement;
  private compassEl!: HTMLElement;
  private foodBar!: HTMLElement;
  private safetyBar!: HTMLElement;
  private knowBar!: HTMLElement;
  private clockEl!: HTMLElement;
  private lexCountEl!: HTMLElement;
  private hintEl!: HTMLElement;
  private hotbarEl!: HTMLElement;
  private toastEl!: HTMLElement;

  private dialogEl!: HTMLElement;
  private dlgSpeakerEl!: HTMLElement;
  private dlgTextEl!: HTMLElement;
  private dlgOptsEl!: HTMLElement;
  private dlgNextBtn!: HTMLButtonElement;
  private dlgSpeakBtn!: HTMLButtonElement;

  private backdropEl!: HTMLElement;
  private modalCardEl!: HTMLElement;
  private modalTitleEl!: HTMLElement;
  private modalBodyEl!: HTMLElement;
  private modalFooterEl!: HTMLElement;

  private activePanel: ActivePanel = 'none';
  private currentRelic: RelicDef | null = null;
  private lexSelected = 'kemet';
  private bagTab: 'all' | 'tool' | 'food' | 'material' | 'culture' = 'all';
  private bagSelected: EgyptItemId = 'papyrus_staengel';
  private startSelectedChapter = 1;
  private selectedRole: PlayerRole = 'fisher';

  private toastQueue: string[] = [];
  private toastBusy = false;

  private spec?: DialogSpec;
  private nodeIdx = 0;
  private questionActive = false;
  private visibleRecipes: EgyptRecipe[] = [];

  constructor() {
    super('UI');
  }

  private isTyping(): boolean {
    const el = document.activeElement;
    return Boolean(el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT'));
  }

  create(): void {
    const existing = document.getElementById('ui-root');
    this.root = existing ?? document.createElement('div');
    this.root.id = 'ui-root';
    if (!existing) document.body.appendChild(this.root);
    this.root.innerHTML = '';

    this.selectedRole = state.playerRole || 'fisher';
    this.startSelectedChapter = state.chapter || 1;

    this.mountDOM();
    this.bindEvents();
    this.bindKeys();
    new TouchControls(this);

    this.renderHUD();
    this.renderHotbar();

    if (!state.skipStartScreen) {
      this.openStartScreen();
    }
  }

  private mountDOM(): void {
    this.root.innerHTML = `
      <div class="hud-top">
        <div class="hud-quest-box" id="hud-quest-box" title="Tippen für Details">
          <div class="hud-chapter-title" id="hud-title">Kapitel 1: Die Wüste weicht – Ankunft am Nil</div>
          <div class="hud-quest-text" id="hud-quest">Ziel wird geladen ...</div>
          <div class="hud-compass" id="hud-compass">🧭 Berechne Weg ...</div>
        </div>
        <div class="hud-right">
          <div class="hud-top-right-group">
            <div class="hud-bars-card" id="hud-bars-card">
              <div class="hud-bar-row" id="row-food" style="cursor:pointer;" title="Tippen zum Essen (F)">
                <span>🍖 Nahrung</span>
                <div class="hud-bar-track"><div class="hud-bar-fill" id="bar-food" style="background:#e0894a;width:85%"></div></div>
              </div>
              <div class="hud-bar-row">
                <span>☀️ Lebenskraft</span>
                <div class="hud-bar-track"><div class="hud-bar-fill" id="bar-safety" style="background:#5aa6e8;width:85%"></div></div>
              </div>
              <div class="hud-bar-row">
                <span>📜 Wissen</span>
                <div class="hud-bar-track"><div class="hud-bar-fill" id="bar-know" style="background:#e8d25a;width:0%"></div></div>
              </div>
              <div class="hud-bar-subinfo" style="display:flex;justify-content:space-between;font-size:11px;color:#ffe9b0;margin-top:2px;">
                <span id="hud-lex-count">Lexikon: 0/27</span>
                <span id="hud-clock">☀️ 08:00</span>
              </div>
            </div>
            <button class="retro-btn hud-mobile-menu-btn" id="hud-mobile-menu-btn" data-act="pause" title="Menü & Pause öffnen">
              <span style="font-size:15px;">⏸</span>
              <span>Menü</span>
            </button>
          </div>
          <div class="hud-btn-row">
            <button class="retro-btn" id="btn-toggle-bgm" title="Hintergrundmusik an/aus (M)" style="border-color:#38bdf8;"><span>🎵 Musik</span></button>
            <button class="retro-btn" data-act="pause" style="border-color:#fbbf24;"><span class="key-badge">P</span> ⏸ Pause</button>
            <button class="retro-btn" data-act="bag" style="border-color:#ffd86b;"><span class="key-badge">I</span> 🎒 Beutel</button>
            <button class="retro-btn" data-act="craft"><span class="key-badge">C</span> Handwerk</button>
            <button class="retro-btn" data-act="trade"><span class="key-badge">H</span> Handel</button>
            <button class="retro-btn" data-act="lexicon"><span class="key-badge">L</span> Lexikon</button>
            <button class="retro-btn" data-act="timeline"><span class="key-badge">Z</span> Zeitstrahl</button>
            <button class="retro-btn" data-act="cert"><span class="key-badge">U</span> Urkunde</button>
          </div>
        </div>
      </div>

      <div class="hud-toast" id="hud-toast"></div>

      <div class="hud-bottom">
        <div class="hud-hint-pill" id="hud-hint" style="display:none"></div>
        <div class="hud-bottom-row">
          <div class="hud-hotbar" id="hud-hotbar"></div>
          <button class="hotbar-bag-btn" id="hud-bag-btn" data-act="bag">
            <span>🎒 Beutel</span>
            <span class="key-badge" style="background:#e8c170;color:#1a1208;font-size:10px;padding:1px 4px;">I</span>
          </button>
        </div>
      </div>

      <div class="dialog-dock" id="dlg-dock" style="display:none">
        <div class="dialog-speaker-row">
          <span class="dialog-speaker" id="dlg-speaker">Mentor</span>
          <div style="display:flex;gap:8px;align-items:center;">
            <button class="retro-btn" id="dlg-speak-btn" style="padding:3px 8px;font-size:12px;">🔊 Vorlesen</button>
            <button class="retro-btn" id="dlg-next-btn" style="padding:3px 10px;font-size:12px;">Weiter (E) ▶</button>
          </div>
        </div>
        <div class="dialog-text" id="dlg-text"></div>
        <div class="dialog-options" id="dlg-opts"></div>
      </div>

      <div class="modal-backdrop" id="modal-backdrop" style="display:none">
        <div class="modal-card" id="modal-card">
          <div class="modal-header">
            <h2 class="modal-title" id="modal-title">Menü</h2>
            <button class="retro-btn no-print" id="modal-close-btn">✕ Schließen (Esc)</button>
          </div>
          <div class="modal-body" id="modal-body"></div>
          <div class="modal-footer no-print" id="modal-footer"></div>
        </div>
      </div>
    `;

    this.titleEl = this.root.querySelector('#hud-title')!;
    this.questEl = this.root.querySelector('#hud-quest')!;
    this.compassEl = this.root.querySelector('#hud-compass')!;
    this.foodBar = this.root.querySelector('#bar-food')!;
    this.safetyBar = this.root.querySelector('#bar-safety')!;
    this.knowBar = this.root.querySelector('#bar-know')!;
    this.clockEl = this.root.querySelector('#hud-clock')!;
    this.lexCountEl = this.root.querySelector('#hud-lex-count')!;
    this.hintEl = this.root.querySelector('#hud-hint')!;
    this.hotbarEl = this.root.querySelector('#hud-hotbar')!;
    this.toastEl = this.root.querySelector('#hud-toast')!;

    this.dialogEl = this.root.querySelector('#dlg-dock')!;
    this.dlgSpeakerEl = this.root.querySelector('#dlg-speaker')!;
    this.dlgTextEl = this.root.querySelector('#dlg-text')!;
    this.dlgOptsEl = this.root.querySelector('#dlg-opts')!;
    this.dlgNextBtn = this.root.querySelector('#dlg-next-btn')!;
    this.dlgSpeakBtn = this.root.querySelector('#dlg-speak-btn')!;

    this.backdropEl = this.root.querySelector('#modal-backdrop')!;
    this.modalCardEl = this.root.querySelector('#modal-card')!;
    this.modalTitleEl = this.root.querySelector('#modal-title')!;
    this.modalBodyEl = this.root.querySelector('#modal-body')!;
    this.modalFooterEl = this.root.querySelector('#modal-footer')!;

    this.root.querySelectorAll('[data-act]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const act = (btn as HTMLElement).dataset.act;
        if (act === 'eat') {
          if (!state.modal) this.toast(state.eat());
        } else if (act) {
          this.togglePanel(act as ActivePanel);
        }
      });
    });

    const bgmBtn = this.root.querySelector('#btn-toggle-bgm') as HTMLButtonElement | null;
    if (bgmBtn) {
      const updateBgmLabel = () => {
        bgmBtn.innerHTML = bgm.isMuted ? '<span>🔇 Musik</span>' : '<span>🎵 Musik</span>';
        bgmBtn.style.opacity = bgm.isMuted ? '0.6' : '1';
      };
      updateBgmLabel();
      bgmBtn.addEventListener('click', () => {
        const muted = bgm.toggleMute();
        updateBgmLabel();
        this.toast(muted ? 'Musik stummgeschaltet' : 'Musik an');
      });
    }

    const questBox = this.root.querySelector('#hud-quest-box');
    if (questBox) {
      questBox.addEventListener('click', () => {
        questBox.classList.toggle('expanded');
      });
    }

    const foodRow = this.root.querySelector('#row-food');
    if (foodRow) {
      foodRow.addEventListener('click', () => {
        if (!state.modal) this.toast(state.eat());
      });
    }

    document.getElementById('btn-dismiss-rotate')?.addEventListener('click', () => {
      document.getElementById('rotate-prompt')?.classList.add('dismissed');
    });

    // Start background music loop
    bgm.playChapter(state.chapter);

    this.dlgNextBtn.addEventListener('click', () => this.advanceDialog());
    this.dlgSpeakBtn.addEventListener('click', () => this.readDialogAloud());
    this.root.querySelector('#modal-close-btn')!.addEventListener('click', () => this.closeModal());
    this.backdropEl.addEventListener('click', (e) => {
      if (e.target === this.backdropEl && this.activePanel !== 'start') {
        this.closeModal();
      }
    });
  }

  private bindEvents(): void {
    state.on('chapterChanged', (ch: number) => {
      bgm.playChapter(ch);
      this.renderHUD();
    });
    state.on('inventory', () => {
      this.renderHUD();
      this.renderHotbar();
    });
    state.on('quest', () => this.renderHUD());
    state.on('lexicon', () => this.renderHUD());
    state.on('buildings', () => this.renderHUD());
    state.on('dialog', (s: DialogSpec) => this.startDialog(s));
    state.on('toast', (msg: string) => this.toast(msg));
    state.on('openTrade', () => this.openTrade());
    state.on('openCertificate', () => this.openCertificate());
    state.on('openRelicQuiz', (r: RelicDef | string) => this.openRelicModal(r), this);
  }

  private bindKeys(): void {
    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => {
      if (this.isTyping()) return;

      if (e.key === 'Escape') {
        if (this.activePanel !== 'none' && this.activePanel !== 'start') this.closeModal();
        return;
      }
      if (e.key === 'p' || e.key === 'P') {
        this.togglePanel('pause');
        return;
      }
      if (e.key === 'i' || e.key === 'I' || e.key === 'b' || e.key === 'B') {
        this.togglePanel('bag');
        return;
      }
      if (e.key === 'c' || e.key === 'C') {
        this.togglePanel('craft');
        return;
      }
      if (e.key === 'h' || e.key === 'H' || e.key === 't' || e.key === 'T') {
        this.togglePanel('trade');
        return;
      }
      if (e.key === 'l' || e.key === 'L') {
        this.togglePanel('lexicon');
        return;
      }
      if (e.key === 'z' || e.key === 'Z') {
        this.togglePanel('timeline');
        return;
      }
      if (e.key === 'u' || e.key === 'U') {
        this.togglePanel('cert');
        return;
      }
      if (e.key >= '1' && e.key <= '9') {
        const num = parseInt(e.key, 10) - 1;
        if (this.activePanel === 'craft') {
          this.craftRecipe(num);
          return;
        }
      }
      if (e.key === 'e' || e.key === 'E' || e.key === ' ' || e.key === 'Enter') {
        if (this.dialogEl.style.display !== 'none') {
          this.advanceDialog();
        }
      }
    });
  }

  update(): void {
    if (this.hintEl) {
      if (state.hint && !state.modal && this.activePanel === 'none') {
        this.hintEl.textContent = state.hint;
        this.hintEl.style.display = 'block';
      } else {
        this.hintEl.style.display = 'none';
      }
    }

    if (this.compassEl) {
      this.compassEl.textContent = state.compassText || '🧭 Folge den Sternen & dem Nil';
    }

    if (this.clockEl) {
      const h = Math.floor(state.dayTime * 24);
      const m = Math.floor((state.dayTime * 24 * 60) % 60);
      const isNight = h < 6 || h >= 20;
      this.clockEl.textContent = `${isNight ? '🌙' : '☀️'} ${h < 10 ? '0' : ''}${h}:${m < 10 ? '0' : ''}${m}`;
    }
  }

  private renderHUD(): void {
    const ch = state.currentChapterDef;
    const qIdx = state.quest;
    this.titleEl.textContent = `Kapitel ${state.chapter}: ${ch.title.split(':')[1]?.trim() || ch.title}`;
    this.questEl.innerHTML = `<strong>Aufgabe:</strong> ${highlightTerms(ch.quests[qIdx] || 'Sprich mit deinem Mentor!')}`;

    this.foodBar.style.width = `${Math.min(100, Math.max(0, state.food))}%`;
    this.safetyBar.style.width = `${Math.min(100, Math.max(0, state.safety))}%`;
    this.knowBar.style.width = `${Math.min(100, Math.max(0, state.knowledge))}%`;
    this.lexCountEl.textContent = `Lexikon: ${state.lexicon.length}/${Object.keys(LEXICON).length}`;
  }

  private renderHotbar(): void {
    const entries = Object.entries(state.inventory).filter(([_, count]) => count > 0);
    if (entries.length === 0) {
      this.hotbarEl.innerHTML = `<div style="font-size:12px;color:#cbd5e1;padding:4px 8px;">Drücke <strong>C</strong> (Handwerk) oder <strong>I</strong> (Rucksack)</div>`;
      return;
    }

    const html = entries.slice(0, 8).map(([id, count]) => {
      const def = ITEMS[id as EgyptItemId];
      const name = def?.name ?? id;
      const isFood = def?.category === 'food';
      return `
        <div class="hotbar-slot ${isFood ? 'slot-food' : ''}" title="${escapeHtml(name)} (${count}×)">
          <img src="assets/icons/${id}.png" class="pixel-icon" alt="${escapeHtml(name)}" onerror="this.style.display='none'" />
          <div class="slot-badge">${count}</div>
        </div>
      `;
    }).join('');

    this.hotbarEl.innerHTML = html;
  }

  toast(msg: string): void {
    this.toastQueue.push(msg);
    if (!this.toastBusy) this.pumpToast();
  }

  private pumpToast(): void {
    if (this.toastQueue.length === 0) {
      this.toastBusy = false;
      return;
    }
    this.toastBusy = true;
    const msg = this.toastQueue.shift()!;
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('visible');
    sfx.click();

    setTimeout(() => {
      this.toastEl.classList.remove('visible');
      setTimeout(() => this.pumpToast(), 250);
    }, 2200);
  }

  private startDialog(spec: DialogSpec): void {
    this.spec = spec;
    this.nodeIdx = 0;
    state.modal = true;
    this.dialogEl.style.display = 'block';
    this.renderDialogNode();
  }

  private renderDialogNode(): void {
    if (!this.spec || this.nodeIdx >= this.spec.nodes.length) {
      this.closeDialog();
      return;
    }
    const node = this.spec.nodes[this.nodeIdx];
    this.dlgSpeakerEl.textContent = node.speaker || this.spec.speaker;
    this.dlgOptsEl.innerHTML = '';
    this.questionActive = false;

    if (node.question && node.options) {
      this.questionActive = true;
      this.dlgTextEl.innerHTML = highlightTerms(node.question);
      this.dlgNextBtn.style.display = 'none';

      node.options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'retro-btn';
        btn.style.margin = '4px';
        btn.innerHTML = `${String.fromCharCode(65 + idx)}) ${escapeHtml(opt)}`;
        btn.addEventListener('click', () => {
          if (idx === node.correct) {
            this.questionActive = false;
            sfx.quest();
            this.dlgTextEl.innerHTML = `<span style="color:#86efac;font-weight:bold;">Richtig!</span> ${highlightTerms(node.explain || '')}`;
            this.dlgOptsEl.innerHTML = '';
            this.dlgNextBtn.style.display = 'inline-block';
            this.dlgNextBtn.textContent = this.nodeIdx === (this.spec?.nodes.length ?? 0) - 1 ? 'Abschließen ✔' : 'Weiter (E) ▶';
          } else {
            sfx.eat();
            state.quizAttempts++;
            this.dlgTextEl.innerHTML = `<span style="color:#f87171;font-weight:bold;">Nicht ganz.</span> Überlege noch einmal genau oder frage deinen Mentor!`;
          }
        });
        this.dlgOptsEl.appendChild(btn);
      });
    } else {
      this.dlgTextEl.innerHTML = highlightTerms(node.text || '');
      this.dlgNextBtn.style.display = 'inline-block';
      this.dlgNextBtn.textContent = this.nodeIdx === this.spec.nodes.length - 1 ? 'Abschließen ✔' : 'Weiter (E) ▶';
    }
  }

  private advanceDialog(): void {
    if (this.questionActive) return;
    this.nodeIdx++;
    this.renderDialogNode();
  }

  private closeDialog(): void {
    this.dialogEl.style.display = 'none';
    state.modal = false;
    state.lastModalClose = Date.now();
    const onDone = this.spec?.onDone;
    this.spec = undefined;
    if (onDone) onDone();
  }

  private readDialogAloud(): void {
    if (!('speechSynthesis' in window)) {
      this.toast('Sprachausgabe wird in diesem Browser nicht unterstützt.');
      return;
    }
    window.speechSynthesis.cancel();
    const text = this.dlgTextEl.innerText;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'de-DE';
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  }

  private togglePanel(panel: ActivePanel): void {
    if (this.activePanel === panel) {
      this.closeModal();
      return;
    }
    switch (panel) {
      case 'pause':
        this.openPause();
        break;
      case 'relic':
        if (this.currentRelic) this.renderRelicModal(this.currentRelic);
        break;
      case 'bag':
        this.openBag();
        break;
      case 'craft':
        this.openCraft();
        break;
      case 'trade':
        this.openTrade();
        break;
      case 'lexicon':
        this.openLexicon();
        break;
      case 'timeline':
        this.openTimeline();
        break;
      case 'cert':
        this.openCertificate();
        break;
    }
  }

  private openModal(panel: ActivePanel, title: string): void {
    this.activePanel = panel;
    state.modal = true;
    this.modalTitleEl.textContent = title;
    this.modalCardEl.classList.remove('dark');
    const closeBtn = this.root.querySelector('#modal-close-btn') as HTMLElement | null;
    if (closeBtn) closeBtn.style.display = panel === 'start' ? 'none' : 'inline-flex';
    this.backdropEl.style.display = 'flex';
  }

  private closeModal(): void {
    this.backdropEl.style.display = 'none';
    this.modalCardEl.classList.remove('dark');
    this.activePanel = 'none';
    state.modal = false;
    state.lastModalClose = Date.now();
  }

  private openStartScreen(): void {
    this.openModal('start', '🏺 Willkommen im Alten Ägypten! (Klasse 5/6)');

    const currentAvatar = state.playerGender === 'female' ? state.femalePreviewUrl : state.malePreviewUrl;
    const savedMeta = CHAPTERS[state.chapter] ?? CHAPTERS[1];
    const savedQuest = savedMeta.quests[Math.min(state.quest, savedMeta.quests.length - 1)];

    const resumeHtml = state.hasHadExistingSaveOnBoot
      ? `
        <div style="background:linear-gradient(135deg,#1d3b1a 0%,#2b5324 100%);border:2.5px solid #86efac;border-radius:10px;padding:12px 16px;color:#fff;margin-bottom:14px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;">
          <div style="display:flex;align-items:center;gap:14px;">
            <div class="gender-avatar-box" style="border-color:#86efac;">
              <img src="${currentAvatar || 'assets/gfx/player_egypt_female.png'}" alt="Spielfigur" />
            </div>
            <div>
              <div style="font-size:11.5px;font-weight:800;color:#bbf7d0;text-transform:uppercase;">
                ✓ Gespeicherter Spielstand auf diesem Gerät gefunden
              </div>
              <div style="font-size:18px;font-weight:900;color:#fff;">
                ${escapeHtml(state.playerName)} · ${escapeHtml(state.roleSpecialistTitle())}
              </div>
              <div style="font-size:13px;color:#dcfce7;">
                ${escapeHtml(savedMeta.title)} · Aufgabe: ${escapeHtml(savedQuest)} · ⏱ ${escapeHtml(state.formatPlayTime())}
              </div>
            </div>
          </div>
          <button class="retro-btn" id="start-resume-btn" style="background:#22c55e;color:#052e16;border-color:#bbf7d0;font-size:15px;padding:10px 18px;font-weight:900;">
            ▶️ Direkt weiterspielen!
          </button>
        </div>
      `
      : '';

    const shortEras = ['', 'Nilnomaden', 'Bewässerung', 'Staatsbildung', 'Schriftkultur', 'Monumente', 'Welthandel'];
    const chPills = [1, 2, 3, 4, 5, 6]
      .map((ch) => {
        const active = this.startSelectedChapter === ch;
        return `
          <button type="button" class="retro-btn" data-start-ch="${ch}" style="background:${active ? '#b45309' : '#3a2410'};border-color:${active ? '#fde68a' : '#8b5a2b'};padding:4px 8px;font-size:12px;color:#ffe9b0;">
            <span class="key-badge">${ch}</span> ${shortEras[ch]}
          </button>
        `;
      })
      .join('');

    this.modalBodyEl.innerHTML = `
      <div class="start-hero">
        <div class="start-hero-title">🏺 KEMET – DAS GESCHENK DES NILS · HOCHKULTUR AM STROM</div>
        <div class="start-hero-sub">
          Erlebe in 6 didaktischen Kapiteln, wie aus nomadisierenden Schilffischern die erste Hochkultur der Menschheit entstand – mit Schaduf-Ackerbau, Lehmziegelstädten, Hieroglyphen und dem Pyramidenbau von Gizeh!
        </div>
        <div class="showcase-strip">
          <div class="showcase-card">
            <img src="assets/icons/nilbarsch.png" alt="Kapitel 1" />
            <div class="showcase-era">Kap. 1 · Nilnomaden</div>
            <div class="showcase-caption">Schilfboot, Fischreuse & Dattelpalmen</div>
          </div>
          <div class="showcase-card">
            <img src="assets/icons/schaduf_teil.png" alt="Kapitel 2" />
            <div class="showcase-era">Kap. 2 · Bewässerung</div>
            <div class="showcase-caption">Schaduf-Hebel, Nilometer & Pflug</div>
          </div>
          <div class="showcase-card">
            <img src="assets/icons/lehmziegel.png" alt="Kapitel 3" />
            <div class="showcase-era">Kap. 3 · Staatsbildung</div>
            <div class="showcase-caption">Lehmziegelofen & Kornspeicher</div>
          </div>
          <div class="showcase-card">
            <img src="assets/icons/papyrusrolle.png" alt="Kapitel 4" />
            <div class="showcase-era">Kap. 4 · Schriftkultur</div>
            <div class="showcase-caption">Papyrusrollen & Hieroglyphen</div>
          </div>
          <div class="showcase-card">
            <img src="assets/icons/kalkstein.png" alt="Kapitel 5" />
            <div class="showcase-era">Kap. 5 · Monumente</div>
            <div class="showcase-caption">Kalksteinquader & Pyramidenbau</div>
          </div>
          <div class="showcase-card">
            <img src="assets/icons/goldmaske.png" alt="Kapitel 6" />
            <div class="showcase-era">Kap. 6 · Welthandel</div>
            <div class="showcase-caption">Nilschiffe, Zedern & Gold</div>
          </div>
        </div>
      </div>

      ${resumeHtml}

      <div style="background:#fffdf7;border:2px solid #c29b61;border-radius:10px;padding:10px 14px;margin-bottom:8px;">
        <div style="font-weight:900;font-size:15px;color:#5a2d0c;margin-bottom:4px;">
          1. Wähle deine Spielfigur (Merit oder Nakht):
        </div>
        <div class="gender-grid">
          <button type="button" class="gender-card ${state.playerGender === 'female' ? 'active' : ''}" data-pick-gender="female">
            <div class="gender-avatar-box">
              <img src="${state.femalePreviewUrl || 'assets/gfx/player_egypt_female.png'}" alt="Merit" />
            </div>
            <div>
              <div style="font-size:16px;font-weight:900;color:#5a2d0c;">👩 Merit (Ägypterin)</div>
              <div style="font-size:13px;font-weight:700;color:#b45309;">„Vom Schilfboot zur Wesirin“</div>
              <div style="font-size:12px;color:#6b533b;margin-top:2px;">Weißes Leinenkleid, Pektoral & geflochtene Zöpfe</div>
            </div>
          </button>

          <button type="button" class="gender-card ${state.playerGender === 'male' ? 'active' : ''}" data-pick-gender="male">
            <div class="gender-avatar-box">
              <img src="${state.malePreviewUrl || 'assets/gfx/player_egypt_male.png'}" alt="Nakht" />
            </div>
            <div>
              <div style="font-size:16px;font-weight:900;color:#5a2d0c;">👦 Nakht (Ägypter)</div>
              <div style="font-size:13px;font-weight:700;color:#b45309;">„Vom Fischer zum Baumeister“</div>
              <div style="font-size:12px;color:#6b533b;margin-top:2px;">Leinenschurz, Schenti & schwarzes Haar</div>
            </div>
          </button>
        </div>

        <div style="font-weight:900;font-size:15px;color:#5a2d0c;margin-top:14px;margin-bottom:6px;">
          2. Wähle deine historische Spezialisierung (Rolle):
        </div>
        <div class="role-grid">
          ${(Object.keys(EGYPT_ROLES) as PlayerRole[])
            .map((rKey) => {
              const r = EGYPT_ROLES[rKey];
              const active = this.selectedRole === rKey;
              return `
                <button type="button" class="role-card ${active ? 'active' : ''}" data-pick-role="${rKey}">
                  <div style="display:flex;align-items:center;justify-content:space-between;">
                    <span style="font-size:24px;">${r.icon}</span>
                    <span class="role-badge" style="background:${active ? '#b45309' : '#3a2410'};">${active ? '✓ Gewählt' : 'Wählen'}</span>
                  </div>
                  <div style="font-weight:900;font-size:14.5px;color:#5a2d0c;">${escapeHtml(r.name)}</div>
                  <div style="font-size:12px;color:#6b533b;">${escapeHtml(r.desc)}</div>
                  <div class="role-perk">⚡ ${escapeHtml(r.perk)}</div>
                </button>
              `;
            })
            .join('')}
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px;margin-top:10px;align-items:end;">
          <div>
            <label for="start-name-input" style="display:block;font-weight:900;font-size:14px;color:#5a2d0c;margin-bottom:3px;">
              3. Wie heißt du? (Dein Name im Alten Ägypten & auf der Urkunde):
            </label>
            <input
              id="start-name-input"
              type="text"
              maxlength="20"
              value="${escapeHtml(state.playerName)}"
              placeholder="z. B. Merit, Nakht, Senmut, Nefertari ..."
              style="width:100%;padding:7px 10px;font-size:14.5px;font-weight:800;border:2px solid #b45309;border-radius:8px;background:#fff;color:#2a1d10;"
            />
          </div>
          <div>
            <div style="font-weight:900;font-size:14.5px;color:#5a2d0c;margin-bottom:4px;">
              4. Start-Epoche wählen:
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;">${chPills}</div>
          </div>
        </div>
      </div>
    `;

    this.modalFooterEl.style.justifyContent = 'space-between';
    this.modalFooterEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <span style="font-weight:800;font-size:13px;color:#ffe9b0;">🔑 Hefter-Code (anderes Gerät):</span>
        <input
          id="start-code-input"
          type="text"
          placeholder="z. B. EGY-MERIT-W-F-K2-Q3-10M"
          style="padding:7px 10px;font-size:13.5px;font-weight:800;border:2px solid #e8c170;border-radius:7px;background:#1e1b18;color:#ffe9b0;width:220px;text-transform:uppercase;"
        />
        <button class="retro-btn" id="start-code-btn">📂 Code laden</button>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${
          state.hasHadExistingSaveOnBoot
            ? `
          <button class="retro-btn" id="start-resume-bottom-btn" style="background:#22c55e;color:#052e16;font-size:15px;padding:9px 16px;border-color:#bbf7d0;font-weight:900;">
            ▶️ Gespeicherten Stand weiterspielen (Kap. ${state.chapter})
          </button>
        `
            : ''
        }
        <button class="retro-btn" id="start-go-btn" style="background:#b45309;color:#fff;font-size:15px;padding:9px 18px;border-color:#fde68a;font-weight:900;">
          🚀 Neues Spiel starten (ab Kap. ${this.startSelectedChapter})
        </button>
      </div>
    `;

    const nameInput = this.modalBodyEl.querySelector('#start-name-input') as HTMLInputElement;
    const syncNameFromInput = () => {
      const v = nameInput?.value.trim();
      if (v) state.playerName = v.slice(0, 20);
      else if (!state.playerName) state.playerName = state.playerGender === 'female' ? 'Merit' : 'Nakht';
    };

    this.modalBodyEl.querySelectorAll('[data-pick-gender]').forEach((btn) => {
      btn.addEventListener('click', () => {
        syncNameFromInput();
        const g = (btn as HTMLElement).dataset.pickGender === 'male' ? 'male' : 'female';
        if (state.playerName === 'Merit' && g === 'male') state.playerName = 'Nakht';
        else if (state.playerName === 'Nakht' && g === 'female') state.playerName = 'Merit';
        state.setProfile(state.playerName, g, this.selectedRole);
        this.openStartScreen();
      });
    });

    this.modalBodyEl.querySelectorAll('[data-pick-role]').forEach((btn) => {
      btn.addEventListener('click', () => {
        syncNameFromInput();
        this.selectedRole = ((btn as HTMLElement).dataset.pickRole as PlayerRole) ?? 'fisher';
        state.setProfile(state.playerName, state.playerGender, this.selectedRole);
        this.openStartScreen();
      });
    });

    this.modalBodyEl.querySelectorAll('[data-start-ch]').forEach((btn) => {
      btn.addEventListener('click', () => {
        syncNameFromInput();
        this.startSelectedChapter = Number((btn as HTMLElement).dataset.startCh) || 1;
        this.openStartScreen();
      });
    });

    const handleResume = () => {
      syncNameFromInput();
      state.setProfile(state.playerName, state.playerGender, this.selectedRole);
      this.closeModal();
      this.toast(`Willkommen zurück, ${state.playerName} (${state.roleSpecialistTitle()})!`);
      this.renderHUD();
      this.renderHotbar();
    };

    const resumeTopBtn = this.modalBodyEl.querySelector('#start-resume-btn');
    if (resumeTopBtn) resumeTopBtn.addEventListener('click', handleResume);

    const resumeBtmBtn = this.modalFooterEl.querySelector('#start-resume-bottom-btn');
    if (resumeBtmBtn) resumeBtmBtn.addEventListener('click', handleResume);

    const startBtn = this.modalFooterEl.querySelector('#start-go-btn');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        syncNameFromInput();
        state.setProfile(state.playerName, state.playerGender, this.selectedRole);
        state.resetNewGame(this.startSelectedChapter);
        if (this.selectedRole === 'scribe') {
          state.unlockSilent(['hieroglyphen', 'papyrus', 'schreiber']);
        }
        this.closeModal();
        this.toast(`Möge Re dich leiten, ${state.playerName}! Kapitel ${state.chapter} beginnt.`);
        this.renderHUD();
        this.renderHotbar();
      });
    }

    const codeBtn = this.modalFooterEl.querySelector('#start-code-btn');
    if (codeBtn) {
      codeBtn.addEventListener('click', () => {
        const inp = this.modalFooterEl.querySelector('#start-code-input') as HTMLInputElement;
        const code = inp?.value.trim() ?? '';
        if (!code) {
          alert('Bitte gib einen gültigen Mnemotechnik-Speichercode ein (z. B. EGY-MERIT-W-F-K2-Q3-10M).');
          return;
        }
        const res = state.importCode(code);
        if (res.ok) {
          this.closeModal();
          this.toast(res.msg);
          this.renderHUD();
          this.renderHotbar();
        } else {
          alert(res.msg);
        }
      });
    }
  }

  private openPause(): void {
    state.persist();
    this.openModal('pause', '⏸️ Spiel pausiert – Abenteuer-Statistik & Sicherung (P)');

    const avatar = state.playerGender === 'female' ? state.femalePreviewUrl : state.malePreviewUrl;
    const meta = CHAPTERS[state.chapter] ?? CHAPTERS[1];
    const qText = meta.quests[Math.min(state.quest, meta.quests.length - 1)];
    const t = state.dayTime;
    const dayPhase = t < 0.55 ? '☀️ Tag' : t < 0.7 ? '🌅 Dämmerung' : t < 0.9 ? '🌙 Nacht' : '🌄 Morgengrauen';
    const shortCode = state.exportCode();

    const builtList =
      state.buildings.length > 0
        ? state.buildings.map((id) => BUILDINGS.find((b) => b.id === id)?.name ?? id).join(', ')
        : 'Noch keine Bauwerke errichtet';

    this.modalBodyEl.innerHTML = `
      <div style="background:linear-gradient(135deg,#2b1a0c 0%,#462b14 100%);border:2px solid #e8c170;border-radius:10px;padding:12px 16px;color:#fff6e0;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;">
        <div style="display:flex;align-items:center;gap:14px;">
          <div class="gender-avatar-box">
            <img src="${avatar || (state.playerGender === 'female' ? 'assets/gfx/player_egypt_female.png' : 'assets/gfx/player_egypt_male.png')}" alt="${escapeHtml(state.playerName)}" />
          </div>
          <div>
            <div style="display:inline-block;background:#fbbf24;color:#1a1208;font-weight:900;font-size:11px;padding:2px 8px;border-radius:99px;margin-bottom:3px;">
              ⏸ ZEIT, HUNGER & SCHUTZ SIND ANGEHALTEN
            </div>
            <div style="font-size:19px;font-weight:900;color:#ffe28a;">
              ${escapeHtml(state.playerName)} · <span style="font-size:15px;color:#fed7aa;">${escapeHtml(state.roleSpecialistTitle())}</span>
            </div>
            <div style="font-size:13px;color:#e8dec5;margin-top:2px;">
              <strong>Aktuelle Aufgabe:</strong> ${escapeHtml(qText)}
            </div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:11.5px;color:#bbf7d0;font-weight:800;">✓ Automatisch auf diesem Gerät gespeichert</div>
          <div style="font-size:12px;color:#fde68a;">Kapitel ${state.chapter}: ${escapeHtml(meta.title)}</div>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-tile">
          <div class="stat-icon">${EGYPT_ROLES[state.playerRole]?.icon ?? '🎣'}</div>
          <div>
            <div class="stat-val">${escapeHtml(EGYPT_ROLES[state.playerRole]?.name ?? 'Pionier/in')}</div>
            <div class="stat-lbl">${escapeHtml(EGYPT_ROLES[state.playerRole]?.perk ?? '')}</div>
          </div>
        </div>
        <div class="stat-tile">
          <div class="stat-icon">⏱️</div>
          <div>
            <div class="stat-val">${escapeHtml(state.formatPlayTime())}</div>
            <div class="stat-lbl">Gespielte Abenteuerzeit</div>
          </div>
        </div>
        <div class="stat-tile">
          <div class="stat-icon">☀️</div>
          <div>
            <div class="stat-val">Tag ${state.daysSurvived} (${dayPhase})</div>
            <div class="stat-lbl">Vergangene Tage am Nil</div>
          </div>
        </div>
        <div class="stat-tile">
          <div class="stat-icon">👣</div>
          <div>
            <div class="stat-val">${Math.round(state.distanceMeters)} Meter</div>
            <div class="stat-lbl">Zu Fuß am Nil zurückgelegt</div>
          </div>
        </div>
        <div class="stat-tile">
          <div class="stat-icon">🎒</div>
          <div>
            <div class="stat-val">${state.totalItemsCollected()} Gegenstände</div>
            <div class="stat-lbl">Gesammelt, geerntet & geschmiedet</div>
          </div>
        </div>
        <div class="stat-tile">
          <div class="stat-icon">🏛️</div>
          <div>
            <div class="stat-val">${state.buildings.length} / ${BUILDINGS.length} Bauwerke</div>
            <div class="stat-lbl" title="${escapeHtml(builtList)}">Im Alten Ägypten errichtet</div>
          </div>
        </div>
        <div class="stat-tile" style="grid-column: 1 / 2;">
          <div class="stat-icon">📖</div>
          <div>
            <div class="stat-val">${state.lexicon.length} / ${Object.keys(LEXICON).length} Begriffe (${state.knowledge}%)</div>
            <div class="stat-lbl">Entdecktes Geschichtswissen</div>
          </div>
        </div>
      </div>

      <div style="background:#fffdf7;border:2px solid #c29b61;border-radius:10px;padding:12px 14px;margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:6px;">
          <div style="font-weight:900;font-size:14.5px;color:#5a2d0c;">
            🏺 Antike Relikte & Archäologie (${state.relicsFound.length} / 5 entdeckt):
          </div>
          <div style="font-size:12px;font-weight:800;color:${state.relicsFound.length === 5 ? '#15803d' : '#b45309'};">
            ${state.relicsFound.length === 5 ? '🏅 Vollständig (Königliches Siegel verliehen)!' : 'Suche an Gräbern, Tempeln & Basaren'}
          </div>
        </div>
        <div class="relic-grid">
          ${Object.values(EGYPT_RELICS).map((rel) => {
            const found = state.relicsFound.includes(rel.id);
            const answered = state.relicQuizAnswered.includes(rel.id);
            return `
              <div class="relic-card ${found ? 'found' : 'locked'}" data-pause-relic="${rel.id}" style="cursor:pointer;" title="${escapeHtml(rel.title)} (${escapeHtml(rel.epoch)})">
                <span class="relic-icon-big">
                  ${found ? `<img src="${rel.image}" alt="${escapeHtml(rel.title)}" style="width:30px;height:30px;image-rendering:pixelated;object-fit:contain;vertical-align:middle;">` : '❓'}
                </span>
                <span class="relic-name">${escapeHtml(found ? rel.title : 'Unentdeckt')}</span>
                <span style="font-size:10.5px;color:${answered ? '#15803d' : '#854d0e'};font-weight:700;">
                  ${found ? (answered ? '✓ Erforscht' : 'Quiz offen') : 'Verborgen'}
                </span>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <div style="background:#fef3c7;border:2px solid #d97706;border-radius:10px;padding:12px 16px;margin-bottom:10px;">
        <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;">
          <div style="flex:1;min-width:240px;">
            <div style="font-weight:900;font-size:15px;color:#7a3b10;">
              📒 Dein kurzer Hefter-Code zum Unterbrechen / Gerätewechsel:
            </div>
            <div style="font-size:13px;color:#4a3520;margin-top:2px;">
              Auf <strong>diesem Gerät</strong> kannst du beim nächsten Mal einfach auf „Weiter spielen“ klicken. Falls du in der nächsten Stunde ein <strong>anderes iPad</strong> bekommst, notiere dir diesen kurzen Code im Heft:
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <span class="shortcode-pill">${escapeHtml(shortCode)}</span>
            <button class="retro-btn" id="pause-copy-code">📋 Code kopieren</button>
          </div>
        </div>
      </div>

      <div style="background:#fffdf7;border:2px solid #c29b61;border-radius:10px;padding:12px 14px;margin-bottom:10px;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;flex-wrap:wrap;">
          <span style="font-size:16px;">🎵</span>
          <span style="font-weight:900;font-size:14.5px;color:#5a2d0c;">Epochen-Soundtrack:</span>
          <span id="pause-music-track-info" style="font-weight:700;font-size:13px;color:#854d0e;">${escapeHtml(bgm.getCurrentTrackInfo(state.chapter).title)} (${escapeHtml(bgm.getCurrentTrackInfo(state.chapter).epoch)})</span>
        </div>
        <div style="font-size:12px;font-weight:700;color:#78350f;background:#fef3c7;padding:2px 10px;border-radius:99px;border:1px solid #fde68a;display:inline-block;margin-bottom:8px;">
          ${escapeHtml(bgm.getCurrentTrackInfo(state.chapter).epoch)}
        </div>
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;background:#fcf8ed;border:1.5px solid #ebd8ab;border-radius:8px;padding:8px 12px;">
          <button class="retro-btn" id="pause-music-toggle-btn" style="min-width:115px;background:${bgm.isMutedState() ? '#78350f' : '#3b5e2b'};color:#fff;">
            ${bgm.isMutedState() ? '🔇 Musik: Aus' : '🔊 Musik: An'}
          </button>
          <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:180px;">
            <span style="font-size:13px;font-weight:800;color:#5a2d0c;">Lautstärke:</span>
            <input
              id="pause-volume-slider"
              type="range"
              min="0"
              max="100"
              value="${Math.round(bgm.getVolume() * 100)}"
              style="flex:1;cursor:pointer;accent-color:#b45309;"
            />
            <span id="pause-volume-label" style="font-size:12.5px;font-weight:900;color:#5a2d0c;min-width:38px;text-align:right;">
              ${Math.round(bgm.getVolume() * 100)}%
            </span>
          </div>
        </div>
      </div>
    `;

    this.modalFooterEl.innerHTML = `
      <button class="retro-btn" id="pause-startscreen-btn">🏠 Zum Startbildschirm</button>
      <button class="retro-btn" id="pause-chapter-btn">🗺️ Epoche wechseln</button>
      <button class="retro-btn btn-primary" id="pause-resume-btn" style="background:#22c55e;color:#052e16;font-size:15px;padding:8px 18px;font-weight:900;">
        ▶️ Weiter spielen (P)
      </button>
    `;

    this.modalBodyEl.querySelector('#pause-copy-code')?.addEventListener('click', () => {
      navigator.clipboard?.writeText(shortCode);
      this.toast(`Hefter-Code kopiert: ${shortCode}`);
    });

    const volSlider = this.modalBodyEl.querySelector<HTMLInputElement>('#pause-volume-slider');
    const volLabel = this.modalBodyEl.querySelector<HTMLElement>('#pause-volume-label');
    const musicToggleBtn = this.modalBodyEl.querySelector<HTMLElement>('#pause-music-toggle-btn');

    if (volSlider && volLabel) {
      volSlider.addEventListener('input', () => {
        const val = Number(volSlider.value);
        volLabel.textContent = `${val}%`;
        bgm.setVolume(val / 100);
        if (bgm.isMutedState() && val > 0) {
          bgm.toggleMute();
          if (musicToggleBtn) {
            musicToggleBtn.textContent = '🔊 Musik: An';
            musicToggleBtn.style.background = '#3b5e2b';
          }
        }
      });
    }

    if (musicToggleBtn) {
      musicToggleBtn.addEventListener('click', () => {
        const isMuted = bgm.toggleMute();
        musicToggleBtn.textContent = isMuted ? '🔇 Musik: Aus' : '🔊 Musik: An';
        musicToggleBtn.style.background = isMuted ? '#78350f' : '#3b5e2b';
        if (volSlider && volLabel) {
          volSlider.value = String(Math.round(bgm.getVolume() * 100));
          volLabel.textContent = `${Math.round(bgm.getVolume() * 100)}%`;
        }
        this.toast(isMuted ? '🔇 Musik stummgeschaltet' : '🎵 Musik an');
      });
    }

    this.modalBodyEl.querySelectorAll('[data-pause-relic]').forEach((el) => {
      el.addEventListener('click', () => {
        const relId = (el as HTMLElement).dataset.pauseRelic;
        if (relId && state.relicsFound.includes(relId)) {
          this.openRelicModal(relId);
        } else {
          this.toast('🏺 Dieses antike Relikt ist noch verborgen. Suche an Tempeln, Gräbern oder im Schilf!');
        }
      });
    });

    this.modalFooterEl.querySelector('#pause-startscreen-btn')?.addEventListener('click', () => {
      state.hasHadExistingSaveOnBoot = true;
      this.openStartScreen();
    });

    this.modalFooterEl.querySelector('#pause-chapter-btn')?.addEventListener('click', () => {
      this.openTimeline();
    });

    this.modalFooterEl.querySelector('#pause-resume-btn')?.addEventListener('click', () => {
      this.closeModal();
    });
  }

  public openRelicModal(relicOrId: RelicDef | string): void {
    const relic = typeof relicOrId === 'string' ? EGYPT_RELICS[relicOrId] : relicOrId;
    if (!relic) return;
    this.currentRelic = relic;
    if (!state.relicsFound.includes(relic.id)) {
      state.relicsFound.push(relic.id);
      state.persist();
      state.emit('relicFound', relic.id);
    }
    this.openModal('relic', `🏺 Antikes Relikt: ${relic.title}`);
    this.renderRelicModal(relic);
  }

  private renderRelicModal(relic: RelicDef): void {
    const alreadyAnswered = state.relicQuizAnswered.includes(relic.id);
    const optsHtml = relic.options
      .map((opt, i) => {
        return `
          <button class="retro-btn relic-opt-btn" data-relic-opt="${i}" style="text-align:left;padding:10px 14px;font-size:14px;line-height:1.4;margin-bottom:6px;width:100%;background:${alreadyAnswered && i === relic.correct ? '#15803d' : '#2a1d10'};color:#fff;">
            ${escapeHtml(opt)}
          </button>
        `;
      })
      .join('');

    this.modalBodyEl.innerHTML = `
      <div style="background:linear-gradient(135deg,#2b1a0c 0%,#462b14 100%);border:2px solid #e8c170;border-radius:10px;padding:12px 16px;color:#fff6e0;display:flex;align-items:center;gap:14px;margin-bottom:12px;">
        <div class="gender-avatar-box" style="border-color:#e8c170;background:#3d2410;">
          <img src="${relic.image}" alt="${escapeHtml(relic.title)}" style="width:36px;height:36px;image-rendering:pixelated;object-fit:contain;" />
        </div>
        <div>
          <div style="font-size:11.5px;font-weight:800;color:#fde047;text-transform:uppercase;">
            Archäologischer Fund · ${escapeHtml(relic.epoch)}
          </div>
          <div style="font-size:18px;font-weight:900;color:#ffe28a;">
            ${escapeHtml(relic.title)}
          </div>
          <div style="font-size:12.5px;color:#e8dec5;margin-top:2px;">
            📍 Fundort: ${escapeHtml(relic.locationHint)}
          </div>
        </div>
      </div>

      <div style="background:#fffdf7;border:2px solid #c29b61;border-radius:10px;padding:12px 14px;margin-bottom:12px;font-size:13.5px;line-height:1.55;color:#3b2310;">
        <strong style="color:#78350f;">Historischer Befund:</strong> ${escapeHtml(relic.lore)}
      </div>

      <div style="background:#fef3c7;border:2px solid #d97706;border-radius:10px;padding:12px 14px;margin-bottom:12px;">
        <div style="font-weight:900;font-size:14.5px;color:#78350f;margin-bottom:8px;">
          ❓ Archäologie-Rätsel: ${escapeHtml(relic.question)}
        </div>
        <div id="relic-options-container">${optsHtml}</div>
        <div id="relic-feedback" style="display:${alreadyAnswered ? 'block' : 'none'};margin-top:10px;font-size:13.5px;font-weight:800;color:#166534;background:#dcfce7;border:1.5px solid #86efac;padding:8px 12px;border-radius:7px;">
          ✓ ${escapeHtml(relic.explanation)}
        </div>
      </div>
    `;

    this.modalFooterEl.innerHTML = `
      <div style="font-size:12.5px;color:#78350f;font-weight:800;flex:1;">
        🏺 Bisher erforscht: ${state.relicsFound.length}/5 Relikten · Archäologen-Quiz gelöst: ${state.relicQuizAnswered.length}/5
      </div>
      <button class="retro-btn btn-primary" id="relic-done-btn" style="background:#22c55e;color:#052e16;font-size:14px;padding:8px 18px;font-weight:900;">
        ✓ Verstanden & Schließen
      </button>
    `;

    const feedbackEl = this.modalBodyEl.querySelector('#relic-feedback') as HTMLElement;
    this.modalBodyEl.querySelectorAll('[data-relic-opt]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const optIdx = Number((btn as HTMLElement).dataset.relicOpt);
        if (optIdx === relic.correct) {
          sfx.craft();
          (btn as HTMLElement).style.background = '#15803d';
          (btn as HTMLElement).style.borderColor = '#86efac';
          if (!state.relicQuizAnswered.includes(relic.id)) {
            state.relicQuizAnswered.push(relic.id);
            state.persist();
          }
          if (feedbackEl) {
            feedbackEl.style.display = 'block';
            feedbackEl.style.color = '#166534';
            feedbackEl.style.background = '#dcfce7';
            feedbackEl.style.borderColor = '#86efac';
            feedbackEl.textContent = `✓ Richtig! ${relic.explanation}`;
          }
          this.toast(`Ausgezeichnet! Relikt-Rätsel gelöst.`);
        } else {
          sfx.tap();
          (btn as HTMLElement).style.background = '#991b1b';
          if (feedbackEl) {
            feedbackEl.style.display = 'block';
            feedbackEl.style.color = '#991b1b';
            feedbackEl.style.background = '#fee2e2';
            feedbackEl.style.borderColor = '#fca5a5';
            feedbackEl.textContent = `Nicht ganz richtig. Lies noch einmal genau im historischen Befund nach!`;
          }
        }
      });
    });

    this.modalFooterEl.querySelector('#relic-done-btn')!.addEventListener('click', () => {
      this.closeModal();
      this.toast(`Relikt „${relic.title}“ erfolgreich in deiner Sammlung erfasst!`);
    });
  }

  private openBag(): void {
    this.openModal('bag', 'Rucksack (Inventar)');
    const items = Object.entries(state.inventory).filter(([_, cnt]) => cnt > 0);

    const listHtml = items.length === 0
      ? `<div style="padding:28px 16px;text-align:center;color:#5a3a1a;font-size:15px;font-weight:600;">
           🎒 Dein Rucksack ist noch leer.<br>
           <span style="font-size:13px;color:#785331;font-weight:normal;display:inline-block;margin-top:6px;">
             Schneide Papyrus-Schilf am Nilufer oder sammle Akazienäste und Wüstenkiesel in der Oase!
           </span>
         </div>`
      : `<div class="bag-items-grid">
          ${items.map(([id, cnt]) => {
            const def = ITEMS[id as EgyptItemId];
            const name = def?.name ?? id;
            return `
              <div class="bag-item-card" data-id="${id}">
                <img src="assets/icons/${id}.png" alt="${escapeHtml(name)}" onerror="this.style.display='none'" />
                <div class="bag-item-count-badge">${cnt}×</div>
                <div class="bag-item-title">${escapeHtml(name)}</div>
              </div>
            `;
          }).join('')}
        </div>`;

    this.modalBodyEl.innerHTML = listHtml;
    this.modalFooterEl.innerHTML = `
      <span style="font-size:12px;color:#6b4423;font-weight:600;">Tipp: Drücke C zum Herstellen von Reusen, Werkzeugen und Materialien.</span>
    `;
  }

  private openCraft(): void {
    this.openModal('craft', '🔨 Handwerk, Weben & Baukunst (C)');
    this.modalCardEl.classList.add('dark');
    this.visibleRecipes = RECIPES.filter((r) => r.minChapter <= state.chapter);

    if (this.visibleRecipes.length === 0) {
      this.modalBodyEl.innerHTML = `
        <div style="padding:28px 16px;text-align:center;color:#ffe9b0;font-size:15px;font-weight:600;">
          🔨 In diesem Kapitel sind noch keine Handwerksrezepte verfügbar.
        </div>
      `;
      this.modalFooterEl.innerHTML = '';
      return;
    }

    const cards = this.visibleRecipes.map((r, i) => {
      const canMat = state.canAfford(r);
      const hasBld = !r.requiresBuilding || state.hasBuilding(r.requiresBuilding);
      const canCraft = canMat && hasBld;
      const cls = canCraft ? 'recipe-card affordable' : !hasBld ? 'recipe-card missing-bld' : 'recipe-card';
      const iconId = r.result ? r.result.item : r.id;

      const costStr = Object.entries(r.cost)
        .map(([id, num]) => {
          const has = state.count(id);
          const def = ITEMS[id as EgyptItemId];
          return `${num}× ${def?.name ?? id} (du hast ${has})`;
        })
        .join(', ');

      const bDef = r.requiresBuilding ? BUILDINGS.find((b) => b.id === r.requiresBuilding) : null;
      const bName = bDef?.name ?? r.requiresBuilding;

      return `
        <div class="${cls}" data-craft-idx="${i}">
          <img class="pixel-icon" src="assets/icons/${iconId}.png" alt="${escapeHtml(r.name)}" style="width:32px;height:32px;margin-top:2px;object-fit:contain;image-rendering:pixelated;" onerror="this.style.display='none'" />
          <div style="flex:1;min-width:0;">
            <div style="font-weight:800;font-size:14.5px;color:#ffe9b0;display:flex;align-items:center;gap:6px;">
              <span class="key-badge" style="background:#e8c170;color:#1a1208;padding:1px 5px;border-radius:3px;font-size:11px;font-weight:800;">${i + 1}</span>
              <span>${escapeHtml(r.name)}</span>
            </div>
            <div style="font-size:12.5px;color:#d6c7b2;margin:2px 0 4px;line-height:1.35;">${highlightTerms(r.desc)}</div>
            <div style="font-size:12px;color:${canMat ? '#86efac' : '#fca5a5'};font-weight:700;">
              Kosten: ${escapeHtml(costStr)}
            </div>
            ${
              bName
                ? `<div style="font-size:11.5px;font-weight:700;color:${hasBld ? '#93c5fd' : '#fbbf24'};margin-top:2px;">
                    ${hasBld ? `✓ Werkstatt bereit: ${escapeHtml(bName)}` : `⚠ Benötigt Dorf-Gebäude: ${escapeHtml(bName)}`}
                  </div>`
                : ''
            }
          </div>
        </div>
      `;
    });

    this.modalBodyEl.innerHTML = `<div class="grid-2col">${cards.join('')}</div>`;

    this.modalBodyEl.querySelectorAll('[data-craft-idx]').forEach((el) => {
      el.addEventListener('click', () => {
        const idx = Number((el as HTMLElement).dataset.craftIdx);
        this.craftRecipe(idx);
      });
    });

    this.modalFooterEl.innerHTML = `
      <span style="font-size:12px;color:#ffe9b0;font-weight:600;">
        Tipp: Klicke auf eine Karte oder drücke die Zifferntaste [1–${this.visibleRecipes.length}] zum Herstellen.
      </span>
    `;
  }

  private craftRecipe(idx: number): void {
    const r = this.visibleRecipes[idx];
    if (this.activePanel !== 'craft' || !r) return;

    if (r.requiresBuilding && !state.hasBuilding(r.requiresBuilding)) {
      const bDef = BUILDINGS.find((b) => b.id === r.requiresBuilding);
      const bName = bDef?.name ?? r.requiresBuilding;
      this.toast(`Baue zuerst „${bName}“ an einem Bauplatz im Dorf!`);
      return;
    }

    if (!state.canAfford(r)) {
      this.toast('Dafür fehlt dir noch Material.');
      return;
    }

    if (state.craft(r)) {
      this.toast(`Hergestellt: ${r.name}!`);
      this.openCraft();
    }
  }

  private openTrade(): void {
    this.openModal('trade', 'Basar am Nil-Hafen (Tauschhandel)');
    const trades = TRADES;

    this.modalBodyEl.innerHTML = `
      <p style="margin-bottom:12px;color:#fde047;">
        Im Alten Ägypten gab es noch kein Münzgeld! Alle Güter wurden im reinen Tauschhandel getauscht.
      </p>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${trades.map((t) => {
          const can = state.canAffordTrade(t);
          const giveStr = Object.entries(t.give).map(([id, num]) => {
            const has = state.count(id);
            const def = ITEMS[id as EgyptItemId];
            const ok = has >= (num ?? 0);
            return `<span style="color:${ok ? '#86efac' : '#f87171'}">${num}× ${def?.name ?? id} (${has}/${num})</span>`;
          }).join(', ');

          const recDef = ITEMS[t.receive.item as EgyptItemId];
          const recStr = `${t.receive.count}× ${recDef?.name ?? t.receive.item}`;

          return `
            <div style="background:#2a1d10;border:1.5px solid ${can ? '#e8c170' : '#475569'};border-radius:8px;padding:10px;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <strong style="color:${can ? '#ffe9b0' : '#94a3b8'};font-size:14px;">${escapeHtml(t.name)}</strong>
                <button class="retro-btn btn-trade-action" data-id="${t.id}" ${can ? '' : 'disabled'}>
                  ${can ? 'Tauschen 🏺' : 'Waren fehlen'}
                </button>
              </div>
              <p style="font-size:12px;color:#cbd5e1;margin:4px 0 6px;">${escapeHtml(t.desc)}</p>
              <div style="font-size:12px;">Du gibst: ${giveStr}</div>
              <div style="font-size:12px;color:#60a5fa;margin-top:2px;">Du erhältst: <strong>${recStr}</strong></div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    this.modalBodyEl.querySelectorAll('.btn-trade-action').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
        const t = trades.find((x) => x.id === id);
        if (t && state.trade(t)) {
          this.toast(`Erfolgreich getauscht: ${t.name}!`);
          this.openTrade();
        }
      });
    });

    this.modalFooterEl.innerHTML = '';
  }

  private openLexicon(): void {
    this.openModal('lexicon', 'Didaktisches Geschichtslexikon (Altes Ägypten)');
    const keys = Object.keys(LEXICON);
    const selected = LEXICON[this.lexSelected] || LEXICON[keys[0]];

    this.modalBodyEl.innerHTML = `
      <div class="lex-layout">
        <div class="lex-list">
          ${keys.map((k) => {
            const unlocked = state.hasLexicon(k);
            const ent = LEXICON[k];
            const active = k === this.lexSelected ? 'active' : '';
            return `
              <button class="lex-item-btn ${active} ${unlocked ? '' : 'locked'}" data-key="${k}">
                <span>${unlocked ? '📜' : '🔒'}</span>
                <span>${escapeHtml(ent.title)}</span>
              </button>
            `;
          }).join('')}
        </div>
        <div class="lex-detail-card">
          ${state.hasLexicon(this.lexSelected)
            ? `
              <h3 style="color:#b45309;margin:0 0 4px;font-size:16px;">${escapeHtml(selected.title)}</h3>
              <div style="color:#64748b;font-size:12px;font-weight:bold;margin-bottom:8px;">Epoche: ${escapeHtml(selected.era)}</div>
              <div style="font-size:14px;line-height:1.6;color:#2a1d10;">
                ${highlightTerms(selected.text)}
              </div>
            `
            : `
              <h3 style="color:#64748b;margin:0 0 6px;font-size:16px;">🔒 Noch nicht entdeckt</h3>
              <p style="color:#475569;font-size:13.5px;line-height:1.5;">
                ${escapeHtml(selected.unlockHint)}
              </p>
            `}
        </div>
      </div>
    `;

    this.modalBodyEl.querySelectorAll('.lex-item-btn').forEach((item) => {
      item.addEventListener('click', (e) => {
        this.lexSelected = (e.currentTarget as HTMLElement).getAttribute('data-key')!;
        this.openLexicon();
      });
    });

    this.modalFooterEl.innerHTML = `
      <span style="font-size:12px;color:#6b4423;font-weight:600;">Entdeckt: ${state.lexicon.length} von ${keys.length} Wissensbausteinen.</span>
    `;
  }

  private openTimeline(): void {
    this.openModal('timeline', '⏳ Epochen-Zeitstrahl & Entwicklungsphasen am Nil (Z)');
    const rows = EPOCH_COMPARISON;

    const rowsHtml = rows.map((r) => {
      const isCurrent = r.chapter === state.chapter;
      return `
        <tr class="${isCurrent ? 'current-era' : ''}">
          <td style="white-space:nowrap;"><strong>${escapeHtml(r.era)}</strong><br><span style="font-size:11.5px;color:#7c5835;font-weight:700;">${escapeHtml(r.time)}</span></td>
          <td>${highlightTerms(r.housing)}</td>
          <td>${highlightTerms(r.food)}</td>
          <td>${highlightTerms(r.tools)}</td>
          <td>${highlightTerms(r.society)}</td>
        </tr>
      `;
    }).join('');

    const merksaetzeHtml = [1, 2, 3, 4, 5, 6].map((ch) => {
      const c = CHAPTERS[ch];
      if (!c) return '';
      return `
        <div class="merksatz-box" style="margin-bottom:10px;background:#fffdf7;border:1.5px solid #d6c39c;border-radius:8px;padding:8px 12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:4px;">
            <strong style="color:#7a3b10;font-size:13px;">📒 ${escapeHtml(c.title)} (${escapeHtml(c.epoch)})</strong>
            <div class="no-print" style="display:flex;gap:6px;">
              <button class="retro-btn btn-speak-ch" data-speak-text="${escapeHtml(c.summary)}" style="padding:2px 7px;font-size:11px;">🔊 Vorlesen</button>
            </div>
          </div>
          <div style="font-size:12.5px;color:#3b2310;line-height:1.4;">${highlightTerms(c.summary)}</div>
        </div>
      `;
    }).join('');

    this.modalBodyEl.innerHTML = `
      <div style="margin-bottom:14px;overflow-x:auto;">
        <table class="epoch-table">
          <thead>
            <tr>
              <th style="min-width:130px;">Epoche / Phase</th>
              <th style="min-width:140px;">🏘️ Siedlung & Wohnen</th>
              <th style="min-width:150px;">🌾 Nahrung & Wasser</th>
              <th style="min-width:150px;">🏺 Technik & Monumente</th>
              <th style="min-width:150px;">📜 Gesellschaft & Herrschaft</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>

      <div style="border-top:2px solid #e6d5b8;padding-top:12px;">
        <h3 style="margin:0 0 10px 0;font-size:14px;color:#5a3818;font-weight:900;">📒 Didaktische Hefter-Merksätze der Kapitel:</h3>
        ${merksaetzeHtml}
      </div>
    `;

    this.modalBodyEl.querySelectorAll('.btn-speak-ch').forEach((btn) => {
      btn.addEventListener('click', () => {
        const text = (btn as HTMLElement).dataset.speakText;
        if (text && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(text);
          u.lang = 'de-DE';
          u.rate = 0.95;
          window.speechSynthesis.speak(u);
        }
      });
    });

    this.modalFooterEl.innerHTML = '';
  }

  private openCertificate(): void {
    this.openModal('cert', 'Königliche Pharaonen-Meister-Urkunde');
    const pName = state.playerName;
    const rank = state.epochRankTitle();
    const time = state.formatPlayTime();
    const code = state.exportCode();

    this.modalBodyEl.innerHTML = `
      <div style="border:4px double #eab308;padding:20px;text-align:center;background:#1e1b18;color:#fef08a;border-radius:8px;">
        <h1 style="font-size:20px;margin-bottom:6px;letter-spacing:2px;">📜 KÖNIGLICHE PHARAONEN-URKUNDE 📜</h1>
        <p style="font-size:12px;color:#fde047;">Heimbürgeschule Kahla · Geschichtsunterricht Klasse 5/6</p>
        <hr style="border:0;border-top:1px solid #ca8a04;margin:12px 0;" />
        <p style="font-size:14px;color:#f8fafc;">Hiermit wird feierlich beurkundet, dass</p>
        <h2 style="font-size:24px;color:#ffffff;margin:8px 0;letter-spacing:1px;">${escapeHtml(pName)}</h2>
        <p style="font-size:14px;color:#fde047;">den königlichen Rang erlangt hat:</p>
        <h3 style="font-size:18px;color:#ca8a04;margin:6px 0;">${escapeHtml(rank)}</h3>
        <p style="font-size:12px;color:#cbd5e1;line-height:1.6;margin-top:12px;">
          Alle Geheimnisse des Nils, des Schaduf-Hebels, der heiligen Hieroglyphen, der Mumifizierung und des Pyramidenbaus von Gizeh wurden erfolgreich erforscht!
        </p>
        <div style="margin-top:16px;font-size:11px;color:#94a3b8;">
          Spielzeit: ${time} · Mnemotechnik-Kürzel: <strong style="color:#ffffff;">${code}</strong>
        </div>
      </div>
    `;

    this.modalFooterEl.innerHTML = `
      <button class="retro-btn" onclick="window.print()">🖨️ Urkunde drucken</button>
      <button class="retro-btn btn-primary" id="btn-cert-done">Schließen</button>
    `;

    this.modalFooterEl.querySelector('#btn-cert-done')!.addEventListener('click', () => {
      this.closeModal();
    });
  }
}
