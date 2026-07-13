// scripts/generate-logo.mjs
// Generates the EdgeLine OS logo as a PNG file for the Telegram bot profile photo.
// Run: node scripts/generate-logo.mjs
// Output: scripts/edgeline-logo.svg (open in browser and screenshot, or use directly)

import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <!-- Background -->
  <rect width="512" height="512" rx="120" fill="#050e0c"/>
  
  <!-- Gradient overlay -->
  <defs>
    <radialGradient id="glow" cx="30%" cy="20%" r="70%">
      <stop offset="0%" stop-color="#14b8a6" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#050e0c" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="barGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#14b8a6"/>
      <stop offset="100%" stop-color="#0d9488"/>
    </linearGradient>
    <linearGradient id="barGrad2" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#d97706"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="120" fill="url(#glow)"/>
  
  <!-- Hexagon border -->
  <polygon 
    points="256,40 440,145 440,355 256,460 72,355 72,145" 
    fill="none" 
    stroke="#14b8a6" 
    stroke-width="8"
    opacity="0.6"
  />
  
  <!-- Signal bars — rising left to right, centered -->
  <!-- Bar 1 - shortest -->
  <rect x="136" y="310" width="44" height="80" rx="10" fill="url(#barGrad)" opacity="0.5"/>
  <!-- Bar 2 -->
  <rect x="194" y="265" width="44" height="125" rx="10" fill="url(#barGrad)" opacity="0.7"/>
  <!-- Bar 3 - tallest (center) -->
  <rect x="252" y="200" width="44" height="190" rx="10" fill="url(#barGrad)"/>
  <!-- Bar 4 -->
  <rect x="310" y="240" width="44" height="150" rx="10" fill="url(#barGrad2)" opacity="0.85"/>
  <!-- Bar 5 - short -->
  <rect x="368" y="280" width="44" height="110" rx="10" fill="url(#barGrad2)" opacity="0.6"/>
  
  <!-- Pulse dot top right -->
  <circle cx="390" cy="120" r="22" fill="#22c55e"/>
  <circle cx="390" cy="120" r="32" fill="none" stroke="#22c55e" stroke-width="4" opacity="0.4"/>
  <circle cx="390" cy="120" r="42" fill="none" stroke="#22c55e" stroke-width="2" opacity="0.15"/>
  
  <!-- Text: EdgeLine -->
  <text 
    x="256" y="490" 
    text-anchor="middle" 
    font-family="Inter, Arial, sans-serif" 
    font-size="42" 
    font-weight="900"
    fill="#e2eeea"
    letter-spacing="2"
  >EdgeLine <tspan fill="#14b8a6">OS</tspan></text>
</svg>`;

const outPath = resolve(__dirname, "edgeline-logo.svg");
writeFileSync(outPath, svg);
console.log(`\n✅ Logo saved to: ${outPath}`);
console.log(`\nSteps to set as Telegram bot photo:`);
console.log(`  1. Open ${outPath} in your browser`);
console.log(`  2. Right-click → Save image as PNG (or screenshot it)`);
console.log(`  3. Open Telegram → @BotFather → /mybots → EdgeLine OS → Edit Bot → Edit Botpic`);
console.log(`  4. Upload the image`);
console.log(`\nYour bot will now show the EdgeLine OS logo in all chats.`);
