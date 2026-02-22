import mongoose, { Schema, Document, Model } from 'mongoose';
import crypto from 'crypto';
import { 
  OptimizationRecord, 
  PromptChange, 
  PerformanceMetrics,
  OptimizationStatus 
} from '../types/index.js';

// Encryption helpers for sensitive prompt data
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex').slice(0, 32);
const IV_LENGTH = 16;

function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text: string): string {
  const parts = text.split(':');
  const iv = Buffer.from(parts.shift()!, 'hex');
  const encryptedText = Buffer.from(parts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

const PromptChangeSchema = new Schema<PromptChange>({
  type: { 
    type: String, 
    enum: ['addition', 'modification', 'removal', 'restructure'],
    required: true 
  },
  description: { type: String, required: true },
  targetedFailure: { type: String, required: true },
  before: { type: String },
  after: { type: String },
}, { _id: false });

const PerformanceMetricsSchema = new Schema<PerformanceMetrics>({
  overallScore: { type: Number, required: true, min: 0, max: 1 },
  passRate: { type: Number, required: true, min: 0, max: 1 },
  criteriaScores: { type: Map, of: Number },
  avgResponseLatency: { type: Number, required: true },
}, { _id: false });

export interface OptimizationRecordDocument extends Omit<OptimizationRecord, 'id' | 'originalPrompt' | 'optimizedPrompt'>, Document {
  originalPromptEncrypted: string;
  optimizedPromptEncrypted: string;
}

const OptimizationRecordSchema = new Schema<OptimizationRecordDocument>({
  agentId: { type: String, required: true, index: true },
  executionId: { type: String, required: true },
  originalPromptEncrypted: { type: String, required: true },
  optimizedPromptEncrypted: { type: String, required: true },
  changes: [PromptChangeSchema],
  beforeMetrics: { type: PerformanceMetricsSchema, required: true },
  afterMetrics: { type: PerformanceMetricsSchema },
  status: { 
    type: String, 
    enum: Object.values(OptimizationStatus),
    default: OptimizationStatus.PENDING,
    index: true
  },
  appliedAt: { type: Date },
  validatedAt: { type: Date },
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (_doc: Document, ret: Record<string, unknown>) => {
      ret.id = (ret._id as mongoose.Types.ObjectId).toString();
      // Decrypt prompts for JSON output
      if (ret.originalPromptEncrypted) {
        ret.originalPrompt = decrypt(ret.originalPromptEncrypted as string);
        delete ret.originalPromptEncrypted;
      }
      if (ret.optimizedPromptEncrypted) {
        ret.optimizedPrompt = decrypt(ret.optimizedPromptEncrypted as string);
        delete ret.optimizedPromptEncrypted;
      }
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Virtual getters for decrypted prompts
OptimizationRecordSchema.virtual('originalPrompt').get(function(this: OptimizationRecordDocument): string {
  return this.originalPromptEncrypted ? decrypt(this.originalPromptEncrypted) : '';
});

OptimizationRecordSchema.virtual('optimizedPrompt').get(function(this: OptimizationRecordDocument): string {
  return this.optimizedPromptEncrypted ? decrypt(this.optimizedPromptEncrypted) : '';
});

// Setters for encryption
OptimizationRecordSchema.methods.setOriginalPrompt = function(this: OptimizationRecordDocument, prompt: string): void {
  this.originalPromptEncrypted = encrypt(prompt);
};

OptimizationRecordSchema.methods.setOptimizedPrompt = function(this: OptimizationRecordDocument, prompt: string): void {
  this.optimizedPromptEncrypted = encrypt(prompt);
};

// Prevent deletion of applied records
OptimizationRecordSchema.pre<OptimizationRecordDocument>('deleteOne', { document: true, query: false }, function(next) {
  if (this.status === OptimizationStatus.APPLIED) {
    next(new Error('Cannot delete optimization record with status "applied" - audit trail must be preserved'));
  }
  next();
});

// Also prevent via query
OptimizationRecordSchema.pre('deleteOne', { document: false, query: true }, async function(next) {
  const doc = await this.model.findOne(this.getFilter());
  if (doc && doc.status === OptimizationStatus.APPLIED) {
    next(new Error('Cannot delete optimization record with status "applied" - audit trail must be preserved'));
  }
  next();
});

// Validate status transitions
OptimizationRecordSchema.pre<OptimizationRecordDocument>('save', function(next) {
  if (this.isModified('status') && !this.isNew) {
    const validTransitions: Record<OptimizationStatus, OptimizationStatus[]> = {
      [OptimizationStatus.PENDING]: [OptimizationStatus.APPLIED],
      [OptimizationStatus.APPLIED]: [OptimizationStatus.VALIDATED, OptimizationStatus.ROLLED_BACK],
      [OptimizationStatus.VALIDATED]: [],
      [OptimizationStatus.ROLLED_BACK]: [],
    };

    const currentStatus = this.status as OptimizationStatus;
    const previousStatus = (this as unknown as { _previousStatus?: OptimizationStatus })._previousStatus;
    
    if (previousStatus && !validTransitions[previousStatus]?.includes(currentStatus)) {
      next(new Error(`Invalid status transition from ${previousStatus} to ${currentStatus}`));
      return;
    }
  }
  next();
});

// Store previous status for transition validation
OptimizationRecordSchema.pre<OptimizationRecordDocument>('save', function(next) {
  if (!this.isNew) {
    (this as unknown as { _previousStatus?: OptimizationStatus })._previousStatus = this.status as OptimizationStatus;
  }
  next();
});

// Compound indexes
OptimizationRecordSchema.index({ agentId: 1, createdAt: -1 });

export const OptimizationRecordModel: Model<OptimizationRecordDocument> = mongoose.model<OptimizationRecordDocument>('OptimizationRecord', OptimizationRecordSchema);

// Helper functions for creating records with encryption
export async function createOptimizationRecord(data: {
  agentId: string;
  executionId: string;
  originalPrompt: string;
  optimizedPrompt: string;
  changes: PromptChange[];
  beforeMetrics: PerformanceMetrics;
}): Promise<OptimizationRecordDocument> {
  const record = new OptimizationRecordModel({
    agentId: data.agentId,
    executionId: data.executionId,
    originalPromptEncrypted: encrypt(data.originalPrompt),
    optimizedPromptEncrypted: encrypt(data.optimizedPrompt),
    changes: data.changes,
    beforeMetrics: data.beforeMetrics,
    status: OptimizationStatus.PENDING,
  });
  return record.save();
}
