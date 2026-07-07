import Phaser from 'phaser';
import { generateAssets } from './assets/generateAssets.js';
import { preloadGodotAssets, processGodotAssets } from './assets/loadGodotAssets.js';
import idlePng from './assets/Dude_Monster_Idle_4.png';
import walkPng from './assets/Dude_Monster_Walk_6.png';
import tileRoad from './assets/processed/tile_road.png';
import tileGrass from './assets/processed/tile_grass.png';
import tileFloor from './assets/processed/tile_floor.png';
import tileField from './assets/processed/tile_field.png';
import decorCar from './assets/processed/decor_car.png';
import standGate from './assets/processed/stand_gate.png';
import standMedical from './assets/processed/stand_medical.png';
import seatGeneral from './assets/processed/seat_general.png';
import seatVip from './assets/processed/seat_vip.png';
import seatPremium from './assets/processed/seat_premium.png';
import standFood from './assets/processed/stand_food.png';
import decorTree from './assets/processed/decor_tree.png';
import standMerch from './assets/processed/stand_merch.png';
import standRestroom from './assets/processed/stand_restroom.png';
import StaffScene from './scenes/StaffScene.js';
import './styles.css';

class StaffBootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    this.load.spritesheet('player-idle', idlePng, { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('player-walk', walkPng, { frameWidth: 32, frameHeight: 32 });
    preloadGodotAssets(this);
    this.load.image('ai-tile-road', tileRoad);
    this.load.image('ai-tile-grass', tileGrass);
    this.load.image('ai-tile-floor', tileFloor);
    this.load.image('ai-tile-field', tileField);
    this.load.image('ai-decor-car', decorCar);
    this.load.image('ai-stand-gate', standGate);
    this.load.image('ai-stand-medical', standMedical);
    this.load.image('ai-seat-general', seatGeneral);
    this.load.image('ai-seat-vip', seatVip);
    this.load.image('ai-seat-premium', seatPremium);
    this.load.image('ai-stand-food', standFood);
    this.load.image('ai-decor-tree', decorTree);
    this.load.image('ai-stand-merch', standMerch);
    this.load.image('ai-stand-restroom', standRestroom);
  }

  create() {
    generateAssets(this);
    const godotAssets = processGodotAssets(this);
    this.registry.set('godotAssets', godotAssets);
    this.scene.start('StaffScene');
  }
}

const config = {
  type: Phaser.AUTO,
  parent: 'app',
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#0f172a',
  pixelArt: true,
  scene: [StaffBootScene, StaffScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.NO_CENTER
  }
};

new Phaser.Game(config);

