export type EgyptItemId =
  | 'papyrus_staengel'
  | 'stock'
  | 'stein'
  | 'fischreuse'
  | 'nilbarsch'
  | 'cooked_fish'
  | 'schaduf_teil'
  | 'wasser'
  | 'samen'
  | 'emmer'
  | 'datteln'
  | 'sichel'
  | 'lehm'
  | 'nilschlamm'
  | 'lehmziegel'
  | 'tontopf'
  | 'leinen'
  | 'brot'
  | 'bier'
  | 'papyrusrolle'
  | 'pinsel_tinte'
  | 'salz'
  | 'kanope'
  | 'skanabaeus'
  | 'kalkstein'
  | 'holz'
  | 'gold'
  | 'weihrauch'
  | 'zedernholz'
  | 'goldmaske'
  | 'getreidesack'
  | 'beere'
  | 'gebratenes_fleisch';

export type EgyptItemCategory = 'tool' | 'food' | 'material' | 'culture';

export interface EgyptItemDef {
  id: EgyptItemId;
  name: string;
  category: EgyptItemCategory;
  desc: string;
  foodValue?: number;
  lore?: string;
  icon?: string;
}

export interface EgyptBuildingDef {
  id: string;
  name: string;
  helperName: string;
  x: number;
  y: number;
  cost: Partial<Record<EgyptItemId, number>>;
  desc: string;
  unlockedInChapter: number;
}

export interface EgyptRecipe {
  id: string;
  name: string;
  desc: string;
  cost: Partial<Record<EgyptItemId, number>>;
  result?: { item: EgyptItemId; count: number };
  requiresBuilding?: string;
}

export interface EgyptTradeOffer {
  id: string;
  name: string;
  desc: string;
  give: Partial<Record<EgyptItemId, number>>;
  receive: { item: EgyptItemId; count: number };
}

