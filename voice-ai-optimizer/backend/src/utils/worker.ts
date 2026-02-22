import { Worker, Job, ConnectionOptions } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config/index.js';
import { JobData, JobResult } from './queue.js';

// Redis connection for worker
const redisConnection = new IORedis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});
const connection = redisConnection as unknown as ConnectionOptions;

// Job processor - will be implemented with actual services later
async function processJob(job: Job<JobData, JobResult>): Promise<JobResult> {
  console.log(`🔄 Processing job ${job.id} of type ${job.data.type}`);

  try {
    switch (job.data.type) {
      case 'test-execution':
        // Will be implemented in TestExecutorService
        await job.updateProgress(10);
        console.log(`📋 Test execution job for suite ${job.data.suiteId}`);
        
        // Placeholder - actual implementation will call TestExecutorService
        await job.updateProgress(100);
        return { success: true, data: { message: 'Test execution placeholder' } };

      case 'optimization-loop':
        // Will be implemented in OptimizationService
        await job.updateProgress(10);
        console.log(`🔧 Optimization job for suite ${job.data.suiteId}`);
        
        // Placeholder - actual implementation will call OptimizationService
        await job.updateProgress(100);
        return { success: true, data: { message: 'Optimization placeholder' } };

      default:
        throw new Error(`Unknown job type: ${(job.data as JobData).type}`);
    }
  } catch (error) {
    console.error(`❌ Job ${job.id} failed:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}


// Create worker
export const worker = new Worker<JobData, JobResult>(
  'voice-ai-optimizer',
  processJob,
  {
    connection,
    concurrency: 3, // Process up to 3 jobs concurrently
    limiter: {
      max: 10,
      duration: 1000, // Max 10 jobs per second
    },
  }
);

// Worker event handlers
worker.on('completed', (job, result) => {
  console.log(`✅ Worker completed job ${job.id}`);
});

worker.on('failed', (job, error) => {
  console.error(`❌ Worker failed job ${job?.id}:`, error.message);
});

worker.on('error', (error) => {
  console.error('❌ Worker error:', error);
});

// Cleanup function
export async function closeWorker(): Promise<void> {
  await worker.close();
  await redisConnection.quit();
  console.log('📦 Worker closed');
}
