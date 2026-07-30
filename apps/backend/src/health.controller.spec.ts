import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let healthController: HealthController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    healthController = app.get<HealthController>(HealthController);
  });

  describe('check', () => {
    it('reports "ok" status alongside a non-negative uptime and an ISO timestamp', () => {
      const result = healthController.check();

      expect(result.status).toBe('ok');
      expect(result.uptime).toBeGreaterThanOrEqual(0);
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    });
  });
});
