import Phaser from 'phaser';

export class GameScene extends Phaser.Scene {
  create() {
    console.log('SCENE START');

    this.add.rectangle(400, 300, 100, 100, 0x00ff00);
  }
}