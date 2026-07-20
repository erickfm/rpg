export interface Stats {
  strength: number;
  intelligence: number;
  charm: number;
}

export type PlaceId =
  | 'apartment'
  | 'castle'
  | 'bank'
  | 'newlines'
  | 'uofs'
  | 'mcsticks'
  | 'fineline'
  | 'stickys'
  | 'casino'
  | 'store'
  | 'pawn'
  | 'busdepot';

export type ItemId =
  | 'smokes'
  | 'caffeine'
  | 'slushee'
  | 'candy'
  | 'nachos'
  | 'bottle'
  | 'cocaine'
  | 'ammo'
  | 'knife'
  | 'alarmClock'
  | 'cellPhone'
  | 'gun';

export type FurnitureId =
  | 'bed'
  | 'tv'
  | 'computer'
  | 'freezer'
  | 'satellite'
  | 'treadmill'
  | 'encyclopedia'
  | 'minibar';

export type HomeTier = 'apartment' | 'bigger' | 'castle';

export type TickerId = 'XGEN' | 'STIK' | 'DIME';

export type CityId =
  | 'detroit'
  | 'la'
  | 'brooklyn'
  | 'chicago'
  | 'camden'
  | 'vegas';

export interface GameState {
  version: 2;
  name: string;
  dayLimit: number | null; // 15 | 40 | 100 | null (unlimited)
  day: number;
  minute: number; // 0..1439
  cash: number;
  bank: number;
  loan: number;
  hp: number;
  stats: Stats;
  karma: number; // -100..100
  inventory: Partial<Record<ItemId, number>>;
  furniture: FurnitureId[];
  furnitureUsed: FurnitureId[]; // reset each sleep
  home: HomeTier;
  jobRank: number; // New Lines rank index, -1 = not hired
  shiftsAtRank: number;
  hasSkateboard: boolean;
  hasCar: boolean;
  punkSmokes: number;
  punkDead: boolean;
  cityVisits: Partial<Record<CityId, number>>;
  stockPrices: Record<TickerId, number>;
  stockOwned: Record<TickerId, number>;
  messages: string[]; // answering-machine inbox at home
  titleOffered: boolean;
  title: 'none' | 'president' | 'dictator';
  dead: boolean;
  deathCause: string | null;
  ended: boolean;
  seed: number; // deterministic per-run salt for daily events
}

/** Every player action returns this: on failure, `state` is unchanged. */
export interface ActionResult {
  ok: boolean;
  state: GameState;
  msg: string;
}
