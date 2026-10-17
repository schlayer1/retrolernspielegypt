export interface RelicDef {
  id: string;
  title: string;
  epoch: string;
  icon: string;
  image: string;
  locationHint: string;
  lore: string;
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

export const EGYPT_RELICS: Record<string, RelicDef> = {
  skanabaeus: {
    id: 'skanabaeus',
    title: 'Skarabäus-Amulett des Khepri',
    epoch: 'Frühzeit / Altes Reich (~2600 v. Chr.)',
    icon: '🪲',
    image: 'assets/icons/skanabaeus.png',
    locationHint: 'Am Schilfgürtel des Nils nahe dem Fischerdorf (Kapitel 1)',
    lore: 'Aus grünem Steatit kunstvoll geschliffen. Der Pillendreher-Käfer rollt seine Dungkugel vor sich her, genau wie der Sonnengott Chepri die glühende Sonnenscheibe über das Himmelsgewölbe treibt. Für die Ägypter galt der Skarabäus als heiligstes Symbol der Auferstehung und des ewigen Lebens.',
    question: 'Welchem altägyptischen Gott der aufgehenden Morgensonne und Wiedergeburt war der heilige Skarabäus geweiht?',
    options: [
      'Chepri (Gott der aufgehenden Morgensonne)',
      'Anubis (Gott der Balsamierung)',
      'Seth (Gott der Wüstenstürme)',
    ],
    correct: 0,
    explanation: 'Richtig! Chepri wurde oft mit einem Skarabäus als Antlitz dargestellt und verkörperte die tägliche Neugeburt der Sonne am Osthorizont.',
  },
  kanope: {
    id: 'kanope',
    title: 'Alabaster-Kanopenkrug des Duamutef',
    epoch: 'Altes & Mittleres Reich (~2200 v. Chr.)',
    icon: '🏺',
    image: 'assets/icons/kanope.png',
    locationHint: 'Nahe der Einbalsamierungshalle (Wabet) im Tempelbezirk (Kapitel 4)',
    lore: 'Meisterhaft aus weiß glänzendem Alabaster gefertigt. Kanopenkrüge bewahrten die empfindlichen inneren Organe des Verstorbenen für die Ewigkeit auf. Duamutef mit dem Schakalkopf beschützte den Magen unter der Obhut der Himmelsgöttin Neith.',
    question: 'Welches lebenswichtige Organ des Verstorbenen wurde traditionell im schakalköpfigen Kanopenkrug des Duamutef verwahrt?',
    options: [
      'Das Gehirn',
      'Der Magen',
      'Die Lunge',
    ],
    correct: 1,
    explanation: 'Richtig! Die vier Horussöhne schützten die lebenswichtigen Eingeweide: Duamutef (Schakal) den Magen, Qebehsenuef (Falke) die Därme, Hapi (Pavian) die Lunge und Amset (Mensch) die Leber.',
  },
  papyrusrolle: {
    id: 'papyrusrolle',
    title: 'Papyrus-Totenbuchrolle des Ani',
    epoch: 'Neues Reich (~1250 v. Chr.)',
    icon: '📜',
    image: 'assets/icons/papyrusrolle.png',
    locationHint: 'Im Haus des Lebens (Per Ankh) bei Ober-Schreiber Ani (Kapitel 4)',
    lore: 'Auf feinsten Papyrus-Schilfstreifen mit Rußtinte und Zinnoberrot geschrieben. Die Schriftrolle enthält mächtige Zaubersprüche und geheime Losungsworte für das Bestehen vor dem 42-köpfigen Totengericht des Osiris beim Wiegen des Herzens gegen die Feder der Ma\'at.',
    question: 'Wogegen wurde das Herz des Verstorbenen im Totengericht auf der Waage der Gerechtigkeit aufgewogen?',
    options: [
      'Gegen ein schweres Goldgewicht',
      'Gegen die Straußenfeder der Göttin Ma\'at (Wahrheit & Ordnung)',
      'Gegen ein Gefäß mit heiligem Nilwasser',
    ],
    correct: 1,
    explanation: 'Richtig! Nur wenn das Herz so leicht war wie die Feder der Ma\'at, galt die Person als rein und durfte in das ewige Jenseits (die Gefilde der Binsen) eingehen.',
  },
  goldmaske: {
    id: 'goldmaske',
    title: 'Goldene Totenmaske des Pharaos',
    epoch: 'Neues Reich (~1330 v. Chr.)',
    icon: '👑',
    image: 'assets/icons/goldmaske.png',
    locationHint: 'In der Grabkammer der Großen Pyramide auf dem Gizeh-Plateau (Kapitel 5)',
    lore: 'Getrieben aus massivem Feingold, eingelegt mit echtem Lapislazuli, Türkis und Quarzglas. Die Maske verlieh dem Pharao ein unvergängliches, göttliches Antlitz und trug die Uräus-Schlange und die Geiergöttin als Schutzsymbole der vereinigten beiden Länder.',
    question: 'Welche beiden heiligen Wappentiere auf der Stirn der Pharaonenmaske symbolisieren die Einheit von Ober- und Unterägypten?',
    options: [
      'Kobra (Uräus) und Geier (Nechbet)',
      'Krokodil (Sobek) und Nilpferd (Taweret)',
      'Löwe und Wüstenfalke',
    ],
    correct: 0,
    explanation: 'Richtig! Die Uräus-Kobra verkörperte Unterägypten (das Nildelta) und die Geiergöttin Nechbet Oberägypten (das südliche Niltal).',
  },
  pinsel_tinte: {
    id: 'pinsel_tinte',
    title: 'Königliche Schreiberpalette & Binsenfedern',
    epoch: 'Spätzeit & Ptolemäerzeit (~300 v. Chr.)',
    icon: '🖌️',
    image: 'assets/icons/pinsel_tinte.png',
    locationHint: 'Am Fernhandels-Basar und der Bibliothek am Nilhafen (Kapitel 6)',
    lore: 'Aus Akazienholz geschnitzt mit zwei runden Farbvertiefungen: Schwarz (aus feinstem Lampenruß und Gummiarabikum) für den Fließtext und Rot (aus Ocker) für wichtige Daten, Zahlen und Überschriften. Das Statussymbol der gebildeten Oberschicht Ägyptens.',
    question: 'Wofür nutzten altägyptische Schreiber die rote Ockertinte auf ihren Paletten?',
    options: [
      'Für Rechenfehler und Streichungen',
      'Für Überschriften, Kapitelanfänge und göttliche Siegel',
      'Ausschließlich für Briefe an fremde Völker',
    ],
    correct: 1,
    explanation: 'Richtig! Rote Farbe (Rubrum) hob wichtige Abschnitte und Überschriften hervor – der historische Ursprung unseres Begriffs „Rubrik“!',
  },
};
