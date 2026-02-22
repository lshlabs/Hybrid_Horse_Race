// 문자열 seed 기반 난수 helper
// 서버/클라에서 같은 seed를 넣으면 같은 결과를 만들기 위해 사용한다.
export function hashStringToUint32(input: string): number {
  let hash = 2166136261 >>> 0
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function createSeededRandom(seed: string): () => number {
  // 간단한 deterministic PRNG (seed string -> 0~1 난수 함수)
  let state = hashStringToUint32(seed)
  if (state === 0) {
    state = 0x9e3779b9
  }

  return () => {
    state += 0x6d2b79f5
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function randomIntSeeded(min: number, max: number, rng: () => number): number {
  return Math.floor(rng() * (max - min + 1)) + min
}

export function randomFloatSeeded(min: number, max: number, rng: () => number): number {
  return rng() * (max - min) + min
}

export function pickRandomSeeded<T>(items: T[], rng: () => number): T {
  // 호출하는 쪽에서 빈 배열을 넘기지 않는다고 가정한다.
  return items[Math.floor(rng() * items.length)]
}
