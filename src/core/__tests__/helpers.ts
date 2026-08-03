/**
 * PRNG dengan seed (mulberry32).
 *
 * Test properti di sini menembak ratusan input acak. Kalau memakai Math.random,
 * sebuah kegagalan tidak akan bisa diulang — dan kegagalan yang tidak bisa
 * diulang praktis tidak bisa diperbaiki. Dengan seed tetap, setiap kegagalan
 * selalu bisa dijalankan ulang persis sama.
 */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomInt(rng: () => number, minInclusive: number, maxInclusive: number): number {
  return minInclusive + Math.floor(rng() * (maxInclusive - minInclusive + 1));
}

export function memberIds(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `m${i + 1}`);
}

/** n bilangan bulat >= 0 yang berjumlah persis `total`. */
export function randomPartition(rng: () => number, total: number, n: number): number[] {
  const parts = new Array<number>(n).fill(0);
  let left = total;
  for (let i = 0; i < n - 1; i++) {
    const take = randomInt(rng, 0, left);
    parts[i] = take;
    left -= take;
  }
  parts[n - 1] = left;
  return parts;
}
