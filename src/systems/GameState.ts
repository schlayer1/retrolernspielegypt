import Phaser from 'phaser';
import { sfx } from '../audio/sound';
import {
  ChapterDef,
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
  EgyptItemDef,
  EgyptItemId,
  EgyptRecipe,
  EgyptTradeOffer,
} from '../data/items';
import { FarmPlotState, PlayerGender, PlayerRole, SaveData, SaveManager } from './SaveManager';
export type { PlayerRole };

export const DAY_MS = 240_000;
export const CROP_MS = 18_000;

export interface EgyptRoleDef {
  id: PlayerRole;
  name: string;
  icon: string;
  title: string;
  desc: string;
  perk: string;
}

export const EGYPT_ROLES: Record<PlayerRole, EgyptRoleDef> = {
  fisher: {
    id: 'fisher',
    name: 'Fischer / Fischerin',
    icon: '🎣',
    title: 'Meister/in des Nils',
    desc: 'Vertraut mit den Strömungen, Schilfgürteln und Oasenfrüchten.',
    perk: '+20% Lauftempo, 2× Ertrag beim Fischen & Dattelernten, Nahrung sinkt 35% langsamer.',
  },
  scribe: {
    id: 'scribe',
    name: 'Schreiber / Schreiberin',
    icon: '📜',
    title: 'Gelehrte/r der Hieroglyphen',
    desc: 'Beherrscht Papyrus, Tinte und die heiligen Zeichen der Götter.',
    perk: '+50% Wissenszuwachs, schaltet Zusatzwissen im Lexikon sofort frei.',
  },
  builder: {
    id: 'builder',
    name: 'Baumeister / Handwerkerin',
    icon: '🏗️',
    title: 'Erbauer/in der Monumente',
    desc: 'Geschickt im Umgang mit Hebeln, Schlammziegeln und Kalksteinquadern.',
    perk: '30% Materialrabatt auf Bauten (Schaduf, Ziegel, Speicher), Extra-Ertrag beim Abbau.',
  },
};

export interface DialogNode {
  speaker?: string;
  text?: string;
  question?: string;
  options?: string[];
  correct?: number;
  explain?: string;
}

export interface DialogSpec {
  speaker: string;
  nodes: DialogNode[];
  onDone?: () => void;
}

class GameState extends Phaser.Events.EventEmitter {
  playerName = 'Merit';
  playerGender: PlayerGender = 'female';
  playerRole: PlayerRole = 'fisher';
  chapter = 1;
  inventory: Record<string, number> = {};
  food = 85;
  safety = 85;
  knowledge = 0;
  quest = 0;
  lexicon: string[] = [];
  counts: Record<string, number> = {};
  plots: FarmPlotState[] = [
    { id: 0, stage: 'raw', wateredAt: 0 },
    { id: 1, stage: 'raw', wateredAt: 0 },
    { id: 2, stage: 'raw', wateredAt: 0 },
    { id: 3, stage: 'raw', wateredAt: 0 },
    { id: 4, stage: 'raw', wateredAt: 0 },
    { id: 5, stage: 'raw', wateredAt: 0 },
  ];
  buildings: string[] = [];
  dayTime = 0.08;
  collapses = 0;
  quizAttempts = 0;
  playTimeSec = 0;
  distanceMeters = 0;
  daysSurvived = 1;
  relicsFound: string[] = [];
  relicQuizAnswered: string[] = [];
  storyFlags: Record<string, boolean> = {};
  dilemmaSummary: string = '';

  playerX = 440;
  playerY = 320;

  malePreviewUrl = '';
  femalePreviewUrl = '';
  showcaseSprites: Record<string, string> = {};
  hasHadExistingSaveOnBoot = false;
  skipStartScreen = false;

  modal = false;
  lastModalClose = 0;
  hint = '';
  compassText = '';
  touch?: { vector: Phaser.Math.Vector2; consumeAction(): boolean };

  readonly saves = new SaveManager();

  constructor() {
    super();
  }

  get chapters() {
    return CHAPTERS;
  }

  get currentChapterDef(): ChapterDef {
    return CHAPTERS[this.chapter] ?? CHAPTERS[1];
  }

