export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function round(value, digits = 2) {
  const power = 10 ** digits;
  return Math.round(value * power) / power;
}

export function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

export function mean(values) {
  return values.length ? sum(values) / values.length : 0;
}

export function stdev(values) {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = mean(values.map((value) => (value - avg) ** 2));
  return Math.sqrt(variance);
}

export function normalize(values) {
  const cleaned = values.map((value) => Math.max(0, Number(value) || 0));
  const total = sum(cleaned);
  if (!total) return values.map(() => 1 / values.length);
  return cleaned.map((value) => value / total);
}

export function decimalToProbability(decimal) {
  return decimal > 1 ? 1 / decimal : 0;
}

export function probabilityToDecimal(probability) {
  return clamp(1 / clamp(probability, 0.01, 0.99), 1.01, 99);
}

export function removeVig(probabilities) {
  return normalize(probabilities);
}

export function pseudoNoise(seed, tick, scale = 1) {
  const x = Math.sin(seed * 12.9898 + tick * 78.233) * 43758.5453;
  return (x - Math.floor(x) - 0.5) * scale;
}

export function hashReceipt(input) {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  const text = JSON.stringify(input);
  for (let index = 0; index < text.length; index += 1) {
    a ^= text.charCodeAt(index);
    a = Math.imul(a, 0x01000193);
    b ^= a >>> 9;
    b = Math.imul(b, 0x85ebca6b);
  }
  const hex = `${(a >>> 0).toString(16).padStart(8, "0")}${(b >>> 0).toString(16).padStart(8, "0")}`;
  return `0x${hex.repeat(4).slice(0, 64)}`;
}
