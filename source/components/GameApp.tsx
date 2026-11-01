import { clsx } from "clsx";
import {
  Anchor,
  BadgeCheck,
  Briefcase,
  Coffee,
  Flame,
  Landmark,
  Music,
  Newspaper,
  Plane,
  RotateCcw,
  Ship,
  TrainFront,
  VolumeX,
  Warehouse,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { audio } from "@/game/audio";
import {
  LOGI_LABEL,
  OFFICES,
  PAY_LABEL,
  PERSONALITY_LABEL,
  PRODUCTS,
  STANCES,
  STAFF,
  buyerById,
  productById,
  titleFor,
} from "@/game/content";
import { cny, cnySigned, etaText, usd, weekday } from "@/game/format";
import {
  act,
  chaseLine,
  creditLimit,
  effectiveUsd,
  goalProgress,
  levelOf,
  newGame,
  payrollOf,
  previewQuote,
  spotLots,
  spotUnit,
  verifyFee,
  warehouseCap,
  warehouseUsed,
} from "@/game/sim";
import type { Action, Logistics, Meta, QuoteChoice, SfxName, StaffRole, World } from "@/game/types";

const SAVE_KEY = "yehgang-v1";

const EMPTY_META: Meta = { bestDay: 0, bestCash: 0, bestBook: 0, bestStreak: 0, runs: 0, legacy: 0 };

function loadMeta(): Meta {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return EMPTY_META;
    const parsed = JSON.parse(raw) as { meta?: Meta };
    return { ...EMPTY_META, ...parsed.meta };
  } catch {
    return EMPTY_META;
  }
}

function loadWorld(): World | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { world?: World };
    if (!parsed.world || parsed.world.v !== 1) return null;
    return parsed.world;
  } catch {
    return null;
  }
}

function persist(world: World | null, meta: Meta) {
  localStorage.setItem(SAVE_KEY, JSON.stringify({ world, meta }));
}

function legacyOf(w: World): number {
  let n = 0;
  if (w.day >= 6) n += 2;
  if (w.day >= 12) n += 2;
  if (w.rep >= 40) n += 2;
  if (w.weekWins >= 1) n += 2;
  return Math.min(8, n);
}

export function GameApp() {
  const [meta, setMeta] = useState<Meta>(EMPTY_META);
  const [world, setWorld] = useState<World | null>(null);
  const [booted, setBooted] = useState(false);
  const [toasts, setToasts] = useState<string[]>([]);
  const [shake, setShake] = useState(false);
  const [ledger, setLedger] = useState(false);
  const [musicOn, setMusicOn] = useState(true);

  useEffect(() => {
    setMeta(loadMeta());
    setWorld(loadWorld());
    setBooted(true);
    window.__ready = true;
  }, []);

  function pushToasts(list: string[]) {
    if (!list.length) return;
    setToasts((t) => [...list, ...t].slice(0, 4));
    window.setTimeout(() => setToasts((t) => t.slice(0, Math.max(0, t.length - list.length))), 2800);
  }

  function commit(next: World, notes: string[], sfx?: SfxName) {
    const nextMeta: Meta = {
      ...meta,
      bestDay: Math.max(meta.bestDay, next.day),
      bestCash: Math.max(meta.bestCash, next.cash),
      bestBook: Math.max(meta.bestBook, next.totalBook),
      bestStreak: Math.max(meta.bestStreak, next.bestStreak),
      legacy: next.gameOver ? legacyOf(next) : meta.legacy,
    };
    setWorld(next);
    setMeta(nextMeta);
    persist(next, nextMeta);
    if (sfx) audio.play(sfx);
    if (sfx === "lose") {
      setShake(true);
      window.setTimeout(() => setShake(false), 420);
    }
    pushToasts(notes);
  }

  const worldRef = useRef<World | null>(null);
  worldRef.current = world;

  function dispatch(action: Action) {
    const current = worldRef.current;
    if (!current) return;
    const res = act(current, action);
    worldRef.current = res.world;
    commit(res.world, res.toasts, res.sfx);
  }

  function start(name: string) {
    audio.unlock();
    const w = newGame(name, meta.legacy);
    const nextMeta = { ...meta, runs: meta.runs + 1, legacy: 0 };
    setMeta(nextMeta);
    setWorld(w);
    persist(w, nextMeta);
    setLedger(false);
  }

  if (!booted) {
    return (
      <main className="grid min-h-dvh place-items-center bg-harbor text-foam">
        <p className="font-serif text-3xl">夜港外贸</p>
      </main>
    );
  }

  if (!world) {
    return (
      <TitleScreen
        meta={meta}
        musicOn={musicOn}
        onMusic={() => {
          const next = !musicOn;
          audio.musicOn = next;
          audio.unlock();
          audio.setMusic(next);
          setMusicOn(next);
        }}
        onStart={start}
      />
    );
  }

  return (
    <div className={clsx("relative flex h-dvh flex-col overflow-hidden bg-harbor text-foam", shake && "shake")}>
      <div className="harbor-bg pointer-events-none absolute inset-0 opacity-50" />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <Header
          world={world}
          musicOn={musicOn}
          onLedger={() => setLedger(true)}
          onMusic={() => {
            const next = !musicOn;
            audio.musicOn = next;
            audio.unlock();
            audio.setMusic(next);
            setMusicOn(next);
          }}
        />
        <Ticker world={world} />
        <p className="px-3 py-1 text-sm text-brass">{chaseLine(world)}</p>
        <div className="grid min-h-0 flex-1 lg:grid-cols-[232px_minmax(0,1fr)_270px]">
          <aside className="hidden overflow-y-auto border-r border-line px-3 py-3 lg:block">
            <SideFacts world={world} />
          </aside>
          <main className="min-h-0 overflow-y-auto px-3 pb-8">
            <Stage world={world} onAct={dispatch} onRestart={() => {
              const next = { ...meta, legacy: Math.max(meta.legacy, legacyOf(world)) };
              setMeta(next);
              setWorld(null);
              persist(null, next);
              setLedger(false);
            }} />
          </main>
          <aside className="hidden overflow-y-auto border-l border-line px-3 py-3 lg:block">
            <Pipeline world={world} onAct={dispatch} />
          </aside>
        </div>
        <div className="flex gap-2 overflow-x-auto border-t border-line px-3 py-2 lg:hidden">
          <PipelineChips world={world} onAct={dispatch} />
        </div>
      </div>
      {ledger && <Ledger world={world} onAct={dispatch} onClose={() => setLedger(false)} onAbandon={() => {
        const next = { ...meta, legacy: Math.max(meta.legacy, legacyOf(world)) };
        setMeta(next);
        setWorld(null);
        persist(null, next);
        setLedger(false);
      }} />}
      <div className="pointer-events-none fixed inset-x-0 top-16 z-50 flex flex-col items-center gap-2">
        {toasts.map((t, i) => (
          <div key={`${t}-${i}`} className="rise rounded-full bg-paper px-4 py-2 text-sm text-paper-ink shadow">
            {t}
          </div>
        ))}
      </div>
    </div>
  );
}

