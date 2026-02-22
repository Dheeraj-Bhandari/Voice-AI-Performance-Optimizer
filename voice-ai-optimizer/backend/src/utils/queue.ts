import { Queue, Job, QueueEvents, ConnectionOptions } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config/index.js';

// Redis connection for BullMQ
const redisConnection = new IORedis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});
const connection = redisConnection as unknown as ConnectionOptions;

// Job types
export type JobType = 'test-execution' | 'optimization-loop';

export interface TestExecutionJobData {
  type: 'test-execution';
  suiteId: string;
  agentId: string;
  userId: string;
}

export interface OptimizationJobData {
  type: 'optimization-loop';
  suiteId: string;
  agentId: string;
  userId: string;
  maxIterations: number;
  targetScore: number;
}

export type JobData = TestExecutionJobData | OptimizationJobData;

export interface JobResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// Create the main queue
export const optimizerQueue = new Queue<JobData, JobResult>('voice-ai-optimizer', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: {
      count: 100, // Keep last 100 completed jobs
    },
    removeOnFail: {
      count: 50, // Keep last 50 failed jobs
    },
  },
});

// Queue events for monitoring
export const queueEvents = new QueueEvents('voice-ai-optimizer', { connection });


queueEvents.on('completed', ({ jobId, returnvalue }) => {
  console.log(`✅ Job ${jobId} completed`);
});

queueEvents.on('failed', ({ jobId, failedReason }) => {
  console.error(`❌ Job ${jobId} failed: ${failedReason}`);
});

queueEvents.on('progress', ({ jobId, data }) => {
  console.log(`📊 Job ${jobId} progress:`, data);
});

// Helper to add jobs
export async function addJob(data: JobData): Promise<Job<JobData, JobResult, string>> {
  const jobName = data.type;
  const job = await optimizerQueue.add(jobName as any, data, {
    jobId: `${data.type}-${data.suiteId}-${Date.now()}`,
  });
  console.log(`📥 Added job ${job.id} to queue`);
  return job as Job<JobData, JobResult, string>;
}

// Helper to get job status
export async function getJobStatus(jobId: string): Promise<{
  id: string;
  status: string;
  progress: number;
  data: JobData | undefined;
  result: JobResult | undefined;
  failedReason: string | undefined;
} | null> {
  const job = await optimizerQueue.getJob(jobId);
  if (!job) return null;

  const state = await job.getState();
  
  return {
    id: job.id || jobId,
    status: state,
    progress: job.progress as number || 0,
    data: job.data,
    result: job.returnvalue as JobResult | undefined,
    failedReason: job.failedReason,
  };
}

// Cleanup function
export async function closeQueue(): Promise<void> {
  await optimizerQueue.close();
  await queueEvents.close();
  await redisConnection.quit();
  console.log('📦 Queue connections closed');
}