  get lexiconData(): Record<string, LexiconEntry> {
    return LEXICON;
  }

  get itemsData(): Record<EgyptItemId, EgyptItemDef> {
    return ITEMS;
  }

  get buildingsData(): EgyptBuildingDef[] {
    return BUILDINGS;
  }

  get recipesData(): EgyptRecipe[] {
    return RECIPES;
  }

  get tradesData(): EgyptTradeOffer[] {
    return TRADES;
  }

  get highlightTerms(): string[] {
    return HIGHLIGHT_TERMS;
  }

  get epochComparison(): EpochComparisonRow[] {
    return EPOCH_COMPARISON;
  }

  count(item: string): number {
    return this.inventory[item] ?? 0;
  }

  add(item: string, n = 1): void {
    let actual = n;
    if (this.playerRole === 'fisher' && (item === 'nilbarsch' || item === 'datteln')) {
      actual = n * 2;
    } else if (this.playerRole === 'builder' && (item === 'lehm' || item === 'stein' || item === 'kalkstein' || item === 'nilschlamm')) {
      actual = n + 1;
    }
    this.inventory[item] = Math.max(0, this.count(item) + actual);
    if (actual > 0) sfx.pickup();
    this.emit('inventory');
    this.checkQuest();
    this.persist();
  }

  bump(key: string, n = 1): void {
    this.counts[key] = (this.counts[key] ?? 0) + n;
    this.checkQuest();
    this.persist();
  }

  canAfford(r: EgyptRecipe): boolean {
    return Object.entries(r.cost).every(([id, n]) => this.count(id) >= Number(n ?? 0));
  }

  canCraft(r: EgyptRecipe): boolean {
    if (r.requiresBuilding && !this.hasBuilding(r.requiresBuilding)) return false;
    return this.canAfford(r);
  }

  getBuildingCost(b: EgyptBuildingDef): Record<string, number> {
    const discounted: Record<string, number> = {};
    for (const [id, n] of Object.entries(b.cost)) {
      if (this.playerRole === 'builder') {
        discounted[id] = Math.max(1, Math.floor(Number(n ?? 0) * 0.7));
      } else {
        discounted[id] = Number(n ?? 0);
      }
    }
    return discounted;
  }

  canAffordBuilding(b: EgyptBuildingDef): boolean {
    const cost = this.getBuildingCost(b);
    return Object.entries(cost).every(([id, n]) => this.count(id) >= n);
  }

  canAffordTrade(t: EgyptTradeOffer): boolean {
    return Object.entries(t.give).every(([id, n]) => this.count(id) >= Number(n ?? 0));
  }

  hasBuilding(id: string): boolean {
    return this.buildings.includes(id);
  }

  addBuilding(id: string): void {
    if (!this.hasBuilding(id)) {
      this.buildings.push(id);
      this.emit('buildings');
      this.checkQuest();
      this.persist();
    }
  }

  craft(r: EgyptRecipe): boolean {
    if (!this.canCraft(r)) return false;
    for (const [id, n] of Object.entries(r.cost)) {
      this.inventory[id] = Math.max(0, this.count(id) - Number(n ?? 0));
    }
    const resultItem = r.result ? r.result.item : r.id;
    const resultCount = r.result ? r.result.count : 1;
    this.add(resultItem, resultCount);
    sfx.craft();
    this.bump(r.id);
    this.emit('inventory');
    this.persist();
    return true;
  }

  trade(t: EgyptTradeOffer): boolean {
    if (!this.canAffordTrade(t)) return false;
    for (const [id, n] of Object.entries(t.give)) {
      this.inventory[id] = Math.max(0, this.count(id) - Number(n ?? 0));
    }
    this.add(t.receive.item, t.receive.count);
    sfx.craft();
    this.bump(t.id);
    this.emit('inventory');
    this.persist();
    return true;
  }

  build(b: EgyptBuildingDef): boolean {
    if (this.hasBuilding(b.id)) return false;
    if (!this.canAffordBuilding(b)) return false;
    const cost = this.getBuildingCost(b);
    for (const [id, n] of Object.entries(cost)) {
      this.inventory[id] = Math.max(0, this.count(id) - n);
    }
    this.addBuilding(b.id);
    sfx.craft();
    this.bump(`build_${b.id}`);
    this.emit('inventory');
    return true;
  }

