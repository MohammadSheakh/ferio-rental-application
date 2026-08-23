import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('application info', () => {
    it('returns the Ferio API identity', () => {
      expect(appController.getApplicationInfo()).toEqual({
        name: 'Ferio Commerce API',
        version: '0.1.0',
      });
    });

    it('returns an operational health response', () => {
      expect(appController.getHealth()).toEqual({
        status: 'ok',
        timestamp: expect.any(String),
      });
    });
  });
});
