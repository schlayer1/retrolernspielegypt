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
import { DialogSpec, state } from '../systems/GameState';
import { PlayerGender } from '../systems/SaveManager';
import { TouchControls } from '../ui/TouchControls';

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
  const escaped = escapeHtml(text);
  return escaped.replace(TERM_REGEX, '<span class="didactic-term">$1</span>');
}

type ActivePanel =
  | 'none'
  | 'start'
  | 'pause'
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
  private lexSelected = 'kemet';
  private bagTab: 'all' | 'tool' | 'food' | 'material' | 'culture' = 'all';
  private bagSelected: EgyptItemId = 'papyrus_staengel';

  private toastQueue: string[] = [];
  private toastBusy = false;

  private spec?: DialogSpec;
  private nodeIdx = 0;
  private questionActive = false;

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

    this.mountDOM();
    this.bindEvents();
    this.bindKeys();
    new TouchControls(this);

    this.renderHUD();
    this.renderHotbar();

    if (!state.skipStartScreen && !state.hasHadExistingSaveOnBoot) {
      this.openStartScreen();
    }
  }

  private mountDOM(): void {
    this.root.innerHTML = `
      <div class="hud-top">
        <div class="hud-quest-box">
          <div class="hud-chapter-title" id="hud-title">Kapitel 1: Die Wüste weicht – Ankunft am Nil</div>
          <div class="hud-quest-text" id="hud-quest">Ziel wird geladen ...</div>
          <div class="hud-compass" id="hud-compass">🧭 Berechne Weg ...</div>
        </div>
        <div class="hud-right">
          <div class="hud-bars-card">
            <div class="hud-bar-row">
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
            <div style="display:flex;justify-content:space-between;font-size:11px;color:#ffe9b0;margin-top:2px;">
              <span id="hud-lex-count">Lexikon: 0/27</span>
              <span id="hud-clock">☀️ 08:00</span>
            </div>
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

    // Start background music loop
    bgm.play('assets/audio/bgm/oasis_loop.mp3');

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
  }

  private bindKeys(): void {
    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => {
      if (this.isTyping()) return;

      if (e.key === 'Escape') {
        if (this.activePanel !== 'none') this.closeModal();
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
            sfx.quest();
            this.dlgTextEl.innerHTML = `<span style="color:#86efac;font-weight:bold;">Richtig!</span> ${highlightTerms(node.explain || '')}`;
            this.dlgOptsEl.innerHTML = '';
            this.dlgNextBtn.style.display = 'inline-block';
            this.dlgNextBtn.textContent = 'Weiter ▶';
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
    this.modalCardEl.classList.toggle('dark', panel === 'pause');
    this.backdropEl.style.display = 'flex';
  }

  private closeModal(): void {
    this.backdropEl.style.display = 'none';
    this.activePanel = 'none';
    state.modal = false;
    state.lastModalClose = Date.now();
  }

  private openStartScreen(): void {
    this.openModal('start', 'Willkommen im Alten Ägypten');
    this.modalBodyEl.innerHTML = `
      <div class="start-hero">
        <div class="start-hero-title">Kemet – Das Geschenk des Nils</div>
        <div class="start-hero-sub">16-Bit-Geschichtsabenteuer der Heimbürgeschule Kahla</div>
      </div>
      <p style="font-size:14px;color:#f8fafc;line-height:1.5;margin-bottom:12px;">
        Erlebe die Entstehung der ersten Hochkultur der Menschheit: Von nomadischen Schilffischern am Nil über die Erfindung des Schadufs und der Hieroglyphen bis zum Pyramidenbau von Gizeh!
      </p>
      <div style="background:#2a1d10;padding:12px;border:1.5px solid #e8c170;border-radius:8px;margin-bottom:12px;">
        <label style="font-size:13px;font-weight:bold;color:#fde047;">Dein Forscher-Name:</label>
        <input type="text" id="start-name" style="width:100%;padding:6px 10px;margin:6px 0 10px;background:#1e1b18;border:1px solid #e8c170;color:#fff;border-radius:5px;font-size:14px;" value="${escapeHtml(state.playerName)}" maxlength="14" />
        <label style="font-size:13px;font-weight:bold;color:#fde047;display:block;margin-bottom:6px;">Wähle deinen Charakter:</label>
        <div style="display:flex;gap:12px;">
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
            <input type="radio" name="gender" value="female" ${state.playerGender === 'female' ? 'checked' : ''} />
            <span>👩 Merit (Ägypterin)</span>
          </label>
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
            <input type="radio" name="gender" value="male" ${state.playerGender === 'male' ? 'checked' : ''} />
            <span>👨 Nakht (Ägypter)</span>
          </label>
        </div>
      </div>
    `;
    this.modalFooterEl.innerHTML = `
      <button class="retro-btn btn-primary" id="btn-start-adventure" style="background:#d97706;border-color:#fef08a;color:#1e1b18;font-weight:900;">Abenteuer am Nil starten ▶</button>
    `;

    this.modalFooterEl.querySelector('#btn-start-adventure')!.addEventListener('click', () => {
      const nameInput = this.modalBodyEl.querySelector('#start-name') as HTMLInputElement;
      if (nameInput?.value.trim()) state.playerName = nameInput.value.trim();
      const gRadio = this.modalBodyEl.querySelector('input[name="gender"]:checked') as HTMLInputElement;
      if (gRadio?.value) state.playerGender = gRadio.value as PlayerGender;
      state.emit('profileChanged');
      state.persist();
      this.closeModal();
      this.toast(`Willkommen in Kemet, ${state.playerName}!`);
    });
  }

  private openPause(): void {
    this.openModal('pause', 'Pausiert – Altes Ägypten');
    const timeStr = state.formatPlayTime();
    const rank = state.epochRankTitle();
    const code = state.exportCode();

    this.modalBodyEl.innerHTML = `
      <div class="pause-stats" style="margin-bottom:14px;">
        <div class="pause-stat-row" style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(232,193,112,0.2);"><span>Forscher:</span> <strong>${escapeHtml(state.playerName)} (${state.playerGender === 'female' ? 'Weiblich' : 'Männlich'})</strong></div>
        <div class="pause-stat-row" style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(232,193,112,0.2);"><span>Titel / Rang:</span> <strong style="color:#fde047;">${escapeHtml(rank)}</strong></div>
        <div class="pause-stat-row" style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(232,193,112,0.2);"><span>Aktuelles Zeitalter:</span> <strong>Kapitel ${state.chapter}</strong></div>
        <div class="pause-stat-row" style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(232,193,112,0.2);"><span>Spielzeit:</span> <strong>${timeStr}</strong></div>
        <div class="pause-stat-row" style="display:flex;justify-content:space-between;padding:4px 0;"><span>Wissen:</span> <strong>${state.knowledge}% (${state.lexicon.length} / ${Object.keys(LEXICON).length} Einträge)</strong></div>
      </div>

      <div style="background:#2a1d10;padding:12px;border:1.5px solid #e8c170;border-radius:8px;margin-bottom:10px;">
        <label style="font-size:12px;font-weight:bold;color:#fde047;">Dein Mnemotechnik-Speichercode (ohne Datenbank):</label>
        <div style="display:flex;gap:6px;margin-top:6px;">
          <input type="text" readonly value="${code}" style="flex:1;background:#1e1b18;border:1px solid #e8c170;color:#fde047;padding:5px 8px;font-family:monospace;font-size:14px;border-radius:4px;" id="pause-code-field" />
          <button class="retro-btn" id="btn-copy-code">📋 Kopieren</button>
        </div>
      </div>

      <div style="background:#2a1d10;padding:12px;border:1.5px solid #e8c170;border-radius:8px;">
        <label style="font-size:12px;font-weight:bold;color:#fde047;">Code eingeben / Fortsetzen:</label>
        <div style="display:flex;gap:6px;margin-top:6px;">
          <input type="text" placeholder="z. B. EGY-MERIT-W-K2-Q3-10M" style="flex:1;background:#1e1b18;border:1px solid #e8c170;color:#fff;padding:5px 8px;font-size:13px;border-radius:4px;" id="input-import-code" />
          <button class="retro-btn" id="btn-import-code">Laden ⏎</button>
        </div>
      </div>
    `;

    this.modalFooterEl.innerHTML = `
      <button class="retro-btn btn-primary" id="btn-resume">Weiterspielen ▶</button>
    `;

    this.modalBodyEl.querySelector('#btn-copy-code')!.addEventListener('click', () => {
      const f = this.modalBodyEl.querySelector('#pause-code-field') as HTMLInputElement;
      f.select();
      navigator.clipboard.writeText(f.value);
      this.toast('Kopiert! Zeige diesen Code deiner Lehrkraft.');
    });

    this.modalBodyEl.querySelector('#btn-import-code')!.addEventListener('click', () => {
      const inp = this.modalBodyEl.querySelector('#input-import-code') as HTMLInputElement;
      const res = state.importCode(inp.value);
      if (res.ok) {
        this.toast(res.msg);
        this.closeModal();
      } else {
        alert(res.msg);
      }
    });

    this.modalFooterEl.querySelector('#btn-resume')!.addEventListener('click', () => {
      this.closeModal();
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
    this.openModal('craft', 'Handwerk & Baukunst');
    const recipes = RECIPES;

    this.modalBodyEl.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${recipes.map((r) => {
          const can = state.canCraft(r);
          const costStr = Object.entries(r.cost).map(([id, num]) => {
            const has = state.count(id);
            const def = ITEMS[id as EgyptItemId];
            const ok = has >= (num ?? 0);
            return `<span style="color:${ok ? '#86efac' : '#f87171'}">${num}× ${def?.name ?? id} (${has}/${num})</span>`;
          }).join(', ');

          return `
            <div style="background:#2a1d10;border:1.5px solid ${can ? '#e8c170' : '#475569'};border-radius:8px;padding:10px;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <strong style="color:${can ? '#ffe9b0' : '#94a3b8'};font-size:14px;">${escapeHtml(r.name)}</strong>
                <button class="retro-btn btn-craft" data-id="${r.id}" ${can ? '' : 'disabled'}>
                  ${can ? 'Herstellen 🔨' : 'Material fehlt'}
                </button>
              </div>
              <p style="font-size:12px;color:#cbd5e1;margin:4px 0 6px;">${escapeHtml(r.desc)}</p>
              <div style="font-size:12px;">Kosten: ${costStr}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    this.modalBodyEl.querySelectorAll('.btn-craft').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
        const r = recipes.find((x) => x.id === id);
        if (r && state.craft(r)) {
          this.toast(`Hergestellt: ${r.name}!`);
          this.openCraft();
        }
      });
    });

    this.modalFooterEl.innerHTML = '';
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
    this.openModal('timeline', 'Epochen-Vergleich: Steinzeit vs. Altes Ägypten');
    const rows = EPOCH_COMPARISON;

    this.modalBodyEl.innerHTML = `
      <table class="epoch-table">
        <thead>
          <tr>
            <th>Historische Dimension</th>
            <th>🦣 Steinzeit & Metallzeit</th>
            <th>𓂀 Altes Ägypten (Hochkultur)</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r) => `
            <tr>
              <td><strong>${escapeHtml(r.topic)}</strong></td>
              <td>${escapeHtml(r.stoneage)}</td>
              <td>${escapeHtml(r.egypt)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

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
