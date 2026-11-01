export function nextRng(seed: number): { seed: number; roll: number } {
  let x = seed >>> 0;
  if (x === 0) x = 0x6d2b79f5;
  x ^= x << 13;
  x >>>= 0;
  x ^= x >> 17;
  x >>>= 0;
  x ^= x << 5;
  x >>>= 0;
  return { seed: x, roll: x / 4294967296 };
}
