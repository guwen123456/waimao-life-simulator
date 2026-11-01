import {
  BUYERS,
  ETA,
  FREIGHT,
  OFFICES,
  PAY_LABEL,
  PRODUCTS,
  STANCES,
  STAFF,
  buyerById,
  buyerTargetMul,
  productById,
  quip,
  titleFor,
  type ProductDef,
} from "./content";
import { clamp } from "./format";
import { nextRng } from "./rng";
import type {
  Action,
  DayReport,
  EventBlock,
  Goal,
  Lead,
  Logistics,
  PayTerm,
  Personality,
  Preview,
  QuoteChoice,
  Result,
  ResultBlock,
  ShipBlock,
  Shipment,
  StaffRole,
  Supplier,
  World,
} from "./types";

interface Ctx {
  notes: string[];
  sfx?: Result["sfx"];
}

export function newGame(name: string, legacy = 0, seed = (Date.now() ^ 0x9e3779b9) >>> 0): World {
  const safe = name.replace(/\s+/g, "").slice(0, 8) || "陈屿";
  const w: World = {
    v: 1,
    seed: seed || 1,
    name: safe,
    company: `${safe.slice(0, 1)}港进出口`,
    day: 1,
    hour: 9,
    abs: 9,
    cash: 68000,
    loan: 0,
    rep: clamp(8 + legacy, 0, 100),
    stress: 10,
    streak: 0,
    bestStreak: 0,
    xp: 0,
    inventory: {},
    stockCost: {},
    staff: { sales: false, ops: false, customs: false },
    bumpSales: 0,
    rel: {},
    priceMod: {},
    heat: {},
    freightMod: 1,
    leads: [],
    shipments: [],
    ar: [],
    blocker: null,
    queue: [],
    log: [],
    office: 0,
    dayIn: 0,
    dayOut: 0,
    dayBook: 0,
    dayStartCash: 68000,
    weekBook: 0,
    totalBook: 0,
    dealsToday: 0,
    deals: 0,
    claims: 0,
    claimWins: 0,
    defaults: 0,
    coffeeToday: false,
    overtimeOn: false,
    tutorialDone: false,
    fairToday: false,
    fairWins: 0,
    weekWins: 0,
    goal: { label: "拿下第一单", metric: "deals", target: 1, reward: 2200 },
    achievements: [],
    rivals: [
      { name: "林昭", firm: "迅达", book: 0 },
      { name: "赵婶", firm: "顺达", book: 0 },
    ],
    news: {
      tag: "开业",
      headline: "南港下小雨，适合开一家谁都不看好的公司。",
      detail: "先活过今天。现金比利润重要。",
    },
    fxLock: 0,
    lockedUsd: 7.18,
    usd: 7.18,
    nearDeath: false,
    escaped: false,
    cleanStreak: 0,
    gameOver: false,
    idSeq: 1,
  };
  for (const p of PRODUCTS) w.priceMod[p.id] = 1;
  for (const b of BUYERS) w.rel[b.id] = b.personality === "loyal" ? 36 : 22;
  const ctx: Ctx = { notes: [] };
  return spawnContent(w, ctx);
}

export function act(world: World, action: Action): Result {
  const ctx: Ctx = { notes: [] };
  let w = clone(world);
  if (w.gameOver && action.t !== "morning") {
    return { world, toasts: [], sfx: "tension" };
  }
  w = reduce(w, action, ctx);
  const ach = harvest(w);
  for (const a of ach) ctx.notes.push(a);
  return { world: w, toasts: ctx.notes, sfx: ctx.sfx };
}

function reduce(w: World, action: Action, ctx: Ctx): World {
  switch (action.t) {
    case "quote":
      return doQuote(w, ctx, action);
    case "pass":
      return doPass(w, ctx);
    case "verify":
      return doVerify(w, ctx);
    case "takeCounter":
      return doTakeCounter(w, ctx);
    case "recede":
      return doRecede(w, ctx);
    case "walk":
      return doWalk(w, ctx);
    case "next":
      return spendHour(w, ctx, "normal");
    case "event":
      return doEvent(w, ctx, action.id);
    case "ship":
      return doShip(w, ctx, action.id);
    case "prospect":
      return spendHour(w, ctx, "lead");
    case "idle":
      return spendHour(w, ctx, "normal");
    case "spot":
      return doSpot(w, ctx, action.productId, action.qty);
    case "coffee":
      return doCoffee(w, ctx);
    case "borrow":
      return doBorrow(w, ctx, action.amt);
    case "repay":
      return doRepay(w, ctx, action.amt);
    case "hire":
      return doHire(w, ctx, action.role);
    case "fire":
      return doFire(w, ctx, action.role);
    case "upgrade":
      return doUpgrade(w, ctx);
    case "open":
      return doOpen(w, ctx, action.leadId);
    case "overtime":
      return doOvertime(w, ctx);
    case "sleep":
      return endDay(w, ctx);
    case "morning":
      return beginMorning(w, ctx);
    case "rescue":
      return action.take ? doRescue(w, ctx) : gameOver(w, ctx, "你谢绝了拆借。门卫明天会换掉公司铭牌。");
    default:
      return w;
  }
}

export function previewQuote(world: World, choice: QuoteChoice): Preview | null {
  const block = world.blocker;
  if (!block || block.kind !== "lead") return null;
  const lead = world.leads.find((l) => l.id === block.leadId);
  if (!lead) return null;
  return buildPreview(world, lead, choice);
}

export function verifyFee(w: World, lead: Lead): number {
  const p = productById(lead.productId);
  const base = Math.round(260 + lead.qty * p.baseCost * 0.018);
  return w.staff.ops ? Math.round(base * 0.45) : base;
}

export function warehouseCap(w: World): number {
  return OFFICES[w.office].warehouse;
}

export function warehouseUsed(w: World): number {
  return PRODUCTS.reduce((s, p) => s + (w.inventory[p.id] ?? 0) * p.bulk, 0);
}

export function payrollOf(w: World): number {
  let n = 0;
  if (w.staff.sales) n += STAFF.sales.day + w.bumpSales;
  if (w.staff.ops) n += STAFF.ops.day;
  if (w.staff.customs) n += STAFF.customs.day;
  return n;
}

export function creditLimit(w: World): number {
  return OFFICES[w.office].credit;
}

export function effectiveUsd(w: World): number {
  return w.fxLock > 0 ? w.lockedUsd : w.usd;
}

export function levelOf(w: World): number {
  return 1 + Math.floor(w.xp / 60);
}

export function chaseLine(w: World): string {
  const best = w.rivals.reduce((a, r) => (r.book > a.book ? r : a), w.rivals[0]);
  if (!best) return "圈子很安静。";
  if (w.weekBook >= best.book && w.weekBook > 0) return `本周你压着${best.name}`;
  const gap = Math.max(0, Math.round(best.book - w.weekBook) + 1);
  if (gap <= 1 && w.weekBook === 0 && best.book === 0) return "本周还没人开张";
  return `再做 ${gap.toLocaleString("en-US")} 毛利就超过${best.name}`;
}

export function goalProgress(w: World): number {
  return w.goal.metric === "deals" ? w.dealsToday : w.dayBook;
}

export function spotUnit(w: World, productId: string): number {
  const p = productById(productId);
  return Math.round(p.baseCost * (w.priceMod[productId] ?? 1) * 0.98);
}

function clone(w: World): World {
  return {
    ...w,
    inventory: { ...w.inventory },
    stockCost: { ...w.stockCost },
    staff: { ...w.staff },
    rel: { ...w.rel },
    priceMod: { ...w.priceMod },
    heat: { ...w.heat },
    leads: w.leads.map((l) => ({ ...l, suppliers: l.suppliers.map((s) => ({ ...s })) })),
    shipments: w.shipments.map((s) => ({ ...s })),
    ar: w.ar.map((a) => ({ ...a })),
    log: w.log.slice(),
    achievements: w.achievements.slice(),
    rivals: w.rivals.map((r) => ({ ...r })),
    queue: w.queue.map((q) => ({ ...q, choices: q.choices.map((c) => ({ ...c })) })),
    goal: { ...w.goal },
    news: { ...w.news },
    blocker: w.blocker ? structuredClone(w.blocker) : null,
  };
}

function roll(w: World): number {
  const n = nextRng(w.seed);
  w.seed = n.seed;
  return n.roll;
}

function nid(w: World): string {
  const id = `n${w.idSeq}`;
  w.idSeq += 1;
  return id;
}

function buzz(ctx: Ctx, s: NonNullable<Result["sfx"]>) {
  const rank: Record<NonNullable<Result["sfx"]>, number> = {
    fanfare: 7,
    win: 6,
    stamp: 5,
    coin: 4,
    lose: 3,
    tension: 2,
    notify: 2,
    click: 1,
  };
  if (!ctx.sfx || rank[s] >= rank[ctx.sfx]) ctx.sfx = s;
}

function log(w: World, tone: World["log"][number]["tone"], text: string) {
  w.log.unshift({ id: nid(w), abs: w.abs, tone, text });
  if (w.log.length > 36) w.log.length = 36;
}

function relOf(w: World, id: string): number {
  return w.rel[id] ?? 20;
}

function addRel(w: World, id: string, d: number) {
  w.rel[id] = clamp(relOf(w, id) + d, 0, 100);
}

function addCash(w: World, delta: number) {
  const v = Math.round(delta);
  w.cash += v;
  if (v >= 0) w.dayIn += v;
  else w.dayOut += -v;
  if (w.cash < 4000 && w.cash > 0) w.nearDeath = true;
}

function addBook(w: World, delta: number) {
  const v = Math.round(delta);
  w.dayBook += v;
  w.weekBook += v;
  w.totalBook += v;
}

function addXp(w: World, n: number) {
  w.xp += n;
}

function bumpRep(w: World, d: number, ctx: Ctx) {
  const before = w.rep;
  w.rep = clamp(Math.round(w.rep + d), 0, 100);
  if (w.rep === before) return;
  for (const p of PRODUCTS) {
    if (before < p.unlockRep && w.rep >= p.unlockRep && p.unlockRep > 0) {
      ctx.notes.push(`新类目：${p.name}`);
      buzz(ctx, "notify");
    }
  }
  for (const b of BUYERS) {
    if (before < b.unlockRep && w.rep >= b.unlockRep && b.unlockRep > 0) {
      ctx.notes.push(`${b.name} 愿意接你的电话了`);
      buzz(ctx, "notify");
    }
  }
  if (titleFor(before) !== titleFor(w.rep)) {
    ctx.notes.push(`江湖称呼变成「${titleFor(w.rep)}」`);
    buzz(ctx, "fanfare");
  }
}

