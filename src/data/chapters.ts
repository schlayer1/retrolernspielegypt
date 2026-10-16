export interface LexiconEntry {
  title: string;
  era: string;
  icon: string;
  unlockHint: string;
  milestone?: boolean;
  text: string;
}

export interface EpochComparisonRow {
  topic: string;
  stoneage: string;
  egypt: string;
}

export interface ChapterDef {
  id: number;
  title: string;
  epoch: string;
  period: string;
  mentor: string;
  mentorRole: string;
  quests: string[];
  hints: string[];
  intro: Array<{ text: string }>;
  quiz: Array<{ question: string; options: string[]; correct: number; explain: string }>;
  summary: string;
}

export const HIGHLIGHT_TERMS: string[] = [
  'Kemet',
  'Deschret',
  'Nil',
  'Nilschwemme',
  'Akhet',
  'Peret',
  'Schemu',
  'Schaduf',
  'Emmer',
  'Papyrus',
  'Pharao',
  'Wesir',
  'Hieroglyphen',
  'Schreiber',
  'Hochkultur',
  'Polytheismus',
  'Osiris',
  'Ra',
  'Anubis',
  'Maat',
  'Mumifizierung',
  'Kanopen',
  'Skarabäus',
  'Pyramide',
  'Sphinx',
  'Gizeh',
  'Kornkammer Roms',
  'Kleopatra',
];

export const EPOCH_COMPARISON: EpochComparisonRow[] = [
  {
    topic: 'Siedlung & Lebensform',
    stoneage: 'Nomadische Sippen in Zelten (später bäuerliche Langhäuser in Sippendörfern)',
    egypt: 'Dichtbesiedelte Städte & Dörfer entlang des Nils, befestigte Gaue und Paläste',
  },
  {
    topic: 'Ernährung & Wasser',
    stoneage: 'Jagd, Sammeln, später Regenfeldbau und Ziegentierhaltung',
    egypt: 'Kanalbewässerung & Schaduf mit Nilschwemme, gezielter Emmer- & Flachsanbau',
  },
  {
    topic: 'Herrschaft & Ordnung',
    stoneage: 'Einfache Sippenälteste ohne Gesetzesbücher oder zentralen Staat',
    egypt: 'Zentralstaat mit göttlichem Pharao an der Spitze, Wesir als Premierminister',
  },
  {
    topic: 'Schrift & Verwaltung',
    stoneage: 'Keine Schrift (mündliche Überlieferung & Höhlenmalereien)',
    egypt: 'Hieroglyphen & hieratische Schrift, Steuerlisten, Gesetze und Archive',
  },
  {
    topic: 'Glaube & Jenseits',
    stoneage: 'Naturgeister, Ahnenkult, Tierknochen- und Fruchtbarkeitsidole',
    egypt: 'Vielgötterglaube (Polytheismus), Totengericht (Maat), Mumifizierung & Pyramiden',
  },
  {
    topic: 'Bauwerke & Technik',
    stoneage: 'Meglithgräber (Dolmen), Holzpfostenhäuser, Stein- & Bronzewerkzeuge',
    egypt: 'Monumentale Steinarchitektur (Pyramiden, Obelisken, Tempel) mit Hebeltechnik',
  },
];

