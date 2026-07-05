import Phaser from 'phaser';
import { GameScene } from './Game';

export const initGame = (parent: string) => {
  return new Phaser.Game({
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent,
    backgroundColor: '#1e1e1e',
    scene: [GameScene],
  });
};