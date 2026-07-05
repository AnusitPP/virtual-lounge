import {
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

type Player = {
  name: string;
  x: number;
  y: number;
  color: number;
};

const players = new Map<string, Player>();

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ChatGateway {
  private lastBroadcast = 0;
  private broadcastTimeout: NodeJS.Timeout | null = null;

  private broadcast() {
    const now = Date.now();
    const timeSinceLastBroadcast = now - this.lastBroadcast;

    if (timeSinceLastBroadcast >= 50) {
      if (this.broadcastTimeout) {
        clearTimeout(this.broadcastTimeout);
        this.broadcastTimeout = null;
      }
      this.server.emit('players', Array.from(players.entries()));
      this.lastBroadcast = now;
    } else {
      if (!this.broadcastTimeout) {
        this.broadcastTimeout = setTimeout(() => {
          this.server.emit('players', Array.from(players.entries()));
          this.lastBroadcast = Date.now();
          this.broadcastTimeout = null;
        }, 50 - timeSinceLastBroadcast);
      }
    }
  }

  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log('connect:', client.id);
  }

  handleDisconnect(client: Socket) {
    players.delete(client.id);
    this.server.emit('players', Array.from(players.entries()));
  }

  @SubscribeMessage('join')
  handleJoin(
    @MessageBody() data: { name: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join('lobby');

    players.set(client.id, {
      name: data.name,
      x: 200,
      y: 200,
      color: Math.floor(Math.random() * 0xffffff),
    });

    // Broadcast immediately on join so other players see them instantly
    this.server.emit('players', Array.from(players.entries()));
  }

  @SubscribeMessage('move')
  handleMove(
    @MessageBody() data: { x: number; y: number },
    @ConnectedSocket() client: Socket,
  ) {
    const p = players.get(client.id);
    if (!p) return;

    p.x = data.x;
    p.y = data.y;

    this.broadcast();
  }
}