export const LEXICON: Record<string, LexiconEntry> = {
  kemet: {
    title: 'Kemet – Das schwarze Land',
    era: 'Altes Ägypten',
    icon: 'nilschlamm',
    unlockHint: 'Berge fruchtbaren Nilschlamm am Flussufer (E).',
    milestone: true,
    text: 'Die Ägypter nannten ihre fruchtbare Heimat „Kemet“ – das schwarze Land. Der fruchtbare dunkle Schlamm, den der Nil jedes Jahr ablagerte, machte das Überleben in der Wüste überhaupt erst möglich.',
  },
  deschret: {
    title: 'Deschret – Das rote Wüstenland',
    era: 'Altes Ägypten',
    icon: 'stein',
    unlockHint: 'Erforsche das Wüstenufer jenseits der Oase.',
    text: '„Deschret“ bezeichnete die glühende, lebensfeindliche Sand- und Steinwüste. Für die Ägypter war sie das Reich der Toten und des Chaosgottes Seth, schenkte ihnen aber auch wertvolle Erze und Steine.',
  },
  nil: {
    title: 'Der Nil – Lebensader',
    era: 'Altes Ägypten',
    icon: 'wasser',
    unlockHint: 'Schöpfe frisches Nilwasser mit einem Tonkrug (E).',
    milestone: true,
    text: 'Mit über 6.650 Kilometern ist der Nil der längste Fluss Afrikas. Ohne sein Wasser wäre Ägypten eine leblose Wüste geblieben. Der griechische Geschichtsschreiber Herodot nannte Ägypten treffend ein „Geschenk des Nils“.',
  },
  nilschwemme: {
    title: 'Die Nilschwemme (Akhet)',
    era: 'Altes Ägypten',
    icon: 'nilschlamm',
    unlockHint: 'Lies den Nilometer-Pegel am Flussufer ab.',
    milestone: true,
    text: 'Jedes Jahr von Juli bis Oktober schwoll der Nil durch tropische Regenfälle in den äthiopischen Bergen an und überflutete das gesamte Flusstal. Dabei lagerte sich nährstoffreicher Schlamm als natürlicher Dünger ab.',
  },
  nilometer: {
    title: 'Das Nilometer',
    era: 'Altes Ägypten',
    icon: 'schaduf_teil',
    unlockHint: 'Untersuche die Messsäule am Nilufer.',
    text: 'Nilometer waren in Stein gehauene Treppen und Pegelsäulen am Flussufer. Stieg das Wasser auf 16 Ellen, war eine reiche Ernte sicher. Zu viel Wasser zerstörte Dämme, zu wenig führte zu Hungersnöten.',
  },
  schaduf: {
    title: 'Der Schaduf (Schwinghebel)',
    era: 'Altes Ägypten',
    icon: 'schaduf_teil',
    unlockHint: 'Errichte den Schaduf am Nilufer.',
    milestone: true,
    text: 'Der Schaduf war eine revolutionäre Erfindung: Ein Holzhebel mit einem schweren Schlamm- oder Steingegengewicht auf der einen und einem Ledereimer auf der anderen Seite. Damit konnte ein Bauer täglich hunderte Liter Wasser auf höher gelegene Felder heben!',
  },
  emmer: {
    title: 'Emmer – Das Urgetreide',
    era: 'Altes Ägypten',
    icon: 'emmer',
    unlockHint: 'Ernte reifen Emmer von deinen Feldern.',
    text: 'Emmer war neben Gerste die wichtigste Getreideart der Pharaonenzeit. Aus dem Mehl buken die Ägypter Fladenbrote und brauten nahrhaftes, dickflüssiges Bier, das als Grundnahrungsmittel galt.',
  },
  papyrus: {
    title: 'Die Papyruspflanze',
    era: 'Altes Ägypten',
    icon: 'papyrus_staengel',
    unlockHint: 'Schneide Papyrus-Schilf am Ufer ab.',
    text: 'Die bis zu 4 Meter hohe Schilfpflanze wuchs üppig in den Sümpfen des Nildeltas. Aus ihr bauten die Menschen Boote, flochten Matten, Körbe und Sandalen – und erfanden den Vorläufer unseres heutigen Papiers.',
  },
  dattelpalme: {
    title: 'Die Dattelpalme',
    era: 'Altes Ägypten',
    icon: 'datteln',
    unlockHint: 'Pflücke süße Datteln in der Oase.',
    text: 'Dattelpalmen spendeten Schatten und lieferten süße Früchte voller Energie. Ihr Holz diente als Dachbalken und die Palmwedel wurden zum Decken von Schilfhütten verwendet.',
  },
  hochkultur: {
    title: 'Merkmale einer Hochkultur',
    era: 'Altes Ägypten',
    icon: 'papyrusrolle',
    unlockHint: 'Sprich mit Wesir Nefermaat am Palasttor.',
    milestone: true,
    text: 'Als Hochkultur bezeichnet man eine hoch entwickelte Gesellschaft mit zentraler Regierung, einheitlicher Schrift, Gesetzen, differenzierter Arbeitsteilung, Religion und monumentalen Bauwerken.',
  },
  pharao: {
    title: 'Der Pharao – Gottkönig',
    era: 'Altes Ägypten',
    icon: 'goldmaske',
    unlockHint: 'Studiere die königliche Thronfolge.',
    milestone: true,
    text: 'Der Pharao war uneingeschränkter Herrscher über Ober- und Unterägypten. Er galt als irdischer Sohn des Sonnengottes Ra und Verkörperung des Horus. Seine wichtigste Pflicht war die Aufrechterhaltung der kosmischen Ordnung (Maat).',
  },
  wesir: {
    title: 'Der Wesir – Oberster Beamter',
    era: 'Altes Ägypten',
    icon: 'pinsel_tinte',
    unlockHint: 'Triff Wesir Nefermaat.',
    text: 'Der Wesir war der oberste Minister des Pharao und Leiter der gesamten Verwaltung. Er überwachte die Gerichte, leitete die Steuererhebung und beaufsichtigte gigantische Bauprojekte wie die Pyramiden.',
  },
  schreiber: {
    title: 'Der Stand der Schreiber',
    era: 'Altes Ägypten',
    icon: 'pinsel_tinte',
    unlockHint: 'Errichte das Schreiberhaus (Haus des Lebens).',
    text: '„Sei Schreiber, damit deine Glieder glatt bleiben und deine Hände weich!“ Schreiber genossen höchstes Ansehen. Sie beherrschten die schwierigen Schriftzeichen, zählten Getreidevorräte und waren von harter körperlicher Arbeit befreit.',
  },
  hieroglyphen: {
    title: 'Hieroglyphen – Heilige Schrift',
    era: 'Altes Ägypten',
    icon: 'papyrusrolle',
    unlockHint: 'Stelle Papyrus und Tinte her.',
    milestone: true,
    text: 'Hieroglyphen („heilige Einkerbungen“) bestanden aus über 700 Bildzeichen. Sie konnten für Laute, ganze Wörter oder Sinngruppen stehen. Erst 1822 entzifferte der Franzose Champollion mit dem Stein von Rosetta das Geheimnis der Schrift.',
  },
  polytheismus: {
    title: 'Polytheismus (Vielgötterei)',
    era: 'Altes Ägypten',
    icon: 'kanope',
    unlockHint: 'Betrete den heiligen Tempelbezirk.',
    milestone: true,
    text: 'Die Ägypter verehrten hunderte Götter, die oft mit Tierköpfen dargestellt wurden: Horus mit Falkenkopf, Anubis mit Schakalkopf, Sobek als Krokodil und Thot mit Ibismaske. Jeder Gott hatte eigene Zuständigkeiten.',
  },
  maat: {
    title: 'Maat – Wahrheit & Ordnung',
    era: 'Altes Ägypten',
    icon: 'kanope',
    unlockHint: 'Bete am Tempelaltar.',
    text: 'Maat verkörperte die Weltordnung, Wahrheit, Gerechtigkeit und kosmische Harmonie. Dargestellt wurde sie als Göttin mit einer Straußenfeder auf dem Kopf. Der Pharao war verpflichtet, Chaos abzuwehren und Maat walten zu lassen.',
  },
  mumifizierung: {
    title: 'Die Mumifizierung',
    era: 'Altes Ägypten',
    icon: 'salz',
    unlockHint: 'Errichte das Balsamierungshaus (Wabet).',
    milestone: true,
    text: 'Um das Weiterleben im Jenseits zu sichern, musste der irdische Körper vor Verwesung bewahrt werden. Über 70 Tage wurde der Körper mit Natronsalz entwässert, mit Harzen und Ölen einbalsamiert und in Leinenbinden gewickelt.',
  },
  kanopen: {
    title: 'Die 4 Kanopenkrüge',
    era: 'Altes Ägypten',
    icon: 'kanope',
    unlockHint: 'Meißle einen Kanopenkrug im Handwerk.',
    text: 'Bei der Einbalsamierung wurden Magen, Leber, Lunge und Darm entnommen und in 4 separaten Krügen (Kanopen) bestattet. Jeder Krug wurde von einem Sohn des Horus beschützt. Das Herz blieb im Körper für das Totengericht!',
  },
  totengericht: {
    title: 'Das Totengericht des Osiris',
    era: 'Altes Ägypten',
    icon: 'skanabaeus',
    unlockHint: 'Präge ein Skarabäus-Amulett.',
    milestone: true,
    text: 'Im Jenseits wurde das Herz des Verstorbenen von Anubis auf einer Waage gegen die Straußenfeder der Wahrheit (Maat) gewogen. War das Herz durch Sünden zu schwer, verschlang die Ungeheuer-Kröte Ammit die Seele.',
  },
  pyramiden: {
    title: 'Die Pyramiden von Gizeh',
    era: 'Altes Ägypten',
    icon: 'kalkstein',
    unlockHint: 'Bruch Kalkstein im Tura-Bruch.',
    milestone: true,
    text: 'Die Cheops-Pyramide war mit ursprünglich 146 Metern fast 4.000 Jahre lang das höchste Bauwerk der Erde! Über 2,3 Millionen Steinblöcke mit je rund 2,5 Tonnen Gewicht wurden von freien Bauern während der Nilflut herantransportiert.',
  },
  sphinx: {
    title: 'Die Große Sphinx',
    era: 'Altes Ägypten',
    icon: 'kalkstein',
    unlockHint: 'Tritt vor das Antlitz der Großen Sphinx.',
    text: 'Die Große Sphinx von Gizeh besitzt den Körper eines ruhenden Löwen und den Kopf eines Pharao (vermutlich Chephren). Als gewaltiger Wächter blickt sie gen Osten zur aufgehenden Sonne und hütet die Königsgräber.',
  },
  steinmetze: {
    title: 'Bauarbeiter & Steinmetze',
    era: 'Altes Ägypten',
    icon: 'holz',
    unlockHint: 'Errichte die Bauhütte der Großbaustelle.',
    text: 'Entgegen früherer Legenden wurden die Pyramiden nicht von ausgepeitschten Sklaven erbaut, sondern von freien Bauern und Handwerkern, die während der Nilüberschwemmung gute Verpflegung (Brot, Fleisch, Bier) und medizinische Versorgung erhielten.',
  },
  kornspeicher: {
    title: 'Königliche Kornspeicher',
    era: 'Altes Ägypten',
    icon: 'getreidesack',
    unlockHint: 'Baue den Kornspeicher am Palast.',
    text: 'Große runde Lehmspeicher sicherten die Getreideernte vor Feuchtigkeit und Schädlingen. In Jahren reicher Fluten wurden gewaltige Vorräte angelegt, um Dürreperioden ohne Hungersnot zu überstehen.',
  },
  handelskarawanen: {
    title: 'Fernhandel & Karawanen',
    era: 'Altes Ägypten',
    icon: 'weihrauch',
    unlockHint: 'Tausche Waren auf dem Basar am Nil-Hafen.',
    text: 'Da Ägypten arm an Bauholz und Silber war, sandten die Pharaonen Karawanen nach Punt (Weihrauch, Myrrhe, Elfenbein), in den Libanon (Zedernholz) und nach Nubien (Gold). Bezahlt wurde im reinen Tauschhandel ohne Münzgeld!',
  },
  kleopatra: {
    title: 'Kleopatra VII. – Die letzte Königin',
    era: 'Altes Ägypten',
    icon: 'goldmaske',
    unlockHint: 'Schließe das Abenteuer in Kapitel 6 ab.',
    text: 'Kleopatra VII. war die berühmteste und letzte Pharaonin Ägyptens. Hochgebildet und sprachbegabt versuchte sie durch Bündnisse mit Julius Cäsar und Marcus Antonius die Unabhängigkeit ihres Reiches gegen Rom zu verteidigen.',
  },
  kornkammer_roms: {
    title: 'Ägypten als Kornkammer Roms',
    era: 'Altes Ägypten',
    icon: 'getreidesack',
    unlockHint: 'Belade die römische Nilbarke am Hafen.',
    milestone: true,
    text: 'Nach dem Sieg von Kaiser Augustus im Jahr 30 v. Chr. wurde Ägypten zur persönlichen Provinz des römischen Kaisers. Ein Drittel des gesamten Getreidebedarfs der Millionenstadt Rom wurde fortan mit Schiffen aus Ägypten geliefert.',
  },
  stein_von_rosetta: {
    title: 'Der Stein von Rosetta',
    era: 'Altes Ägypten',
    icon: 'papyrusrolle',
    unlockHint: 'Vollende alle 27 Lexikoneinträge.',
    milestone: true,
    text: 'Der 1799 gefundene Stein trug denselben Text in drei Schriften: Altgriechisch, Demotisch und Hieroglyphen. Da Griechisch bekannt war, gelang es 1822 Jean-François Champollion, den Hieroglyphen-Code nach über 1.400 Jahren endlich zu knacken!',
  },
};