export const ITEMS: Record<EgyptItemId, EgyptItemDef> = {
  papyrus_staengel: {
    id: 'papyrus_staengel',
    name: 'Papyrus-Stängel',
    category: 'material',
    desc: 'Frisches Schilfrohr aus den Sümpfen des Nils. Vielseitig für Reusen, Boote und Beschreibstoffe.',
    lore: 'Die Papyruspflanze wuchs meterhoch im Nildelta und war das Symbol für Unterägypten.',
  },
  stock: {
    id: 'stock',
    name: 'Akazienast',
    category: 'material',
    desc: 'Zähes Holz aus der Ufervegetation. Wichtig für Hebel, Werkzeuge und Bootsrippen.',
  },
  stein: {
    id: 'stein',
    name: 'Wüstenkiesel',
    category: 'material',
    desc: 'Harte Fluss- und Wüstenkiesel, nützlich als Gegengewicht und Mahlstein.',
  },
  fischreuse: {
    id: 'fischreuse',
    name: 'Schilf-Reuse',
    category: 'tool',
    desc: 'Aus biegsamem Papyrus geflochtene Reuse für den Fischfang in den Nilbuchten.',
  },
  nilbarsch: {
    id: 'nilbarsch',
    name: 'Frischer Nilbarsch',
    category: 'food',
    foodValue: 30,
    desc: 'Köstlicher Speisefisch aus dem Nil. Hauptnahrungsquelle der einfachen Bevölkerung.',
  },
  cooked_fish: {
    id: 'cooked_fish',
    name: 'Gebratener Nilbarsch',
    category: 'food',
    foodValue: 40,
    desc: 'Über dem Schilffeuer knusprig gegrillter Fisch.',
  },
  schaduf_teil: {
    id: 'schaduf_teil',
    name: 'Schaduf-Hebelarm',
    category: 'tool',
    desc: 'Zusammengefügter Hebel mit Lederriemen und Gegengewicht zum Schöpfen von Nilwasser.',
  },
  wasser: {
    id: 'wasser',
    name: 'Krug Nilwasser',
    category: 'material',
    desc: 'Frisch geschöpftes Flusswasser zur Bewässerung der Beete.',
  },
  samen: {
    id: 'samen',
    name: 'Emmer-Saatgut',
    category: 'material',
    desc: 'Ausgewählte Körner des altägyptischen Spelzweizens zur Aussaat nach der Flut.',
  },
  emmer: {
    id: 'emmer',
    name: 'Emmer-Getreide',
    category: 'food',
    foodValue: 15,
    desc: 'Das Urgetreide der Pharaonenzeit. Grundstoff für nahrhaftes Fladenbrot und Dickbier.',
  },
  datteln: {
    id: 'datteln',
    name: 'Süße Datteln',
    category: 'food',
    foodValue: 20,
    desc: 'Sonnengetrocknete Datteln von den Palmen. Natürlicher Energiespender der Nomaden.',
  },
  sichel: {
    id: 'sichel',
    name: 'Holzsichel mit Feuersteinklingen',
    category: 'tool',
    desc: 'Klassische altägyptische Erntesichel mit scharfen Mikrolithen im Holzbogen.',
  },
  lehm: {
    id: 'lehm',
    name: 'Uferlehm',
    category: 'material',
    desc: 'Feiner mineralischer Schlick vom Nilufer.',
  },
  nilschlamm: {
    id: 'nilschlamm',
    name: 'Fruchtbarer Nilschlamm',
    category: 'material',
    desc: 'Der sagenhafte schwarze Schlamm der Akhet-Schwelle (Kemet). Dünger und Baustoff.',
  },
  lehmziegel: {
    id: 'lehmziegel',
    name: 'Luftgetrockneter Lehmziegel',
    category: 'material',
    desc: 'Mit Häcksel gemischter und in der Wüstensonne gehärteter Ziegel für Häuser und Kornspeicher.',
  },
  tontopf: {
    id: 'tontopf',
    name: 'Gebrannter Vorratstopf',
    category: 'tool',
    desc: 'Robuster Krug zur Aufbewahrung von Bier, Öl, Nilwasser und Getreide.',
  },
  leinen: {
    id: 'leinen',
    name: 'Feines weißes Leinen',
    category: 'material',
    desc: 'Aus Flachsfasern gesponnenes und gewebtes kühles Tuch für Tuniken und Priestergewänder.',
  },
  brot: {
    id: 'brot',
    name: 'Emmer-Fladenbrot',
    category: 'food',
    foodValue: 35,
    desc: 'Frisch im Kuppelofen gebackenes Brot. Hauptzahlungsmittel für Arbeiter und Schreiber.',
  },
  bier: {
    id: 'bier',
    name: 'Krug Gersten-Dickbier (Henket)',
    category: 'food',
    foodValue: 25,
    desc: 'Trübes, nahrhaftes Nationalgetränk der Ägypter. Keimfrei und voller Vitamine.',
  },
  papyrusrolle: {
    id: 'papyrusrolle',
    name: 'Papyrusrolle',
    category: 'culture',
    desc: 'Glattgeklopftes und poliertes Schreibblatt aus gekreuzten Papyrusstreifen.',
  },
  pinsel_tinte: {
    id: 'pinsel_tinte',
    name: 'Binsenpinsel & Rußtinte',
    category: 'tool',
    desc: 'Schreibpalette des Schreibers mit rotem Ocker und Rußtinte für Hieroglyphen.',
  },
  salz: {
    id: 'salz',
    name: 'Natronsalz',
    category: 'material',
    desc: 'Mineralisches Salzgemisch aus den Wüstenseen. Unverzichtbar für die Mumifizierung.',
  },
  kanope: {
    id: 'kanope',
    name: 'Geweihte Kanope',
    category: 'culture',
    desc: 'Alabaster- oder Tonkrug mit Götterkopf zur Bergung der inneren Organe des Verstorbenen.',
  },
  skanabaeus: {
    id: 'skanabaeus',
    name: 'Herz-Skarabäus (Fayence)',
    category: 'culture',
    desc: 'Heiliges Schutzamulett des Sonnengottes Chepri für das Weiterleben im Jenseits.',
  },
  kalkstein: {
    id: 'kalkstein',
    name: 'Tura-Kalksteinquader',
    category: 'material',
    desc: 'Feiner weißer Kalkstein aus den Steinbrüchen von Tura für die Pyramidenverkleidung.',
  },
  holz: {
    id: 'holz',
    name: 'Stammholz',
    category: 'material',
    desc: 'Schweres Bauholz für Schlittenkufen, Rollbalken und Schiffsrümpfe.',
  },
  gold: {
    id: 'gold',
    name: 'Nubisches Waschgold',
    category: 'material',
    desc: 'Glänzendes Edelmetall aus den Minen Nubiens. Das Fleisch der Götter.',
  },
  weihrauch: {
    id: 'weihrauch',
    name: 'Punt-Weihrauchharz',
    category: 'culture',
    desc: 'Kostbares Duftharz von königlichen Expeditionen ins geheimnisvolle Land Punt.',
  },
  zedernholz: {
    id: 'zedernholz',
    name: 'Phönizisches Zedernholz',
    category: 'material',
    desc: 'Harzreiches, langlebiges Nadelholz aus dem Libanon für königliche Schiffe.',
  },
  goldmaske: {
    id: 'goldmaske',
    name: 'Goldene Totenmaske',
    category: 'culture',
    desc: 'Prunkvolles Meisterwerk für den Sarkophag des Pharao.',
  },
  getreidesack: {
    id: 'getreidesack',
    name: 'Versiegelter Getreidesack',
    category: 'food',
    foodValue: 40,
    desc: 'Mit dem königlichen Siegel versehener Vorratssack für den Export nach Rom.',
  },
  beere: {
    id: 'beere',
    name: 'Wüstenbeeren',
    category: 'food',
    foodValue: 12,
    desc: 'Frische Beeren aus den Oasengärten.',
  },
  gebratenes_fleisch: {
    id: 'gebratenes_fleisch',
    name: 'Gebratenes Fleisch',
    category: 'food',
    foodValue: 40,
    desc: 'Würziger Rinderbraten vom Opferfest.',
  },
};

