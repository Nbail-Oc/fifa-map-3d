import { ISO_TILE_WIDTH, ISO_TILE_HEIGHT, WALL_HEIGHT, SEAT_HEIGHT, TILE_SIZE } from '../map/mockStadiumMap.js';

const W = ISO_TILE_WIDTH;
const H = ISO_TILE_HEIGHT;

export function generateAssets(scene) {
  makeFloor(scene);
  makeWallVariants(scene);
  makeSeatVariants(scene);
  makeField(scene);
  makeExteriorTiles(scene); // New exterior tiles
  makePlayer(scene);
  makeIcons(scene);

  // 2D flat view assets
  makeFloor2D(scene);
  makeWall2D(scene);
  makeSeat2D(scene);
  makeField2D(scene);
  makeExteriorTiles2D(scene); // New 2D exterior tiles
}

// ----------------------------------------------------------------------------
// Shared isometric diamond geometry
// ----------------------------------------------------------------------------
// Top-face diamond corners, relative to a WxH canvas region:
//   T (top), R (right), B (bottom/front tip), L (left)
function diamondCorners(offsetY = 0) {
  return {
    T: { x: W / 2, y: 0 + offsetY },
    R: { x: W, y: H / 2 + offsetY },
    B: { x: W / 2, y: H + offsetY },
    L: { x: 0, y: H / 2 + offsetY }
  };
}

function fillDiamond(g, corners, color, alpha = 1) {
  g.fillStyle(color, alpha);
  g.beginPath();
  g.moveTo(corners.T.x, corners.T.y);
  g.lineTo(corners.R.x, corners.R.y);
  g.lineTo(corners.B.x, corners.B.y);
  g.lineTo(corners.L.x, corners.L.y);
  g.closePath();
  g.fillPath();
}

function strokeDiamond(g, corners, color, alpha = 1, width = 1) {
  g.lineStyle(width, color, alpha);
  g.beginPath();
  g.moveTo(corners.T.x, corners.T.y);
  g.lineTo(corners.R.x, corners.R.y);
  g.lineTo(corners.B.x, corners.B.y);
  g.lineTo(corners.L.x, corners.L.y);
  g.closePath();
  g.strokePath();
}

// Draws the two extruded "riser" side faces below a diamond top face,
// giving a pseudo-3D block look. leftColor/rightColor let us fake simple
// directional shading (left face = shadow side, right face = lit side).
function fillExtrusion(g, corners, height, leftColor, rightColor) {
  const { L, B, R } = corners;
  const bands = 4;
  for (let i = 0; i < bands; i++) {
    const y0 = height * (i / bands);
    const y1 = height * ((i + 1) / bands);
    const shade = 1 - i * 0.14; // darkens toward the base (pseudo ambient occlusion)

    g.fillStyle(leftColor, shade);
    g.beginPath();
    g.moveTo(L.x, L.y + y0); g.lineTo(B.x, B.y + y0);
    g.lineTo(B.x, B.y + y1); g.lineTo(L.x, L.y + y1);
    g.closePath(); g.fillPath();

    g.fillStyle(rightColor, shade);
    g.beginPath();
    g.moveTo(B.x, B.y + y0); g.lineTo(R.x, R.y + y0);
    g.lineTo(R.x, R.y + y1); g.lineTo(B.x, B.y + y1);
    g.closePath(); g.fillPath();
  }
  // crisp highlight where the top diamond meets the riser
  g.lineStyle(1, 0xffffff, 0.22);
  g.lineBetween(L.x, L.y, B.x, B.y);
  g.lineBetween(B.x, B.y, R.x, R.y);

  // contact shadow along the base of each riser
  g.lineStyle(1, 0x000000, 0.4);
  g.lineBetween(L.x, L.y + height, B.x, B.y + height);
  g.lineBetween(B.x, B.y + height, R.x, R.y + height);
}

