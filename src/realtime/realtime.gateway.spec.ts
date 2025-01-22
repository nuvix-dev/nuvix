import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { RealtimeModule } from './realtime.module';

describe('RealtimeGateway', () => {
  let app: INestApplication;
  let wsClient: WebSocket;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [RealtimeModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should handle WebSocket events', (done) => {
    const ws = new WebSocket('ws://localhost:3000/');

    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({ event: 'events', data: 'test message' }));
    });

    ws.addEventListener('message', (event) => {
      const parsedMessage = JSON.parse(event.data);
      expect(parsedMessage).toBe('test message');
      ws.close();
      done();
    });

    ws.addEventListener('error', (error) => {
      console.log(error, '_____________THE ERROR');
      done(error);
    });
  });
});
