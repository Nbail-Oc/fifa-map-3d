/**
 * Sprite Extractor for Godot Tilesets
 * 
 * Handles extraction of individual sprites from Godot tileset sprite sheets
 * for use in Phaser game engine with zoom-based detail levels.
 */

/**
 * Load and slice a tileset into individual sprite textures
 * @param {Phaser.Scene} scene - The Phaser scene
 * @param {string} textureKey - The loaded texture key
 * @param {Object} config - Slicing configuration
 * @param {number} config.tileWidth - Width of each tile
 * @param {number} config.tileHeight - Height of each tile
 * @param {number} config.margin - Margin around tileset (default: 0)
 * @param {number} config.spacing - Spacing between tiles (default: 0)
 * @param {string} config.prefix - Prefix for generated sprite keys
 * @returns {Array} Array of generated sprite keys
 */
export function sliceTileset(scene, textureKey, config) {
  const {
    tileWidth,
    tileHeight,
    margin = 0,
    spacing = 0,
    prefix = 'tile'
  } = config;

  const texture = scene.textures.get(textureKey);
  const source = texture.getSourceImage();
  const keys = [];

  const cols = Math.floor((source.width - margin * 2 + spacing) / (tileWidth + spacing));
  const rows = Math.floor((source.height - margin * 2 + spacing) / (tileHeight + spacing));

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = margin + col * (tileWidth + spacing);
      const y = margin + row * (tileHeight + spacing);
      
      const key = `${prefix}-${row}-${col}`;
      
      // Create a new texture from the slice
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      const tempCanvas = scene.textures.createCanvas(`temp-${key}`, tileWidth, tileHeight);
      const ctx = tempCanvas.context;
      
      // Draw the slice
      ctx.drawImage(
        source,
        x, y, tileWidth, tileHeight,
        0, 0, tileWidth, tileHeight
      );
      
      tempCanvas.refresh();
      
      keys.push(key);
    }
  }

  return keys;
}

/**
 * Configuration for known Godot tileset formats
 */
export const TILESET_CONFIGS = {
  // Sprout Lands grass tiles
  grass: {
    tileWidth: 16,
    tileHeight: 16,
    margin: 0,
    spacing: 0,
    prefix: 'grass'
  },
  
  // Fences
  fences: {
    tileWidth: 16,
    tileHeight: 16,
    margin: 0,
    spacing: 0,
    prefix: 'fence'
  },
  
  // Doors
  doors: {
    tileWidth: 16,
    tileHeight: 16,
    margin: 0,
    spacing: 0,
    prefix: 'door'
  },
  
  // Basic furniture (larger sprites)
  furniture: {
    tileWidth: 16,
    tileHeight: 16,
    margin: 0,
    spacing: 0,
    prefix: 'furniture'
  }
};

/**
 * Extract specific sprite by index from a sliced tileset
 * @param {Array} spriteKeys - Array of sprite keys from sliceTileset
 * @param {number} row - Row index
 * @param {number} col - Column index
 * @param {number} cols - Total columns in the tileset
 * @returns {string} Sprite key
 */
export function getSpriteKey(spriteKeys, row, col, cols) {
  const index = row * cols + col;
  return spriteKeys[index] || null;
}

/**
 * Create detail-level sprite variants for zoom-based rendering
 * @param {Phaser.Scene} scene - The Phaser scene
 * @param {string} spriteKey - Source sprite key
 * @param {Object} detailConfig - Detail level configuration
 * @returns {Object} Object with lowDetail, mediumDetail, highDetail keys
 */
export function createDetailLevels(scene, spriteKey, detailConfig = {}) {
  const {
    lowDetailScale = 0.5,
    mediumDetailScale = 1.0,
    highDetailScale = 2.0,
    prefix = spriteKey
  } = detailConfig;

  const texture = scene.textures.get(spriteKey);
  if (!texture) {
    console.warn(`Texture ${spriteKey} not found`);
    return null;
  }

  const source = texture.getSourceImage();
  const keys = {};

  // Low detail (simplified, smaller)
  const lowKey = `${prefix}-low`;
  const lowCanvas = scene.textures.createCanvas(
    lowKey,
    source.width * lowDetailScale,
    source.height * lowDetailScale
  );
  lowCanvas.context.imageSmoothingEnabled = false;
  lowCanvas.context.drawImage(
    source,
    0, 0, source.width, source.height,
    0, 0, source.width * lowDetailScale, source.height * lowDetailScale
  );
  lowCanvas.refresh();
  keys.lowDetail = lowKey;

  // Medium detail (original)
  keys.mediumDetail = spriteKey;

  // High detail (scaled up with filtering for smoothness)
  const highKey = `${prefix}-high`;
  const highCanvas = scene.textures.createCanvas(
    highKey,
    source.width * highDetailScale,
    source.height * highDetailScale
  );
  highCanvas.context.imageSmoothingEnabled = true;
  highCanvas.context.drawImage(
    source,
    0, 0, source.width, source.height,
    0, 0, source.width * highDetailScale, source.height * highDetailScale
  );
  highCanvas.refresh();
  keys.highDetail = highKey;

  return keys;
}

/**
 * Determine which detail level to use based on camera zoom
 * @param {number} zoom - Current camera zoom level
 * @returns {string} Detail level: 'low', 'medium', or 'high'
 */
export function getDetailLevel(zoom) {
  if (zoom < 0.6) return 'low';
  if (zoom < 1.5) return 'medium';
  return 'high';
}

/**
 * Enhanced seat detail generator for zoom levels
 * Creates individual seat sprites with people at high zoom
 */
export function generateDetailedSeatSprites(scene, characterSprites) {
  const seatConfigs = [
    { key: 'seat-empty', hasChar: false, color: 0x4aa3df },
    { key: 'seat-occupied-blue', hasChar: true, charIndex: 0, color: 0x4aa3df },
    { key: 'seat-occupied-teal', hasChar: true, charIndex: 1, color: 0x3fbfae },
    { key: 'seat-occupied-purple', hasChar: true, charIndex: 2, color: 0x8b6be8 }
  ];

  const seatWidth = 16;
  const seatHeight = 16;

  seatConfigs.forEach(({ key, hasChar, charIndex, color }) => {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });

    // Draw seat base
    g.fillStyle(color, 1);
    g.fillRoundedRect(2, 8, 12, 6, 1);

    // Seat back
    g.fillStyle(color, 0.8);
    g.fillRoundedRect(3, 4, 10, 5, 1);

    // Armrests
    g.fillStyle(color, 0.9);
    g.fillRect(2, 8, 1, 4);
    g.fillRect(13, 8, 1, 4);

    // Highlight
    g.fillStyle(0xffffff, 0.3);
    g.fillRect(4, 5, 8, 1);

    // Shadow
    g.fillStyle(0x000000, 0.2);
    g.fillRect(3, 13, 10, 1);

    if (hasChar && characterSprites && characterSprites[charIndex]) {
      // Draw simplified character sitting
      const charX = 8;
      const charY = 7;
      
      // Head
      g.fillStyle(0xf5d6a6, 1);
      g.fillCircle(charX, charY, 2);
      
      // Body
      g.fillStyle(0x2f8f83, 1);
      g.fillRect(charX - 2, charY + 1, 4, 3);
    }

    g.generateTexture(key, seatWidth, seatHeight);
    g.destroy();
  });

  return seatConfigs.map(c => c.key);
}