  hasLexicon(key: string): boolean {
    return this.lexicon.includes(key);
  }

  unlockLexicon(key: string): boolean {
    if (this.hasLexicon(key)) return false;
    this.lexicon.push(key);
    const totalCount = Object.keys(this.lexiconData).length;
    let base = (this.lexicon.length / Math.max(1, totalCount)) * 100;
    if (this.playerRole === 'scribe') base *= 1.5;
    this.knowledge = Math.min(100, Math.round(base));
    sfx.quest();
    this.emit('lexicon', key);
    this.emit('toast', `Neuer Lexikoneintrag: ${this.lexiconData[key]?.title ?? key}`);
    this.persist();
    return true;
  }

  unlockSilent(keys: string[]): void {
    for (const k of keys) {
      if (!this.lexicon.includes(k)) this.lexicon.push(k);
    }
    const totalCount = Object.keys(this.lexiconData).length;
    let base = (this.lexicon.length / Math.max(1, totalCount)) * 100;
    if (this.playerRole === 'scribe') base *= 1.5;
    this.knowledge = Math.min(100, Math.round(base));
  }

  openDialog(spec: DialogSpec): void {
    this.emit('dialog', spec);
  }

  startChapter(ch: number): void {
    this.chapter = Math.max(1, Math.min(6, ch));
    this.quest = 0;

    if (ch === 1) {
      this.buildings = [];
      this.inventory = {};
      this.playerX = 490;
      this.playerY = 350;
      this.plots = this.plots.map((p) => ({ ...p, stage: 'raw', wateredAt: 0 }));
      this.unlockSilent(['kemet', 'deschret', 'nil']);
    } else if (ch === 2) {
      this.buildings = [];
      this.playerX = 460;
      this.playerY = 205;
      this.plots = this.plots.map((p) => ({ ...p, stage: 'raw', wateredAt: 0 }));
      this.unlockSilent(['nilschwemme', 'schaduf', 'emmer']);
      if (this.count('sichel') === 0) this.inventory.sichel = 1;
    } else if (ch === 3) {
      this.buildings = ['schaduf'];
      this.playerX = 390;
      this.playerY = 210;
      this.unlockSilent(['pharao', 'wesir', 'hochkultur']);
    } else if (ch === 4) {
      this.buildings = ['schaduf', 'ziegelei', 'speicher'];
      this.playerX = 240;
      this.playerY = 355;
      this.unlockSilent(['schreiber', 'hieroglyphen', 'polytheismus']);
    } else if (ch === 5) {
      this.buildings = ['schaduf', 'ziegelei', 'speicher', 'schreiberhaus', 'wabet'];
      this.playerX = 140;
      this.playerY = 220;
      this.unlockSilent(['pyramiden', 'sphinx', 'steinmetze']);
    } else if (ch === 6) {
      this.buildings = ['schaduf', 'ziegelei', 'speicher', 'schreiberhaus', 'wabet', 'steinmetz'];
      this.playerX = 540;
      this.playerY = 470;
      this.unlockSilent(['kornkammer_roms', 'kleopatra']);
    }

    sfx.quest();
    this.persist();
    this.emit('buildings');
    this.emit('chapterChanged', ch);
    this.emit('inventory');
    this.emit('quest');
  }

