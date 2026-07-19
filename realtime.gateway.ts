import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

/**
 * Realtime channel described in the API design notes. Auth here is
 * deliberately simple (userId handshake) for the skeleton — swap for a
 * verified JWT handshake (see JwtStrategy) before this leaves dev.
 *
 * Clients join `ride:{rideId}` once a ride exists, and drivers join
 * `driver:{driverId}` to receive incoming offers.
 */
@WebSocketGateway({ cors: true, namespace: '/v1/realtime' })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger('RealtimeGateway');

  handleConnection(client: Socket) {
    this.logger.log(`client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`client disconnected: ${client.id}`);
  }

  @SubscribeMessage('ride.subscribe')
  onSubscribeRide(client: Socket, rideId: string) {
    client.join(`ride:${rideId}`);
  }

  @SubscribeMessage('driver.subscribe')
  onSubscribeDriver(client: Socket, driverId: string) {
    client.join(`driver:${driverId}`);
  }

  emitToRide(rideId: string, event: string, payload: unknown) {
    this.server.to(`ride:${rideId}`).emit(event, payload);
  }

  emitToDriver(driverId: string, event: string, payload: unknown) {
    this.server.to(`driver:${driverId}`).emit(event, payload);
  }
}
