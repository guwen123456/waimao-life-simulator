import type { Logistics, PayTerm, Personality, StaffRole } from "./types";

export interface ProductDef {
  id: string;
  name: string;
  unit: string;
  cat: string;
  baseCost: number;
  refUsd: number;
  risk: number;
  unlockRep: number;
  bulk: number;
  qtyBase: number;
}

export interface BuyerDef {
  id: string;
  name: string;
  country: string;
  market: string;
  personality: Personality;
  pay: PayTerm;
  blurb: string;
  unlockRep: number;
  qty: number;
}

export const PRODUCTS: ProductDef[] = [
  { id: "cable", name: "编织数据线", unit: "条", cat: "电子", baseCost: 6.6, refUsd: 1.34, risk: 0.1, unlockRep: 0, bulk: 1, qtyBase: 1800 },
  { id: "bulb", name: "LED球泡灯", unit: "只", cat: "照明", baseCost: 3.9, refUsd: 0.84, risk: 0.08, unlockRep: 0, bulk: 1, qtyBase: 2600 },
  { id: "cup", name: "不锈钢保温杯", unit: "只", cat: "家居", baseCost: 15.5, refUsd: 3.45, risk: 0.09, unlockRep: 0, bulk: 1, qtyBase: 800 },
  { id: "earbud", name: "蓝牙耳机", unit: "副", cat: "电子", baseCost: 27, refUsd: 5.8, risk: 0.18, unlockRep: 20, bulk: 1, qtyBase: 520 },
  { id: "mat", name: "瑜伽垫", unit: "张", cat: "运动", baseCost: 21, refUsd: 4.7, risk: 0.11, unlockRep: 32, bulk: 2, qtyBase: 420 },
  { id: "solar", name: "太阳能庭院灯", unit: "套", cat: "照明", baseCost: 34, refUsd: 7.4, risk: 0.14, unlockRep: 44, bulk: 2, qtyBase: 280 },
  { id: "pet", name: "宠物喂食器", unit: "台", cat: "智能", baseCost: 52, refUsd: 12.2, risk: 0.16, unlockRep: 56, bulk: 2, qtyBase: 180 },
  { id: "power", name: "便携储能电源", unit: "台", cat: "储能", baseCost: 238, refUsd: 49, risk: 0.2, unlockRep: 70, bulk: 4, qtyBase: 40 },
];

export const BUYERS: BuyerDef[] = [
  { id: "tanaka", name: "田中健一", country: "日本", market: "jp", personality: "strict", pay: "TT30", blurb: "大阪连锁。验货比做账细，认准了就翻单。", unlockRep: 0, qty: 0.72 },
  { id: "marcus", name: "Marcus Hale", country: "美国", market: "us", personality: "shark", pay: "OA30", blurb: "洛杉矶亚马逊卖家。第一句永远是 best price。", unlockRep: 0, qty: 1.35 },
  { id: "linh", name: "阮氏玲", country: "越南", market: "sea", personality: "loyal", pay: "TT30", blurb: "胡志明批发。不浪漫，回款和翻单都很稳。", unlockRep: 0, qty: 1.05 },
  { id: "aisha", name: "Aisha Al-Farsi", country: "阿联酋", market: "me", personality: "rush", pay: "TT100", blurb: "迪拜转口。催货比催命快，愿意为交期付钱。", unlockRep: 14, qty: 1.15 },
  { id: "sofia", name: "Sofia Alvarez", country: "墨西哥", market: "latam", personality: "green", pay: "OA60", blurb: "墨西哥城新店主。很热情，账期也很热情。", unlockRep: 16, qty: 0.95 },
  { id: "hans", name: "Hans Weber", country: "德国", market: "eu", personality: "strict", pay: "LC", blurb: "汉堡工具超市。信用证、文件、一丝不苟。", unlockRep: 22, qty: 1.2 },
  { id: "raj", name: "Rajesh Mehta", country: "印度", market: "in", personality: "shark", pay: "TT30", blurb: "孟买价格屠夫。砍完还会问能不能再送 2%。", unlockRep: 26, qty: 1.55 },
  { id: "jenny", name: "陈珍妮", country: "新加坡", market: "sea", personality: "loyal", pay: "TT100", blurb: "精品买手。包装丑会退，钱倒是痛快。", unlockRep: 32, qty: 0.55 },
  { id: "olivia", name: "Olivia Grant", country: "英国", market: "eu", personality: "green", pay: "OA30", blurb: "伦敦独立站。好看的图比低价更打动她。", unlockRep: 38, qty: 0.78 },
  { id: "hokuto", name: "北斗商社", country: "日本", market: "jp", personality: "whale", pay: "LC", blurb: "神秘大商社。一单能改你这个月的命运。", unlockRep: 48, qty: 2.35 },
];