// ----------------------------------------------------------------------------
// TILE 0: Concourse / Walkway - flat isometric concrete diamond
// ----------------------------------------------------------------------------
function makeFloor(scene) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  const corners = diamondCorners();

  // ── Base concrete colour ─────────────────────────────────────────────────
  fillDiamond(g, corners, 0x9ea5ab, 1);

  // ── Simulated lighting gradient: lighter near top-right edge ─────────────
  g.fillStyle(0xffffff, 0.07);
  g.beginPath();
  g.moveTo(corners.T.x, corners.T.y);
  g.lineTo(corners.R.x, corners.R.y);
  g.lineTo(corners.B.x, corners.B.y);
  g.closePath();
  g.fillPath();

  // ── Expansion joint grid (horizontal seam + vertical seam) ──────────────
  // Main centre seam (horizontal split)
  g.lineStyle(1, 0x767c82, 0.65);
  g.lineBetween(corners.L.x, corners.L.y, corners.R.x, corners.R.y);
  // Vertical (top-to-bottom) seam
  g.lineStyle(1, 0x767c82, 0.45);
  g.lineBetween(corners.T.x, corners.T.y, corners.B.x, corners.B.y);

  // ── Aggregate speckle — coarse pebble-like dots ──────────────────────────
  const speckles = [
    { x: 11, y:  6, r: 1.2, c: 0x8b9198, a: 0.45 },
    { x: 28, y:  5, r: 0.8, c: 0xb3b9bf, a: 0.35 },
    { x: 48, y:  7, r: 1.1, c: 0x8b9198, a: 0.40 },
    { x: 18, y: 12, r: 0.7, c: 0xb3b9bf, a: 0.30 },
    { x: 38, y: 11, r: 1.0, c: 0x8b9198, a: 0.42 },
    { x:  8, y: 20, r: 0.9, c: 0xb3b9bf, a: 0.33 },
    { x: 24, y: 22, r: 1.3, c: 0x8b9198, a: 0.38 },
    { x: 52, y: 19, r: 0.7, c: 0xb3b9bf, a: 0.28 },
    { x: 43, y: 25, r: 1.0, c: 0x8b9198, a: 0.40 },
    { x: 14, y: 28, r: 0.8, c: 0xb3b9bf, a: 0.32 },
    { x: 33, y: 27, r: 1.1, c: 0x8b9198, a: 0.44 },
    { x: 57, y: 28, r: 0.7, c: 0xb3b9bf, a: 0.30 },
  ];
  speckles.forEach(({ x, y, r, c, a }) => {
    g.fillStyle(c, a);
    g.fillCircle(x, y, r);
  });

  // ── Subtle hairline cracks ───────────────────────────────────────────────
  g.lineStyle(1, 0x6f757b, 0.22);
  g.lineBetween(20, 8, 26, 14);
  g.lineBetween(42, 14, 46, 20);

  // ── Tire-scuff marks (faint dark smear) ─────────────────────────────────
  g.lineStyle(2, 0x4a5057, 0.10);
  g.lineBetween(12, 18, 22, 22);
  g.lineBetween(38, 9, 48, 13);

  // ── Edge highlight (specular rim) ────────────────────────────────────────
  strokeDiamond(g, corners, 0xd0d5da, 0.30, 1);

  g.generateTexture('tile-floor', W, H);
  g.destroy();
}

// ----------------------------------------------------------------------------
// TILE 1: Structural Wall - extruded isometric block (4 rotation variants)
// ----------------------------------------------------------------------------
const WALL_SHADE_SETS = [
  { left: 0x14161a, right: 0x2b2f36 }, // rot 0
  { left: 0x2b2f36, right: 0x14161a }, // rot 1 (90°) - light flips
  { left: 0x14161a, right: 0x2b2f36 }, // rot 2
  { left: 0x2b2f36, right: 0x14161a }, // rot 3
];

function makeWallVariants(scene) {
  WALL_SHADE_SETS.forEach((s, i) => makeWall(scene, `tile-wall-${i}`, s.left, s.right));
}

