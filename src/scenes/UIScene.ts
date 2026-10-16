import Phaser from 'phaser';
import { sfx } from '../audio/sound';
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
  EgyptItemDef,
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

    this.buildDOM();
    this.bindEvents();
    this.bindKeys();
    new TouchControls(this);

    this.renderHUD();
    this.renderHotbar();

    if (!state.skipStartScreen && !state.hasHadExistingSaveOnBoot) {
      this.openStartScreen();
    }
  }

  private buildDOM(): void {
    this.root.innerHTML = `
      <div class="hud" id="hud">
        <div class="hud-top">
          <div class="hud-pill pill-chapter" id="hud-chapter">Kapitel 1</div>
          <div class="hud-pill pill-quest" id="hud-quest">Ziel wird geladen ...</div>
          <div class="hud-spacer"></div>
          <div class="hud-clock" id="hud-clock">☀️ 08:00</div>
          <button class="retro-btn btn-square" id="btn-pause" title="Pause / Mnemotechnik">⏸️</button>
        </div>
        <div class="hud-compass" id="hud-compass">🧭 Berechne Weg ...</div>
        <div class="hud-meters">
          <div class="meter-col">
            <span class="meter-lbl">🍖 Nahrung</span>
            <div class="meter-track"><div class="meter-fill fill-food" id="meter-food" style="width:85%"></div></div>
          </div>
          <div class="meter-col">
            <span class="meter-lbl">☀️ Lebenskraft</span>
            <div class="meter-track"><div class="meter-fill fill-safety" id="meter-safety" style="width:85%"></div></div>
          </div>
          <div class="meter-col">
            <span class="meter-lbl">📜 Wissen</span>
            <div class="meter-track"><div class="meter-fill fill-know" id="meter-know" style="width:0%"></div></div>
          </div>
        </div>
      </div>

      <div class="interaction-hint" id="interaction-hint"></div>
      <div class="hotbar" id="hotbar"></div>
      <div class="toast" id="toast"></div>

      <div class="dialog-layer" id="dialog-layer" style="display:none">
        <div class="dialog-box">
          <div class="dialog-header">
            <span class="dialog-speaker" id="dlg-speaker">Mentor</span>
            <button class="retro-btn btn-tts" id="dlg-tts" title="Text laut vorlesen">🔊 Vorlesen</button>
          </div>
          <div class="dialog-text" id="dlg-text"></div>
          <div class="dialog-options" id="dlg-opts"></div>
          <div class="dialog-footer">
            <button class="retro-btn" id="dlg-next">Weiter ▶</button>
          </div>
        </div>
      </div>

      <div class="modal-backdrop" id="modal-backdrop" style="display:none">
        <div class="modal-card" id="modal-card">
          <div class="modal-header">
            <h2 class="modal-title" id="modal-title">Menü</h2>
            <button class="retro-btn btn-square" id="modal-close">✕</button>
          </div>
          <div class="modal-body" id="modal-body"></div>
          <div class="modal-footer" id="modal-footer"></div>
        </div>
      </div>
    `;

    this.titleEl = this.root.querySelector('#hud-chapter')!;
    this.questEl = this.root.querySelector('#hud-quest')!;
    this.compassEl = this.root.querySelector('#hud-compass')!;
    this.foodBar = this.root.querySelector('#meter-food')!;
    this.safetyBar = this.root.querySelector('#meter-safety')!;
    this.knowBar = this.root.querySelector('#meter-know')!;
    this.clockEl = this.root.querySelector('#hud-clock')!;
    this.hintEl = this.root.querySelector('#interaction-hint')!;
    this.hotbarEl = this.root.querySelector('#hotbar')!;
    this.toastEl = this.root.querySelector('#toast')!;

    this.dialogEl = this.root.querySelector('#dialog-layer')!;
    this.dlgSpeakerEl = this.root.querySelector('#dlg-speaker')!;
    this.dlgTextEl = this.root.querySelector('#dlg-text')!;
    this.dlgOptsEl = this.root.querySelector('#dlg-opts')!;
    this.dlgNextBtn = this.root.querySelector('#dlg-next')!;
    this.dlgSpeakBtn = this.root.querySelector('#dlg-tts')!;

    this.backdropEl = this.root.querySelector('#modal-backdrop')!;
    this.modalCardEl = this.root.querySelector('#modal-card')!;
    this.modalTitleEl = this.root.querySelector('#modal-title')!;
    this.modalBodyEl = this.root.querySelector('#modal-body')!;
    this.modalFooterEl = this.root.querySelector('#modal-footer')!;

    this.root.querySelector('#btn-pause')!.addEventListener('click', () => this.openPause());
    this.root.querySelector('#modal-close')!.addEventListener('click', () => this.closeModal());
    this.dlgNextBtn.addEventListener('click', () => this.advanceDialog());
    this.dlgSpeakBtn.addEventListener('click', () => this.readDialogAloud());
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

      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (this.activePanel !== 'none') this.closeModal();
        else this.openPause();
        return;
      }
      if (e.key === 'i' || e.key === 'I' || e.key === 'b' || e.key === 'B') {
        if (this.activePanel === 'bag') this.closeModal();
        else this.openBag();
        return;
      }
      if (e.key === 'c' || e.key === 'C') {
        if (this.activePanel === 'craft') this.closeModal();
        else this.openCraft();
        return;
      }
      if (e.key === 't' || e.key === 'T') {
        if (this.activePanel === 'trade') this.closeModal();
        else this.openTrade();
        return;
      }
      if (e.key === 'l' || e.key === 'L') {
        if (this.activePanel === 'lexicon') this.closeModal();
        else this.openLexicon();
        return;
      }
      if (e.key === 'z' || e.key === 'Z') {
        if (this.activePanel === 'timeline') this.closeModal();
        else this.openTimeline();
        return;
      }
      if (e.key === 'u' || e.key === 'U') {
        if (this.activePanel === 'cert') this.closeModal();
        else this.openCertificate();
        return;
      }
      if (e.key === '1' && e.ctrlKey) {
        state.eat();
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
    this.questEl.textContent = ch.quests[qIdx] || 'Sprich mit deinem Mentor!';

    this.foodBar.style.width = `${Math.min(100, Math.max(0, state.food))}%`;
    this.safetyBar.style.width = `${Math.min(100, Math.max(0, state.safety))}%`;
    this.knowBar.style.width = `${Math.min(100, Math.max(0, state.knowledge))}%`;
  }

  private renderHotbar(): void {
    const entries = Object.entries(state.inventory).filter(([_, count]) => count > 0);
    if (entries.length === 0) {
      this.hotbarEl.innerHTML = `<div class="hotbar-empty">Drücke <strong>C</strong> (Handwerk) oder <strong>I</strong> (Rucksack)</div>`;
      return;
    }

    const html = entries.slice(0, 8).map(([id, count]) => {
      const def = ITEMS[id as EgyptItemId];
      const name = def?.name ?? id;
      const isFood = def?.category === 'food';
      return `
        <div class="hotbar-slot ${isFood ? 'slot-food' : ''}" title="${escapeHtml(name)} (${count}×)">
          <div class="slot-badge">${count}</div>
          <div class="slot-name">${escapeHtml(name.slice(0, 10))}</div>
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
    this.toastEl.classList.add('toast-show');
    sfx.click();

    setTimeout(() => {
      this.toastEl.classList.remove('toast-show');
      setTimeout(() => this.pumpToast(), 250);
    }, 2200);
  }

  private startDialog(spec: DialogSpec): void {
    this.spec = spec;
    this.nodeIdx = 0;
    state.modal = true;
    this.dialogEl.style.display = 'flex';
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
        btn.className = 'retro-btn dlg-opt-btn';
        btn.innerHTML = `${String.fromCharCode(65 + idx)}) ${escapeHtml(opt)}`;
        btn.addEventListener('click', () => {
          if (idx === node.correct) {
            sfx.quest();
            btn.classList.add('opt-correct');
            this.dlgTextEl.innerHTML = `<span style="color:#86efac;font-weight:bold;">Richtig!</span> ${highlightTerms(node.explain || '')}`;
            this.dlgOptsEl.innerHTML = '';
            this.dlgNextBtn.style.display = 'inline-block';
            this.dlgNextBtn.textContent = 'Weiter ▶';
          } else {
            sfx.eat();
            btn.classList.add('opt-wrong');
            state.quizAttempts++;
            this.dlgTextEl.innerHTML = `<span style="color:#f87171;font-weight:bold;">Nicht ganz.</span> Überlege noch einmal genau oder frage deinen Mentor!`;
          }
        });
        this.dlgOptsEl.appendChild(btn);
      });
    } else {
      this.dlgTextEl.innerHTML = highlightTerms(node.text || '');
      this.dlgNextBtn.style.display = 'inline-block';
      this.dlgNextBtn.textContent = this.nodeIdx === this.spec.nodes.length - 1 ? 'Abschließen ✔' : 'Weiter ▶';
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

  private openModal(panel: ActivePanel, title: string): void {
    this.activePanel = panel;
    state.modal = true;
    this.modalTitleEl.textContent = title;
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
      <div class="start-box">
        <h3 class="start-subtitle">Kemet – Das Geschenk des Nils</h3>
        <p class="start-text">
          Erlebe die Entstehung der ersten Hochkultur der Menschheit: Von nomadischen Jägern am Nil über die Erfindung des Schadufs und der Hieroglyphen bis zum Bau der Pyramiden von Gizeh!
        </p>
        <div class="char-setup">
          <label><strong>Dein Forscher-Name:</strong></label>
          <input type="text" id="start-name" class="retro-input" value="${escapeHtml(state.playerName)}" maxlength="12" />
          <div class="gender-pick">
            <label><input type="radio" name="gender" value="female" ${state.playerGender === 'female' ? 'checked' : ''} /> 👩 Ägypterin Merit</label>
            <label><input type="radio" name="gender" value="male" ${state.playerGender === 'male' ? 'checked' : ''} /> 👨 Ägypter Senbi</label>
          </div>
        </div>
      </div>
    `;
    this.modalFooterEl.innerHTML = `
      <button class="retro-btn btn-primary" id="btn-start-adventure">Abenteuer am Nil starten ▶</button>
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
      <div class="pause-stats">
        <div class="pause-stat-row"><span>Forscher:</span> <strong>${escapeHtml(state.playerName)} (${state.playerGender === 'female' ? 'Weiblich' : 'Männlich'})</strong></div>
        <div class="pause-stat-row"><span>Titel / Rang:</span> <strong style="color:#fde047;">${escapeHtml(rank)}</strong></div>
        <div class="pause-stat-row"><span>Aktuelles Kapitel:</span> <strong>Kapitel ${state.chapter}</strong></div>
        <div class="pause-stat-row"><span>Spielzeit:</span> <strong>${timeStr}</strong></div>
        <div class="pause-stat-row"><span>Gesammeltes Wissen:</span> <strong>${state.knowledge}% (${state.lexicon.length} / ${Object.keys(LEXICON).length} Einträge)</strong></div>
      </div>

      <div class="code-box">
        <label><strong>Dein Mnemotechnik-Speichercode (für die Schule):</strong></label>
        <div class="code-row">
          <input type="text" readonly value="${code}" class="retro-input code-input" id="pause-code-field" />
          <button class="retro-btn" id="btn-copy-code">📋 Kopieren</button>
        </div>
      </div>

      <div class="code-box" style="margin-top:12px;">
        <label>Code eingeben / Fortsetzen:</label>
        <div class="code-row">
          <input type="text" placeholder="z. B. EGY-MERIT-W-K2-Q3-10M" class="retro-input" id="input-import-code" />
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
      ? `<p style="padding:16px;color:#cbd5e1;">Dein Rucksack ist noch leer. Schneide Papyrus oder sammle Schilf am Nilufer!</p>`
      : `<div class="bag-grid">
          ${items.map(([id, cnt]) => {
            const def = ITEMS[id as EgyptItemId];
            const name = def?.name ?? id;
            return `
              <div class="bag-item" data-id="${id}">
                <div class="bag-count">${cnt}×</div>
                <div class="bag-name">${escapeHtml(name)}</div>
              </div>
            `;
          }).join('')}
        </div>`;

    this.modalBodyEl.innerHTML = listHtml;
    this.modalFooterEl.innerHTML = `
      <span style="font-size:12px;color:#cbd5e1;">Tipp: Drücke C zum Herstellen von Werkzeugen und Baumaterialien.</span>
    `;
  }

  private openCraft(): void {
    this.openModal('craft', 'Handwerk & Baukunst');
    const recipes = RECIPES;

    this.modalBodyEl.innerHTML = `
      <div class="recipe-list">
        ${recipes.map((r) => {
          const can = state.canCraft(r);
          const costStr = Object.entries(r.cost).map(([id, num]) => {
            const has = state.count(id);
            const def = ITEMS[id as EgyptItemId];
            const ok = has >= (num ?? 0);
            return `<span style="color:${ok ? '#86efac' : '#f87171'}">${num}× ${def?.name ?? id} (${has}/${num})</span>`;
          }).join(', ');

          return `
            <div class="recipe-card ${can ? 'can-craft' : 'locked-craft'}">
              <div class="recipe-header">
                <strong>${escapeHtml(r.name)}</strong>
                <button class="retro-btn btn-craft" data-id="${r.id}" ${can ? '' : 'disabled'}>
                  ${can ? 'Herstellen 🔨' : 'Material fehlt'}
                </button>
              </div>
              <p class="recipe-desc">${escapeHtml(r.desc)}</p>
              <div class="recipe-cost">Kosten: ${costStr}</div>
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
      <div class="trade-list">
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
            <div class="trade-card ${can ? 'can-trade' : 'locked-trade'}">
              <div class="trade-header">
                <strong>${escapeHtml(t.name)}</strong>
                <button class="retro-btn btn-trade-action" data-id="${t.id}" ${can ? '' : 'disabled'}>
                  ${can ? 'Tauschen 🏺' : 'Waren fehlen'}
                </button>
              </div>
              <p class="trade-desc">${escapeHtml(t.desc)}</p>
              <div class="trade-give">Du gibst: ${giveStr}</div>
              <div class="trade-receive" style="color:#60a5fa;margin-top:4px;">Du erhältst: <strong>${recStr}</strong></div>
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
        <div class="lex-sidebar">
          ${keys.map((k) => {
            const unlocked = state.hasLexicon(k);
            const ent = LEXICON[k];
            const active = k === this.lexSelected ? 'lex-active' : '';
            return `
              <div class="lex-nav-item ${active} ${unlocked ? 'unlocked' : 'locked'}" data-key="${k}">
                ${unlocked ? '📜' : '🔒'} ${escapeHtml(ent.title)}
              </div>
            `;
          }).join('')}
        </div>
        <div class="lex-content">
          ${state.hasLexicon(this.lexSelected)
            ? `
              <h3 style="color:#fde047;margin-bottom:8px;">${escapeHtml(selected.title)}</h3>
              <div class="lex-era" style="color:#93c5fd;font-size:12px;margin-bottom:12px;">Epoche: ${escapeHtml(selected.era)}</div>
              <div class="lex-body" style="font-size:14px;line-height:1.6;color:#f8fafc;">
                ${highlightTerms(selected.text)}
              </div>
            `
            : `
              <h3 style="color:#94a3b8;margin-bottom:8px;">🔒 Noch nicht entdeckt</h3>
              <p style="color:#cbd5e1;font-size:14px;line-height:1.5;">
                ${escapeHtml(selected.unlockHint)}
              </p>
            `}
        </div>
      </div>
    `;

    this.modalBodyEl.querySelectorAll('.lex-nav-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        this.lexSelected = (e.currentTarget as HTMLElement).getAttribute('data-key')!;
        this.openLexicon();
      });
    });

    this.modalFooterEl.innerHTML = `
      <span style="font-size:12px;color:#cbd5e1;">Entdeckt: ${state.lexicon.length} von ${keys.length} Wissensbausteinen.</span>
    `;
  }

  private openTimeline(): void {
    this.openModal('timeline', 'Epochen-Vergleich: Steinzeit vs. Altes Ägypten');
    const rows = EPOCH_COMPARISON;

    this.modalBodyEl.innerHTML = `
      <table class="epoch-table" style="width:100%;border-collapse:collapse;font-size:12px;color:#f8fafc;">
        <thead>
          <tr style="border-bottom:2px solid #eab308;color:#fde047;text-align:left;">
            <th style="padding:8px;">Historische Dimension</th>
            <th style="padding:8px;">🦣 Steinzeit & Metallzeit</th>
            <th style="padding:8px;">𓂀 Altes Ägypten (Hochkultur)</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r) => `
            <tr style="border-bottom:1px solid #334155;">
              <td style="padding:8px;font-weight:bold;color:#fde047;">${escapeHtml(r.topic)}</td>
              <td style="padding:8px;color:#cbd5e1;">${escapeHtml(r.stoneage)}</td>
              <td style="padding:8px;color:#93c5fd;">${escapeHtml(r.egypt)}</td>
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
      <div class="cert-frame" style="border:4px double #eab308;padding:20px;text-align:center;background:#1e1b18;color:#fef08a;">
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