  checkQuest(): void {
    const c = (k: string) => this.counts[k] ?? 0;
    let conds: Array<() => boolean> = [];

    if (this.chapter === 1) {
      conds = [
        () => false, // 0: Intro bei Senbi
        () => c('papyrus_staengel') >= 3 || this.count('papyrus_staengel') >= 3,
        () => (this.count('stock') >= 2 && this.count('stein') >= 2) || c('schilf_gesammelt') >= 2,
        () => this.count('fischreuse') >= 1 || c('craft_fischreuse') >= 1,
        () => c('trap') >= 1 || c('fisch_fang') >= 1 || c('caught_fish') >= 1 || this.count('nilbarsch') >= 1,
        () => c('cooked') >= 1 || c('cooked_fish') >= 1 || this.count('cooked_fish') >= 1,
      ];
    } else if (this.chapter === 2) {
      conds = [
        () => false, // 0: Intro bei Ameni
        () => c('nilometer') >= 1, // 1: Nilometer abgelesen
        () => this.count('schaduf_teil') >= 1 || c('craft_schaduf') >= 1 || this.hasBuilding('schaduf'), // 2: Hebelarm
        () => this.hasBuilding('schaduf'), // 3: Schaduf am Ufer gebaut
        () => this.count('wasser') >= 1 || c('schaduf_water') >= 1, // 4: Nilwasser geschöpft
        () => c('seeded_plot') >= 1, // 5: Feld aufgelockert & gesät
        () => c('watered_plot') >= 1, // 6: Feld bewässert
        () => c('datteln') >= 3 || this.count('datteln') >= 3, // 7: 3x Datteln gepflückt
        () => c('harvested_emmer') >= 1 || this.count('emmer') >= 1, // 8: Reifes Emmer geerntet
      ];
    } else if (this.chapter === 3) {
      conds = [
        () => false, // 0: Intro bei Nefermaat
        () => this.count('nilschlamm') >= 3 || c('dug_mud') >= 3, // 1: Schlamm gegraben
        () => this.hasBuilding('ziegelei'), // 2: Ziegelei gebaut
        () => this.count('lehmziegel') >= 3 || c('craft_lehmziegel') >= 3, // 3: 3x Ziegel gestrichen
        () => this.hasBuilding('speicher'), // 4: Speicher gebaut
        () => this.count('tontopf') >= 1 || c('craft_tontopf') >= 1, // 5: Vorratstopf gebrannt
        () => this.count('leinen') >= 1 || c('craft_leinen') >= 1, // 6: Leinen gewebt
        () => (this.count('brot') >= 2 || c('brot') >= 2) && (this.count('bier') >= 1 || c('bier') >= 1), // 7: Brot & Bier
      ];
    } else if (this.chapter === 4) {
      conds = [
        () => false, // 0: Intro bei Ani
        () => this.hasBuilding('schreiberhaus'), // 1: Schreiberhaus gebaut
        () => this.count('papyrusrolle') >= 1 || c('craft_papyrusrolle') >= 1, // 2: Papyrusrolle
        () => this.count('pinsel_tinte') >= 1 || c('craft_pinsel_tinte') >= 1, // 3: Binsenpinsel
        () => c('tax_recorded') >= 1, // 4: Steuern notiert
        () => this.hasBuilding('wabet'), // 5: Wabet gebaut
        () => (this.count('salz') >= 2 || c('trade_salz') >= 1) && (this.count('kanope') >= 1 || c('craft_kanope') >= 1), // 6: Salz & Kanope
        () => this.count('skanabaeus') >= 1 || c('craft_skanabaeus') >= 1, // 7: Skarabäus
      ];
    } else if (this.chapter === 5) {
      conds = [
        () => false, // 0: Intro bei Hemiunu
        () => this.hasBuilding('steinmetz'), // 1: Bauhütte gebaut
        () => this.count('kalkstein') >= 3 || c('kalkstein_mined') >= 3, // 2: 3x Kalkstein
        () => this.count('stock') >= 3 || this.count('holz') >= 3 || c('timber_chopped') >= 3, // 3: Bauholz
        () => c('ramp_watered') >= 1, // 4: Rampe befeuchtet
        () => c('pyramidion_delivered') >= 1, // 5: Deckstein geliefert
        () => c('sphinx_visited') >= 1, // 6: Sphinx besucht
        () => c('sphinx_aligned') >= 1, // 7: Sphinx gen Osten ausgerichtet
      ];
    } else if (this.chapter === 6) {
      conds = [
        () => false, // 0: Intro bei Baki
        () => this.count('weihrauch') >= 1 || c('trade_weihrauch') >= 1, // 1: Weihrauch
        () => this.count('zedernholz') >= 1 || c('trade_zedernholz') >= 1, // 2: Zedernholz
        () => this.count('goldmaske') >= 1 || c('craft_goldmaske') >= 1, // 3: Goldmaske
        () => this.count('getreidesack') >= 3 || c('craft_getreidesack') >= 3, // 4: 3x Getreidesäcke
        () => c('barge_loaded') >= 1, // 5: Barke beladen
        () => c('treaty_signed') >= 1, // 6: Vertrag besiegelt
      ];
    }

    const cur = this.quest;
    const chMeta = this.currentChapterDef;
    if (cur > 0 && cur < chMeta.quests.length - 1) {
      if (conds[cur] && conds[cur]()) {
        sfx.quest();
        this.quest = cur + 1;
        this.emit('quest');
        const qTitle = chMeta.quests[this.quest];
        if (this.quest === chMeta.quests.length - 1) {
          this.emit('toast', `Kapitel-Aufgaben gemeistert! Sprich mit deinem Mentor zur Wissens-Prüfung!`);
        } else {
          this.emit('toast', `Aufgabe geschafft! Nächstes Ziel: ${qTitle}`);
        }
        this.persist();
      }
    }
  }