export const BUILDINGS: EgyptBuildingDef[] = [
  {
    id: 'schaduf',
    name: 'Schaduf-Schöpfwerk',
    helperName: 'Ameni',
    x: 520,
    y: 220,
    cost: { schaduf_teil: 1, stock: 2, stein: 2 },
    desc: 'Der Hebelarm mit Gegengewicht hebt Nilwasser mühelos auf höhergelegene Felder.',
    unlockedInChapter: 2,
  },
  {
    id: 'ziegelei',
    name: 'Lehmziegelei',
    helperName: 'Ameni',
    x: 480,
    y: 150,
    cost: { nilschlamm: 4, papyrus_staengel: 2 },
    desc: 'In Holzformen gestrichene Schlammziegel trocknen in der glühenden Wüstensonne.',
    unlockedInChapter: 3,
  },
  {
    id: 'speicher',
    name: 'Königlicher Kornspeicher',
    helperName: 'Nefermaat',
    x: 410,
    y: 120,
    cost: { lehmziegel: 4, holz: 2 },
    desc: 'Zentraler Getreidespeicher des Pharao zur Absicherung in Dürrejahren und Steuerabgabe.',
    unlockedInChapter: 3,
  },
  {
    id: 'schreiberhaus',
    name: 'Haus des Lebens (Schreiberhaus)',
    helperName: 'Ani',
    x: 320,
    y: 120,
    cost: { lehmziegel: 4, papyrusrolle: 2 },
    desc: 'Hier werden Priester und Schreiber in Hieroglyphen, Geometrie und Astronomie ausgebildet.',
    unlockedInChapter: 4,
  },
  {
    id: 'wabet',
    name: 'Balsamierungshaus (Wabet)',
    helperName: 'Ani',
    x: 230,
    y: 120,
    cost: { lehmziegel: 4, kalkstein: 2 },
    desc: 'Heilige Werkstatt des Anubis zur Mumifizierung und Totenklage für die Ewigkeit.',
    unlockedInChapter: 4,
  },
  {
    id: 'steinmetz',
    name: 'Bauhütte der Pyramide',
    helperName: 'Hemiunu',
    x: 160,
    y: 180,
    cost: { holz: 4, kalkstein: 4 },
    desc: 'Planungszentrum der Großbaumeister mit Schlitten, Seilen und Nivellier-Wasserwaagen.',
    unlockedInChapter: 5,
  },
];

