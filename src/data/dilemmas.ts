/**
 * Historische Dilemma- & Ratsentscheidungen für Altes Ägypten
 */

export interface DilemmaOption {
  id: string;
  title: string;
  argumentText: string;
  rewards: Record<string, number>;
  storyFlag: string;
  feedbackText: string;
}

export interface DilemmaDef {
  id: string;
  chapter: number;
  councilTitle: string;
  mentorSpeaker: string;
  illustrationKey: string;
  conflictTitle: string;
  conflictText: string;
  options: DilemmaOption[];
}

export const EGYPT_DILEMMAS: DilemmaDef[] = [
  {
    id: 'dilemma_ch3_nilschwelle',
    chapter: 3,
    councilTitle: 'Pharaonen-Rat am Hofe des Wesirs',
    mentorSpeaker: 'Wesir Rechmire',
    illustrationKey: 'council_egypt',
    conflictTitle: 'Niedrige Nilschwelle: Saatgut für die Bauern oder Vorrat für den Tempel?',
    conflictText: 'Die diesjährige Nilflut fiel gering aus. Die Speicher des Pharaos sind gut gefüllt, doch den Kleinbauern droht der Hunger und es fehlt Saatgut für die nächste Aussaat. Die Priester des Amun fordern jedoch, den Tempelzehnten unangetastet zu lassen, um den Zorn der Götter nicht zu wecken.',
    options: [
      {
        id: 'opt_farmers',
        title: 'Saatgut an die Bauern verteilen',
        argumentText: 'Öffnet die königlichen Speicher! Wenn die Bauern jetzt nicht säen, wird im nächsten Jahr die Not noch größer sein.',
        rewards: { weizen: 20, stroh: 10 },
        storyFlag: 'dilemma_ch3_farmers_saved',
        feedbackText: 'Eine fürsorgliche Entscheidung! Die Bauern danken dir mit frischem Korn und Fleiß beim Pyramidenbau.'
      },
      {
        id: 'opt_compromise',
        title: 'Kompromiss: Darlehen an die Feldarbeiter vergeben',
        argumentText: 'Ein Teil des Getreides wird als Darlehen für die Aussaat ausgegeben und nach der Ernte zurückgezahlt.',
        rewards: { weizen: 10, deben: 2 },
        storyFlag: 'dilemma_ch3_compromise_struck',
        feedbackText: 'Ein geschickter Ausgleich! Sowohl Priester als auch Bauern respektieren deine kaufmännische Weitsicht.'
      }
    ]
  }
];