export const CHAPTERS: Record<number, ChapterDef> = {
  1: {
    id: 1,
    title: 'Kapitel 1: Die Wüste weicht – Ankunft am Nil',
    epoch: 'Frühzeit',
    period: 'ca. 4.000 v. Chr.',
    mentor: 'Fischer Senbi',
    mentorRole: 'Erfahrener Schilffischer',
    quests: [
      'Sprich mit Fischer Senbi am Schilfgürtel des Nils (E)',
      'Schneide 3× Papyrus-Schilf am feuchten Flussufer',
      'Sammle 2× Stöcke und 2× Wüstenkiesel am Ufersaum',
      'Flechte eine Schilf-Reuse im Handwerksmenü (Taste C)',
      'Fange einen frischen Nilbarsch an den Fischgründen (E)',
      'Brate den Nilbarsch über dem Lagerfeuer',
      'Kehre zu Fischer Senbi zurück und beweise dein Wissen!',
    ],
    hints: [
      'Suche Senbi im Schilfgürtel am rechten Flussrand.',
      'Gehe an das grüne Schilf am Wasser und drücke Taste E.',
      'Trockene Äste und Steine liegen entlang der Wüstenränder.',
      'Öffne dein Handwerksmenü mit Taste C.',
      'Gehe zu den Wasserwirbeln am Flussufer.',
      'Drücke E am Lagerfeuer, um den Fisch zuzubereiten.',
      'Sprich erneut mit Senbi zur Wissensprüfung.',
    ],
    intro: [
      { text: 'Sei gegrüßt, Wanderer! Die große Trockenheit trieb unsere Sippe aus der glühenden Sahara hierher an die Ufer des mächtigen Stroms.' },
      { text: 'Hier nennen wir das schwarze Land „Kemet“. Der Fluss schenkt uns Nahrung, Wasser und Schilf. Zeige mir, dass du am Nil überleben kannst!' },
    ],
    quiz: [
      {
        question: 'Wie nannten die alten Ägypter ihr fruchtbares Land am Nilufer?',
        options: ['Deschret', 'Kemet', 'Sahara', 'Babylon'],
        correct: 1,
        explain: 'Richtig! „Kemet“ bedeutet „das schwarze Land“, benannt nach dem dunklen, fruchtbaren Nilschlamm.',
      },
      {
        question: 'Warum nannte der griechische Geschichtsschreiber Herodot Ägypten ein „Geschenk des Nils“?',
        options: [
          'Weil die Götter dort Gold verschenkten',
          'Weil ohne das Wasser und den Schlamm des Nils das ganze Land eine tote Wüste wäre',
          'Weil der Pharao jedem Bürger ein Schiff schenkte',
          'Weil der Fluss im Winter zufriert',
        ],
        correct: 1,
        explain: 'Exakt! Der Nil ist die einzige Lebensader in der glühenden Wüste Nordafrikas.',
      },
    ],
    summary: 'Du hast gelernt, wie die ersten Menschen die Wüste verließen und sich am Nil niederließen. Aus Schilf und Flusssteinen sicherst du deine Nahrung!',
  },
  2: {
    id: 2,
    title: 'Kapitel 2: Die Nilschwemme & das Wunder des Schadufs',
    epoch: 'Altes Reich',
    period: 'ca. 2.800 v. Chr.',
    mentor: 'Feldhüter Ameni',
    mentorRole: 'Kanal- und Bewässerungsmeister',
    quests: [
      'Lies den Pegelstand am antiken Nilometer ab (E)',
      'Zimmere einen Schaduf-Hebelarm im Handwerksmenü (Taste C)',
      'Errichte das Schaduf-Schöpfwerk am Nilufer (E)',
      'Schöpfe frisches Nilwasser aus dem Fluss',
      'Lockere ein Ackerbeet mit der Hacke auf und säe Emmer',
      'Bewässere das Saatbeet mit geschöpftem Nilwasser',
      'Pflücke 3× süße Datteln von den Oasenpalmen',
      'Ernte den reifen Emmer mit der Sichel (E)',
      'Sprich mit Feldhüter Ameni zur Prüfung über die Jahreszeiten!',
    ],
    hints: [
      'Das Nilometer steht am Ufer südlich der Fischerhütte.',
      'Du brauchst Holz, Stein und Papyrus für den Schaduf-Arm.',
      'Gehe zum Bauplatz des Schadufs am Flussufer.',
      'Drücke E an der Wasserstelle, um Wasser zu schöpfen.',
      'Bearbeite eines der 6 Beete vor der Oase.',
      'Gieße das gesäte Beet mit deinem Wasserkrug.',
      'Dattelpalmen wachsen rund um die grüne Oase.',
      'Warte kurz, bis das Getreide golden leuchtet, und drücke E.',
      'Tritt vor Ameni und erkläre den ägyptischen Kalender.',
    ],
    intro: [
      { text: 'Willkommen auf den Feldern von Kemet! Die Zeit der Überschwemmung (Akhet) zieht sich zurück. Der Nilschlamm liegt satt auf den Böden.' },
      { text: 'Doch die Sonne brennt heiß! Wenn wir das Nilwasser nicht auf die höher gelegenen Felder leiten, vertrocknet die Saat. Wir brauchen den Schaduf!' },
    ],
    quiz: [
      {
        question: 'Wie heißt die ägyptische Jahreszeit der Nilüberschwemmung (Juli bis Oktober)?',
        options: ['Akhet', 'Peret', 'Schemu', 'Ramadan'],
        correct: 0,
        explain: 'Richtig! Akhet ist die Zeit der Flut. Danach folgen Peret (Aussaat) und Schemu (Ernte).',
      },
      {
        question: 'Welches physikalische Prinzip nutzt der Schaduf zum Heben des Wassers?',
        options: [
          'Dampfkraft',
          'Schwinghebel mit schwerem Gegengewicht',
          'Wasserrad mit Schaufeln',
          'Elektrische Pumpe',
        ],
        correct: 1,
        explain: 'Genau! Das Gegengewicht (Stein/Lehm) zieht den vollen Wassereimer fast mühelos nach oben!',
      },
    ],
    summary: 'Mit Nilometer und Schaduf beherrschst du das Wasser. Künstliche Bewässerung schuf die Basis für Vorratshaltung und Großstädte!',
  },
  3: {
    id: 3,
    title: 'Kapitel 3: Der Pharao, sein Wesir & der Kornspeicher',
    epoch: 'Altes / Mittleres Reich',
    period: 'ca. 2.400 v. Chr.',
    mentor: 'Wesir Nefermaat',
    mentorRole: 'Erster Minister des Gottkönigs',
    quests: [
      'Errichte die Lehmziegelei am Wüstenrand (E)',
      'Streiche 3× sonnengetrocknete Lehmziegel (Taste C)',
      'Baue den Königlichen Kornspeicher am Palasthof (E)',
      'Brenne einen gebrannten Vorratstopf im Handwerk (C)',
      'Webe 1× kühles Leinentuch aus Pflanzenfasern',
      'Backe 2× Emmerbrot und braue 1× Dickbier als Arbeiterlohn',
      'Entrichte die königliche Steuerabgabe beim Wesir (E)',
    ],
    hints: [
      'Den Bauplatz der Ziegelei findest du nördlich der Felder.',
      'Mische Schlamm und Papyrus im Handwerksmenü.',
      'Errichte den runden Getreidespeicher mit Lehmziegeln.',
      'Forme Schlick zu einem Vorratstopf.',
      'Webe Leinen im Handwerk (Taste C).',
      'Brot und Bier sind Grundnahrungsmittel und Zahlungsmittel!',
      'Sprich mit Wesir Nefermaat am Palasttor.',
    ],
    intro: [
      { text: 'Sei gegrüßt im Namen des Pharao! Ein Staat entsteht nicht von allein: Tausende Menschen müssen ernährt, Deiche gepflegt und Vorräte gelagert werden.' },
      { text: 'Als oberster Wesir organisiere ich die Arbeit. Wir brauchen sonnengetrocknete Ziegel für Kornspeicher und frisches Brot für unsere Baumeister!' },
    ],
    quiz: [
      {
        question: 'Welche Rolle hatte der Wesir im Alten Ägypten?',
        options: [
          'Er war der oberste Tempeltänzer',
          'Er war der oberste Minister und Verwalter des Pharao',
          'Er war ein ausländischer Sklave',
          'Er bewachte als Soldat die Stadtgrenze',
        ],
        correct: 1,
        explain: 'Richtig! Der Wesir leitete Verwaltung, Gerichtsbarkeit, Bauvorhaben und Steuererhebung.',
      },
      {
        question: 'Womit bezahlten die alten Ägypter Arbeiter, da es noch kein Münzgeld gab?',
        options: [
          'Mit Kreditkarten aus Papyrus',
          'Mit Naturalien wie Emmerbrot, Bier, Leinen und Fleisch',
          'Mit glänzenden Glasperlen',
          'Gar nicht, Arbeiter bekamen nie Nahrung',
        ],
        correct: 1,
        explain: 'Richtig! Brot und Bier waren die feste Währung und Nahrung der arbeitenden Bevölkerung.',
      },
    ],
    summary: 'Du hast den Aufbau des ägyptischen Staates verstanden: Arbeitsteilung, zentrale Verwaltung und Vorratshaltung machten Ägypten zur ersten Hochkultur!',
  },
  4: {
    id: 4,
    title: 'Kapitel 4: Das Haus der Schreiber & das Pantheon der Götter',
    epoch: 'Mittleres Reich',
    period: 'ca. 1.900 v. Chr.',
    mentor: 'Ober-Schreiber Ani',
    mentorRole: 'Gelehrter im Haus des Lebens',
    quests: [
      'Errichte das Schreiberhaus (Haus des Lebens) (E)',
      'Presse eine saubere Papyrusrolle im Handwerksmenü (C)',
      'Stelle Binsenpinsel und schwarze Rußtinte her (C)',
      'Notiere die Getreidesteuern auf der Papyrusrolle (E)',
      'Errichte das Balsamierungshaus (Wabet) des Anubis',
      'Beschaffe Natronsalz und meißle einen Kanopenkrug (C)',
      'Gieße ein Skarabäus-Amulett für das ewige Totengericht (C)',
      'Bestehe Anis Prüfung über Hieroglyphen & Totengericht!',
    ],
    hints: [
      'Baue das Schreiberhaus westlich des Kornspeichers.',
      'Klopfe Papyrusstreifen im Handwerksmenü zu Schriftrollen.',
      'Mische Lampenruß und Binsenpinsel im Handwerk.',
      'Gehe zum Kornspeicher und drücke E zum Notieren.',
      'Das Balsamierungshaus entsteht am Wüstenrand.',
      'Natronsalz erhältst du durch Tausch am Basar.',
      'Ein Fayence-Skarabäus schützt das Herz vor dem Ungeheuer.',
      'Tritt vor Meister Ani zur Prüfung.',
    ],
    intro: [
      { text: 'Willkommen im Haus des Lebens! Worte verwehen, doch das geschriebene Wort währt ewig. Hieroglyphen sind die Worte der Götter selbst.' },
      { text: 'Und vergesse niemals die Götter: Osiris herrscht im Jenseits, Anubis wägt die Herzen, und die Göttin Maat wacht über Wahrheit und Gerechtigkeit!' },
    ],
    quiz: [
      {
        question: 'Was geschah nach dem ägyptischen Glauben beim Totengericht des Osiris?',
        options: [
          'Der Pharao verurteilte alle Feinde zum Tode',
          'Das Herz des Verstorbenen wurde gegen die Feder der Wahrheit (Maat) gewogen',
          'Die Menschen mussten um die Wette laufen',
          'Anubis zählte das Gold im Sarkophag',
        ],
        correct: 1,
        explain: 'Richtig! War das Herz rein und leicht wie die Feder, durfte die Seele in die ewigen Gefilde eintreten.',
      },
      {
        question: 'Wozu dienten die 4 Kanopenkrüge bei der Mumifizierung?',
        options: [
          'Sie enthielten kühles Nilwasser für die Reise',
          'Sie bargen die entnommenen inneren Organe (Magen, Leber, Lunge, Darm)',
          'Darin wurden Speiseopfer aus Datteln verbrannt',
          'Sie dienten als Öllampen in der Grabkammer',
        ],
        correct: 1,
        explain: 'Exakt! Das Herz blieb im Körper, während die Eingeweide in den 4 Kanopen geweiht wurden.',
      },
    ],
    summary: 'Du beherrschst Hieroglyphen und kennst die Götterwelt. Die Bewahrung der Maat und der Glaube ans Jenseits prägten jeden Lebensbereich!',
  },
  5: {
    id: 5,
    title: 'Kapitel 5: Die Baumeister von Gizeh – Pyramiden für die Ewigkeit',
    epoch: 'Altes Reich / Blütezeit',
    period: 'ca. 2.550 v. Chr.',
    mentor: 'Baumeister Hemiunu',
    mentorRole: 'Großarchitekt der königlichen Grabanlage',
    quests: [
      'Errichte die Bauhütte der Großbaustelle (E)',
      'Brich 3× Tura-Kalksteinquader im Steinbruch (E)',
      'Schlage 3× schweres Bauholz für die Transportschlitten',
      'Befeuchte die Rampe mit Schlammwasser für geringe Reibung',
      'Liefere den polierten Deckstein zur Großen Pyramide (E)',
      'Besuche die Große Sphinx von Gizeh am Tempeleingang',
      'Richte den Blick der Sphinx gen Osten zur Morgensonne aus',
      'Lege bei Baumeister Hemiunu die Architekten-Prüfung ab!',
    ],
    hints: [
      'Die Bauhütte liegt nahe den Monumenten im Westen.',
      'Gehe zu den Felsen im Nordwesten und haue Steinquader ab.',
      'Fälle Akazienholz für Rollbalken und Ziehschlitten.',
      'Gieße Schlammwasser vor den Schlitten, um die Reibung zu halbieren!',
      'Tritt an die monumentale Cheops-Pyramide heran (E).',
      'Die Sphinx liegt südlich der großen Pyramide.',
      'Drücke E an der Sphinx, um ihre Himmelsausrichtung zu prüfen.',
      'Sprich mit Hemiunu über die Bautechnik der Monumente.',
    ],
    intro: [
      { text: 'Staune, Mensch! Was wir hier errichten, trotzt den Jahrtausenden: Ein Monument für unseren göttlichen Pharao Cheops!' },
      { text: 'Vergiss die Märchen späterer Völker: Keine Peitschen knechten hier Sklaven! Freie Bauern, Zimmerleute und Steinmetze errichten dieses Wunderwerk als Dienst am Gottkönig.' },
    ],
    quiz: [
      {
        question: 'Wer erbaute die gewaltigen Pyramiden von Gizeh?',
        options: [
          'Außerirdische Besucher mit Fluggeräten',
          'Tausende ausgepeitschte römische Sklaven',
          'Zehntausende freie ägyptische Bauern und Handwerker während der Nilflut',
          'Römische Legionäre im Feldzug',
        ],
        correct: 2,
        explain: 'Richtig! Ausgrabungen von Arbeitersiedlungen beweisen: Freie Arbeiter erbauten sie mit Stolz und wurden mit Fleisch und Bier versorgt.',
      },
      {
        question: 'Welchen genialen physikalischen Trick nutzten die Ägypter beim Ziehen der tonnenschweren Schlitten?',
        options: [
          'Sie gossen Wasser und Schlamm vor die Schlittenkufen zur Verringerung der Reibung',
          'Sie nutzten Heißluftballons',
          'Sie spannten Elefanten ein',
          'Sie bauten Schienen aus purem Gold',
        ],
        correct: 0,
        explain: 'Genau! Physikalische Experimente beweisen: Befeuchteter Wüstensand halbiert die Zugkraft!',
      },
    ],
    summary: 'Du hast verstanden, wie logistische Meisterleistung, Hebelgesetze und freie Arbeitskräfte die ewigen Pyramiden von Gizeh schufen!',
  },
  6: {
    id: 6,
    title: 'Kapitel 6: Basare, Nilflotte & Kornkammer Roms',
    epoch: 'Ptolemäerzeit bis Römische Provinz',
    period: 'ca. 30 v. Chr.',
    mentor: 'Hafenmeister Baki',
    mentorRole: 'Kaufmann der Nilflotte & königlicher Gesandter',
    quests: [
      'Erhandle seltenes Weihrauchharz aus dem Land Punt am Basar',
      'Tausche Leinen gegen Libanon-Zedernholz am Nilhafen (E)',
      'Schmiede eine prunkvolle goldene Totenmaske (Taste C)',
      'Belade die königliche Nilbarke mit gesiegelten Getreidesäcken',
      'Besiegle das Handelsabkommen mit den römischen Kaufleuten (E)',
      'Hole dir deine königliche Meister-Urkunde bei Hafenmeister Baki!',
    ],
    hints: [
      'Besuche den Händler am Marktstand südlich des Hafens.',
      'Tausche Waren mit den Fernhändlern aus Phönizien.',
      'Kombiniere nubisches Gold mit Leinen im Handwerk (C).',
      'Tritt an das große Schiff am Nilhafen heran (E).',
      'Bestätige die Getreidelieferung nach Rom.',
      'Sprich mit Baki und empfange deine Pharaonen-Urkunde (U)!',
    ],
    intro: [
      { text: 'Heil dir, weitgereister Baumeister! Jahrtausende glänzte unser Reich. Phönizier, Griechen und Nubier handelten auf unseren Märkten.' },
      { text: 'Nun steht die letzte Königin auf dem Thron: Kleopatra! Und aus dem Westen drängen die Legionen Roms. Ägypten wird zur Kornkammer des Weltreichs!' },
    ],
    quiz: [
      {
        question: 'Warum war Ägypten für das Römische Reich von überragender strategischer Bedeutung?',
        options: [
          'Weil die Römer dort Ski fahren wollten',
          'Weil Ägypten als „Kornkammer Roms“ die Millionenstadt Rom mit Getreide ernährte',
          'Weil Rom keine eigenen Schiffe besaß',
          'Weil Rom nur dort Marmor fand',
        ],
        correct: 1,
        explain: 'Richtig! Ein Drittel des römischen Getreidebedarfs stammte aus Ägypten. Wer Ägypten kontrollierte, kontrollierte Rom!',
      },
      {
        question: 'Wer war die berühmte letzte Pharaonin Ägyptens vor der Umwandlung in eine römische Provinz?',
        options: ['Nofretete', 'Hatschepsut', 'Kleopatra VII.', 'Maria Theresia'],
        correct: 2,
        explain: 'Richtig! Nach Kleopatras Tod im Jahr 30 v. Chr. machte Kaiser Augustus Ägypten zur persönlichen Provinz des Kaisers.',
      },
    ],
    summary: 'Du hast den gesamten historischen Bogen Ägyptens gemeistert: Von den ersten Schilfhütten über Hochkultur und Pyramiden bis zur Kornkammer Roms!',
  },
};
