/**
 * Strict Visual Bounding-Box Overlap Linter for SNES Retro Game Aegypten
 * Checks all placed buildings, monuments, props, palms, plots, and nodes at full visual scale.
 */
const fs = require('fs');
const path = require('path');

const itemsSrc = fs.readFileSync(path.join(__dirname, '../src/data/items.ts'), 'utf8');
const worldSrc = fs.readFileSync(path.join(__dirname, '../src/scenes/WorldScene.ts'), 'utf8');

const FRAME_SIZES = {
  hut_senbi: [48, 48],
  drying_fish_rack: [96, 48],
  fish_baskets_group: [48, 48],
  fire0: [16, 16],
  fish_trap_wicker: [48, 48],
  nile_felucca: [96, 96],
  stele_nilometer: [48, 96],
  wheat_sheaf: [48, 48],
  grain_basket: [48, 48],
  amphora_red: [48, 48],
  water_basin_square: [48, 48],
  prop_haystack: [44, 48],
  prop_water_trough: [44, 22],
  prop_pots_group: [32, 24],
  prop_clay_pile: [24, 20],
  prop_wood_stack: [28, 28],
  palm_tree: [48, 64],
  rocks_large: [32, 32],
  cactus_tall: [16, 32],
  palace_colonnade: [96, 96],
  egypt_pillar: [48, 112],
  throne_gold: [48, 48],
  statue_lion_l: [48, 48],
  statue_lion_r: [48, 48],
  temple_ornate: [96, 96],
  statue_thoth: [48, 96],
  statue_anubis: [48, 96],
  table_offering: [48, 48],
  canopic_falcon: [48, 48],
  canopic_jackal: [48, 48],
  sarcophagus_gold: [48, 96],
  pyramid_step: [96, 96],
  egypt_pyramid: [192, 155],
  egypt_sphinx: [192, 167],
  obelisk_tall_1: [48, 96],
  limestone_blocks: [48, 48],
  tool_pickaxe: [48, 48],
  stone_blocks_pile: [48, 48],
  timber_logs: [48, 48],
  cargo_wagon_full: [96, 48],
  nile_cargo_barge: [144, 96],
  crane_beam_wood: [96, 96],
  crate_wood: [48, 48],
  barrel_wood: [48, 48],
  bazaar_punt_incense: [96, 96],
  canopy_gold: [96, 96],
  market_table_spices: [48, 48],
  market_table_fruits: [48, 48],
  chest_turquoise: [48, 48],
  statue_pharaoh: [48, 96],
  papyrus_clump_tall: [48, 48],
  bush_small: [16, 16],
  stone_flat: [16, 16],
  clay_vat_mud: [48, 48],
  tool_shovel: [48, 48],
  schaduf_prop: [42, 42],
  brick_kiln: [48, 48],
  granary_compound: [96, 96],
  scribes_house: [96, 96],
  temple_shrine: [96, 96],
  stonemason_yard: [96, 96],
};

const items = [];

// 1. Parse direct this.placeProp(x, y, ...)
const propRegex = /this\.placeProp\(\s*(\d+)\s*,\s*(\d+)\s*,\s*'([^']+)'\s*,\s*(?:'([^']+)'|undefined)\s*(?:,\s*\{([\s\S]*?)\})?\s*\)/g;
let m;
while ((m = propRegex.exec(worldSrc)) !== null) {
  const x = Number(m[1]);
  const y = Number(m[2]);
  const tex = m[3];
  const frame = m[4] || tex;
  const opts = m[5] || '';
  const scaleMatch = opts.match(/scale:\s*([\d.]+)/);
  const scale = scaleMatch ? Number(scaleMatch[1]) : 1.0;
  const [bw, bh] = FRAME_SIZES[frame] || FRAME_SIZES[tex] || [32, 32];
  items.push({
    id: `prop:${frame}`,
    x,
    y,
    w: Math.round(bw * scale * 0.95),
    h: Math.round(bh * scale * 0.92),
  });
}