declare global {
  interface Window {
    __ready?: boolean;
  }
}

function TitleScreen({
  meta,
  musicOn,
  onMusic,
  onStart,
}: {
  meta: Meta;
  musicOn: boolean;
  onMusic: () => void;
  onStart: (name: string) => void;
}) {
  const [name, setName] = useState("");
  return (
    <main className="title-scrim relative grid min-h-dvh place-items-end sm:place-items-center">
      <div className="rise w-full max-w-xl px-5 pb-10 sm:px-8">
        <p className="text-sm tracking-widest text-brass">南港市 · 虚构口岸</p>
        <h1 className="mt-2 font-serif text-5xl font-bold text-foam sm:text-6xl">夜港外贸</h1>
        <p className="mt-3 max-w-md text-base leading-relaxed text-foam">
          现金比订单重要，订单比睡眠重要。从一间出租屋报价，活到广交会。
        </p>
        <label className="mt-6 block text-sm text-mist" htmlFor="boss-name">
          你的名字
        </label>
        <input
          id="boss-name"
          value={name}
          placeholder="陈屿"
          maxLength={8}
          onChange={(e) => setName(e.target.value)}
          className="mt-2 w-full rounded-xl border border-line bg-dock px-4 py-3 text-foam placeholder:text-mist"
        />
        <div className="mt-4 flex flex-wrap gap-3">
          <Btn tone="brass" onClick={() => onStart(name)}>
            <Anchor className="size-4" />
            开业
          </Btn>
          <Btn tone="ghost" onClick={onMusic}>
            {musicOn ? <Music className="size-4" /> : <VolumeX className="size-4" />}
            {musicOn ? "音乐开着" : "音乐关掉"}
          </Btn>
        </div>
        <p className="mt-4 text-sm text-mist">点开业才会响。港风循环，戴耳机更上头。</p>
        {meta.runs > 0 && (
          <p className="mt-3 text-sm text-foam">
            最好撑到第 {meta.bestDay} 天 · 最高现金 {cny(meta.bestCash)}
            {meta.legacy > 0 ? ` · 名声残留 +${meta.legacy}` : ""}
          </p>
        )}
      </div>
    </main>
  );
}

function Header({
  world,
  musicOn,
  onLedger,
  onMusic,
}: {
  world: World;
  musicOn: boolean;
  onLedger: () => void;
  onMusic: () => void;
}) {
  return (
    <header className="flex items-center gap-3 border-b border-line px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="truncate font-serif text-lg text-foam">{world.company}</p>
          <span className="text-xs text-mist">
            Lv.{levelOf(world)} {titleFor(world.rep)}
          </span>
        </div>
        <p className="text-xs text-mist">
          第 {world.day} 天 周{weekday(world.day)} · {world.hour}:00
          {world.streak >= 2 ? ` · 连胜 ${world.streak}` : ""}
        </p>
      </div>
      <div className="text-right">
        <p className="num text-lg font-bold text-brass">{cny(world.cash)}</p>
        <p className="text-xs text-mist">美元 {effectiveUsd(world).toFixed(2)}{world.fxLock > 0 ? " 锁" : ""}</p>
      </div>
      <button type="button" className="grid size-11 place-items-center rounded-full border border-line" onClick={onMusic} aria-label="音乐">
        {musicOn ? <Music className="size-4" /> : <VolumeX className="size-4" />}
      </button>
      <Btn tone="dock" onClick={onLedger}>
        <Landmark className="size-4" />
        账房
      </Btn>
    </header>
  );
}