export const OFFICES = [
  { name: "城中村出租屋", rent: 680, warehouse: 700, credit: 80000, rate: 0.006, blurb: "空调外机对着床。灵感和蚊子一起飞。" },
  { name: "联合办公靠窗位", rent: 1980, warehouse: 1800, credit: 220000, rate: 0.0042, blurb: "前台帮你收样品。租金开始有存在感。" },
  { name: "口岸写字楼", rent: 5600, warehouse: 4600, credit: 560000, rate: 0.0032, blurb: "电梯广告上终于有你公司的名字。" },
] as const;

export const STANCES = [
  { name: "流血抢单", mul: 0.86 },
  { name: "薄利多销", mul: 0.94 },
  { name: "市场价", mul: 1 },
  { name: "硬气", mul: 1.11 },
  { name: "狮子开口", mul: 1.24 },
] as const;

export const PAY_LABEL: Record<PayTerm, string> = {
  TT100: "全额前 TT",
  TT30: "30% 前 TT",
  LC: "即期信用证",
  OA30: "放账 30 天",
  OA60: "放账 60 天",
};

export const PERSONALITY_LABEL: Record<Personality, string> = {
  shark: "压价",
  loyal: "认人",
  strict: "苛刻",
  rush: "急单",
  green: "新手",
  whale: "巨鲸",
};

export const LOGI_LABEL: Record<Logistics, string> = {
  sea: "海运",
  rail: "班列",
  air: "空运",
};

export const FREIGHT: Record<Logistics, number> = { sea: 0.58, rail: 1.25, air: 3.7 };
export const ETA: Record<Logistics, number> = { sea: 16, rail: 10, air: 5 };

export const STAFF: Record<StaffRole, { name: string; who: string; day: number; blurb: string }> = {
  sales: { name: "业务", who: "阿 May", day: 1100, blurb: "多询盘，成交更顺。她的朋友圈比你广。" },
  ops: { name: "跟单", who: "老周", day: 820, blurb: "验厂几乎半价，投诉少一半。话少，但单不丢。" },
  customs: { name: "报关", who: "小陈", day: 900, blurb: "海关那关，他能把故事讲圆。运费也省一截。" },
};

const TITLES: [number, string][] = [
  [90, "全球合伙人"],
  [75, "行业狠角色"],
  [60, "客户都要排队"],
  [45, "区域供货商"],
  [30, "口岸熟脸"],
  [15, "能报价的人"],
  [0, "跑单新手"],
];

export function titleFor(rep: number): string {
  return TITLES.find(([n]) => rep >= n)?.[1] ?? "跑单新手";
}

export function productById(id: string): ProductDef {
  return PRODUCTS.find((p) => p.id === id) ?? PRODUCTS[0];
}

export function buyerById(id: string): BuyerDef {
  return BUYERS.find((b) => b.id === id) ?? BUYERS[0];
}

export function quip(
  personality: Personality,
  stance: number,
  outcome: "win" | "lose" | "counter",
): string {
  if (outcome === "counter") {
    if (personality === "shark") return "他丢过来一个更低的数字，像在扔骨头。";
    if (personality === "strict") return "价格可以谈。文件，不行。";
    if (personality === "rush") return "便宜一点我今天就定，晚了我就换人。";
    if (personality === "whale") return "商社的还价不带情绪，只带体积。";
    if (personality === "green") return "她打了一长段语音，意思是再让一点。";
    return "对方还了一次价，语气还算给面子。";
  }
  if (outcome === "lose") {
    if (personality === "shark") return "已读不回。五分钟后，朋友圈有别人的 PI。";
    if (personality === "strict") return "规格书对不上，窗口被轻轻关上。";
    if (personality === "rush") return "你还在算，他已经找到现货。";
    if (personality === "whale") return "商社没有第二次会议。";
    if (personality === "loyal") return "他叹了口气：这次先算了，下次早点说。";
    return "新手被报价吓到，去问了表哥。";
  }
  if (personality === "shark" && stance <= 1) return "他回了个 OK，短得像施舍。";
  if (personality === "shark") return "骂骂咧咧地接受了。这种单会传开。";
  if (personality === "loyal") return "对方说：就跟你做。";
  if (personality === "strict") return "可以。请按附件格式重出 PI。";
  if (personality === "rush") return "定了。提单信息马上发你。";
  if (personality === "whale") return "采购委员会通过。这单不小。";
  if (stance >= 4) return "她心疼了一下，还是点了头。";
  return "成交。港口的风都好像贵了一点。";
}

export function buyerTargetMul(p: Personality): number {
  switch (p) {
    case "shark":
      return 0.84;
    case "loyal":
      return 0.98;
    case "strict":
      return 0.93;
    case "rush":
      return 1.06;
    case "green":
      return 0.9;
    case "whale":
      return 1.01;
  }
}