  isReadyForQuiz(): boolean {
    const meta = this.currentChapterDef;
    return this.quest === meta.quests.length - 1;
  }

  isChapterComplete(): boolean {
    const meta = this.currentChapterDef;
    return this.quest >= meta.quests.length;
  }

  eat(): string {
    const foods = [
      { id: 'cooked_fish', val: 35, name: 'Gebratener Nilbarsch' },
      { id: 'brot', val: 35, name: 'Emmerbrot' },
      { id: 'bier', val: 25, name: 'Krug Gerstenbier' },
      { id: 'datteln', val: 20, name: 'Süße Datteln' },
      { id: 'nilbarsch', val: 20, name: 'Frischer Nilbarsch' },
      { id: 'gebratenes_fleisch', val: 40, name: 'Gebratenes Fleisch' },
      { id: 'beere', val: 12, name: 'Wüstenbeeren' },
    ];
    for (const f of foods) {
      if (this.count(f.id) > 0) {
        this.inventory[f.id]--;
        this.food = Math.min(100, this.food + f.val);
        sfx.eat();
        this.emit('inventory');
        this.persist();
        return `Gegessen: 1× ${f.name} (+${f.val} Nahrung)`;
      }
    }
    return 'Du hast keine verzehrbare Nahrung im Inventar!';
  }

  totalItemsCollected(): number {
    return Object.values(this.counts).reduce((a, b) => a + b, 0);
  }

  formatPlayTime(): string {
    const m = Math.floor(this.playTimeSec / 60);
    const s = Math.floor(this.playTimeSec % 60);
    return `${m} Min. ${s} Sek.`;
  }

  epochRankTitle(): string {
    const titles = [
      'Nomade des Nils',
      'Herr der Schöpfung (Schaduf-Pionier)',
      'Kornschreiber des Pharao',
      'Hüter der heiligen Hieroglyphen',
      'Großbaumeister der Ewigkeit',
      'Königlicher Berater & Kornkammer-Meister',
    ];
    return titles[Math.min(titles.length - 1, this.chapter - 1)];
  }

  setProfile(name: string, gender: PlayerGender, role: PlayerRole): void {
    if (name.trim()) this.playerName = name.trim().slice(0, 20);
    this.playerGender = gender;
    this.playerRole = role;
    this.emit('profileChanged');
    this.persist();
  }

  resetNewGame(chapter = 1): void {
    this.saves.clear();
    this.startChapter(chapter);
    this.food = 100;
    this.safety = 100;
    this.playTimeSec = 0;
    this.distanceMeters = 0;
    this.daysSurvived = 1;
    this.relicsFound = [];
    this.relicQuizAnswered = [];
    this.persist();
  }

  roleSpecialistTitle(): string {
    return EGYPT_ROLES[this.playerRole]?.title ?? 'Pionier/in';
  }

  exportCode(): string {
    const pName = (this.playerName || 'MERIT').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    const gCode = this.playerGender === 'male' ? 'M' : 'W';
    const rCode = this.playerRole === 'fisher' ? 'F' : this.playerRole === 'scribe' ? 'S' : 'B';
    const mins = Math.max(1, Math.round(this.playTimeSec / 60));
    return `EGY-${pName}-${gCode}-${rCode}-K${this.chapter}-Q${this.quest}-R${this.relicsFound.length}-${mins}M`;
  }