function Ticker({ world }: { world: World }) {
  const items = useMemo(() => {
    const bits = PRODUCTS.filter((p) => world.rep >= p.unlockRep).map(
      (p) => `${p.name} ¥${spotUnit(world, p.id)}`,
    );
    bits.push(`USD ${world.usd.toFixed(2)}`);
    bits.push(world.news.headline);
    return bits;
  }, [world]);
  const row = [...items, ...items];
  return (
    <div className="overflow-hidden border-b border-line bg-dock/80 py-1">
      <div className="ticker-track flex w-max gap-8 px-4 text-xs text-mist">
        {row.map((item, i) => (
          <span key={`${item}-${i}`} className="flex items-center gap-2">
            <Newspaper className="size-3 text-brass" />
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function SideFacts({ world }: { world: World }) {
  const goalNow = goalProgress(world);
  const pct = world.goal.target <= 0 ? 1 : Math.max(0, Math.min(1, goalNow / world.goal.target));
  return (
    <div className="space-y-4">
      <section>
        <p className="text-xs text-mist">今日目标</p>
        <p className="mt-1 text-sm">{world.goal.label}</p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
          <div className="h-full bg-brass" style={{ width: `${pct * 100}%` }} />
        </div>
        <p className="mt-1 text-xs text-mist">
          达成奖 {cny(world.goal.reward)}
        </p>
      </section>
      <section className="grid grid-cols-2 gap-2 text-sm">
        <Stat k="信誉" v={`${world.rep}`} />
        <Stat k="压力" v={`${world.stress}`} hot={world.stress > 75} />
        <Stat k="今日毛利" v={cny(world.dayBook)} />
        <Stat k="本周毛利" v={cny(world.weekBook)} />
      </section>
      <section>
        <p className="text-xs text-mist">圈子</p>
        {[{ name: world.name, book: world.weekBook, you: true }, ...world.rivals.map((r) => ({ name: r.name, book: r.book, you: false }))]
          .sort((a, b) => b.book - a.book)
          .map((r) => (
            <div key={r.name} className="mt-1 flex justify-between text-sm">
              <span className={r.you ? "text-brass" : "text-mist"}>{r.you ? "你" : r.name}</span>
              <span className="num">{cny(r.book)}</span>
            </div>
          ))}
      </section>
      <section>
        <p className="text-xs text-mist">团队 · 日薪 {cny(payrollOf(world))}</p>
        <p className="mt-1 text-sm">
          {(Object.keys(STAFF) as StaffRole[]).map((k) => (world.staff[k] ? STAFF[k].who : null)).filter(Boolean).join(" · ") || "还是你一个人"}
        </p>
      </section>
    </div>
  );
}

function Stat({ k, v, hot }: { k: string; v: string; hot?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-dock px-2 py-2">
      <p className="text-xs text-mist">{k}</p>
      <p className={clsx("num text-sm", hot ? "text-coral" : "text-foam")}>{v}</p>
    </div>
  );
}

function Stage({ world, onAct, onRestart }: { world: World; onAct: (a: Action) => void; onRestart: () => void }) {
  const b = world.blocker;
  if (!b) return <Quiet world={world} onAct={onAct} line="口岸暂时没人找你。" />;
  if (b.kind === "lead") return <Deal world={world} leadId={b.leadId} onAct={onAct} />;
  if (b.kind === "result") return <ResultView world={world} onAct={onAct} />;
  if (b.kind === "event" || b.kind === "ship") {
    return (
      <ChoiceCard
        kicker={b.kind === "ship" ? "在途" : "口岸"}
        title={b.title}
        body={b.body}
        choices={b.choices}
        onPick={(id) => onAct(b.kind === "ship" ? { t: "ship", id } : { t: "event", id })}
      />
    );
  }
  if (b.kind === "quiet") return <Quiet world={world} onAct={onAct} line={b.line} />;
  if (b.kind === "closing") return <Closing world={world} onAct={onAct} />;
  if (b.kind === "dayend" || b.kind === "rescue") {
    const report = b.report;
    return <DayEnd world={world} report={report} rescue={b.kind === "rescue" ? b.need : 0} onAct={onAct} />;
  }
  return <GameOver world={world} onRestart={onRestart} />;
}

function Deal({ world, leadId, onAct }: { world: World; leadId: string; onAct: (a: Action) => void }) {
  const lead = world.leads.find((l) => l.id === leadId);
  const [stance, setStance] = useState(2);
  const [supplierId, setSupplierId] = useState(lead?.suppliers[1]?.id ?? lead?.suppliers[0]?.id ?? "old");
  const [logistics, setLogistics] = useState<Logistics>("sea");
  const [useStock, setUseStock] = useState(false);
  const [pushPay, setPushPay] = useState(false);

  useEffect(() => {
    setStance(2);
    setSupplierId(lead?.suppliers[1]?.id ?? "old");
    setLogistics("sea");
    setUseStock(false);
    setPushPay(false);
  }, [leadId]);

  const choice: QuoteChoice = { stance, supplierId, logistics, useStock, pushPay };
  const preview = lead ? previewQuote({ ...world, blocker: { kind: "lead", leadId } }, choice) : null;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return;
      const n = Number(e.key);
      if (n >= 1 && n <= 5) setStance(n - 1);
      if (e.key === "Enter" && preview?.canAfford) onAct({ t: "quote", ...choice });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!lead || !preview) {
    return (
      <Paper>
        <p>这单已经不在邮箱里。</p>
        <Btn tone="brass" onClick={() => onAct({ t: "idle" })}>让时间走</Btn>
      </Paper>
    );
  }
  const buyer = buyerById(lead.buyerId);
  const product = productById(lead.productId);
  const stock = world.inventory[product.id] ?? 0;
  const hours = Math.max(0, lead.expireAbs - world.abs);
  const fee = verifyFee(world, lead);

  return (
    <Paper>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-mist">
            {lead.fair ? "广交会" : lead.hot ? "急询盘" : "询盘"} · 还剩 {hours} 小时
          </p>
          <h2 className="font-serif text-2xl text-paper-ink">{buyer.name}</h2>
          <p className="text-sm text-paper-ink/80">{buyer.country} · {PERSONALITY_LABEL[buyer.personality]} · {PAY_LABEL[buyer.pay]}</p>
        </div>
        <span className="rounded-full border border-paper-ink/20 px-2 py-1 text-xs text-paper-ink">{buyer.country}</span>
      </div>
      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-paper-ink/80">{buyer.blurb}</p>
      <p className="mt-3 text-lg text-paper-ink">
        {product.name} <span className="num">× {lead.qty.toLocaleString("en-US")}</span> {product.unit}
      </p>
      {lead.tutorial && (
        <p className="mt-2 rounded-xl bg-brass/30 px-3 py-2 text-sm text-paper-ink">
          便签：先看「立刻现金」。利润可以是以后的，货款往往要现在垫。
        </p>
      )}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-mist">经济利润</p>
          <p className={clsx("num text-2xl font-bold", preview.profit >= 0 ? "text-jade" : "text-coral")}>{cny(preview.profit)}</p>
        </div>
        <div>
          <p className="text-xs text-mist">立刻现金</p>
          <p className={clsx("num text-2xl font-bold", preview.cashNow >= 0 ? "text-jade" : "text-coral")}>{cnySigned(preview.cashNow)}</p>
        </div>
      </div>
      <p className="mt-1 text-sm text-paper-ink/70">{preview.laterNote}</p>
      <p className="mt-3 text-xs text-mist">报价档位 · 键盘 1-5</p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {STANCES.map((s, i) => (
          <button
            key={s.name}
            type="button"
            onClick={() => setStance(i)}
            className={clsx(
              "min-h-11 rounded-xl border px-2 py-2 text-sm",
              stance === i ? "border-brass bg-brass text-ink" : "border-paper-ink/15 bg-paper text-paper-ink",
            )}
          >
            {s.name}
            <span className="mt-1 block text-xs opacity-70">{usd(round2(lead.fairUsd * s.mul))}</span>
          </button>
        ))}
      </div>
      <p className="mt-4 text-xs text-mist">工厂</p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {lead.suppliers.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSupplierId(s.id)}
            className={clsx(
              "min-h-11 rounded-xl border px-2 py-2 text-left",
              supplierId === s.id ? "border-brass bg-brass/20" : "border-paper-ink/15",
            )}
          >
            <span className="block text-sm text-paper-ink">{s.label}</span>
            <span className="block text-xs text-paper-ink/70">{s.note}</span>
            <span className="num mt-1 block text-xs text-paper-ink">
              {lead.verified ? `¥${s.mid.toFixed(2)}` : `¥${s.min.toFixed(0)}–${s.max.toFixed(0)}`}
            </span>
            <span className="block text-xs text-paper-ink/60">{lead.verified ? `品控 ${Math.round(s.quality * 100)}` : "品控未知"}</span>
          </button>
        ))}
      </div>
      {!lead.verified && (
        <div className="mt-2">
          <Btn tone="ink" disabled={world.cash < fee} onClick={() => onAct({ t: "verify" })}>
            <BadgeCheck className="size-4" />
            验厂 {cny(fee)}{world.staff.ops ? " · 老周折扣" : ""}
          </Btn>
        </div>
      )}
      <p className="mt-4 text-xs text-mist">物流</p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {(["sea", "rail", "air"] as Logistics[]).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLogistics(l)}
            className={clsx(
              "min-h-11 rounded-xl border px-2 py-2 text-sm",
              logistics === l ? "border-brass bg-brass text-ink" : "border-paper-ink/15 text-paper-ink",
            )}
          >
            <span className="flex items-center justify-center gap-1">
              {l === "sea" ? <Ship className="size-4" /> : l === "rail" ? <TrainFront className="size-4" /> : <Plane className="size-4" />}
              {LOGI_LABEL[l]}
            </span>
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {buyer.pay !== "TT100" && (
          <Toggle on={pushPay} onClick={() => setPushPay((v) => !v)} label="争取更稳的账期" />
        )}
        {stock >= lead.qty && (
          <Toggle on={useStock} onClick={() => setUseStock((v) => !v)} label={`走库存 ${stock}${product.unit}`} />
        )}
      </div>
      <div className="mt-4">
        <div className="mb-1 flex justify-between text-xs text-paper-ink/70">
          <span>把握</span>
          <span>{preview.closeWord}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-paper-ink/10">
          <div className="h-full bg-jade" style={{ width: `${preview.close * 100}%` }} />
        </div>
        {preview.warn && <p className="mt-2 text-sm text-coral">{preview.warn}</p>}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Btn tone="brass" disabled={!preview.canAfford} onClick={() => onAct({ t: "quote", stance, supplierId, logistics, useStock, pushPay })}>
          发出报价
        </Btn>
        <Btn tone="line" onClick={() => onAct({ t: "pass" })}>这单不做</Btn>
      </div>
      <p className="mt-2 text-xs text-paper-ink/50">报价 {usd(preview.unitUsd)} · {preview.stanceName} · {preview.pay === buyer.pay ? PAY_LABEL[preview.pay] : `改成 ${PAY_LABEL[preview.pay]}`} · {etaText(preview.eta)}</p>
    </Paper>
  );
}

function ResultView({ world, onAct }: { world: World; onAct: (a: Action) => void }) {
  const b = world.blocker;
  if (b?.kind !== "result") return null;
  const lead = b.leadId ? world.leads.find((l) => l.id === b.leadId) : undefined;
  let counterProfit = "";
  if (b.outcome === "counter" && lead && b.counterUsd != null) {
    const pv = previewQuote(
      { ...world, blocker: { kind: "lead", leadId: lead.id } },
      {
        stance: b.stance ?? 2,
        supplierId: b.supplierId ?? lead.suppliers[0].id,
        logistics: b.logistics ?? "sea",
        useStock: !!b.useStock,
        pushPay: !!b.pushPay,
      },
    );
    if (pv) {
      const rebuilt = previewAt(world, lead.id, b);
      counterProfit = rebuilt;
    }
  }
  return (
    <Paper>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-mist">{b.outcome === "win" ? "PI 已回签" : b.outcome === "counter" ? "还价" : "黄了"}</p>
          <h2 className="font-serif text-3xl text-paper-ink">{b.title}</h2>
        </div>
        {b.outcome === "win" && <span className="stamp border-2 border-coral px-2 py-1 font-serif text-xl text-coral">成交</span>}
      </div>
      <p className="mt-3 text-lg text-paper-ink">{b.body}</p>
      {b.outcome === "counter" && <p className="mt-2 text-sm text-paper-ink">{counterProfit}</p>}
      <p className="mt-3 text-sm leading-relaxed text-paper-ink/80">{b.quip}</p>
      {world.streak >= 2 && b.outcome === "win" && (
        <p className="mt-3 flex items-center gap-1 text-brass">
          <Flame className="size-4" /> 连胜 {world.streak}
        </p>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
        {b.outcome === "counter" ? (
          <>
            <Btn tone="brass" onClick={() => onAct({ t: "takeCounter" })}>接受还价</Btn>
            {!b.receded && <Btn tone="ink" onClick={() => onAct({ t: "recede" })}>再让半档</Btn>}
            <Btn tone="line" onClick={() => onAct({ t: "walk" })}>不干了</Btn>
          </>
        ) : (
          <Btn tone="brass" onClick={() => onAct({ t: "next" })}>{b.outcome === "win" ? "下一小时" : "咽下去，下一小时"}</Btn>
        )}
      </div>
    </Paper>
  );
}

function previewAt(world: World, leadId: string, b: Extract<World["blocker"], { kind: "result" }>): string {
  const fake = { ...world, blocker: { kind: "lead" as const, leadId } };
  const choice: QuoteChoice = {
    stance: b.stance ?? 2,
    supplierId: b.supplierId ?? "old",
    logistics: b.logistics ?? "sea",
    useStock: !!b.useStock,
    pushPay: !!b.pushPay,
  };
  const pv = previewQuote(fake, choice);
  if (!pv || b.counterUsd == null) return "";
  const ratio = b.counterUsd / Math.max(0.01, pv.unitUsd);
  const profit = Math.round(pv.profit * ratio - pv.revenue * (1 - ratio));
  return `按还价，经济利润大约 ${cny(profit)}。接受就是成交。`;
}

function ChoiceCard({
  kicker,
  title,
  body,
  choices,
  onPick,
}: {
  kicker: string;
  title: string;
  body: string;
  choices: { id: string; label: string; hint: string }[];
  onPick: (id: string) => void;
}) {
  return (
    <Paper>
      <p className="text-xs text-mist">{kicker}</p>
      <h2 className="font-serif text-2xl text-paper-ink">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-paper-ink/80">{body}</p>
      <div className="mt-4 grid gap-2">
        {choices.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onPick(c.id)}
            className="min-h-11 rounded-xl border border-paper-ink/15 px-3 py-3 text-left hover:border-brass"
          >
            <span className="block text-sm font-medium text-paper-ink">{c.label}</span>
            <span className="block text-xs text-paper-ink/60">{c.hint}</span>
          </button>
        ))}
      </div>
    </Paper>
  );
}