function makeWall(scene, key, leftColor, rightColor) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  const corners = diamondCorners();
  const { L, B, R } = corners;
  const isLitRight = rightColor > leftColor; // which side is the "light" face

  // ── Base extrusion (banded AO shading) ────────────────────────────────
  fillExtrusion(g, corners, WALL_HEIGHT, leftColor, rightColor);

  // ── Concrete panel joints on the side faces ────────────────────────────
  // Horizontal mortar joints every ~6 px of height
  const jointStep = 6;
  const jointAlpha = 0.28;
  for (let y = jointStep; y < WALL_HEIGHT; y += jointStep) {
    // Left face joint
    g.lineStyle(1, 0x000000, jointAlpha);
    g.lineBetween(L.x, L.y + y, B.x, B.y + y);
    // Right face joint
    g.lineBetween(B.x, B.y + y, R.x, R.y + y);
  }

  // ── Vertical panel seam (one per face, roughly centred) ───────────────
  g.lineStyle(1, 0x000000, 0.20);
  const lMidX = (L.x + B.x) / 2;
  const lMidY = (L.y + B.y) / 2;
  g.lineBetween(lMidX, lMidY, lMidX, lMidY + WALL_HEIGHT);
  const rMidX = (B.x + R.x) / 2;
  const rMidY = (B.y + R.y) / 2;
  g.lineBetween(rMidX, rMidY, rMidX, rMidY + WALL_HEIGHT);

  // ── Hairline surface crack on shadow face ─────────────────────────────
  if (!isLitRight) {
    g.lineStyle(1, 0x000000, 0.18);
    g.lineBetween(lMidX - 3, L.y + 4, lMidX - 1, L.y + WALL_HEIGHT * 0.6);
  } else {
    g.lineStyle(1, 0x000000, 0.18);
    g.lineBetween(rMidX + 2, R.y + 5, rMidX, R.y + WALL_HEIGHT * 0.55);
  }

  // ── Specular edge highlight along the lit extrusion edges ─────────────
  g.lineStyle(1, 0xffffff, 0.12);
  if (isLitRight) {
    g.lineBetween(B.x, B.y, R.x, R.y);
  } else {
    g.lineBetween(L.x, L.y, B.x, B.y);
  }

  // ── Top face: concrete slab ────────────────────────────────────────────
  fillDiamond(g, corners, 0x33373f, 1);

  // Subtle top-face gradient: lighter near the back edge
  g.fillStyle(0xffffff, 0.06);
  g.beginPath();
  g.moveTo(corners.T.x, corners.T.y);
  g.lineTo(corners.R.x, corners.R.y);
  g.lineTo(corners.B.x, corners.B.y);
  g.closePath();
  g.fillPath();

  // Top-face: aggregate speckle (concrete texture)
  const topSpeckles = [
    { x: 20, y:  5, r: 0.7, a: 0.35 },
    { x: 36, y:  6, r: 0.5, a: 0.28 },
    { x: 28, y: 10, r: 0.8, a: 0.30 },
    { x: 15, y: 12, r: 0.6, a: 0.25 },
    { x: 44, y: 11, r: 0.7, a: 0.32 },
    { x: 32, y: 14, r: 0.5, a: 0.20 },
  ];
  topSpeckles.forEach(({ x, y, r, a }) => {
    g.fillStyle(0xffffff, a);
    g.fillCircle(x, y, r);
  });

  // Top-face panel seam (left-right centre line)
  g.lineStyle(1, 0x23262b, 0.55);
  g.lineBetween(corners.L.x, corners.L.y, corners.R.x, corners.R.y);

  // ── Warning stripe along lit side base ────────────────────────────────
  const stripeY = WALL_HEIGHT - 5;
  g.fillStyle(0xc9a227, 0.45);
  g.beginPath();
  if (isLitRight) {
    g.moveTo(B.x, B.y + stripeY);
    g.lineTo(R.x, R.y + stripeY);
    g.lineTo(R.x, R.y + WALL_HEIGHT);
    g.lineTo(B.x, B.y + WALL_HEIGHT);
  } else {
    g.moveTo(L.x, L.y + stripeY);
    g.lineTo(B.x, B.y + stripeY);
    g.lineTo(B.x, B.y + WALL_HEIGHT);
    g.lineTo(L.x, L.y + WALL_HEIGHT);
  }
  g.closePath();
  g.fillPath();

  // Hash marks over the warning stripe (black diagonal lines, 5px apart)
  g.lineStyle(1, 0x000000, 0.35);
  for (let hx = 0; hx < W; hx += 5) {
    if (isLitRight) {
      const t = hx / W;
      const sx = B.x + (R.x - B.x) * t;
      const sy = B.y + (R.y - B.y) * t + stripeY;
      g.lineBetween(sx - 2, sy, sx + 2, sy + 4);
    } else {
      const t = hx / W;
      const sx = L.x + (B.x - L.x) * t;
      const sy = L.y + (B.y - L.y) * t + stripeY;
      g.lineBetween(sx - 2, sy, sx + 2, sy + 4);
    }
  }

  // ── Bolt / rivet dots on panel joints ─────────────────────────────────
  const boltPositions = isLitRight
    ? [{ x: rMidX - 1, y: R.y + 3 }, { x: rMidX - 1, y: R.y + WALL_HEIGHT - 4 }]
    : [{ x: lMidX + 1, y: L.y + 3 }, { x: lMidX + 1, y: L.y + WALL_HEIGHT - 4 }];
  boltPositions.forEach(({ x, y }) => {
    g.fillStyle(0xffffff, 0.25);
    g.fillCircle(x, y, 1.2);
    g.fillStyle(0x000000, 0.20);
    g.fillCircle(x, y, 0.6);
  });

  // ── Outer silhouette outline ───────────────────────────────────────────
  strokeDiamond(g, corners, 0x000000, 0.40, 1);

  g.generateTexture(key, W, H + WALL_HEIGHT);
  g.destroy();
}

