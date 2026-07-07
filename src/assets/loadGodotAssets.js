/**
 * Godot Asset Loader for Phaser
 * 
 * Loads and processes Godot tileset sprite sheets for use in the stadium map
 */

import grassPng from '../../ASSETS/Modern tiles_Free/Sprout Lands - Sprites - Basic pack/Tilesets/Grass.png';
import fencesPng from '../../ASSETS/Modern tiles_Free/Sprout Lands - Sprites - Basic pack/Tilesets/Fences.png';
import doorsPng from '../../ASSETS/Modern tiles_Free/Sprout Lands - Sprites - Basic pack/Tilesets/Doors.png';
import furniturePng from '../../ASSETS/Modern tiles_Free/Sprout Lands - Sprites - Basic pack/Objects/Basic Furniture.png';

// Sitting character sprites for detailed seats
import adamSitPng from '../../ASSETS/Modern tiles_Free/Characters_free/Adam_sit_16x16.png';
import alexSitPng from '../../ASSETS/Modern tiles_Free/Characters_free/Alex_sit_16x16.png';
import ameliaSitPng from '../../ASSETS/Modern tiles_Free/Characters_free/Amelia_sit_16x16.png';
import bobSitPng from '../../ASSETS/Modern tiles_Free/Characters_free/Bob_sit_16x16.png';

import { sliceTileset, TILESET_CONFIGS, generateDetailedSeatSprites } from './spriteExtractor.js';

/**
 * Asset paths and configurations
 */
export const GODOT_ASSETS = {
  tilesets: {
    grass: { path: grassPng, config: TILESET_CONFIGS.grass },
    fences: { path: fencesPng, config: TILESET_CONFIGS.fences },
    doors: { path: doorsPng, config: TILESET_CONFIGS.doors },
    furniture: { path: furniturePng, config: TILESET_CONFIGS.furniture }
  },
  characters: {
    adamSit: adamSitPng,
    alexSit: alexSitPng,
    ameliaSit: ameliaSitPng,
    bobSit: bobSitPng
  }
};

/**
 * Preload all Godot assets in BootScene
 * @param {Phaser.Scene} scene - The boot scene
 */
export function preloadGodotAssets(scene) {
  // Load tilesets as single images
  Object.entries(GODOT_ASSETS.tilesets).forEach(([key, { path }]) => {
    scene.load.image(`tileset-${key}`, path);
  });

  // Load character spritesheets (sitting poses for detailed seats)
  Object.entries(GODOT_ASSETS.characters).forEach(([key, path]) => {
    scene.load.spritesheet(`char-${key}`, path, {
      frameWidth: 16,
      frameHeight: 16
    });
  });
}

/**
 * Process loaded Godot assets in the create phase
 * @param {Phaser.Scene} scene - The scene where assets will be used
 * @returns {Object} Processed asset keys organized by type
 */
export function processGodotAssets(scene) {
  const processed = {
    grass: [],
    fences: [],
    doors: [],
    furniture: [],
    detailedSeats: [],
    characters: []
  };

  // Slice tilesets into individual sprites
  Object.entries(GODOT_ASSETS.tilesets).forEach(([key, { config }]) => {
    const textureKey = `tileset-${key}`;
    if (scene.textures.exists(textureKey)) {
      const spriteKeys = sliceTileset(scene, textureKey, config);
      processed[key] = spriteKeys;
      console.log(`✓ Sliced ${key} tileset: ${spriteKeys.length} sprites`);
    }
  });

  // Generate detailed seat sprites with characters
  const charKeys = Object.keys(GODOT_ASSETS.characters).map(k => `char-${k}`);
  processed.detailedSeats = generateDetailedSeatSprites(scene, charKeys);
  console.log(`✓ Generated ${processed.detailedSeats.length} detailed seat sprites`);

  return processed;
}

/**
 * Get a random grass variant for natural-looking terrain
 * @param {Array} grassSprites - Array of grass sprite keys
 * @returns {string} Random grass sprite key
 */
export function getRandomGrass(grassSprites) {
  if (!grassSprites || grassSprites.length === 0) return null;
  return grassSprites[Math.floor(Math.random() * grassSprites.length)];
}

/**
 * Get a fence sprite by direction
 * Assumes fence sprites are organized by row (horizontal, vertical, corners, etc.)
 * @param {Array} fenceSprites - Array of fence sprite keys
 * @param {string} direction - 'horizontal', 'vertical', 'corner-tl', 'corner-tr', etc.
 * @returns {string} Fence sprite key
 */
export function getFenceSprite(fenceSprites, direction) {
  if (!fenceSprites || fenceSprites.length === 0) return null;
  
  // Mapping based on typical Godot fence tileset organization
  const directionMap = {
    'horizontal': 0,
    'vertical': 1,
    'corner-tl': 2,
    'corner-tr': 3,
    'corner-bl': 4,
    'corner-br': 5,
    'end-left': 6,
    'end-right': 7,
    'end-top': 8,
    'end-bottom': 9
  };
  
  const index = directionMap[direction] || 0;
  return fenceSprites[Math.min(index, fenceSprites.length - 1)];
}

/**
 * Get furniture sprite by index
 * @param {Array} furnitureSprites - Array of furniture sprite keys
 * @param {number} index - Furniture index
 * @returns {string} Furniture sprite key
 */
export function getFurnitureSprite(furnitureSprites, index = 0) {
  if (!furnitureSprites || furnitureSprites.length === 0) return null;
  return furnitureSprites[Math.min(index, furnitureSprites.length - 1)];
}

/**
 * Sprite index helpers for common furniture items
 * These are estimates - adjust based on actual tileset layout
 */
export const FURNITURE_INDICES = {
  CHAIR: 0,
  TABLE: 4,
  BENCH: 8,
  COUNTER: 12,
  STALL: 16,
  SIGN: 20
};
