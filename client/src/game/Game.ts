import Phaser from 'phaser';
import { socket } from '../socket';
import room1Url from '../assets/room1.jpg';
import room2Url from '../assets/room2.jpg';
import room3Url from '../assets/room3.jpg';

type Player = {
  name: string;
  x: number;
  y: number;
  color: number;
  avatarImg?: string;
};

type PlayersPayload = [string, Player][];

type PositionUpdate = {
  x: number;
  y: number;
  timestamp: number;
};

type RemotePlayer = {
  body: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image;
  text: Phaser.GameObjects.Text;
  updates: PositionUpdate[];
  color: number;
  avatarImg?: string;
};

export class GameScene extends Phaser.Scene {
  player!: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image;
  playerText!: Phaser.GameObjects.Text;
  backgroundImage!: Phaser.GameObjects.Image;
  cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  wasdKeys!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };

  lastSent = 0;
  otherPlayers: Map<string, RemotePlayer> = new Map();

  // Helper to create body (rectangle or base64 image)
  createPlayerBody(x: number, y: number, color: number, avatarImg?: string, id?: string): Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image {
    const key = id ? `avatar_${id}` : 'avatar_local';
    
    if (avatarImg) {
      if (this.textures.exists(key)) {
        const img = this.add.image(x, y, key);
        img.setDisplaySize(32, 32);
        return img;
      }
      
      // Return a temporary colored rectangle while the image is loading
      const placeholder = this.add.rectangle(x, y, 32, 32, color);
      
      const loaderImg = new Image();
      loaderImg.onload = () => {
        // Safe check: Exit if the scene is destroyed or no longer active
        if (!this.sys || !this.sys.isActive() || !this.textures || !this.add) {
          return;
        }
        
        try {
          if (this.textures.exists(key)) {
            this.textures.remove(key);
          }
          
          this.textures.addImage(key, loaderImg);
          
          if (placeholder.active) {
            const px = placeholder.x;
            const py = placeholder.y;
            placeholder.destroy();
            
            const img = this.add.image(px, py, key);
            img.setDisplaySize(32, 32);
            
            if (id) {
              const remoteP = this.otherPlayers.get(id);
              if (remoteP && remoteP.body === placeholder) {
                remoteP.body = img;
              }
            } else {
              this.player = img;
              this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
            }
          }
        } catch (err) {
          console.error("Error creating player texture", err);
        }
      };
      loaderImg.src = avatarImg;
      
      return placeholder;
    } else {
      return this.add.rectangle(x, y, 32, 32, color);
    }
  }

  // Helper to dynamically update player visual when color or avatarImg changes
  updatePlayerVisual(p: { body: any; color?: number; avatarImg?: string }, color: number, avatarImg?: string, id?: string) {
    const oldX = p.body.x;
    const oldY = p.body.y;
    
    const hasImage = !!avatarImg;
    const isCurrentlyImage = p.body instanceof Phaser.GameObjects.Image;

    // Check if we need to reconstruct the body because type changed or image source changed
    const typeChanged = isCurrentlyImage !== hasImage;
    const imageChanged = hasImage && p.avatarImg !== avatarImg;
    const colorChanged = !hasImage && p.color !== color;

    if (typeChanged || imageChanged || colorChanged) {
      p.body.destroy();
      p.body = this.createPlayerBody(oldX, oldY, color, avatarImg, id);
      
      // Update our stored reference values
      p.color = color;
      p.avatarImg = avatarImg;

      // If local player and is ready, re-anchor camera
      if (!id && p.body instanceof Phaser.GameObjects.Image) {
        this.player = p.body;
        this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
      }
    }
  }

  preload() {
    this.load.image('room1', room1Url);
    this.load.image('room2', room2Url);
    this.load.image('room3', room3Url);
  }

  create() {
    console.log('GAME START');

    // 1. Set world bounds
    this.cameras.main.setBounds(0, 0, 2000, 2000);

    // 2. Add dynamic room background image
    const savedBg = sessionStorage.getItem('vl_background') || 'room1';
    this.backgroundImage = this.add.image(1000, 1000, savedBg);
    this.backgroundImage.setDisplaySize(2000, 2000);

    // 3. Register inputs
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasdKeys = this.input.keyboard!.addKeys({
      W: Phaser.Input.Keyboard.KeyCodes.W,
      A: Phaser.Input.Keyboard.KeyCodes.A,
      S: Phaser.Input.Keyboard.KeyCodes.S,
      D: Phaser.Input.Keyboard.KeyCodes.D
    }) as any;

    // 4. Local player config from sessionStorage
    const savedName = sessionStorage.getItem('vl_username') || `Player_${Math.floor(Math.random() * 9000 + 1000)}`;
    const savedColorHex = sessionStorage.getItem('vl_color') || '#00ff00';
    const savedColor = parseInt(savedColorHex.replace('#', '0x'));
    const savedAvatar = sessionStorage.getItem('vl_avatarImg') || '';

    // 5. Create local player and label
    this.player = this.createPlayerBody(200, 200, savedColor, savedAvatar);
    this.playerText = this.add.text(200, 180, savedName, {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold',
      backgroundColor: '#121212aa',
      padding: { x: 4, y: 2 }
    }).setOrigin(0.5);

    // 6. Camera Follow Easing, Zoom & Deadzone
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08); // Follow easing
    this.cameras.main.setZoom(1.2); // Smooth zoom
    this.cameras.main.setDeadzone(100, 100); // Camera deadzone

    // socket connect listener
    const joinLobby = () => {
      if (socket.id) {
        const currentName = sessionStorage.getItem('vl_username') || savedName;
        const currentColor = sessionStorage.getItem('vl_color') || savedColorHex;
        const currentRoom = sessionStorage.getItem('vl_roomId') || 'lobby';
        const currentAvatar = sessionStorage.getItem('vl_avatarImg') || '';
        socket.emit('join', {
          name: currentName,
          roomId: currentRoom,
          color: parseInt(currentColor.replace('#', '0x')),
          avatarImg: currentAvatar
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
          const body = this.createPlayerBody(data.x, data.y, data.color, data.avatarImg, id);
          const text = this.add.text(data.x, data.y - 20, data.name, {
            fontSize: '14px',
            color: '#ffffff',
            backgroundColor: '#121212aa',
            padding: { x: 4, y: 2 }
          }).setOrigin(0.5);

          p = {
            body,
            text,
            updates: [],
            color: data.color,
            avatarImg: data.avatarImg
          };

          this.otherPlayers.set(id, p);
        } else {
          // If name changed
          p.text.setText(data.name);
          
          // Dynamic visual update if avatar color or image changed
          this.updatePlayerVisual(p, data.color, data.avatarImg, id);
        }

        // Add coordinate updates to the history buffer for interpolation
        p.updates.push({
          x: data.x,
          y: data.y,
          timestamp: Date.now()
        });
      });
    };

    socket.on('players', onPlayers);

    // Profile updated listener (from React App.tsx form submit)
    const onProfileUpdate = (e: Event) => {
      const { name, color, avatarImg } = (e as CustomEvent).detail;
      const colorNum = parseInt(color.replace('#', '0x'));
      
      if (this.playerText) {
        this.playerText.setText(name);
      }

      // Update local player visual dynamically
      this.updatePlayerVisual(
        { body: this.player, color: savedColor, avatarImg: savedAvatar },
        colorNum,
        avatarImg
      );
    };

    window.addEventListener('vl-profile-updated', onProfileUpdate);

    // Background updated listener (from React App.tsx background select)
    const onBgUpdate = (e: Event) => {
      const { bg } = (e as CustomEvent).detail;
      if (this.backgroundImage) {
        this.backgroundImage.setTexture(bg);
      }
    };

    window.addEventListener('vl-bg-updated', onBgUpdate);

    // Disable Phaser keyboard input and preventDefault when typing in HTML inputs
    const onInputFocus = () => {
      if (this.input && this.input.keyboard) {
        this.input.keyboard.enabled = false;
        this.input.keyboard.clearCaptures();
      }
    };

    const onInputBlur = () => {
      if (this.input && this.input.keyboard) {
        this.input.keyboard.enabled = true;
        // Re-add captures for Arrow keys and Space (37=Left, 38=Up, 39=Right, 40=Down, 32=Space)
        this.input.keyboard.addCapture([32, 37, 38, 39, 40]);
      }
    };

    window.addEventListener('vl-input-focus', onInputFocus);
    window.addEventListener('vl-input-blur', onInputBlur);

    // Clean up socket and window listeners when scene shutdowns
    this.events.once('shutdown', () => {
      socket.off('connect', joinLobby);
      socket.off('players', onPlayers);
      window.removeEventListener('vl-profile-updated', onProfileUpdate);
      window.removeEventListener('vl-bg-updated', onBgUpdate);
      window.removeEventListener('vl-input-focus', onInputFocus);
      window.removeEventListener('vl-input-blur', onInputBlur);
    });
  }

  update() {
    if (!this.cursors) return;

    const speed = 4;
    let moved = false;

    // movement with borders bounds (0 to 2000)
    if (this.cursors.left?.isDown || this.wasdKeys.A?.isDown) {
      this.player.x = Phaser.Math.Clamp(this.player.x - speed, 16, 1984);
      moved = true;
    }

    if (this.cursors.right?.isDown || this.wasdKeys.D?.isDown) {
      this.player.x = Phaser.Math.Clamp(this.player.x + speed, 16, 1984);
      moved = true;
    }

    if (this.cursors.up?.isDown || this.wasdKeys.W?.isDown) {
      this.player.y = Phaser.Math.Clamp(this.player.y - speed, 16, 1984);
      moved = true;
    }

    if (this.cursors.down?.isDown || this.wasdKeys.S?.isDown) {
      this.player.y = Phaser.Math.Clamp(this.player.y + speed, 16, 1984);
      moved = true;
    }

    // Keep text label on top of local player
    if (this.playerText) {
      this.playerText.x = this.player.x;
      this.playerText.y = this.player.y - 24;
    }

    // send position to server
    const now = Date.now();
    if (moved && now - this.lastSent > 45) {
      socket.emit('move', {
        x: this.player.x,
        y: this.player.y,
      });

      this.lastSent = now;
    }

    // Smooth remote players rendering using Lerp with a 150ms buffer
    const renderTime = Date.now() - 150;
    this.otherPlayers.forEach((p) => {
      const updates = p.updates;
      
      if (updates.length >= 2) {
        // Find the updates framing the render time
        let i = 0;
        for (; i < updates.length - 1; i++) {
          if (updates[i].timestamp <= renderTime && updates[i + 1].timestamp >= renderTime) {
            break;
          }
        }

        if (i < updates.length - 1) {
          const u1 = updates[i];
          const u2 = updates[i + 1];

          // Calculate interpolation ratio (t)
          const total = u2.timestamp - u1.timestamp;
          const portion = renderTime - u1.timestamp;
          const t = total > 0 ? portion / total : 0;

          // Lerp coordinates
          p.body.x = u1.x + (u2.x - u1.x) * t;
          p.body.y = u1.y + (u2.y - u1.y) * t;
        } else {
          // If buffer lags or is empty, fall back to simple easing
          const latest = updates[updates.length - 1];
          p.body.x += (latest.x - p.body.x) * 0.15;
          p.body.y += (latest.y - p.body.y) * 0.15;
        }

        // Shift out old updates that are past renderTime to prevent memory leaks
        while (updates.length > 2 && updates[1].timestamp < renderTime) {
          updates.shift();
        }
      } else if (updates.length === 1) {
        // Simple easing for single initial packet
        const latest = updates[0];
        p.body.x += (latest.x - p.body.x) * 0.15;
        p.body.y += (latest.y - p.body.y) * 0.15;
      }

      // Update text label position
      p.text.x = p.body.x;
      p.text.y = p.body.y - 24;
    });
  }
}