// ----------------------------------------------------------------------------
// TILE 2: Spectator Seating - gradient bowl rings (outer/mid/inner) as
// extruded isometric risers (4 rotation variants per ring).
// ----------------------------------------------------------------------------
const SEAT_VARIANTS = [
  { key: 'tile-seat-outer', top: 0x4aa3df, left: 0x27577a, right: 0x3a7dab },
  { key: 'tile-seat-mid', top: 0x3fbfae, left: 0x1f5c53, right: 0x2e8b7f },
  { key: 'tile-seat-inner', top: 0x8b6be8, left: 0x3f2f78, right: 0x6650b8 }
];

function makeSeatVariants(scene) {
  SEAT_VARIANTS.forEach(({ key, top, left, right }) => {
    for (let rot = 0; rot < 4; rot++) {
      const isOdd = rot % 2 !== 0;
      const leftColor = isOdd ? right : left;
      const rightColor = isOdd ? left : right;
      makeSeatVariant(scene, `${key}-${rot}`, top, leftColor, rightColor);
    }
  });
}

function makeSeatVariant(scene, key, topColor, leftColor, rightColor) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  const corners = diamondCorners();
  const { L, B, R } = corners;

  // ── Riser extrusion ────────────────────────────────────────────────────
  fillExtrusion(g, corners, SEAT_HEIGHT, leftColor, rightColor);

  // ── Riser: row-divider lines on the side faces (every 4 px) ──────────
  const rowStep = 4;
  for (let ry = rowStep; ry < SEAT_HEIGHT; ry += rowStep) {
    g.lineStyle(1, 0x000000, 0.20);
    g.lineBetween(L.x, L.y + ry, B.x, B.y + ry);
    g.lineBetween(B.x, B.y + ry, R.x, R.y + ry);
  }

  // ── Riser: individual seat column hints (vertical notches) ────────────
  const colStep = 8;
  g.lineStyle(1, 0x000000, 0.12);
  for (let cx = colStep; cx < W; cx += colStep) {
    const t = (cx / W) * 0.5;
    const lx = L.x + (B.x - L.x) * t;
    const ly = L.y + (B.y - L.y) * t;
    g.lineBetween(lx, ly, lx, ly + SEAT_HEIGHT);
  }

  // ── Top face: base colour ──────────────────────────────────────────────
  fillDiamond(g, corners, topColor, 1);

  // ── Top-face plastic sheen: subtle specular highlight half ─────────────
  g.fillStyle(0xffffff, 0.10);
  g.beginPath();
  g.moveTo(corners.T.x, corners.T.y);
  g.lineTo(corners.R.x, corners.R.y);
  g.lineTo(corners.B.x, corners.B.y);
  g.closePath();
  g.fillPath();

  // Slightly darker front-left half (shadow side of seat backs)
  g.fillStyle(0x000000, 0.08);
  g.beginPath();
  g.moveTo(corners.T.x, corners.T.y);
  g.lineTo(corners.L.x, corners.L.y);
  g.lineTo(corners.B.x, corners.B.y);
  g.closePath();
  g.fillPath();

  // ── Seat rows across the top face ─────────────────────────────────────
  const rows = [0.22, 0.50, 0.76];
  rows.forEach((t) => {
    const rowY   = H * t;
    const inset  = Math.abs(t - 0.5) * (W * 0.65);
    const rowW   = W - inset * 2 - 6;
    const startX = inset + 3;

    // Row backing strip
    g.fillStyle(0x000000, 0.15);
    g.fillRect(startX, rowY - 1, rowW, 3);

    // Individual seat segments
    const seatW    = 7;
    const gap      = 2;
    const seatCount = Math.floor(rowW / (seatW + gap));
    for (let s = 0; s < seatCount; s++) {
      const sx = startX + s * (seatW + gap);
      // Seat back highlight (top edge)
      g.fillStyle(0xffffff, 0.28);
      g.fillRect(sx, rowY, seatW - 1, 1);
      // Seat surface
      g.fillStyle(0xffffff, 0.10);
      g.fillRect(sx, rowY + 1, seatW - 1, 2);
      // Seat shadow / armrest divider
      g.fillStyle(0x000000, 0.18);
      g.fillRect(sx + seatW - 1, rowY, 1, 3);
    }
  });

  // ── Outline ────────────────────────────────────────────────────────────
  strokeDiamond(g, corners, 0x000000, 0.28, 1);

  g.generateTexture(key, W, H + SEAT_HEIGHT);
  g.destroy();
}