function breakStreak(w: World) {
  w.streak = 0;
}

function winStreak(w: World, ctx: Ctx) {
  w.streak += 1;
  if (w.streak > w.bestStreak) w.bestStreak = w.streak;
  if (w.streak === 3) ctx.notes.push("三连成交。手感来了。");
  if (w.streak === 5) ctx.notes.push("五连。林昭开始打听你。");
  if (w.streak === 7) ctx.notes.push("七连。这周你是传说。");
}

function rateNow(w: World): number {
  return effectiveUsd(w);
}

function improvedPay(pay: PayTerm): PayTerm {
  if (pay === "OA60") return "OA30";
  if (pay === "OA30") return "TT30";
  if (pay === "TT30") return "TT100";
  if (pay === "LC") return "TT30";
  return pay;
}

function closeChance(w: World, lead: Lead, stance: number, supplier: Supplier, logistics: Logistics, pushPay: boolean): number {
  const buyer = buyerById(lead.buyerId);
  const quoteMul = STANCES[stance]?.mul ?? 1;
  const targetMul = lead.targetUsd / lead.fairUsd;
  let p = 0.6;
  p -= (quoteMul - targetMul) * 0.9;
  p += (relOf(w, buyer.id) - 30) / 240;
  p += w.rep / 380;
  p += (w.heat[buyer.market] ?? 0) * 0.1;
  if (w.staff.sales) p += 0.07;
  if (pushPay) p -= 0.16;
  if (pushPay && buyer.personality === "strict" && buyer.pay === "LC") p -= 0.08;
  if (logistics === "air" && buyer.personality === "rush") p += 0.14;
  if (logistics === "sea" && buyer.personality === "rush") p -= 0.1;
  if (!lead.verified && (buyer.personality === "strict" || buyer.personality === "whale") && supplier.quality < 0.6) {
    p -= 0.12;
  }
  if (supplier.quality < 0.5 && (buyer.personality === "strict" || buyer.personality === "whale")) p -= 0.2;
  if (supplier.quality >= 0.85 && (buyer.personality === "strict" || buyer.personality === "loyal")) p += 0.07;
  if (w.stress > 78) p -= 0.08;
  if (w.stress > 92) p -= 0.06;
  if (lead.tutorial && stance <= 2) p += 0.34;
  if (lead.fair) p += 0.04;
  p += Math.min(8, levelOf(w)) * 0.006;
  if (w.streak >= 3) p += 0.03;
  return clamp(p, 0.05, 0.93);
}

function closeWord(p: number): string {
  if (p >= 0.82) return "十拿九稳";
  if (p >= 0.66) return "把握不小";
  if (p >= 0.48) return "五五开";
  if (p >= 0.32) return "有点悬";
  return "几乎没戏";
}

function buildPreview(w: World, lead: Lead, choice: QuoteChoice, unitOverride?: number, costRoll?: number): Preview | null {
  const product = productById(lead.productId);
  const buyer = buyerById(lead.buyerId);
  const supplier = lead.suppliers.find((s) => s.id === choice.supplierId) ?? lead.suppliers[0];
  if (!supplier) return null;
  const stance = clamp(choice.stance, 0, STANCES.length - 1);
  const useStock = choice.useStock && (w.inventory[product.id] ?? 0) >= lead.qty;
  const pushPay = choice.pushPay && buyer.pay !== "TT100";
  const pay = pushPay ? improvedPay(buyer.pay) : buyer.pay;
  const unitUsd = unitOverride ?? round2(lead.fairUsd * STANCES[stance].mul);
  const mod = w.priceMod[product.id] ?? 1;
  let unitCost: number;
  let costLo: number;
  let costHi: number;
  if (useStock) {
    unitCost = w.stockCost[product.id] ?? supplier.mid;
    costLo = unitCost;
    costHi = unitCost;
  } else if (lead.verified || costRoll === undefined) {
    unitCost = supplier.mid * (lead.verified ? 1 : 1) ;
    // verified uses true mid; unverified preview uses midpoint of range
    if (lead.verified) unitCost = supplier.mid;
    else unitCost = (supplier.min + supplier.max) / 2;
    if (costRoll !== undefined && !lead.verified) {
      unitCost = supplier.min + (supplier.max - supplier.min) * costRoll;
    }
    costLo = lead.verified ? supplier.mid : supplier.min;
    costHi = lead.verified ? supplier.mid : supplier.max;
  } else {
    unitCost = supplier.min + (supplier.max - supplier.min) * costRoll;
    costLo = supplier.min;
    costHi = supplier.max;
  }
  // priceMod baked into supplier at creation, don't apply twice
  void mod;
  const freightEach = FREIGHT[choice.logistics] * product.bulk * w.freightMod * (w.staff.customs ? 0.9 : 1);
  const freight = Math.round(freightEach * lead.qty);
  const cogs = useStock ? Math.round(unitCost * lead.qty) : Math.round(unitCost * lead.qty);
  const rate = rateNow(w);
  const revenue = Math.round(unitUsd * lead.qty * rate);
  const fee = pay === "LC" ? Math.round(revenue * 0.012) : 0;
  const profit = revenue - (useStock ? Math.round((w.stockCost[product.id] ?? unitCost) * lead.qty) : cogs) - freight - fee;
  const immediateRev = immediatePortion(pay) * revenue;
  const immediateCost = (useStock ? 0 : cogs) + freight + fee;
  const cashNow = Math.round(immediateRev - immediateCost);
  const laterUsd = round2(unitUsd * lead.qty * (1 - immediatePortion(pay)));
  const eta = Math.max(3, ETA[choice.logistics] + (useStock ? -2 : supplier.speed));
  let laterNote = "当场两讫";
  if (pay === "TT30") laterNote = `尾款约 ${Math.round(laterUsd * rate).toLocaleString("en-US")} 元，到港结`;
  if (pay === "LC") laterNote = "信用证到港议付，汇率未锁会漂";
  if (pay === "OA30") laterNote = "整笔放账，大约一天半以后才进卡";
  if (pay === "OA60") laterNote = "长账期。利润是故事，现金是命";
  const p = closeChance(w, lead, stance, supplier, choice.logistics, pushPay);
  const worstCost = useStock ? 0 : Math.round(costHi * lead.qty);
  const worstNow = Math.round(immediateRev - (worstCost + freight + fee));
  const affordNow = w.cash + cashNow >= 0;
  const risky = !useStock && !lead.verified && w.cash + worstNow < 0;
  let warn: string | null = null;
  if (!affordNow) warn = "按这个算法，现在的现金不够垫。";
  else if (risky) warn = "没验厂的话，成本若顶到高位，这单会黄。";
  else if (pay === "OA60" || pay === "OA30") warn = "账上会很好看。卡里会先瘦一圈。";
  else if (w.stress > 80) warn = "你已经开始看错小数点。";
  return {
    unitUsd,
    unitCost: Math.round(unitCost * 100) / 100,
    costHi: Math.round(costHi * 100) / 100,
    costLo: Math.round(costLo * 100) / 100,
    qty: lead.qty,
    revenue,
    cogs: useStock ? 0 : cogs,
    freight,
    fee,
    profit,
    cashNow,
    laterUsd,
    laterNote,
    close: p,
    closeWord: closeWord(p),
    pay,
    warn,
    canAfford: affordNow,
    risky,
    stanceName: STANCES[stance].name,
    eta,
  };
}

