import Phaser from 'phaser';
import { socket } from '../socket';

type Player = {
  name: string;
  x: number;
  y: number;
  color: number;
};

type PlayersPayload = [string, Player][];

type RemotePlayer = {
  body: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
  targetX: number;
  targetY: number;
};

export class GameScene extends Phaser.Scene {
  player!: Phaser.GameObjects.Rectangle;
  cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  wasdKeys!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };

  lastSent = 0;

  otherPlayers: Map<string, RemotePlayer> = new Map();

  create() {
    console.log('GAME START');

    // input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasdKeys = this.input.keyboard!.addKeys({
      W: Phaser.Input.Keyboard.KeyCodes.W,
      A: Phaser.Input.Keyboard.KeyCodes.A,
      S: Phaser.Input.Keyboard.KeyCodes.S,
      D: Phaser.Input.Keyboard.KeyCodes.D
    }) as any;

    // local player
    this.player = this.add.rectangle(200, 200, 32, 32, 0x00ff00);


    // socket connect
    const joinLobby = () => {
      if (socket.id) {
        socket.emit('join', {
          name: `Player_${socket.id.slice(0, 4)}`,
        });
      }
    };

    if (socket.connected) {
      joinLobby();
    }

    socket.on('connect', joinLobby);

    const onPlayers = (players: PlayersPayload) => {
      if (!this.sys || !this.sys.isActive() || !this.add) {
        return;
      }

      const alive = new Set(players.map(([id]) => id));

      // remove dead
      this.otherPlayers.forEach((obj, id) => {
        if (!alive.has(id)) {
          obj.body.destroy();
          obj.text.destroy();
          this.otherPlayers.delete(id);
        }
      });

      // update / create
      players.forEach(([id, data]) => {
        if (id === socket.id) {
          return;
        }

        let p = this.otherPlayers.get(id);

        if (!p) {
          if (!this.add) return;
          const body = this.add.rectangle(data.x, data.y, 32, 32, data.color);
          const text = this.add.text(data.x, data.y - 20, data.name);

          p = {
            body,
            text,
            targetX: data.x,
            targetY: data.y,
          };

          this.otherPlayers.set(id, p);
        }

        p.targetX = data.x;
        p.targetY = data.y;
      });
    };

    socket.on('players', onPlayers);

    // Clean up socket listeners when scene shutdowns
    this.events.once('shutdown', () => {
      socket.off('connect', joinLobby);
      socket.off('players', onPlayers);
    });
  }

  update() {
    if (!this.cursors) return;

    const speed = 3;
    let moved = false;

    // movement
    if (this.cursors.left?.isDown || this.wasdKeys.A?.isDown) {
      this.player.x -= speed;
      moved = true;
    }

    if (this.cursors.right?.isDown || this.wasdKeys.D?.isDown) {
      this.player.x += speed;
      moved = true;
    }

    if (this.cursors.up?.isDown || this.wasdKeys.W?.isDown) {
      this.player.y -= speed;
      moved = true;
    }

    if (this.cursors.down?.isDown || this.wasdKeys.S?.isDown) {
      this.player.y += speed;
      moved = true;
    }

    // send position
    const now = Date.now();
    if (moved && now - this.lastSent > 50) {
      socket.emit('move', {
        x: this.player.x,
        y: this.player.y,
      });

      this.lastSent = now;
    }

    // smooth other players
    this.otherPlayers.forEach((p) => {
      p.body.x += (p.targetX - p.body.x) * 0.15;
      p.body.y += (p.targetY - p.body.y) * 0.15;

      p.text.x = p.body.x;
      p.text.y = p.body.y - 20;
    });
  }
}