// ----------------------------------------------------------------------------
// TILE 3: Soccer Pitch / Field - flat isometric grass diamond
// ----------------------------------------------------------------------------
function makeField(scene) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  const corners = diamondCorners();

  // ── Base grass colour ─────────────────────────────────────────────────
  fillDiamond(g, corners, 0x3a8f3e, 1);

  // ── Alternating mow-stripe bands across the diamond ───────────────────
  const stripeColors = [0x3e9142, 0x42994a];
  const bandCount = 8;
  for (let b = 0; b < bandCount; b++) {
    const t0 = b / bandCount;
    const t1 = (b + 1) / bandCount;

    const yTop    = corners.T.y + (corners.B.y - corners.T.y) * t0;
    const yBottom = corners.T.y + (corners.B.y - corners.T.y) * t1;

    const leftX = (yFrac) => {
      if (yFrac <= 0.5) return corners.L.x + (corners.T.x - corners.L.x) * (1 - yFrac * 2);
      return corners.L.x + (corners.B.x - corners.L.x) * ((yFrac - 0.5) * 2);
    };
    const rightX = (yFrac) => {
      if (yFrac <= 0.5) return corners.R.x - (corners.R.x - corners.T.x) * (1 - yFrac * 2);
      return corners.R.x - (corners.R.x - corners.B.x) * ((yFrac - 0.5) * 2);
    };

    const lx0 = leftX(t0), lx1 = leftX(t1);
    const rx0 = rightX(t0), rx1 = rightX(t1);

    g.fillStyle(stripeColors[b % 2], 0.60);
    g.beginPath();
    g.moveTo(lx0, yTop);
    g.lineTo(rx0, yTop);
    g.lineTo(rx1, yBottom);
    g.lineTo(lx1, yBottom);
    g.closePath();
    g.fillPath();
  }

  // ── Fine grass blade texture (short vertical dashes) ─────────────────
  const blades = [
    { x:  9, y:  7 }, { x: 22, y:  5 }, { x: 40, y:  6 }, { x: 54, y:  8 },
    { x: 14, y: 12 }, { x: 32, y: 11 }, { x: 48, y: 13 }, { x:  7, y: 16 },
    { x: 25, y: 17 }, { x: 44, y: 18 }, { x: 58, y: 16 }, { x: 16, y: 22 },
    { x: 34, y: 23 }, { x: 51, y: 21 }, { x:  5, y: 26 }, { x: 27, y: 27 },
    { x: 42, y: 28 }, { x: 60, y: 24 },
  ];
  blades.forEach(({ x, y }) => {
    g.fillStyle(0x2a6e2e, 0.30);
    g.fillRect(x, y, 1, 2);
    g.fillStyle(0x56b85a, 0.20);
    g.fillRect(x, y - 1, 1, 1);
  });

  // ── Specular top-right highlight (sun glint on wet grass) ────────────
  g.fillStyle(0xffffff, 0.06);
  g.beginPath();
  g.moveTo(corners.T.x, corners.T.y);
  g.lineTo(corners.R.x, corners.R.y);
  g.lineTo(corners.B.x, corners.B.y);
  g.closePath();
  g.fillPath();

  // ── Subtle vignette: darken edges of the diamond ─────────────────────
  g.lineStyle(2, 0x1a5c1e, 0.35);
  g.beginPath();
  g.moveTo(corners.T.x, corners.T.y);
  g.lineTo(corners.R.x, corners.R.y);
  g.lineTo(corners.B.x, corners.B.y);
  g.lineTo(corners.L.x, corners.L.y);
  g.closePath();
  g.strokePath();

  g.generateTexture('tile-field', W, H);
  g.destroy();
}

function makePlayer(scene) {
  const colors = [0x2f8f83, 0x3eaa98];

  colors.forEach((color, index) => {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    const bob = index === 0 ? 0 : -2;
    g.fillStyle(0x13343c, 0.35);
    g.fillEllipse(16, 25, 18, 7);
    g.fillStyle(color, 1);
    g.fillCircle(16, 15 + bob, 9);
    g.fillStyle(0xf5d6a6, 1);
    g.fillCircle(16, 9 + bob, 5);
    g.fillStyle(0xffffff, 1);
    g.fillTriangle(16, 3 + bob, 12, 9 + bob, 20, 9 + bob);
    g.generateTexture(`player-${index}`, 32, 32);
    g.destroy();
  });
}

