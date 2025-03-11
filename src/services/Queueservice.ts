import Queue from 'bull';
import { DCAService } from './DCAService';
export const dcaQueue = new Queue('dca-execution', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379
  }
});

dcaQueue.process(async (job) => {
  const { orderId, intervalSeconds } = job.data;
  const dcaService = new DCAService();
  return await dcaService.processScheduledTrade(orderId, intervalSeconds);
});