export const RECIPES: EgyptRecipe[] = [
  {
    id: 'fischreuse',
    name: 'Fischreuse flechten',
    desc: 'Aus Papyrusrohr und Stöcken eine Reuse für das Nilufer flechten.',
    cost: { papyrus_staengel: 2, stock: 1 },
    result: { item: 'fischreuse', count: 1 },
  },
  {
    id: 'schaduf_teil',
    name: 'Schaduf-Hebelarm zimmern',
    desc: 'Holzbalken mit Gegengewichtsstein und Lederschlaufe verbinden.',
    cost: { holz: 2, stein: 1, papyrus_staengel: 1 },
    result: { item: 'schaduf_teil', count: 1 },
  },
  {
    id: 'lehmziegel',
    name: 'Lehmziegel streichen',
    desc: 'Nilschlamm mit Strohhäcksel mischen und in Formen trocknen.',
    cost: { nilschlamm: 2, papyrus_staengel: 1 },
    result: { item: 'lehmziegel', count: 2 },
  },
  {
    id: 'tontopf',
    name: 'Vorratstopf brennen',
    desc: 'Schlick auf der Töpferscheibe formen und im Ofen härten.',
    cost: { nilschlamm: 2 },
    result: { item: 'tontopf', count: 1 },
  },
  {
    id: 'leinen',
    name: 'Leinentuch weben',
    desc: 'Aus Flachsfasern Garn spinnen und auf dem Rahmen weben.',
    cost: { papyrus_staengel: 3 },
    result: { item: 'leinen', count: 1 },
  },
  {
    id: 'brot',
    name: 'Emmerbrot backen',
    desc: 'Gemahlenen Emmer mit Wasser kneten und auf heißen Steinen backen.',
    cost: { emmer: 2, wasser: 1 },
    result: { item: 'brot', count: 2 },
  },
  {
    id: 'bier',
    name: 'Gersten-Dickbier brauen',
    desc: 'Halbgebackenes Brot im Krug mit Wasser und Datteln vergären lassen.',
    cost: { emmer: 2, wasser: 1, tontopf: 1 },
    result: { item: 'bier', count: 1 },
  },
  {
    id: 'papyrusrolle',
    name: 'Papyrusrolle pressen',
    desc: 'Schilfmark in Streifen kreuzen, feucht schlagen und trocknen.',
    cost: { papyrus_staengel: 3, wasser: 1 },
    result: { item: 'papyrusrolle', count: 1 },
  },
  {
    id: 'pinsel_tinte',
    name: 'Binsenpinsel & Rußtinte',
    desc: 'Binsenstängel kauen und Lampenruß mit Wasser anrühren.',
    cost: { stock: 1, papyrus_staengel: 1, wasser: 1 },
    result: { item: 'pinsel_tinte', count: 1 },
  },
  {
    id: 'kanope',
    name: 'Kanopenkrug meißeln',
    desc: 'Kalksteingefäß mit dem Kopf der vier Schutzgötter des Horus gestalten.',
    cost: { kalkstein: 1, nilschlamm: 1 },
    result: { item: 'kanope', count: 1 },
  },
  {
    id: 'skanabaeus',
    name: 'Herz-Skarabäus formen',
    desc: 'Fayence-Amulett des heiligen Pillendrehers als Grabbeigabe brennen.',
    cost: { kalkstein: 1, nilschlamm: 1 },
    result: { item: 'skanabaeus', count: 1 },
  },
  {
    id: 'getreidesack',
    name: 'Getreidesack schnüren',
    desc: 'Überschüssigen Emmer in Leinensäcke füllen und siegeln.',
    cost: { emmer: 4, leinen: 1 },
    result: { item: 'getreidesack', count: 1 },
  },
  {
    id: 'goldmaske',
    name: 'Goldene Totenmaske schmieden',
    desc: 'Reines nubisches Blattgold über eine Holzform treiben.',
    cost: { gold: 2, leinen: 1 },
    result: { item: 'goldmaske', count: 1 },
  },
];

export const TRADES: EgyptTradeOffer[] = [
  {
    id: 'trade_salz',
    name: 'Fisch gegen Natronsalz (Oasenkarawane)',
    desc: 'Tausche 2 fangfrische Nilbarsche gegen 2 Beutel Natronsalz aus den Oasen.',
    give: { nilbarsch: 2 },
    receive: { item: 'salz', count: 2 },
  },
  {
    id: 'trade_weihrauch',
    name: 'Getreide gegen Punt-Weihrauch',
    desc: 'Gib 1 Getreidesack und erhalte 1 seltenes Räucherharz aus dem Land Punt.',
    give: { getreidesack: 1 },
    receive: { item: 'weihrauch', count: 1 },
  },
  {
    id: 'trade_zedernholz',
    name: 'Leinen gegen Libanon-Zedernholz',
    desc: 'Tausche 2 Ballen feines Leinen gegen 2 Stämme duftendes Zedernholz.',
    give: { leinen: 2 },
    receive: { item: 'zedernholz', count: 2 },
  },
  {
    id: 'trade_gold',
    name: 'Getreide gegen Nubisches Gold',
    desc: 'Tausche 2 gesiegelte Getreidesäcke gegen 2 Barren reines Gold.',
    give: { getreidesack: 2 },
    receive: { item: 'gold', count: 2 },
  },
  {
    id: 'trade_sichel',
    name: 'Reuse gegen Bronze-Erntesichel',
    desc: 'Tausche 1 geflochtene Reuse gegen eine geschmiedete Sichel für schnellere Ernte.',
    give: { fischreuse: 1 },
    receive: { item: 'sichel', count: 1 },
  },
];