// ----------------------------------------------------------------------------
// POI ICONS - drawn as clean white glyphs (24x24) so they read well on top
// of any colored POI marker circle.
// ----------------------------------------------------------------------------
function makeIcons(scene) {
  makeGateIcon(scene);
  makeSeatIcon(scene);
  makeFoodIcon(scene);
  makeRestroomIcon(scene);
  makeMedicalIcon(scene);
  makeMerchIcon(scene);
}

const ICON_SIZE = 24;
const WHITE = 0xffffff;

function newIconGraphics(scene) {
  return scene.make.graphics({ x: 0, y: 0, add: false });
}

// Gate: a simple entrance arch
function makeGateIcon(scene) {
  const g = newIconGraphics(scene);
  g.lineStyle(2.4, WHITE, 1);
  g.lineBetween(6, 10, 6, 19);
  g.lineBetween(18, 10, 18, 19);
  g.beginPath();
  g.moveTo(6, 10);
  g.lineTo(6, 7);
  g.lineTo(9, 5);
  g.lineTo(15, 5);
  g.lineTo(18, 7);
  g.lineTo(18, 10);
  g.strokePath();
  g.lineBetween(4, 19, 20, 19);
  g.generateTexture('icon-gate', ICON_SIZE, ICON_SIZE);
  g.destroy();
}

// Seat: a stylised armchair / stadium seat glyph
function makeSeatIcon(scene) {
  const g = newIconGraphics(scene);
  g.fillStyle(WHITE, 1);
  g.fillRoundedRect(6, 4, 12, 9, 2);
  g.fillRoundedRect(5, 12, 14, 5, 2);
  g.fillRoundedRect(4, 11, 3, 7, 1);
  g.fillRoundedRect(17, 11, 3, 7, 1);
  g.fillRect(6, 19, 2, 3);
  g.fillRect(16, 19, 2, 3);
  g.generateTexture('icon-seat', ICON_SIZE, ICON_SIZE);
  g.destroy();
}

// Food: a fork and knife
function makeFoodIcon(scene) {
  const g = newIconGraphics(scene);
  g.lineStyle(2, WHITE, 1);
  g.lineBetween(15, 4, 15, 20);
  g.fillStyle(WHITE, 1);
  g.fillTriangle(13, 4, 17, 4, 15, 11);
  g.lineBetween(8, 12, 8, 20);
  g.lineBetween(6, 4, 6, 11);
  g.lineBetween(8, 4, 8, 11);
  g.lineBetween(10, 4, 10, 11);
  g.lineBetween(6, 11, 10, 11);
  g.generateTexture('icon-food', ICON_SIZE, ICON_SIZE);
  g.destroy();
}

// Restroom: simple person silhouette
function makeRestroomIcon(scene) {
  const g = newIconGraphics(scene);
  g.fillStyle(WHITE, 1);
  g.fillCircle(12, 6, 3);
  g.fillTriangle(7, 20, 17, 20, 12, 10);
  g.fillRect(9, 10, 6, 6);
  g.generateTexture('icon-restroom', ICON_SIZE, ICON_SIZE);
  g.destroy();
}

// Medical: red cross on white
function makeMedicalIcon(scene) {
  const g = newIconGraphics(scene);
  g.fillStyle(WHITE, 1);
  g.fillRoundedRect(2, 2, 20, 20, 4);
  g.fillStyle(0xd93838, 1);
  g.fillRect(10, 5, 4, 14);
  g.fillRect(5, 10, 14, 4);
  g.generateTexture('icon-medical', ICON_SIZE, ICON_SIZE);
  g.destroy();
}

// Merch: a price tag / shopping tag
function makeMerchIcon(scene) {
  const g = newIconGraphics(scene);
  g.fillStyle(WHITE, 1);
  g.fillTriangle(4, 12, 12, 4, 20, 12);
  g.fillRect(4, 12, 16, 8);
  g.fillStyle(0x1f2937, 1);
  g.fillCircle(12, 9, 1.6);
  g.generateTexture('icon-merch', ICON_SIZE, ICON_SIZE);
  g.destroy();
}

