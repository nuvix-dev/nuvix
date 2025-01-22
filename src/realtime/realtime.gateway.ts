import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
} from '@nestjs/websockets';
import { RealtimeService } from './realtime.service';

@WebSocketGateway({
  namespace: 'v1/realtime',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  allowEIO3: true,
  transports: ['websocket', 'polling'],
})
export class RealtimeGateway {
  constructor(private readonly realtimeService: RealtimeService) {}

  @WebSocketServer() server: any;

  @SubscribeMessage('events')
  handleEvent(@MessageBody() data: string) {
    this.server.emit('events', data);
  }
}
