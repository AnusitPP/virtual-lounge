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
  roomId: string;
};

const players = new Map<string, Player>();

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ChatGateway {
  private roomLastBroadcast = new Map<string, number>();
  private roomBroadcastTimeout = new Map<string, NodeJS.Timeout>();

  private broadcastRoom(roomId: string) {
    const roomPlayers = Array.from(players.entries()).filter(
      ([_, p]) => p.roomId === roomId
    );
    this.server.to(roomId).emit('players', roomPlayers);
  }

  private broadcastRoomThrottled(roomId: string) {
    const now = Date.now();
    const lastBroadcast = this.roomLastBroadcast.get(roomId) || 0;
    const timeSinceLastBroadcast = now - lastBroadcast;

    const performBroadcast = () => {
      this.broadcastRoom(roomId);
      this.roomLastBroadcast.set(roomId, Date.now());
      this.roomBroadcastTimeout.delete(roomId);
    };

    if (timeSinceLastBroadcast >= 50) {
      const timeout = this.roomBroadcastTimeout.get(roomId);
      if (timeout) {
        clearTimeout(timeout);
        this.roomBroadcastTimeout.delete(roomId);
      }
      performBroadcast();
    } else {
      if (!this.roomBroadcastTimeout.has(roomId)) {
        const timeout = setTimeout(() => {
          performBroadcast();
        }, 50 - timeSinceLastBroadcast);
        this.roomBroadcastTimeout.set(roomId, timeout);
      }
    }
  }

  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log('connect:', client.id);
  }

  handleDisconnect(client: Socket) {
    const p = players.get(client.id);
    if (p) {
      const roomId = p.roomId;
      players.delete(client.id);
      this.broadcastRoom(roomId);
    }
  }

  @SubscribeMessage('join')
  handleJoin(
    @MessageBody() data: { name: string; roomId?: string; color?: number },
    @ConnectedSocket() client: Socket,
  ) {
    const roomId = data.roomId || 'lobby';

    // Leave any other rooms (except client's own private room ID)
    client.rooms.forEach((room) => {
      if (room !== client.id) {
        client.leave(room);
      }
    });

    client.join(roomId);

    players.set(client.id, {
      name: data.name,
      x: 200,
      y: 200,
      color: data.color !== undefined ? data.color : Math.floor(Math.random() * 0xffffff),
      roomId,
    });

    // Broadcast immediately to the new room so others see the join
    this.broadcastRoom(roomId);
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

    this.broadcastRoomThrottled(p.roomId);
  }
}