// ----------------------------------------------------------------------------
// 2D Flat view tile generators
// ----------------------------------------------------------------------------
function makeFloor2D(scene) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(0x9ea5ab, 1);
  g.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
  g.lineStyle(1, 0x8b9198, 0.45);
  g.strokeRect(0.5, 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
  g.generateTexture('tile-floor-2d', TILE_SIZE, TILE_SIZE);
  g.destroy();
}

function makeWall2D(scene) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(0x23262b, 1);
  g.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
  g.lineStyle(1, 0x14161a, 0.85);
  g.strokeRect(0.5, 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
  g.generateTexture('tile-wall-2d', TILE_SIZE, TILE_SIZE);
  g.destroy();
}

function makeSeat2D(scene) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(0x4aa3df, 1);
  g.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
  g.lineStyle(1, 0x27577a, 0.5);
  g.strokeRect(0.5, 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
  g.generateTexture('tile-seat-2d', TILE_SIZE, TILE_SIZE);
  g.destroy();
}

function makeField2D(scene) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(0x3e9142, 1);
  g.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
  g.lineStyle(1, 0x2f7a34, 0.3);
  g.strokeRect(0.5, 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
  g.generateTexture('tile-field-2d', TILE_SIZE, TILE_SIZE);
  g.destroy();
}


// ----------------------------------------------------------------------------
// EXTERIOR TILES (3D Isometric)
// ----------------------------------------------------------------------------

// TILE 4: Parking Lot - asphalt diamond with parking line markings
function makeParkingLot(scene) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  const corners = diamondCorners();

  // Base asphalt color
  fillDiamond(g, corners, 0x4a5057, 1);

  // Slight gradient for realism
  g.fillStyle(0xffffff, 0.04);
  g.beginPath();
  g.moveTo(corners.T.x, corners.T.y);
  g.lineTo(corners.R.x, corners.R.y);
  g.lineTo(corners.B.x, corners.B.y);
  g.closePath();
  g.fillPath();

  // Parking line (yellow stripe)
  g.lineStyle(1.5, 0xf5d041, 0.85);
  g.lineBetween(corners.L.x + 8, corners.L.y, corners.R.x - 8, corners.R.y);

  // Oil stain
  g.fillStyle(0x1a1d22, 0.25);
  g.fillCircle(26, 14, 4);

  // Crack
  g.lineStyle(1, 0x33373f, 0.40);
  g.lineBetween(16, 10, 22, 18);

  strokeDiamond(g, corners, 0x33373f, 0.25, 1);

  g.generateTexture('tile-parking', W, H);
  g.destroy();
}

// TILE 5: Grass / Landscaping - natural grass diamond
function makeGrass(scene) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  const corners = diamondCorners();

  // Base grass color (slightly different from field)
  fillDiamond(g, corners, 0x5ba35f, 1);

  // Subtle patches of varied green
  g.fillStyle(0x4d9251, 0.35);
  g.fillCircle(18, 10, 8);
  g.fillCircle(42, 18, 6);

  // Grass blades
  const blades = [
    { x: 12, y:  8 }, { x: 28, y:  6 }, { x: 44, y:  9 },
    { x: 20, y: 14 }, { x: 36, y: 12 }, { x: 52, y: 16 },
    { x: 16, y: 20 }, { x: 32, y: 22 }, { x: 48, y: 19 },
  ];
  blades.forEach(({ x, y }) => {
    g.fillStyle(0x3f7543, 0.40);
    g.fillRect(x, y, 1, 3);
  });

  // Light gradient
  g.fillStyle(0xffffff, 0.05);
  g.beginPath();
  g.moveTo(corners.T.x, corners.T.y);
  g.lineTo(corners.R.x, corners.R.y);
  g.lineTo(corners.B.x, corners.B.y);
  g.closePath();
  g.fillPath();

  strokeDiamond(g, corners, 0x4d9251, 0.20, 1);

  g.generateTexture('tile-grass', W, H);
  g.destroy();
}

// TILE 6: Trees / Decorative - stylized tree on grass
function makeTree(scene) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  const corners = diamondCorners();

  // Grass base
  fillDiamond(g, corners, 0x5ba35f, 1);

  // Tree shadow (ellipse on ground)
  g.fillStyle(0x1a3a1e, 0.30);
  g.fillEllipse(W / 2, H / 2 + 4, 14, 6);

  // Tree trunk
  const trunkX = W / 2;
  const trunkY = H / 2 - 6;
  g.fillStyle(0x5d4037, 1);
  g.fillRect(trunkX - 2, trunkY, 4, 12);

  // Tree foliage (circular canopy)
  g.fillStyle(0x2e7d32, 1);
  g.fillCircle(trunkX, trunkY - 2, 9);
  
  // Foliage highlights
  g.fillStyle(0x4caf50, 0.65);
  g.fillCircle(trunkX - 3, trunkY - 4, 5);
  g.fillCircle(trunkX + 3, trunkY - 5, 4);

  // Foliage shadow
  g.fillStyle(0x1b5e20, 0.50);
  g.fillCircle(trunkX + 2, trunkY + 1, 5);

  strokeDiamond(g, corners, 0x4d9251, 0.20, 1);

  g.generateTexture('tile-tree', W, H);
  g.destroy();
}

