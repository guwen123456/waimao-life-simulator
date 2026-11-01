export type Logistics = "sea" | "rail" | "air";
export type StaffRole = "sales" | "ops" | "customs";
export type PayTerm = "TT100" | "TT30" | "LC" | "OA30" | "OA60";
export type Personality = "shark" | "loyal" | "strict" | "rush" | "green" | "whale";
export type Tone = "good" | "bad" | "gold" | "neutral";

export interface Supplier {
  id: string;
  label: string;
  note: string;
  mid: number;
  min: number;
  max: number;
  quality: number;
  speed: number;
}

export interface Lead {
  id: string;
  buyerId: string;
  productId: string;
  qty: number;
  fairUsd: number;
  targetUsd: number;
  bornAbs: number;
  expireAbs: number;
  hot: boolean;
  tutorial: boolean;
  fair: boolean;
  verified: boolean;
  suppliers: Supplier[];
}

export interface Shipment {
  id: string;
  buyerId: string;
  productId: string;
  qty: number;
  quality: number;
  logistics: Logistics;
  departAbs: number;
  arriveAbs: number;
  midAbs: number;
  midFired: boolean;
  arrived: boolean;
  unitUsd: number;
  pay: PayTerm;
  cogs: number;
  freight: number;
}

export interface AR {
  id: string;
  buyerId: string;
  productId: string;
  usd: number;
  dueAbs: number;
  risk: number;
  expectRate: number;
  tied?: string;
  note: string;
}

export interface LogItem {
  id: string;
  abs: number;
  tone: Tone;
  text: string;
}

export interface Choice {
  id: string;
  label: string;
  hint: string;
}

export interface DayReport {
  net: number;
  book: number;
  incoming: number;
  outgoing: number;
  rent: number;
  payroll: number;
  interest: number;
  other: number;
  goalHit: boolean;
  goalLabel: string;
  reward: number;
  hook: string;
  weekEnd: boolean;
  weekWin: boolean;
  weekBonus: number;
  rank: { name: string; firm: string; book: number; you: boolean }[];
}

export interface ShipBlock {
  kind: "ship";
  shipmentId: string;
  eventId: "customs" | "port" | "label" | "claim";
  title: string;
  body: string;
  choices: Choice[];
}

export interface EventBlock {
  kind: "event";
  eventId: string;
  title: string;
  body: string;
  choices: Choice[];
  meta: Record<string, string | number>;
}

export interface ResultBlock {
  kind: "result";
  outcome: "win" | "lose" | "counter";
  title: string;
  body: string;
  quip: string;
  leadId?: string;
  counterUsd?: number;
  stance?: number;
  supplierId?: string;
  logistics?: Logistics;
  useStock?: boolean;
  pushPay?: boolean;
  receded?: boolean;
}

export type Blocker =
  | { kind: "lead"; leadId: string }
  | ResultBlock
  | EventBlock
  | ShipBlock
  | { kind: "quiet"; line: string }
  | { kind: "closing" }
  | { kind: "dayend"; report: DayReport }
  | { kind: "rescue"; need: number; report: DayReport }
  | { kind: "gameover"; reason: string; days: number; book: number; cash: number };

export interface Goal {
  label: string;
  metric: "deals" | "book";
  target: number;
  reward: number;
}

export interface World {
  v: 1;
  seed: number;
  name: string;
  company: string;
  day: number;
  hour: number;
  abs: number;
  cash: number;
  loan: number;
  rep: number;
  stress: number;
  streak: number;
  bestStreak: number;
  xp: number;
  inventory: Record<string, number>;
  stockCost: Record<string, number>;
  staff: Record<StaffRole, boolean>;
  bumpSales: number;
  rel: Record<string, number>;
  priceMod: Record<string, number>;
  heat: Record<string, number>;
  freightMod: number;
  leads: Lead[];
  shipments: Shipment[];
  ar: AR[];
  blocker: Blocker | null;
  queue: ShipBlock[];
  log: LogItem[];
  office: 0 | 1 | 2;
  dayIn: number;
  dayOut: number;
  dayBook: number;
  dayStartCash: number;
  weekBook: number;
  totalBook: number;
  dealsToday: number;
  deals: number;
  claims: number;
  claimWins: number;
  defaults: number;
  coffeeToday: boolean;
  overtimeOn: boolean;
  tutorialDone: boolean;
  fairToday: boolean;
  fairWins: number;
  weekWins: number;
  goal: Goal;
  achievements: string[];
  rivals: { name: string; firm: string; book: number }[];
  news: { tag: string; headline: string; detail: string };
  fxLock: number;
  lockedUsd: number;
  usd: number;
  nearDeath: boolean;
  escaped: boolean;
  cleanStreak: number;
  gameOver: boolean;
  idSeq: number;
}

export interface QuoteChoice {
  stance: number;
  supplierId: string;
  logistics: Logistics;
  useStock: boolean;
  pushPay: boolean;
}

export interface Preview {
  unitUsd: number;
  unitCost: number;
  costHi: number;
  costLo: number;
  qty: number;
  revenue: number;
  cogs: number;
  freight: number;
  fee: number;
  profit: number;
  cashNow: number;
  laterUsd: number;
  laterNote: string;
  close: number;
  closeWord: string;
  pay: PayTerm;
  warn: string | null;
  canAfford: boolean;
  risky: boolean;
  stanceName: string;
  eta: number;
}

export type SfxName =
  | "click"
  | "win"
  | "lose"
  | "coin"
  | "notify"
  | "fanfare"
  | "tension"
  | "stamp";

export interface Result {
  world: World;
  sfx?: SfxName;
  toasts: string[];
}

export type Action =
  | ({ t: "quote" } & QuoteChoice)
  | { t: "pass" }
  | { t: "verify" }
  | { t: "takeCounter" }
  | { t: "recede" }
  | { t: "walk" }
  | { t: "next" }
  | { t: "event"; id: string }
  | { t: "ship"; id: string }
  | { t: "prospect" }
  | { t: "idle" }
  | { t: "spot"; productId: string; qty: number }
  | { t: "coffee" }
  | { t: "borrow"; amt: number }
  | { t: "repay"; amt: number }
  | { t: "hire"; role: StaffRole }
  | { t: "fire"; role: StaffRole }
  | { t: "upgrade" }
  | { t: "open"; leadId: string }
  | { t: "overtime" }
  | { t: "sleep" }
  | { t: "morning" }
  | { t: "rescue"; take: boolean };

export interface Meta {
  bestDay: number;
  bestCash: number;
  bestBook: number;
  bestStreak: number;
  runs: number;
  legacy: number;
}
