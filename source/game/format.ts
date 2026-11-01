export function cny(n: number): string {
  const v = Math.round(n);
  const sign = v < 0 ? "-" : "";
  const a = Math.abs(v);
  return `${sign}¥${a.toLocaleString("en-US")}`;
}

export function cnySigned(n: number): string {
  const v = Math.round(n);
  if (v > 0) return `+${cny(v)}`;
  if (v < 0) return cny(v);
  return "¥0";
}

export function usd(n: number): string {
  const v = Math.round(n * 100) / 100;
  const sign = v < 0 ? "-" : "";
  return `${sign}$${Math.abs(v).toFixed(2)}`;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function weekday(day: number): string {
  return ["一", "二", "三", "四", "五", "六", "日"][(day - 1) % 7] ?? "一";
}

export function etaText(hours: number): string {
  const h = Math.max(0, Math.round(hours));
  if (h <= 0) return "即将到港";
  if (h < 24) return `${h} 小时到港`;
  const d = Math.floor(h / 24);
  const r = h % 24;
  return r ? `${d} 天 ${r} 小时` : `${d} 天`;
}