// TILE 7: Road / Street - asphalt with road markings
function makeRoad(scene) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  const corners = diamondCorners();

  // Dark asphalt
  fillDiamond(g, corners, 0x36393e, 1);

  // Road center line (dashed yellow)
  g.fillStyle(0xffd740, 0.90);
  const dashes = 6;
  for (let i = 0; i < dashes; i++) {
    const t0 = (i * 2) / (dashes * 2);
    const t1 = (i * 2 + 1) / (dashes * 2);
    const y0 = corners.T.y + (corners.B.y - corners.T.y) * t0;
    const y1 = corners.T.y + (corners.B.y - corners.T.y) * t1;
    g.fillRect(W / 2 - 1, y0, 2, y1 - y0);
  }

  // Tire marks
  g.lineStyle(1, 0x23262b, 0.20);
  g.lineBetween(14, 6, 12, 26);
  g.lineBetween(48, 8, 50, 24);

  // Subtle gradient
  g.fillStyle(0xffffff, 0.03);
  g.beginPath();
  g.moveTo(corners.T.x, corners.T.y);
  g.lineTo(corners.R.x, corners.R.y);
  g.lineTo(corners.B.x, corners.B.y);
  g.closePath();
  g.fillPath();

  strokeDiamond(g, corners, 0x23262b, 0.30, 1);

  g.generateTexture('tile-road', W, H);
  g.destroy();
}

function makeExteriorTiles(scene) {
  makeParkingLot(scene);
  makeGrass(scene);
  makeTree(scene);
  makeRoad(scene);
}

// ----------------------------------------------------------------------------
// EXTERIOR TILES (2D Flat View)
// ----------------------------------------------------------------------------

function makeParkingLot2D(scene) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(0x4a5057, 1);
  g.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
  g.lineStyle(1.5, 0xf5d041, 0.70);
  g.lineBetween(0, TILE_SIZE / 2, TILE_SIZE, TILE_SIZE / 2);
  g.lineStyle(1, 0x33373f, 0.35);
  g.strokeRect(0.5, 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
  g.generateTexture('tile-parking-2d', TILE_SIZE, TILE_SIZE);
  g.destroy();
}

function makeGrass2D(scene) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(0x5ba35f, 1);
  g.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
  g.fillStyle(0x4d9251, 0.25);
  g.fillRect(4, 4, 10, 10);
  g.fillRect(18, 16, 12, 12);
  g.lineStyle(1, 0x4d9251, 0.25);
  g.strokeRect(0.5, 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
  g.generateTexture('tile-grass-2d', TILE_SIZE, TILE_SIZE);
  g.destroy();
}

function makeTree2D(scene) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(0x5ba35f, 1);
  g.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
  g.fillStyle(0x5d4037, 1);
  g.fillRect(TILE_SIZE / 2 - 2, TILE_SIZE / 2 - 2, 4, 10);
  g.fillStyle(0x2e7d32, 1);
  g.fillCircle(TILE_SIZE / 2, TILE_SIZE / 2 - 4, 8);
  g.lineStyle(1, 0x4d9251, 0.25);
  g.strokeRect(0.5, 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
  g.generateTexture('tile-tree-2d', TILE_SIZE, TILE_SIZE);
  g.destroy();
}

function makeRoad2D(scene) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(0x36393e, 1);
  g.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
  g.fillStyle(0xffd740, 0.85);
  for (let i = 0; i < TILE_SIZE; i += 6) {
    g.fillRect(TILE_SIZE / 2 - 1, i, 2, 3);
  }
  g.lineStyle(1, 0x23262b, 0.40);
  g.strokeRect(0.5, 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
  g.generateTexture('tile-road-2d', TILE_SIZE, TILE_SIZE);
  g.destroy();
}

function makeExteriorTiles2D(scene) {
  makeParkingLot2D(scene);
  makeGrass2D(scene);
  makeTree2D(scene);
  makeRoad2D(scene);
}