  importCode(raw: string): { ok: boolean; msg: string } {
    const clean = raw.trim().toUpperCase();
    const parts = clean.split('-');
    if (parts.length < 6 || parts[0] !== 'EGY') {
      return { ok: false, msg: 'Ungültiges Code-Format. Erwartet: EGY-NAME-G-R-K[X]-Q[Y]-R[Z]-[ZEIT]M' };
    }
    const name = parts[1];
    const gender = parts[2] === 'M' ? 'male' : 'female';
    let role: PlayerRole = 'fisher';
    let chIdx = 3;
    if (parts[3] === 'F') { role = 'fisher'; chIdx = 4; }
    else if (parts[3] === 'S') { role = 'scribe'; chIdx = 4; }
    else if (parts[3] === 'B') { role = 'builder'; chIdx = 4; }

    const chPart = parts.find((p) => p.startsWith('K')) || 'K1';
    const qPart = parts.find((p) => p.startsWith('Q')) || 'Q1';
    const ch = parseInt(chPart.replace('K', ''), 10);
    const q = parseInt(qPart.replace('Q', ''), 10);
    if (isNaN(ch) || ch < 1 || ch > 6) return { ok: false, msg: 'Ungültiges Kapitel im Code!' };

    this.playerName = name.charAt(0) + name.slice(1).toLowerCase();
    this.playerGender = gender;
    this.playerRole = role;
    this.startChapter(ch);
    this.quest = isNaN(q) ? 1 : Math.max(1, Math.min(q, 7));
    this.persist();
    return { ok: true, msg: `Code geladen: Kapitel ${ch}, Quest ${this.quest}!` };
  }

  loadFrom(data: SaveData): void {
    this.playerName = data.playerName || 'Merit';
    this.playerGender = data.playerGender || 'female';
    this.playerRole = data.playerRole || 'fisher';
    this.chapter = data.chapter || 1;
    this.playerX = data.x ?? 440;
    this.playerY = data.y ?? 320;
    this.inventory = data.inventory || {};
    this.lexicon = data.lexicon || [];
    this.food = data.food ?? 85;
    this.safety = data.safety ?? 85;
    this.knowledge = data.knowledge ?? 0;
    this.quest = data.quest ?? 0;
    this.counts = data.counts || {};
    this.plots = data.plots || this.plots;
    this.buildings = data.buildings || [];
    this.dayTime = data.dayTime ?? 0.08;
    this.collapses = data.collapses || 0;
    this.quizAttempts = data.quizAttempts || 0;
    this.playTimeSec = data.playTimeSec || 0;
    this.distanceMeters = data.distanceMeters || 0;
    this.daysSurvived = data.daysSurvived || 1;
    this.relicsFound = data.relicsFound || [];
    this.relicQuizAnswered = data.relicQuizAnswered || [];
  }

  toSaveData(): SaveData {
    return {
      version: 4,
      epoch: 'aegypten',
      playerName: this.playerName,
      playerGender: this.playerGender,
      playerRole: this.playerRole,
      chapter: this.chapter,
      x: this.playerX,
      y: this.playerY,
      inventory: this.inventory,
      lexicon: this.lexicon,
      food: this.food,
      safety: this.safety,
      knowledge: this.knowledge,
      quest: this.quest,
      counts: this.counts,
      plots: this.plots,
      buildings: this.buildings,
      dayTime: this.dayTime,
      collapses: this.collapses,
      quizAttempts: this.quizAttempts,
      playTimeSec: this.playTimeSec,
      distanceMeters: this.distanceMeters,
      daysSurvived: this.daysSurvived,
      relicsFound: this.relicsFound,
      relicQuizAnswered: this.relicQuizAnswered,
    };
  }

  persist(): void {
    this.saves.save(this.toSaveData());
  }
}

export const state = new GameState();
if (typeof window !== 'undefined') {
  (window as any).kemetState = state;
}