function immediatePortion(pay: PayTerm): number {
  if (pay === "TT100") return 1;
  if (pay === "TT30") return 0.3;
  return 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function currentLead(w: World): Lead | null {
  const block = w.blocker;
  if (!block || block.kind !== "lead") return null;
  return w.leads.find((l) => l.id === block.leadId) ?? null;
}

function doQuote(w: World, ctx: Ctx, choice: QuoteChoice): World {
  const lead = currentLead(w);
  if (!lead) return w;
  const preview = buildPreview(w, lead, choice, undefined);
  if (!preview) return w;
  if (!preview.canAfford) {
    ctx.notes.push("现金垫不起，报价没发出去。");
    buzz(ctx, "tension");
    return w;
  }
  let stance = choice.stance;
  if (w.stress > 74 && stance < 4 && roll(w) < (w.stress - 68) / 140) {
    stance += 1;
    ctx.notes.push("手滑，报价高了一档。");
    buzz(ctx, "tension");
  }
  const supplier = lead.suppliers.find((s) => s.id === choice.supplierId) ?? lead.suppliers[0];
  const buyer = buyerById(lead.buyerId);
  const useStock = choice.useStock && (w.inventory[lead.productId] ?? 0) >= lead.qty;
  const pushPay = choice.pushPay && buyer.pay !== "TT100";
  const p = closeChance(w, lead, stance, supplier, choice.logistics, pushPay);
  const r = roll(w);
  const costRoll = roll(w);
  if (r < p) {
    return commitDeal(w, ctx, lead, { ...choice, stance, useStock, pushPay }, undefined, costRoll);
  }
  if (r < p + 0.3 && stance > 0) {
    const quoteMul = STANCES[stance].mul;
    const targetMul = lead.targetUsd / lead.fairUsd;
    let counter = round2(lead.fairUsd * Math.min(quoteMul * 0.97, (quoteMul + targetMul) / 2));
    counter = Math.max(round2(lead.fairUsd * 0.78), counter);
    const block: ResultBlock = {
      kind: "result",
      outcome: "counter",
      title: "对方还价",
      body: `${usdLoose(counter)} / ${productById(lead.productId).unit}`,
      quip: quip(buyer.personality, stance, "counter"),
      leadId: lead.id,
      counterUsd: counter,
      stance,
      supplierId: supplier.id,
      logistics: choice.logistics,
      useStock,
      pushPay,
      receded: false,
    };
    w.blocker = block;
    buzz(ctx, "notify");
    return w;
  }
  return failDeal(w, ctx, lead, buyer.personality, stance);
}

function usdLoose(n: number): string {
  return `$${n.toFixed(2)}`;
}

function failDeal(w: World, ctx: Ctx, lead: Lead, personality: Personality, stance: number, reason?: string): World {
  w.leads = w.leads.filter((l) => l.id !== lead.id);
  addRel(w, lead.buyerId, -4);
  bumpRep(w, -1, ctx);
  w.stress = clamp(w.stress + 7, 0, 100);
  breakStreak(w);
  log(w, "bad", `${buyerById(lead.buyerId).name} 没接 ${productById(lead.productId).name}。`);
  w.blocker = {
    kind: "result",
    outcome: "lose",
    title: "没成交",
    body: "这小时耗进去了。",
    quip: reason ?? quip(personality, stance, "lose"),
  };
  buzz(ctx, "lose");
  return w;
}

function commitDeal(
  w: World,
  ctx: Ctx,
  lead: Lead,
  choice: QuoteChoice,
  unitOverride: number | undefined,
  costRoll: number,
): World {
  const buyer = buyerById(lead.buyerId);
  const product = productById(lead.productId);
  const supplier = lead.suppliers.find((s) => s.id === choice.supplierId) ?? lead.suppliers[0];
  const built = buildPreview(w, lead, choice, unitOverride, choice.useStock || lead.verified ? undefined : costRoll);
  if (!built) return w;
  const useStock = choice.useStock && (w.inventory[product.id] ?? 0) >= lead.qty;
  const pay = built.pay;
  const immediateCost = built.cogs + built.freight + built.fee;
  const immediateRev = Math.round(immediatePortion(pay) * built.revenue);
  if (w.cash + immediateRev < immediateCost) {
    ctx.notes.push("工厂要现款。成本一跳，你垫不起，单子黄了。");
    return failDeal(w, ctx, lead, buyer.personality, choice.stance, "厂价跳到高位，卡里垫不起。客户只能收到一句抱歉。");
  }
  if (useStock) {
    w.inventory[product.id] = (w.inventory[product.id] ?? 0) - lead.qty;
    if ((w.inventory[product.id] ?? 0) <= 0) {
      delete w.inventory[product.id];
    }
  }
  addCash(w, immediateRev - immediateCost);
  addBook(w, built.profit);
  w.deals += 1;
  w.dealsToday += 1;
  addXp(w, lead.fair ? 22 : 14);
  bumpRep(w, lead.fair ? 3 : 1, ctx);
  addRel(w, buyer.id, choice.stance >= 4 ? 2 : 6);
  w.stress = clamp(w.stress - 4, 0, 100);
  winStreak(w, ctx);
  if (lead.fair) {
    w.fairWins += 1;
    ctx.notes.push("广交会这单拿下了。");
  }
  const quality = useStock ? 0.8 : supplier.quality;
  const speed = useStock ? -2 : supplier.speed;
  const travel = Math.max(3, ETA[choice.logistics] + speed);
  const arriveAbs = w.abs + travel;
  const ship: Shipment = {
    id: nid(w),
    buyerId: buyer.id,
    productId: product.id,
    qty: lead.qty,
    quality,
    logistics: choice.logistics,
    departAbs: w.abs,
    arriveAbs,
    midAbs: w.abs + Math.max(2, Math.floor(travel / 2)),
    midFired: travel <= 4,
    arrived: false,
    unitUsd: built.unitUsd,
    pay,
    cogs: useStock ? Math.round((w.stockCost[product.id] ?? built.unitCost) * lead.qty) : built.cogs,
    freight: built.freight,
  };
  w.shipments.push(ship);
  const laterUsd = built.laterUsd;
  if (laterUsd > 0.5) {
    const due =
      pay === "TT30" || pay === "LC"
        ? arriveAbs
        : pay === "OA30"
          ? w.abs + 36
          : w.abs + 68;
    const risk =
      pay === "OA60" ? 0.27 : pay === "OA30" ? 0.15 : pay === "TT30" ? 0.04 : pay === "LC" ? 0.02 : 0.02;
    w.ar.push({
      id: nid(w),
      buyerId: buyer.id,
      productId: product.id,
      usd: laterUsd,
      dueAbs: due,
      risk: clamp(risk + (buyer.personality === "shark" ? 0.05 : 0) + (buyer.personality === "green" ? 0.04 : 0) - relOf(w, buyer.id) / 900, 0.01, 0.55),
      expectRate: rateNow(w),
      tied: pay === "TT30" || pay === "LC" ? ship.id : undefined,
      note: PAY_LABEL[pay],
    });
  }
  w.leads = w.leads.filter((l) => l.id !== lead.id);
  log(w, "good", `${buyer.name} 定了 ${product.name} ×${lead.qty}，毛利 ${Math.round(built.profit).toLocaleString("en-US")}。`);
  w.blocker = {
    kind: "result",
    outcome: "win",
    title: lead.fair ? "广交会成交" : "成交",
    body: `经济利润 ¥${Math.round(built.profit).toLocaleString("en-US")} · 立刻现金 ${built.cashNow >= 0 ? "+" : ""}¥${Math.round(built.cashNow).toLocaleString("en-US")}`,
    quip: quip(buyer.personality, choice.stance, "win"),
  };
  buzz(ctx, built.profit >= 20000 || lead.fair ? "fanfare" : "win");
  return w;
}

function doTakeCounter(w: World, ctx: Ctx): World {
  const b = w.blocker;
  if (b?.kind !== "result" || b.outcome !== "counter" || !b.leadId || b.counterUsd == null) return w;
  const lead = w.leads.find((l) => l.id === b.leadId);
  if (!lead) return w;
  const choice: QuoteChoice = {
    stance: b.stance ?? 2,
    supplierId: b.supplierId ?? lead.suppliers[0].id,
    logistics: b.logistics ?? "sea",
    useStock: !!b.useStock,
    pushPay: !!b.pushPay,
  };
  return commitDeal(w, ctx, lead, choice, b.counterUsd, roll(w));
}

function doRecede(w: World, ctx: Ctx): World {
  const b = w.blocker;
  if (b?.kind !== "result" || b.outcome !== "counter" || b.receded || !b.leadId) return w;
  const lead = w.leads.find((l) => l.id === b.leadId);
  if (!lead) return w;
  const stance = clamp((b.stance ?? 2) - 1, 0, 4);
  const supplier = lead.suppliers.find((s) => s.id === b.supplierId) ?? lead.suppliers[0];
  const logistics = b.logistics ?? "sea";
  const pushPay = !!b.pushPay;
  const p = clamp(closeChance(w, lead, stance, supplier, logistics, pushPay) + 0.12, 0.05, 0.95);
  const buyer = buyerById(lead.buyerId);
  if (roll(w) < p) {
    return commitDeal(
      w,
      ctx,
      lead,
      { stance, supplierId: supplier.id, logistics, useStock: !!b.useStock, pushPay },
      undefined,
      roll(w),
    );
  }
  const quoteMul = STANCES[stance].mul;
  const targetMul = lead.targetUsd / lead.fairUsd;
  let counter = round2(lead.fairUsd * Math.min(quoteMul * 0.98, (quoteMul * 0.6 + targetMul * 0.4)));
  counter = Math.max(round2(lead.fairUsd * 0.78), counter);
  w.blocker = {
    ...b,
    stance,
    counterUsd: counter,
    receded: true,
    body: `${usdLoose(counter)} / ${productById(lead.productId).unit}`,
    quip: "你让了半档。对方还是叼着价，但松了一点。",
  };
  buzz(ctx, "notify");
  void buyer;
  return w;
}

function doWalk(w: World, ctx: Ctx): World {
  const b = w.blocker;
  if (b?.kind !== "result" || b.outcome !== "counter" || !b.leadId) return w;
  const lead = w.leads.find((l) => l.id === b.leadId);
  if (!lead) return w;
  return failDeal(w, ctx, lead, buyerById(lead.buyerId).personality, b.stance ?? 2);
}

function doPass(w: World, ctx: Ctx): World {
  const lead = currentLead(w);
  if (!lead) return w;
  w.leads = w.leads.filter((l) => l.id !== lead.id);
  addRel(w, lead.buyerId, -2);
  w.stress = clamp(w.stress - 3, 0, 100);
  log(w, "neutral", `放过 ${buyerById(lead.buyerId).name} 的 ${productById(lead.productId).name}。`);
  ctx.notes.push("这单让出去了。");
  buzz(ctx, "click");
  w.blocker = null;
  return spendHour(w, ctx, "normal");
}

function doVerify(w: World, ctx: Ctx): World {
  const lead = currentLead(w);
  if (!lead || lead.verified) return w;
  const fee = verifyFee(w, lead);
  if (w.cash < fee) {
    ctx.notes.push("验厂的钱也不够。");
    buzz(ctx, "tension");
    return w;
  }
  addCash(w, -fee);
  const found = w.leads.find((l) => l.id === lead.id);
  if (found) found.verified = true;
  log(w, "neutral", `验了 ${productById(lead.productId).name} 的厂，花了 ${fee}。`);
  ctx.notes.push(w.staff.ops ? "老周把厂摸清了。" : "验厂报告回来了。数字不再是区间。");
  buzz(ctx, "notify");
  return w;
}

function doEvent(w: World, ctx: Ctx, id: string): World {
  const b = w.blocker;
  if (b?.kind !== "event") return w;
  w = applyEvent(w, ctx, b, id);
  w.blocker = null;
  addXp(w, 4);
  return spendHour(w, ctx, "normal");
}

function doShip(w: World, ctx: Ctx, id: string): World {
  const b = w.blocker;
  if (b?.kind !== "ship") return w;
  w = applyShip(w, ctx, b, id);
  return afterFree(w, ctx);
}

function doSpot(w: World, ctx: Ctx, productId: string, qty: number): World {
  if (w.blocker && w.blocker.kind !== "quiet" && w.blocker.kind !== "closing") {
    ctx.notes.push("眼前这单还没完。");
    buzz(ctx, "tension");
    return w;
  }
  const p = productById(productId);
  if (w.rep < p.unlockRep) return w;
  const q = Math.max(0, Math.round(qty));
  if (q <= 0) return w;
  const unit = spotUnit(w, p.id);
  const cost = unit * q;
  const room = warehouseCap(w) - warehouseUsed(w);
  if (q * p.bulk > room) {
    ctx.notes.push("仓库塞不下。");
    buzz(ctx, "tension");
    return w;
  }
  if (w.cash < cost) {
    ctx.notes.push("现金不够扫货。");
    buzz(ctx, "tension");
    return w;
  }
  const prev = w.inventory[p.id] ?? 0;
  const prevC = w.stockCost[p.id] ?? unit;
  w.inventory[p.id] = prev + q;
  w.stockCost[p.id] = Math.round(((prev * prevC + cost) / (prev + q)) * 100) / 100;
  addCash(w, -cost);
  log(w, "neutral", `扫进 ${p.name} ×${q}，单价 ¥${unit}。`);
  ctx.notes.push(`库存 +${q}${p.unit}`);
  buzz(ctx, "coin");
  w.blocker = null;
  return spendHour(w, ctx, "normal");
}

function doCoffee(w: World, ctx: Ctx): World {
  if (w.coffeeToday) {
    ctx.notes.push("今天已经灌过一杯了。");
    return w;
  }
  if (w.cash < 48) {
    ctx.notes.push("连冻柠茶都要赊。");
    buzz(ctx, "tension");
    return w;
  }
  addCash(w, -48);
  w.coffeeToday = true;
  w.stress = clamp(w.stress - 24, 0, 100);
  ctx.notes.push("港式冻柠茶。小数点暂时看清了。");
  buzz(ctx, "click");
  return w;
}

function doBorrow(w: World, ctx: Ctx, amt: number): World {
  const room = creditLimit(w) - w.loan;
  const take = Math.min(Math.max(0, Math.round(amt)), room);
  if (take < 1000) {
    ctx.notes.push("额度不够，银行经理在笑。");
    buzz(ctx, "tension");
    return w;
  }
  w.loan += take;
  addCash(w, take);
  w.stress = clamp(w.stress + 4, 0, 100);
  log(w, "gold", `拆借 ¥${take.toLocaleString("en-US")}，日息按写字楼档走。`);
  ctx.notes.push(`到账 ¥${take.toLocaleString("en-US")}，利息每晚来敲门。`);
  buzz(ctx, "coin");
  return w;
}

function doRepay(w: World, ctx: Ctx, amt: number): World {
  const keep = 800;
  const can = Math.max(0, Math.min(w.loan, w.cash - keep, Math.round(amt)));
  if (can < 500) {
    ctx.notes.push("留点饭钱。现在还不上。");
    buzz(ctx, "tension");
    return w;
  }
  w.loan -= can;
  addCash(w, -can);
  log(w, "good", `还掉贷款 ¥${can.toLocaleString("en-US")}。`);
  ctx.notes.push("负债轻了一截。");
  buzz(ctx, "click");
  return w;
}

function doHire(w: World, ctx: Ctx, role: StaffRole): World {
  if (w.staff[role]) return w;
  const cost = STAFF[role].day * 3;
  if (w.cash < cost) {
    ctx.notes.push("先发得出这周的工资，再谈理想。");
    buzz(ctx, "tension");
    return w;
  }
  w.staff[role] = true;
  log(w, "gold", `${STAFF[role].who} 入职，管${STAFF[role].name}。`);
  ctx.notes.push(`${STAFF[role].who} 来了。`);
  buzz(ctx, "notify");
  addXp(w, 6);
  return w;
}

function doFire(w: World, ctx: Ctx, role: StaffRole): World {
  if (!w.staff[role]) return w;
  w.staff[role] = false;
  if (role === "sales") w.bumpSales = 0;
  bumpRep(w, -2, ctx);
  w.stress = clamp(w.stress + 6, 0, 100);
  log(w, "bad", `${STAFF[role].who} 走了。群里安静了一下。`);
  ctx.notes.push(`${STAFF[role].who} 离职。`);
  buzz(ctx, "lose");
  return w;
}

function doUpgrade(w: World, ctx: Ctx): World {
  if (w.office >= 2) return w;
  const next = (w.office + 1) as 1 | 2;
  const need = OFFICES[next].rent * 8;
  if (w.cash < need) {
    ctx.notes.push(`账上至少留 ${need.toLocaleString("en-US")} 再搬，不然第一晚就熄灯。`);
    buzz(ctx, "tension");
    return w;
  }
  w.office = next;
  log(w, "gold", `搬进${OFFICES[next].name}。今晚房租变了。`);
  ctx.notes.push(OFFICES[next].name);
  buzz(ctx, "fanfare");
  addXp(w, 10);
  return w;
}

function doOpen(w: World, ctx: Ctx, leadId: string): World {
  if (w.blocker && w.blocker.kind !== "quiet") {
    ctx.notes.push("先把眼前这单料理了。");
    buzz(ctx, "tension");
    return w;
  }
  const lead = w.leads.find((l) => l.id === leadId);
  if (!lead) return w;
  w.blocker = { kind: "lead", leadId };
  buzz(ctx, "click");
  return w;
}

function doOvertime(w: World, ctx: Ctx): World {
  if (w.blocker?.kind !== "closing" || w.overtimeOn) return w;
  w.overtimeOn = true;
  w.stress = clamp(w.stress + 20, 0, 100);
  w.blocker = null;
  ctx.notes.push("灯还亮着。再撑三个小时。");
  buzz(ctx, "notify");
  return spawnContent(w, ctx);
}

function doRescue(w: World, ctx: Ctx): World {
  const b = w.blocker;
  if (b?.kind !== "rescue") return w;
  const room = creditLimit(w) - w.loan;
  const take = Math.min(room, b.need);
  if (take <= 0) return gameOver(w, ctx, "额度用尽，续命失败。");
  w.loan += take;
  w.cash += take;
  w.stress = clamp(w.stress + 14, 0, 100);
  log(w, "bad", `连夜拆借 ¥${take.toLocaleString("en-US")}，公司没死。`);
  ctx.notes.push("活下来了。利息会记得你。");
  buzz(ctx, "tension");
  w.blocker = null;
  return beginMorning(w, ctx);
}

function spendHour(w: World, ctx: Ctx, mode: "normal" | "lead"): World {
  if (w.gameOver) return w;
  const from = w.abs;
  w.hour += 1;
  w.abs += 1;
  w.fxLock = Math.max(0, w.fxLock - 1);
  w.blocker = null;
  w = resolveRange(w, ctx, from, w.abs);
  if (mode === "lead" && w.queue.length === 0 && w.leads.length < 3 && w.hour < 18) {
    const before = w.leads.length;
    w = addLead(w, ctx, {});
    if (w.leads.length > before) {
      w.blocker = { kind: "lead", leadId: w.leads[w.leads.length - 1].id };
      return w;
    }
  }
  return afterTime(w, ctx);
}

function afterFree(w: World, ctx: Ctx): World {
  w.blocker = null;
  if (w.queue.length) {
    w.blocker = w.queue.shift() ?? null;
    return w;
  }
  return afterTime(w, ctx);
}

function afterTime(w: World, ctx: Ctx): World {
  if (w.queue.length && !w.blocker) {
    w.blocker = w.queue.shift() ?? null;
    return w;
  }
  if (w.blocker) return w;
  if (w.hour >= 21) return endDay(w, ctx);
  if (w.hour >= 18 && !w.overtimeOn) {
    w.blocker = { kind: "closing" };
    return w;
  }
  return spawnContent(w, ctx);
}

function endDay(w: World, ctx: Ctx): World {
  if (w.gameOver) return w;
  if (w.blocker?.kind === "dayend" || w.blocker?.kind === "rescue" || w.blocker?.kind === "gameover") return w;
  const rent = OFFICES[w.office].rent;
  const payroll = payrollOf(w);
  const interest = Math.round(w.loan * OFFICES[w.office].rate);
  addCash(w, -rent);
  addCash(w, -payroll);
  if (interest) addCash(w, -interest);
  // settlement was counted in dayOut; keep explicit fields for the report
  const goalHit = goalProgress(w) >= w.goal.target;
  let reward = 0;
  if (goalHit) {
    reward = w.goal.reward;
    addCash(w, reward);
    bumpRep(w, 1, ctx);
    ctx.notes.push("今日目标达成");
    buzz(ctx, "stamp");
  }
  w.stress = clamp(w.stress - (w.overtimeOn ? 6 : 18), 0, 100);
  for (const r of w.rivals) {
    r.book += Math.round(8200 + roll(w) * 15000 + w.day * 900);
  }
  const weekEnd = w.day % 5 === 0;
  let weekWin = false;
  let weekBonus = 0;
  if (weekEnd) {
    const bestRival = Math.max(...w.rivals.map((r) => r.book));
    if (w.weekBook > 0 && w.weekBook >= bestRival) {
      weekWin = true;
      weekBonus = 12000 + w.day * 400;
      addCash(w, weekBonus);
      bumpRep(w, 5, ctx);
      w.weekWins += 1;
      ctx.notes.push("本周圈子第一");
      buzz(ctx, "fanfare");
    }
  }
  const cashBeforePlug = w.cash;
  const explainedIn = w.dayIn;
  const explainedOut = w.dayOut;
  const net = cashBeforePlug - w.dayStartCash;
  const explained = explainedIn - explainedOut;
  const other = net - explained;
  const rank = rankRows(w);
  const report: DayReport = {
    net,
    book: w.dayBook,
    incoming: explainedIn,
    outgoing: explainedOut - rent - payroll - interest,
    rent,
    payroll,
    interest,
    other,
    goalHit,
    goalLabel: w.goal.label,
    reward,
    hook: hookFor(w.day + 1, w),
    weekEnd,
    weekWin,
    weekBonus,
    rank,
  };
  // outgoing included settlement because addCash counted it. The waterfall wants operating out separate.
  // Recompute operating outgoing as dayOut minus settlement charges (they're also in dayOut).
  report.outgoing = Math.max(0, w.dayOut - rent - payroll - interest - (goalHit ? 0 : 0));
  void other;
  log(w, net >= 0 ? "good" : "bad", `第 ${w.day} 天打烊，现金流 ${net >= 0 ? "+" : ""}${net}。`);
  addXp(w, 6);
  if (w.cash < 0) {
    const need = Math.max(12000, -w.cash + 9000);
    if (w.loan + need <= creditLimit(w)) {
      w.blocker = { kind: "rescue", need, report };
      buzz(ctx, "tension");
      return w;
    }
    return gameOver(w, ctx, "现金断了，额度也断了。南港不欠你一个摊位。");
  }
  w.blocker = { kind: "dayend", report };
  if (!ctx.sfx) buzz(ctx, net >= 8000 ? "coin" : "click");
  return w;
}

function beginMorning(w: World, ctx: Ctx): World {
  if (w.blocker?.kind === "gameover") return w;
  const prevAbs = w.abs;
  const weekEnd = w.blocker?.kind === "dayend" ? w.blocker.report.weekEnd : w.blocker?.kind === "rescue" ? w.blocker.report.weekEnd : w.day % 5 === 0;
  w.day += 1;
  w.hour = 9;
  w.abs = (w.day - 1) * 24 + 9;
  w.fxLock = Math.max(0, w.fxLock - (w.abs - prevAbs));
  w = resolveRange(w, ctx, prevAbs, w.abs);
  if (w.day % 7 === 0) w.stress = clamp(w.stress - 8, 0, 100);
  w.dayIn = 0;
  w.dayOut = 0;
  w.dayBook = 0;
  w.dealsToday = 0;
  w.coffeeToday = false;
  w.overtimeOn = false;
  w.fairToday = false;
  w.freightMod = 1;
  if (weekEnd) {
    w.weekBook = 0;
    for (const r of w.rivals) r.book = 0;
  }
  drift(w, ctx);
  w.goal = makeGoal(w);
  w.dayStartCash = w.cash;
  w.blocker = null;
  if (w.queue.length) {
    w.blocker = w.queue.shift() ?? null;
    return w;
  }
  return spawnContent(w, ctx);
}

function gameOver(w: World, ctx: Ctx, reason: string): World {
  w.gameOver = true;
  w.blocker = {
    kind: "gameover",
    reason,
    days: w.day,
    book: w.totalBook,
    cash: w.cash,
  };
  buzz(ctx, "lose");
  log(w, "bad", "公司注销。");
  return w;
}

function makeGoal(w: World): Goal {
  if (w.day === 1) return { label: "拿下第一单", metric: "deals", target: 1, reward: 2200 };
  if (w.day % 7 === 0) return { label: "周日保住现金，或做成任意一单", metric: "deals", target: 0, reward: 800 };
  const target = Math.round((6500 + w.day * 2100) * (w.office === 2 ? 1.35 : w.office === 1 ? 1.15 : 1));
  return {
    label: `今日毛利 ¥${target.toLocaleString("en-US")}`,
    metric: "book",
    target,
    reward: Math.round(target * 0.07),
  };
}

function hookFor(nextDay: number, w: World): string {
  if (nextDay % 5 === 0) return "明天广交会。有个大买家点了你的名。";
  if (nextDay % 7 === 0) return "明天周日。客户去陪家人，利息不会放假。";
  if (w.shipments.length) return `在途还有 ${w.shipments.length} 票货，睡着也会到港。`;
  if (w.ar.length) return "有笔应收在路上。别在到账前把钱花成故事。";
  const hot = [...PRODUCTS].filter((p) => w.rep >= p.unlockRep).sort((a, b) => (w.priceMod[a.id] ?? 1) - (w.priceMod[b.id] ?? 1))[0];
  if (hot && (w.priceMod[hot.id] ?? 1) < 0.92) return `明天 ${hot.name} 的厂价还软着，可以看看。`;
  return "明天邮箱还会响。你只要再撑一个上午。";
}

function rankRows(w: World): DayReport["rank"] {
  const rows = [
    { name: w.company, firm: w.name, book: w.weekBook, you: true },
    ...w.rivals.map((r) => ({ name: r.firm, firm: r.name, book: r.book, you: false })),
  ];
  rows.sort((a, b) => b.book - a.book);
  return rows;
}

function drift(w: World, ctx: Ctx) {
  const usdJ = (roll(w) - 0.48) * 0.018;
  w.usd = clamp(round2(w.usd * (1 + usdJ)), 6.55, 7.85);
  const p = PRODUCTS[Math.floor(roll(w) * PRODUCTS.length)];
  const jump = (roll(w) - 0.48) * 0.16;
  w.priceMod[p.id] = clamp(round2((w.priceMod[p.id] ?? 1) * (1 + jump)), 0.72, 1.45);
  for (const m of ["jp", "us", "sea", "me", "eu", "latam", "in"]) {
    w.heat[m] = clamp((w.heat[m] ?? 0) * 0.55, -0.25, 0.45);
  }
  const market = ["jp", "us", "sea", "me", "eu", "latam", "in"][Math.floor(roll(w) * 7)];
  w.heat[market] = clamp((roll(w) - 0.35) * 0.55, -0.2, 0.48);
  const up = jump > 0.03;
  const down = jump < -0.03;
  const fx = usdJ > 0.004 ? "人民币偏弱，美元货更值钱。" : usdJ < -0.004 ? "人民币一夜变硬，报价别太贪。" : "汇率像港面一样平。";
  let headline = `${p.name}${up ? "厂价抬头" : down ? "厂价松了" : "价格没大动"}。${fx}`;
  if (w.day % 5 === 0) headline = `广交会开馆。${headline}`;
  if (w.day % 7 === 0) headline = `周日的南港很安静。${headline}`;
  w.news = {
    tag: up ? "涨" : down ? "跌" : "平",
    headline,
    detail: fx,
  };
  if (Math.abs(jump) > 0.07) ctx.notes.push(headline);
}

function resolveRange(w: World, ctx: Ctx, from: number, to: number): World {
  const marks = new Set<number>();
  for (const s of w.shipments) {
    if (!s.midFired && s.midAbs > from && s.midAbs <= to) marks.add(s.midAbs);
    if (!s.arrived && s.arriveAbs > from && s.arriveAbs <= to) marks.add(s.arriveAbs);
  }
  for (const a of w.ar) if (a.dueAbs > from && a.dueAbs <= to) marks.add(a.dueAbs);
  for (const l of w.leads) if (l.expireAbs > from && l.expireAbs <= to) marks.add(l.expireAbs);
  const times = [...marks].sort((a, b) => a - b);
  for (const t of times) fireAt(w, ctx, t);
  return w;
}

function fireAt(w: World, ctx: Ctx, t: number) {
  const expiring = w.leads.filter((l) => l.expireAbs === t);
  if (expiring.length) {
    const ids = new Set(expiring.map((l) => l.id));
    w.leads = w.leads.filter((l) => !ids.has(l.id));
    for (const l of expiring) {
      log(w, "bad", `${buyerById(l.buyerId).name} 的询盘过期，大概进了林昭的邮箱。`);
      ctx.notes.push("一单询盘凉了");
      w.stress = clamp(w.stress + 3, 0, 100);
    }
  }
  for (const s of w.shipments) {
    if (!s.midFired && s.midAbs === t) {
      s.midFired = true;
      if (roll(w) < 0.3) w.queue.push(midBlock(w, s));
    }
  }
  for (const s of [...w.shipments]) {
    if (s.arrived || s.arriveAbs !== t) continue;
    s.arrived = true;
    const buyer = buyerById(s.buyerId);
    const product = productById(s.productId);
    let risk = 0.06 + product.risk * (1.25 - s.quality) * (buyer.personality === "strict" || buyer.personality === "whale" ? 1.25 : 1);
    if (w.staff.ops) risk *= 0.62;
    if (s.logistics === "air") risk *= 0.8;
    if (roll(w) < clamp(risk, 0.04, 0.55)) {
      w.claims += 1;
      w.queue.push(claimBlock(s));
      log(w, "bad", `${product.name} 到港，对方挑出了毛病。`);
    } else {
      w.shipments = w.shipments.filter((x) => x.id !== s.id);
      addRel(w, s.buyerId, 3);
      bumpRep(w, 1, ctx);
      w.cleanStreak += 1;
      addXp(w, 4);
      log(w, "good", `${buyer.name} 的 ${product.name} 顺利到港。`);
      ctx.notes.push(`${product.name} 到港`);
      buzz(ctx, "coin");
    }
  }
  for (const a of [...w.ar]) {
    if (a.dueAbs !== t) continue;
    collectAR(w, ctx, a.id);
  }
}

function midBlock(w: World, s: Shipment): ShipBlock {
  const kindRoll = roll(w);
  const product = productById(s.productId);
  const buyer = buyerById(s.buyerId);
  if (kindRoll < 0.34) {
    return {
      kind: "ship",
      shipmentId: s.id,
      eventId: "customs",
      title: "海关抽中了你",
      body: `${buyer.country} 这票 ${product.name} 被拉去机检。放着不管，交期和脸色一起变。`,
      choices: [
        { id: "pay", label: "花钱疏通", hint: "约 ¥1,600，立刻放行" },
        { id: "argue", label: "自己去磨", hint: "可能罚款，也可能只是慢" },
        { id: "staff", label: w.staff.customs ? "交给小陈" : "没有报关员", hint: w.staff.customs ? "他会把故事讲圆" : "这个选项是空的" },
      ],
    };
  }
  if (kindRoll < 0.67) {
    return {
      kind: "ship",
      shipmentId: s.id,
      eventId: "port",
      title: "港口堵了",
      body: `${LOGI(s.logistics)} 爆仓。${product.name} 在堆场里看海。`,
      choices: [
        { id: "wait", label: "干等", hint: "再晚几个小时，客户会催" },
        { id: "air", label: "改空运救急", hint: "贵，但交期能救" },
      ],
    };
  }
  return {
    kind: "ship",
    shipmentId: s.id,
    eventId: "label",
    title: "箱唛印错了",
    body: `${buyer.name} 说外箱条码和订单对不上。现在改还来得及。`,
    choices: [
      { id: "fix", label: "返工箱唛", hint: "花钱、费神，关系保住" },
      { id: "ship", label: "先走再说", hint: "赌对方收货时心情好" },
    ],
  };
}

function LOGI(l: Logistics): string {
  return l === "sea" ? "海运" : l === "rail" ? "班列" : "空运";
}

function claimBlock(s: Shipment): ShipBlock {
  const product = productById(s.productId);
  const buyer = buyerById(s.buyerId);
  return {
    kind: "ship",
    shipmentId: s.id,
    eventId: "claim",
    title: "到港投诉",
    body: `${buyer.name} 说 ${product.name} 有一批不合格。照片拍得很好，心情拍得很差。`,
    choices: [
      { id: "replace", label: "补货息事", hint: "再垫一截成本，名声还在" },
      { id: "refund", label: "退一截款", hint: "现金立刻疼一下" },
      { id: "hard", label: "硬刚", hint: "对一半是骨气，错一半是事故" },
    ],
  };
}

function applyShip(w: World, ctx: Ctx, b: ShipBlock, id: string): World {
  const s = w.shipments.find((x) => x.id === b.shipmentId);
  if (!s) return w;
  const product = productById(s.productId);
  if (b.eventId === "customs") {
    if (id === "staff" && w.staff.customs) {
      log(w, "good", `小陈把 ${product.name} 的海关记录说圆了。`);
      ctx.notes.push("海关放行");
      buzz(ctx, "notify");
    } else if (id === "pay") {
      addCash(w, -1600);
      addBook(w, -1600);
      log(w, "neutral", "海关这关，用钱买回了时间。");
      buzz(ctx, "click");
    } else {
      w.stress = clamp(w.stress + 8, 0, 100);
      if (roll(w) < 0.45) {
        addCash(w, -2800);
        addBook(w, -2800);
        s.arriveAbs += 6;
        shiftTied(w, s.id, 6);
        bumpRep(w, -2, ctx);
        log(w, "bad", "越争越真，罚了款还延误。");
        buzz(ctx, "lose");
      } else {
        s.arriveAbs += 3;
        shiftTied(w, s.id, 3);
        log(w, "neutral", "磨到放行，只是晚了一拍。");
        buzz(ctx, "click");
      }
    }
    return w;
  }
  if (b.eventId === "port") {
    if (id === "air") {
      const extra = Math.round(1200 + s.qty * product.bulk * 1.4);
      addCash(w, -extra);
      addBook(w, -extra);
      s.logistics = "air";
      const cut = Math.min(6, Math.max(2, s.arriveAbs - w.abs - 3));
      s.arriveAbs = Math.max(w.abs + 2, s.arriveAbs - cut);
      log(w, "neutral", `改空运，多花 ${extra}。`);
      buzz(ctx, "coin");
    } else {
      s.arriveAbs += 6;
      shiftTied(w, s.id, 6);
      addRel(w, s.buyerId, -2);
      log(w, "bad", `${product.name} 在港口多睡了几个小时。`);
      buzz(ctx, "tension");
    }
    return w;
  }
  if (b.eventId === "label") {
    if (id === "fix") {
      addCash(w, -900);
      addBook(w, -400);
      w.stress = clamp(w.stress + 4, 0, 100);
      addRel(w, s.buyerId, 2);
      log(w, "neutral", "箱唛连夜改完。");
      buzz(ctx, "click");
    } else {
      s.quality = clamp(s.quality - 0.25, 0.05, 1);
      log(w, "bad", "箱唛将错就错。到港再看运气。");
      buzz(ctx, "tension");
    }
    return w;
  }
  // claim
  w.shipments = w.shipments.filter((x) => x.id !== s.id);
  if (id === "replace") {
    const cost = Math.round(s.cogs * (w.staff.ops ? 0.22 : 0.34));
    addCash(w, -cost);
    addBook(w, -cost);
    bumpRep(w, 2, ctx);
    addRel(w, s.buyerId, 5);
    w.claimWins += 1;
    w.stress = clamp(w.stress + 4, 0, 100);
    log(w, "good", `补了一批 ${product.name}，投诉按下去了。`);
    ctx.notes.push("投诉翻篇");
    buzz(ctx, "notify");
    return w;
  }
  if (id === "refund") {
    const back = Math.round(s.unitUsd * s.qty * rateNow(w) * 0.22);
    addCash(w, -back);
    addBook(w, -back);
    addRel(w, s.buyerId, 1);
    breakStreak(w);
    log(w, "bad", `退了 ¥${back.toLocaleString("en-US")}，这单瘦了。`);
    buzz(ctx, "lose");
    return w;
  }
  if (roll(w) < 0.5) {
    bumpRep(w, 1, ctx);
    addRel(w, s.buyerId, -2);
    w.claimWins += 1;
    log(w, "gold", "证据站得住。对方嘴硬，但没再追款。");
    ctx.notes.push("硬刚赢了");
    buzz(ctx, "win");
  } else {
    const back = Math.round(s.unitUsd * s.qty * rateNow(w) * 0.4);
    addCash(w, -back);
    addBook(w, -back);
    bumpRep(w, -5, ctx);
    addRel(w, s.buyerId, -12);
    breakStreak(w);
    w.cleanStreak = 0;
    log(w, "bad", `硬刚失败，赔了 ¥${back.toLocaleString("en-US")}。`);
    buzz(ctx, "lose");
  }
  return w;
}

function shiftTied(w: World, shipId: string, hours: number) {
  for (const a of w.ar) if (a.tied === shipId) a.dueAbs += hours;
}

function collectAR(w: World, ctx: Ctx, id: string) {
  const a = w.ar.find((x) => x.id === id);
  if (!a) return;
  w.ar = w.ar.filter((x) => x.id !== id);
  const buyer = buyerById(a.buyerId);
  const fail = roll(w) < a.risk;
  const rate = rateNow(w);
  if (!fail) {
    const got = Math.round(a.usd * rate);
    addCash(w, got);
    addBook(w, Math.round(a.usd * (rate - a.expectRate)));
    log(w, "good", `${buyer.name} 的 ${a.note} 到账 ¥${got.toLocaleString("en-US")}。`);
    ctx.notes.push(`到账 ¥${got.toLocaleString("en-US")}`);
    buzz(ctx, "coin");
    addRel(w, a.buyerId, 2);
    return;
  }
  const portion = roll(w) < 0.5 ? 0 : round2(0.2 + roll(w) * 0.25);
  const got = Math.round(a.usd * rate * portion);
  if (got) addCash(w, got);
  addBook(w, Math.round(got - a.usd * a.expectRate));
  w.defaults += 1;
  breakStreak(w);
  bumpRep(w, -3, ctx);
  addRel(w, a.buyerId, -14);
  log(w, "bad", `${buyer.name} 的应收砸了。${got ? `只抠回 ¥${got.toLocaleString("en-US")}。` : "一分没进。"}`);
  ctx.notes.push("坏账");
  buzz(ctx, "lose");
}

function mostUrgent(w: World): Lead {
  return [...w.leads].sort((a, b) => a.expireAbs - b.expireAbs)[0];
}

function spawnContent(w: World, ctx: Ctx, forceLead = false): World {
  if (!w.tutorialDone) {
    w.tutorialDone = true;
    w = addLead(w, ctx, { tutorial: true });
    const lead = w.leads[w.leads.length - 1];
    if (lead) w.blocker = { kind: "lead", leadId: lead.id };
    return w;
  }
  if (w.day % 5 === 0 && !w.fairToday) {
    w.fairToday = true;
    w = addLead(w, ctx, { fair: true });
    const lead = w.leads[w.leads.length - 1];
    if (lead) {
      w.blocker = { kind: "lead", leadId: lead.id };
      ctx.notes.push("广交会的牌子亮了");
      buzz(ctx, "notify");
      return w;
    }
  }
  if (forceLead && w.leads.length < 3) {
    const before = w.leads.length;
    w = addLead(w, ctx, {});
    const lead = w.leads[w.leads.length - 1];
    if (w.leads.length > before && lead) {
      w.blocker = { kind: "lead", leadId: lead.id };
      return w;
    }
  }
  const sunday = w.day % 7 === 0;
  const saturday = w.day % 7 === 6;
  const r = roll(w);
  const focusP = sunday ? 0.4 : saturday ? 0.86 : 0.72;
  if (w.leads.length && r < focusP) {
    w.blocker = { kind: "lead", leadId: mostUrgent(w).id };
    return w;
  }
  if (r < (sunday ? 0.62 : 0.84)) {
    const ev = buildEvent(w, ctx);
    if (ev) {
      w.blocker = ev;
      buzz(ctx, "notify");
      return w;
    }
  }
  if (!sunday && w.leads.length < 3 && r < 0.96) {
    const before = w.leads.length;
    w = addLead(w, ctx, {});
    const lead = w.leads[w.leads.length - 1];
    if (w.leads.length > before && lead) {
      w.blocker = { kind: "lead", leadId: lead.id };
      return w;
    }
  }
  w.blocker = {
    kind: "quiet",
    line: sunday
      ? "周日的口岸像关掉了声音。你可以扫货，也可以真的休息。"
      : "这小时没有新邮件。你可以出击，也可以看盘。",
  };
  return w;
}

function addLead(w: World, ctx: Ctx, opt: { tutorial?: boolean; fair?: boolean }): World {
  if (w.leads.length >= 3 && !opt.tutorial) return w;
  const products = PRODUCTS.filter((p) => w.rep >= p.unlockRep);
  const buyers = BUYERS.filter((b) => w.rep >= b.unlockRep);
  if (!products.length || !buyers.length) return w;
  let product = products[Math.floor(roll(w) * products.length)];
  let buyer = buyers[Math.floor(roll(w) * buyers.length)];
  if (opt.tutorial) {
    product = productById("cable");
    buyer = buyerById("linh");
  } else if (opt.fair) {
    const whale = buyers.find((b) => b.personality === "whale") ?? [...buyers].sort((a, b) => b.qty - a.qty)[0];
    buyer = whale;
    product = [...products].sort((a, b) => b.refUsd - a.refUsd)[0];
  } else if (w.staff.sales && roll(w) < 0.45) {
    const hotM = Object.entries(w.heat).sort((a, b) => b[1] - a[1])[0]?.[0];
    const pool = buyers.filter((b) => b.market === hotM);
    if (pool.length) buyer = pool[Math.floor(roll(w) * pool.length)];
  }
  const mod = w.priceMod[product.id] ?? 1;
  const qtyRaw = product.qtyBase * buyer.qty * (0.78 + roll(w) * 0.55) * (1 + w.office * 0.18) * (w.staff.sales ? 1.12 : 1) * (opt.fair ? 2.15 : 1);
  const qty = Math.max(10, Math.round(qtyRaw / 10) * 10);
  const fairUsd = round2(product.refUsd * (0.96 + roll(w) * 0.08) * (1 + (mod - 1) * 0.35));
  const targetUsd = round2(fairUsd * buyerTargetMul(buyer.personality) * (1 + relOf(w, buyer.id) / 900));
  const suppliers = makeSuppliers(w, product, mod);
  const lead: Lead = {
    id: nid(w),
    buyerId: buyer.id,
    productId: product.id,
    qty,
    fairUsd,
    targetUsd,
    bornAbs: w.abs,
    expireAbs: w.abs + (opt.tutorial ? 24 : opt.fair ? 7 : 3 + Math.floor(roll(w) * 3)),
    hot: !!opt.fair || buyer.personality === "rush" || qty > product.qtyBase * 1.3,
    tutorial: !!opt.tutorial,
    fair: !!opt.fair,
    verified: !!opt.tutorial,
    suppliers,
  };
  if (opt.tutorial) {
    lead.qty = 2600;
    lead.fairUsd = 1.48;
    lead.targetUsd = 1.4;
    lead.expireAbs = w.abs + 20;
  }
  w.leads.push(lead);
  if (!opt.tutorial) {
    log(w, "neutral", `新询盘：${buyer.name} 要 ${product.name} ×${qty}。`);
  }
  void ctx;
  return w;
}

function makeSuppliers(w: World, product: ProductDef, mod: number): Supplier[] {
  const m = product.baseCost * mod;
  const q1 = 0.34 + roll(w) * 0.18;
  const q2 = 0.72 + roll(w) * 0.12;
  const q3 = 0.9 + roll(w) * 0.08;
  const raw = [
    { id: "village", label: "村口小厂", note: "便宜，品控看天", mid: m * 0.86, quality: q1, speed: 2 },
    { id: "old", label: "合作老厂", note: "认章，少出事", mid: m * 1, quality: q2, speed: 0 },
    { id: "big", label: "大厂外贸部", note: "贵，但你睡得着", mid: m * 1.15, quality: q3, speed: -2 },
  ];
  return raw.map((s) => {
    const band = 0.07 + (1 - s.quality) * 0.08;
    return { ...s, min: round2(s.mid * (1 - band)), max: round2(s.mid * (1 + band)), mid: round2(s.mid), quality: round2(s.quality) };
  });
}

function buildEvent(w: World, ctx: Ctx): EventBlock | null {
  const options: { id: string; can: boolean; make: () => EventBlock }[] = [];
  const unlocked = PRODUCTS.filter((p) => w.rep >= p.unlockRep);
  const cheap = [...unlocked].sort((a, b) => (w.priceMod[a.id] ?? 1) - (w.priceMod[b.id] ?? 1))[0];
  if (cheap && w.cash > 4000) {
    options.push({
      id: "flash",
      can: true,
      make: () => {
        const price = Math.max(1, Math.round(cheap.baseCost * (w.priceMod[cheap.id] ?? 1) * 0.84));
        const qtyS = Math.max(10, Math.round(cheap.qtyBase * 0.35));
        const qtyB = qtyS * 3;
        return {
          kind: "event",
          eventId: "flash",
          title: "工厂清库存",
          body: `${cheap.name}有人砸在手里，出厂 ¥${price}，窗口只有今天。`,
          choices: [
            { id: "no", label: "不接", hint: "现金留着睡觉" },
            { id: "s", label: `吃进 ${qtyS}${cheap.unit}`, hint: `¥${(price * qtyS).toLocaleString("en-US")}` },
            { id: "b", label: `吃进 ${qtyB}${cheap.unit}`, hint: `¥${(price * qtyB).toLocaleString("en-US")}` },
          ],
          meta: { productId: cheap.id, price, qtyS, qtyB },
        };
      },
    });
  }
  if (w.staff.sales) {
    options.push({
      id: "poach",
      can: true,
      make: () => ({
        kind: "event",
        eventId: "poach",
        title: "林昭在挖阿 May",
        body: "迅达开出更高的底薪。阿 May 把聊天记录转给了你，没说话。",
        choices: [
          { id: "raise", label: "加薪留下", hint: "立刻花 ¥2,000，日薪变高" },
          { id: "let", label: "祝她好", hint: "团队少一个人" },
          { id: "talk", label: "画个饼", hint: "一半留下，一半更难堪" },
        ],
        meta: {},
      }),
    });
  }
  if (warehouseUsed(w) > 0) {
    options.push({
      id: "leak",
      can: true,
      make: () => ({
        kind: "event",
        eventId: "leak",
        title: "仓库漏水",
        body: "出租屋那边的仓漏了。纸箱塌了一角，像你的现金流。",
        choices: [
          { id: "scrap", label: "抽检报废", hint: "主动扔掉约一成，心里有数" },
          { id: "dump", label: "折价内销", hint: "换回一点现金" },
          { id: "gamble", label: "赌没湿透", hint: "可能没事，也可能更惨" },
        ],
        meta: {},
      }),
    });
  }
  options.push({
    id: "fx",
    can: true,
    make: () => ({
      kind: "event",
      eventId: "fx",
      title: "银行问你锁不锁汇",
      body: `客户经理的语音很甜。此刻美元 ${w.usd.toFixed(2)}。锁三天，或者继续裸奔。`,
      choices: [
        { id: "lock", label: "锁上", hint: "三天内按这个汇率结" },
        { id: "float", label: "裸奔", hint: "你赌方向" },
      ],
      meta: {},
    }),
  });
  options.push({
    id: "booth",
    can: w.cash > 8000 && w.day % 5 !== 0,
    make: () => ({
      kind: "event",
      eventId: "booth",
      title: "展会摊位尾单",
      body: "主办方说有个边角摊位，今天转给你算便宜。去了，广交会好说话一点。",
      choices: [
        { id: "buy", label: "定下 ¥6,000", hint: "下一场大单更好谈" },
        { id: "skip", label: "不去凑热闹", hint: "钱留在卡里" },
      ],
      meta: {},
    }),
  });
  const sampleBuyer = BUYERS.filter((b) => w.rep >= b.unlockRep)[Math.floor(roll(w) * Math.max(1, BUYERS.filter((b) => w.rep >= b.unlockRep).length))];
  if (sampleBuyer && cheap) {
    options.push({
      id: "sample",
      can: true,
      make: () => {
        const cost = Math.round(cheap.baseCost * 8 + 420);
        return {
          kind: "event",
          eventId: "sample",
          title: "有人要样品",
          body: `${sampleBuyer.name} 没下单，先要一套 ${cheap.name} 样品。空运过去，像递名片。`,
          choices: [
            { id: "send", label: "寄", hint: `约 ¥${cost.toLocaleString("en-US")}` },
            { id: "no", label: "不寄", hint: "省钱，也省一段关系" },
          ],
          meta: { buyerId: sampleBuyer.id, cost, productId: cheap.id },
        };
      },
    });
  }
  if (cheap) {
    const dir = roll(w) < 0.5 ? 1 : -1;
    const truth = roll(w) < 0.68 ? 1 : 0;
    options.push({
      id: "rumor",
      can: true,
      make: () => ({
        kind: "event",
        eventId: "rumor",
        title: "行业群在传",
        body: `有人说 ${cheap.name} 要${dir > 0 ? "涨" : "跌"}。这种消息一半值钱，一半是情绪。`,
        choices: [
          { id: "buy", label: "跟一手", hint: "先吃进一批" },
          { id: "hold", label: "就看看", hint: "消息仍会发酵" },
          { id: "dump", label: "先清库存", hint: "如果你手里有货" },
        ],
        meta: { productId: cheap.id, dir, truth },
      }),
    });
  }
  options.push({
    id: "night",
    can: w.leads.length < 3 && w.hour >= 10 && w.hour < 18,
    make: () => ({
      kind: "event",
      eventId: "night",
      title: "很晚的语音",
      body: "一个没存备注的号码。对方说要现货，语气像已经熬过两个时区。",
      choices: [
        { id: "take", label: "接", hint: "塞进询盘，压力上来" },
        { id: "sleep", label: "当没看见", hint: "睡眠也是资产" },
      ],
      meta: {},
    }),
  });
  options.push({
    id: "audit",
    can: true,
    make: () => ({
      kind: "event",
      eventId: "audit",
      title: "外汇抽查",
      body: "一封很官方的邮件，要你解释预收货款。不回也会有人替你解释。",
      choices: [
        { id: "paper", label: "老实补材料", hint: "费神，但干净" },
        { id: "fix", label: "找人", hint: "¥2,000，省一个下午" },
        { id: "drag", label: "再拖拖", hint: "也许没事" },
      ],
      meta: {},
    }),
  });
  const pool = options.filter((o) => o.can);
  if (!pool.length) return null;
  const pick = pool[Math.floor(roll(w) * pool.length)];
  void ctx;
  return pick.make();
}

function applyEvent(w: World, ctx: Ctx, b: EventBlock, id: string): World {
  const meta = b.meta;
  if (b.eventId === "flash") {
    const product = productById(String(meta.productId));
    const price = Number(meta.price);
    const qty = id === "b" ? Number(meta.qtyB) : id === "s" ? Number(meta.qtyS) : 0;
    if (!qty) {
      log(w, "neutral", "清库存的电话你没接。");
      return w;
    }
    const cost = price * qty;
    if (qty * product.bulk > warehouseCap(w) - warehouseUsed(w) || w.cash < cost) {
      ctx.notes.push("想吃，但仓库或现金不允许。");
      buzz(ctx, "tension");
      log(w, "bad", "清库存单接不住。");
      return w;
    }
    const prev = w.inventory[product.id] ?? 0;
    const prevC = w.stockCost[product.id] ?? price;
    w.inventory[product.id] = prev + qty;
    w.stockCost[product.id] = Math.round(((prev * prevC + cost) / (prev + qty)) * 100) / 100;
    addCash(w, -cost);
    log(w, "gold", `低价吃进 ${product.name} ×${qty}。`);
    ctx.notes.push("库存到手");
    buzz(ctx, "coin");
    return w;
  }
  if (b.eventId === "poach") {
    if (id === "raise") {
      if (w.cash < 2000) {
        ctx.notes.push("加薪的钱没凑齐，她还是走了。");
        w.staff.sales = false;
        w.bumpSales = 0;
        buzz(ctx, "lose");
        return w;
      }
      addCash(w, -2000);
      w.bumpSales += 380;
      addRel(w, "linh", 0);
      log(w, "good", "阿 May 留下了。日薪悄悄变高。");
      ctx.notes.push("人留下来了");
      buzz(ctx, "notify");
      return w;
    }
    if (id === "let") {
      w.staff.sales = false;
      w.bumpSales = 0;
      bumpRep(w, -1, ctx);
      log(w, "bad", "阿 May 去了迅达。");
      buzz(ctx, "lose");
      return w;
    }
    if (roll(w) < 0.5) {
      log(w, "good", "饼画圆了。阿 May 说再看看。");
      w.stress = clamp(w.stress + 4, 0, 100);
      buzz(ctx, "click");
    } else {
      w.staff.sales = false;
      w.bumpSales = 0;
      w.stress = clamp(w.stress + 10, 0, 100);
      log(w, "bad", "饼破了。阿 May 走得很安静。");
      buzz(ctx, "lose");
    }
    return w;
  }
  if (b.eventId === "leak") {
    if (id === "scrap") {
      shrinkStock(w, 0.12, 0);
      log(w, "neutral", "报废了一部分受潮的货。");
      buzz(ctx, "click");
    } else if (id === "dump") {
      const got = liquidate(w, 0.22, 0.72);
      addCash(w, got);
      log(w, "neutral", `内销回笼 ¥${got.toLocaleString("en-US")}。`);
      buzz(ctx, "coin");
    } else if (roll(w) < 0.48) {
      log(w, "good", "纸箱只是吓你。货还干着。");
      buzz(ctx, "win");
    } else {
      shrinkStock(w, 0.28, 0);
      log(w, "bad", "赌输了。受潮的比你想的多。");
      buzz(ctx, "lose");
    }
    return w;
  }
  if (b.eventId === "fx") {
    if (id === "lock") {
      w.fxLock = 30;
      w.lockedUsd = w.usd;
      log(w, "gold", `锁汇 ${w.usd.toFixed(2)}，接下来几天心安一点。`);
      ctx.notes.push("汇率锁上了");
      buzz(ctx, "notify");
    } else {
      log(w, "neutral", "你选择继续跟汇率搏斗。");
    }
    return w;
  }
  if (b.eventId === "booth") {
    if (id === "buy" && w.cash >= 6000) {
      addCash(w, -6000);
      w.rep = clamp(w.rep + 2, 0, 100);
      log(w, "gold", "摊位定了。广交会你有个站的地方。");
      ctx.notes.push("摊位已定");
      // store as heat boost across markets slightly via rep already; add a temporary flag using fx? use heat
      for (const m of Object.keys(w.heat)) w.heat[m] = clamp((w.heat[m] ?? 0) + 0.08, -0.2, 0.5);
      buzz(ctx, "coin");
    } else if (id === "buy") {
      ctx.notes.push("六千块没凑齐。");
      buzz(ctx, "tension");
    } else {
      log(w, "neutral", "展会尾单你放过了。");
    }
    return w;
  }
  if (b.eventId === "sample") {
    const cost = Number(meta.cost);
    const buyerId = String(meta.buyerId);
    if (id === "send" && w.cash >= cost) {
      addCash(w, -cost);
      addRel(w, buyerId, 10);
      bumpRep(w, 1, ctx);
      log(w, "good", `样品寄给 ${buyerById(buyerId).name}。`);
      ctx.notes.push("样品在路上");
      buzz(ctx, "notify");
    } else if (id === "send") {
      ctx.notes.push("样品的运费也不够。");
      buzz(ctx, "tension");
    } else {
      addRel(w, buyerId, -2);
      log(w, "neutral", "样品的要求你回绝了。");
    }
    return w;
  }
  if (b.eventId === "rumor") {
    const product = productById(String(meta.productId));
    const dir = Number(meta.dir);
    const truth = Number(meta.truth) === 1;
    const move = truth ? dir * 0.12 : dir * -0.06;
    if (id === "buy") {
      const qty = Math.max(10, Math.round(product.qtyBase * 0.4));
      const unit = spotUnit(w, product.id);
      const cost = unit * qty;
      if (w.cash >= cost && qty * product.bulk <= warehouseCap(w) - warehouseUsed(w)) {
        const prev = w.inventory[product.id] ?? 0;
        const prevC = w.stockCost[product.id] ?? unit;
        w.inventory[product.id] = prev + qty;
        w.stockCost[product.id] = Math.round(((prev * prevC + cost) / (prev + qty)) * 100) / 100;
        addCash(w, -cost);
        log(w, "neutral", `跟着传言吃进 ${product.name}。`);
      } else {
        ctx.notes.push("想跟，仓或钱不允许。");
      }
    } else if (id === "dump") {
      const got = liquidateProduct(w, product.id, 1, 0.9);
      if (got > 0) {
        addCash(w, got);
        log(w, "neutral", `清掉 ${product.name}，回笼 ¥${got.toLocaleString("en-US")}。`);
        buzz(ctx, "coin");
      } else log(w, "neutral", "你没有这批货可清。");
    }
    w.priceMod[product.id] = clamp(round2((w.priceMod[product.id] ?? 1) * (1 + move)), 0.72, 1.45);
    log(w, truth ? "gold" : "bad", truth ? `${product.name} 的传言是真的。` : `${product.name} 的传言反向打脸。`);
    ctx.notes.push(truth ? "传言坐实" : "传言打脸");
    buzz(ctx, truth ? "notify" : "tension");
    return w;
  }
  if (b.eventId === "night") {
    if (id === "take") {
      w.stress = clamp(w.stress + 8, 0, 100);
      w = addLead(w, ctx, {});
      const lead = w.leads[w.leads.length - 1];
      if (lead) {
        lead.hot = true;
        lead.expireAbs = Math.min(lead.expireAbs, w.abs + 3);
      }
      log(w, "gold", "深夜询盘接住了。");
      ctx.notes.push("新询盘进邮箱");
      buzz(ctx, "notify");
    } else {
      w.stress = clamp(w.stress - 4, 0, 100);
      log(w, "neutral", "那个号码你没回。世界没有塌。");
    }
    return w;
  }
  if (b.eventId === "audit") {
    if (id === "paper") {
      w.stress = clamp(w.stress + 8, 0, 100);
      bumpRep(w, 1, ctx);
      log(w, "neutral", "材料补齐了。眼睛很酸。");
      buzz(ctx, "click");
    } else if (id === "fix" && w.cash >= 2000) {
      addCash(w, -2000);
      log(w, "neutral", "找人把外汇解释写完了。");
      buzz(ctx, "click");
    } else if (id === "fix") {
      ctx.notes.push("找人的预算没有。");
      buzz(ctx, "tension");
    } else if (roll(w) < 0.42) {
      addCash(w, -8000);
      addBook(w, -8000);
      bumpRep(w, -3, ctx);
      log(w, "bad", "拖出了一张罚单。");
      buzz(ctx, "lose");
    } else {
      log(w, "good", "抽查的邮件石沉大海。你赌对了一次。");
      buzz(ctx, "win");
    }
    return w;
  }
  return w;
}

function shrinkStock(w: World, ratio: number, _x: number) {
  for (const id of Object.keys(w.inventory)) {
    const q = w.inventory[id] ?? 0;
    const cut = Math.floor(q * ratio);
    w.inventory[id] = q - cut;
    if ((w.inventory[id] ?? 0) <= 0) delete w.inventory[id];
  }
}

function liquidate(w: World, ratio: number, priceMul: number): number {
  let got = 0;
  for (const id of Object.keys(w.inventory)) got += liquidateProduct(w, id, ratio, priceMul);
  return got;
}

function liquidateProduct(w: World, id: string, ratio: number, priceMul: number): number {
  const q = w.inventory[id] ?? 0;
  if (q <= 0) return 0;
  const cut = Math.max(1, Math.floor(q * ratio));
  const sold = Math.min(q, cut);
  const cost = w.stockCost[id] ?? productById(id).baseCost;
  w.inventory[id] = q - sold;
  if ((w.inventory[id] ?? 0) <= 0) delete w.inventory[id];
  const revenue = Math.round(sold * cost * priceMul);
  addBook(w, Math.round(revenue - sold * cost));
  return revenue;
}

const ACHIEVEMENTS: { id: string; label: string; ok: (w: World) => boolean }[] = [
  { id: "first", label: "成就：第一单", ok: (w) => w.deals >= 1 },
  { id: "s3", label: "成就：三连手感", ok: (w) => w.bestStreak >= 3 },
  { id: "s7", label: "成就：七连传说", ok: (w) => w.bestStreak >= 7 },
  { id: "c200", label: "成就：现金二十万", ok: (w) => w.cash >= 200000 },
  { id: "c1m", label: "成就：百万在账", ok: (w) => w.cash >= 1000000 },
  { id: "d10", label: "成就：活过一旬", ok: (w) => w.day >= 10 },
  { id: "d30", label: "成就：老口岸", ok: (w) => w.day >= 30 },
  { id: "claim", label: "成就：投诉翻盘", ok: (w) => w.claimWins >= 1 },
  { id: "dead", label: "成就：死里逃生", ok: (w) => w.nearDeath && w.cash >= 80000 },
  { id: "bad", label: "成就：吃过坏账", ok: (w) => w.defaults >= 1 },
  { id: "week", label: "成就：圈子周冠", ok: (w) => w.weekWins >= 1 },
  { id: "team", label: "成就：三人成行", ok: (w) => w.staff.sales && w.staff.ops && w.staff.customs },
  { id: "office", label: "成就：写字楼灯火", ok: (w) => w.office === 2 },
  { id: "fair", label: "成就：广交会赢家", ok: (w) => w.fairWins >= 1 },
  { id: "clean", label: "成就：五票完美交期", ok: (w) => w.cleanStreak >= 5 },
];

function harvest(w: World): string[] {
  const out: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (!w.achievements.includes(a.id) && a.ok(w)) {
      w.achievements.push(a.id);
      out.push(a.label);
    }
  }
  if (w.nearDeath && w.cash >= 80000) w.escaped = true;
  return out;
}

export function spotLots(w: World, productId: string): number[] {
  const p = productById(productId);
  const small = Math.max(10, Math.round(p.qtyBase * 0.25));
  const big = small * 3;
  return [small, big];
}

