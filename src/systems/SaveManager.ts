export type PlayerGender = 'male' | 'female';
export type PlayerRole = 'fisher' | 'scribe' | 'builder';

export interface FarmPlotState {
  id: number;
  stage: 'raw' | 'tilled' | 'seeded' | 'watered' | 'ripe';
  wateredAt: number;
}

export interface SaveData {
  version: number;
  epoch: 'aegypten';
  playerName: string;
  playerGender: PlayerGender;
  playerRole: PlayerRole;
  chapter: number;
  x: number;
  y: number;
  inventory: Record<string, number>;
  lexicon: string[];
  food: number;
  safety: number;
  knowledge: number;
  quest: number;
  counts: Record<string, number>;
  plots: FarmPlotState[];
  buildings: string[];
  dayTime: number;
  collapses: number;
  quizAttempts: number;
  playTimeSec: number;
  distanceMeters: number;
  daysSurvived: number;
}

const STORAGE_KEY = 'retro_save_aegypten';

export class SaveManager {
  hasSave(): boolean {
    return Boolean(localStorage.getItem(STORAGE_KEY));
  }

  load(): SaveData | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data && data.version >= 1) return data as SaveData;
    } catch {
      // ignore parse error
    }
    return null;
  }

  save(data: SaveData): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // ignore storage error
    }
  }

  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  }
}