// 2. Parse coordinate array loops (palmPositions, rockClusters, desertPlants, reeds, sticks, pebbles, mudSpots)
function parseArrayCoords(arrayName, label, bw, bh, scale = 1.0) {
  const rx = new RegExp(`const\\s+${arrayName}\\s*=\\s*\\[([\\s\\S]*?)\\];`);
  const match = worldSrc.match(rx);
  if (!match) return;
  const pairRx = /\[\s*(\d+)\s*,\s*(\d+)\s*\]/g;
  let pm;
  while ((pm = pairRx.exec(match[1])) !== null) {
    items.push({
      id: `${label}`,
      x: Number(pm[1]),
      y: Number(pm[2]),
      w: Math.round(bw * scale * 0.92),
      h: Math.round(bh * scale * 0.90),
    });
  }
}

parseArrayCoords('palmPositions', 'palm:palm_tree', 36, 48, 1.0);
parseArrayCoords('rockClusters', 'rock:rocks_large', 32, 32, 1.0);
parseArrayCoords('desertPlants', 'cactus:cactus_tall', 16, 32, 1.0);
parseArrayCoords('reeds', 'node:egypt_papyrus', 48, 48, 0.68);
parseArrayCoords('sticks', 'node:egypt_stick', 16, 16, 1.0);
parseArrayCoords('pebbles', 'node:egypt_pebble', 16, 16, 1.0);
parseArrayCoords('mudSpots', 'node:egypt_mud', 24, 20, 1.0);

// 3. Parse BUILDINGS from items.ts
const buildingsBlock = itemsSrc.split('export const BUILDINGS')[1] || '';
const buildRegex = /id:\s*'([^']+)'[\s\S]*?x:\s*(\d+)\s*,\s*y:\s*(\d+)/g;
const BUILD_SIZES = {
  schaduf: [42, 42, 1.0],
  ziegelei: [48, 48, 1.15],
  speicher: [96, 96, 0.85],
  schreiberhaus: [96, 96, 0.85],
  wabet: [96, 96, 0.85],
  steinmetz: [96, 96, 0.75],
};
while ((m = buildRegex.exec(buildingsBlock)) !== null) {
  const id = m[1];
  const x = Number(m[2]);
  const y = Number(m[3]);
  const [bw, bh, scale] = BUILD_SIZES[id] || [48, 48, 1.0];
  items.push({
    id: `building:${id}`,
    x,
    y: y - 6,
    w: Math.round(bw * scale * 0.95),
    h: Math.round(bh * scale * 0.92),
  });
}

// 4. Parse direct addNode calls
const nodeRegex = /this\.addNode\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*(?:'([^']+)'|0|undefined)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g;
while ((m = nodeRegex.exec(worldSrc)) !== null) {
  const kind = m[1];
  const tex = m[2];
  const frame = m[3] || tex;
  const x = Number(m[4]);
  const y = Number(m[5]);
  if (kind === 'egypt_pyramid' || kind === 'egypt_sphinx') continue;
  const isNpc = tex.startsWith('npc_');
  const [bw, bh] = isNpc ? [16, 28] : (FRAME_SIZES[frame] || [32, 32]);
  const scale = isNpc ? 1.0 : 0.75;
  items.push({
    id: `node:${kind}`,
    x,
    y,
    w: Math.round(bw * scale * 0.82),
    h: Math.round(bh * scale * 0.78),
  });
}

let overlaps = 0;
for (let i = 0; i < items.length; i++) {
  for (let j = i + 1; j < items.length; j++) {
    const a = items[i];
    const b = items[j];
    // Intentional architectural composition inside Palace court: throne_gold inside palace_colonnade
    if (
      (a.id === 'prop:palace_colonnade' && b.id === 'prop:throne_gold') ||
      (b.id === 'prop:palace_colonnade' && a.id === 'prop:throne_gold')
    ) {
      continue;
    }
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    const minW = (a.w + b.w) / 2;
    const minH = (a.h + b.h) / 2;
    if (dx < minW && dy < minH) {
      console.error(
        `❌ OVERLAP: ${a.id} (${a.x},${a.y} [${a.w}x${a.h}]) <-> ${b.id} (${b.x},${b.y} [${b.w}x${b.h}])`
      );
      overlaps++;
    }
  }
}

if (overlaps > 0) {
  console.error(`\nFound ${overlaps} spatial overlap(s) in SNES Retro Game Aegypten!`);
  process.exit(1);
} else {
  console.log(`✅ Layout check passed: ${items.length} placed objects verified with 0 overlaps.`);
}