function Quiet({ world, onAct, line }: { world: World; onAct: (a: Action) => void; line: string }) {
  return (
    <Paper>
      <p className="text-xs text-mist">{world.hour}:00 · 空档</p>
      <h2 className="font-serif text-2xl text-paper-ink">这小时很安静</h2>
      <p className="mt-2 text-sm text-paper-ink/80">{line}</p>
      {world.leads.length > 0 && (
        <div className="mt-4 grid gap-2">
          {world.leads.map((l) => {
            const buyer = buyerById(l.buyerId);
            const product = productById(l.productId);
            return (
              <button key={l.id} type="button" onClick={() => onAct({ t: "open", leadId: l.id })} className="min-h-11 rounded-xl border border-paper-ink/15 px-3 py-2 text-left">
                <span className="block text-sm text-paper-ink">{buyer.name} · {product.name} ×{l.qty}</span>
                <span className="text-xs text-paper-ink/60">还剩 {Math.max(0, l.expireAbs - world.abs)} 小时</span>
              </button>
            );
          })}
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Btn tone="brass" onClick={() => onAct({ t: "prospect" })}>主动出击</Btn>
        <Btn tone="ink" onClick={() => onAct({ t: "idle" })}>让这小时过去</Btn>
        {world.hour >= 12 && <Btn tone="line" onClick={() => onAct({ t: "sleep" })}>提前收工</Btn>}
      </div>
    </Paper>
  );
}

function Closing({ world, onAct }: { world: World; onAct: (a: Action) => void }) {
  return (
    <Paper>
      <p className="text-xs text-mist">打烊</p>
      <h2 className="font-serif text-2xl text-paper-ink">灯还关不关</h2>
      <p className="mt-2 text-sm text-paper-ink/80">
        今天毛利 {cny(world.dayBook)}，现金 {cny(world.cash)}。加班会更累，也可能多一单。
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Btn tone="brass" onClick={() => onAct({ t: "sleep" })}>收工</Btn>
        {!world.overtimeOn && (
          <Btn tone="ink" onClick={() => onAct({ t: "overtime" })}>加班三个小时</Btn>
        )}
      </div>
    </Paper>
  );
}

function DayEnd({
  world,
  report,
  rescue,
  onAct,
}: {
  world: World;
  report: import("@/game/types").DayReport;
  rescue: number;
  onAct: (a: Action) => void;
}) {
  return (
    <Paper>
      <p className="text-xs text-mist">第 {world.day} 天打烊</p>
      <h2 className="font-serif text-2xl text-paper-ink">今日现金流</h2>
      <p className={clsx("num text-4xl font-bold", report.net >= 0 ? "text-jade" : "text-coral")}>{cnySigned(report.net)}</p>
      <p className="text-sm text-paper-ink/70">账面毛利 {cny(report.book)}</p>
      <ul className="mt-3 space-y-1 text-sm text-paper-ink">
        <li className="flex justify-between"><span>进账</span><span className="num">{cny(report.incoming)}</span></li>
        <li className="flex justify-between"><span>垫付</span><span className="num">{cny(report.outgoing)}</span></li>
        <li className="flex justify-between"><span>房租</span><span className="num">{cny(report.rent)}</span></li>
        <li className="flex justify-between"><span>工资</span><span className="num">{cny(report.payroll)}</span></li>
        <li className="flex justify-between"><span>利息</span><span className="num">{cny(report.interest)}</span></li>
      </ul>
      <p className={clsx("mt-3 text-sm", report.goalHit ? "text-jade" : "text-coral")}>
        {report.goalHit ? `目标达成，奖金 ${cny(report.reward)}` : `目标没达到：${report.goalLabel}`}
      </p>
      {report.weekEnd && (
        <p className="mt-2 text-sm text-paper-ink">
          {report.weekWin ? `本周圈子第一，奖金 ${cny(report.weekBonus)}` : "本周毛利没压过圈子。"}
        </p>
      )}
      <div className="mt-3 rounded-xl bg-brass/25 px-3 py-3 text-sm text-paper-ink">{report.hook}</div>
      {rescue > 0 ? (
        <div className="mt-4">
          <p className="text-sm text-coral">现金断了。拆借 {cny(rescue)} 可以续命，利息每晚来。</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Btn tone="coral" onClick={() => onAct({ t: "rescue", take: true })}>拆借续命</Btn>
            <Btn tone="line" onClick={() => onAct({ t: "rescue", take: false })}>就此注销</Btn>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <Btn tone="brass" onClick={() => onAct({ t: "morning" })}>进入下一天</Btn>
        </div>
      )}
    </Paper>
  );
}

function GameOver({ world, onRestart }: { world: World; onRestart: () => void }) {
  const b = world.blocker;
  if (b?.kind !== "gameover") return null;
  return (
    <Paper>
      <p className="text-xs text-coral">注销</p>
      <h2 className="font-serif text-3xl text-paper-ink">公司没了</h2>
      <p className="mt-2 text-sm leading-relaxed text-paper-ink/80">{b.reason}</p>
      <p className="mt-3 text-sm text-paper-ink">撑了 {b.days} 天 · 累计毛利 {cny(b.book)} · 连胜最高 {world.bestStreak}</p>
      <p className="mt-2 text-sm text-paper-ink/70">名声会留下一点。下次开业，起步略容易。</p>
      <div className="mt-4">
        <Btn tone="brass" onClick={onRestart}>
          <RotateCcw className="size-4" />
          再开一家
        </Btn>
      </div>
    </Paper>
  );
}

function Pipeline({ world, onAct }: { world: World; onAct: (a: Action) => void }) {
  return (
    <div className="space-y-4 text-sm">
      <section>
        <p className="text-xs text-mist">询盘</p>
        {world.leads.length === 0 && <p className="mt-1 text-mist">空的</p>}
        {world.leads.map((l) => (
          <button key={l.id} type="button" className="mt-2 block w-full text-left" onClick={() => onAct({ t: "open", leadId: l.id })}>
            <span className="block">{buyerById(l.buyerId).name}</span>
            <span className="text-xs text-mist">{productById(l.productId).name} · {Math.max(0, l.expireAbs - world.abs)}h</span>
          </button>
        ))}
      </section>
      <section>
        <p className="text-xs text-mist">在途</p>
        {world.shipments.length === 0 && <p className="mt-1 text-mist">没有货在海上</p>}
        {world.shipments.map((s) => (
          <p key={s.id} className="mt-2">
            {LOGI_LABEL[s.logistics]} · {productById(s.productId).name}
            <span className="block text-xs text-mist">{etaText(s.arriveAbs - world.abs)}</span>
          </p>
        ))}
      </section>
      <section>
        <p className="text-xs text-mist">应收</p>
        {world.ar.length === 0 && <p className="mt-1 text-mist">没有人欠你</p>}
        {world.ar.map((a) => (
          <p key={a.id} className="mt-2">
            {usd(a.usd)} · {buyerById(a.buyerId).name}
            <span className="block text-xs text-mist">{a.note} · {Math.max(0, a.dueAbs - world.abs)}h</span>
          </p>
        ))}
      </section>
      <section>
        <p className="text-xs text-mist">仓库 {warehouseUsed(world)}/{warehouseCap(world)}</p>
        {PRODUCTS.filter((p) => (world.inventory[p.id] ?? 0) > 0).map((p) => (
          <p key={p.id} className="mt-1">{p.name} ×{world.inventory[p.id]}</p>
        ))}
      </section>
      <section>
        <p className="text-xs text-mist">最近</p>
        {world.log.slice(0, 6).map((l) => (
          <p key={l.id} className={clsx("mt-1 text-xs", l.tone === "bad" ? "text-coral" : l.tone === "good" || l.tone === "gold" ? "text-foam" : "text-mist")}>{l.text}</p>
        ))}
      </section>
    </div>
  );
}

function PipelineChips({ world, onAct }: { world: World; onAct: (a: Action) => void }) {
  if (!world.leads.length && !world.shipments.length && !world.ar.length) {
    return <span className="text-xs text-mist">没有在途，也没有人欠你</span>;
  }
  return (
    <>
      {world.leads.map((l) => (
        <button key={l.id} type="button" onClick={() => onAct({ t: "open", leadId: l.id })} className="shrink-0 rounded-full border border-line px-3 py-2 text-xs">
          {buyerById(l.buyerId).name} · {Math.max(0, l.expireAbs - world.abs)}h
        </button>
      ))}
      {world.shipments.map((s) => (
        <span key={s.id} className="shrink-0 rounded-full border border-line px-3 py-2 text-xs text-mist">
          {productById(s.productId).name} {etaText(s.arriveAbs - world.abs)}
        </span>
      ))}
    </>
  );
}

function Ledger({
  world,
  onAct,
  onClose,
  onAbandon,
}: {
  world: World;
  onAct: (a: Action) => void;
  onClose: () => void;
  onAbandon: () => void;
}) {
  const [sure, setSure] = useState(false);
  const nextOffice = world.office < 2 ? OFFICES[world.office + 1] : null;
  const busy = world.blocker && world.blocker.kind !== "quiet" && world.blocker.kind !== "closing";
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-harbor/70">
      <div className="h-full w-full max-w-md overflow-y-auto bg-dock px-4 py-4 text-foam">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-2xl">账房</h2>
          <button type="button" className="grid size-11 place-items-center" onClick={onClose} aria-label="关闭">
            <X />
          </button>
        </div>
        <p className="mt-2 text-sm text-mist">贷款 {cny(world.loan)} / 额度 {cny(creditLimit(world))} · 日息 {(OFFICES[world.office].rate * 100).toFixed(2)}%</p>
        <p className="text-sm text-mist">{OFFICES[world.office].name} · 房租 {cny(OFFICES[world.office].rent)} / 晚</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {[20000, 50000, 100000].map((n) => (
            <Btn key={n} tone="brass" onClick={() => onAct({ t: "borrow", amt: n })}>借 {cny(n)}</Btn>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {[20000, 50000].map((n) => (
            <Btn key={n} tone="ghost" onClick={() => onAct({ t: "repay", amt: n })}>还 {cny(n)}</Btn>
          ))}
          <Btn tone="dock" disabled={world.coffeeToday} onClick={() => onAct({ t: "coffee" })}>
            <Coffee className="size-4" />
            冻柠茶
          </Btn>
        </div>
        <h3 className="mt-6 text-sm text-mist">团队</h3>
        <div className="mt-2 grid gap-2">
          {(Object.keys(STAFF) as StaffRole[]).map((role) => (
            <div key={role} className="rounded-xl border border-line px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p>{STAFF[role].who} · {STAFF[role].name}</p>
                  <p className="text-xs text-mist">{STAFF[role].blurb}</p>
                  <p className="text-xs text-brass">日薪 {cny(STAFF[role].day + (role === "sales" ? world.bumpSales : 0))}</p>
                </div>
                {world.staff[role] ? (
                  <Btn tone="coral" onClick={() => onAct({ t: "fire", role })}>请走</Btn>
                ) : (
                  <Btn tone="brass" onClick={() => onAct({ t: "hire", role })}>
                    <Briefcase className="size-4" />
                    聘请
                  </Btn>
                )}
              </div>
            </div>
          ))}
        </div>
        {nextOffice && (
          <div className="mt-4 rounded-xl border border-line px-3 py-3">
            <p>搬去{nextOffice.name}</p>
            <p className="text-xs text-mist">{nextOffice.blurb} 房租变 {cny(nextOffice.rent)}。</p>
            <div className="mt-2">
              <Btn tone="brass" onClick={() => onAct({ t: "upgrade" })}>
                <Warehouse className="size-4" />
                搬家
              </Btn>
            </div>
          </div>
        )}
        <h3 className="mt-6 text-sm text-mist">扫货</h3>
        {busy && <p className="mt-1 text-xs text-mist">眼前还有事，市场先放一放。贷款可以先办。</p>}
        <div className="mt-2 grid gap-2">
          {PRODUCTS.filter((p) => world.rep >= p.unlockRep).map((p) => {
            const lots = spotLots(world, p.id);
            return (
              <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
                <span>{p.name} ¥{spotUnit(world, p.id)}</span>
                <span className="flex gap-1">
                  {lots.map((q) => (
                    <button key={q} type="button" disabled={!!busy} onClick={() => onAct({ t: "spot", productId: p.id, qty: q })} className="min-h-11 rounded-lg border border-line px-2 text-xs disabled:opacity-40">
                      {q}{p.unit}
                    </button>
                  ))}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-6">
          {sure ? (
            <Btn tone="coral" onClick={onAbandon}>确认关掉这家公司</Btn>
          ) : (
            <Btn tone="ghost" onClick={() => setSure(true)}>结束这局</Btn>
          )}
        </div>
        {world.achievements.length > 0 && (
          <p className="mt-4 text-xs text-mist">成就 {world.achievements.length} 个已入账</p>
        )}
      </div>
    </div>
  );
}

function Paper({ children }: { children: ReactNode }) {
  return <section className="rise mx-auto mt-3 max-w-2xl rounded-2xl bg-paper px-4 py-4 text-paper-ink shadow-lg">{children}</section>;
}

function Btn({
  children,
  onClick,
  tone = "brass",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "brass" | "ghost" | "jade" | "coral" | "ink" | "dock" | "line";
  disabled?: boolean;
}) {
  const tones = {
    brass: "bg-brass text-ink",
    jade: "bg-jade text-foam",
    coral: "bg-coral text-paper",
    ghost: "border border-line bg-transparent text-foam",
    ink: "bg-ink text-paper",
    dock: "border border-line bg-dock text-foam",
    line: "border border-paper-ink/20 bg-transparent text-paper-ink",
  } as const;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={clsx("inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-40", tones[tone])}
    >
      {children}
    </button>
  );
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className={clsx("min-h-11 rounded-full border px-3 text-sm", on ? "border-brass bg-brass text-ink" : "border-paper-ink/20 text-paper-ink")}>
      {label}
    </button>
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
