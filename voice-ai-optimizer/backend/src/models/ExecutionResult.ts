import mongoose, { Schema, Document, Model } from 'mongoose';
import { 
  ExecutionResult, 
  TestResponse, 
  Evaluation,
  CriteriaResult,
  ConversationTurn,
  ExecutionStatus 
} from '../types/index.js';

const ConversationTurnSchema = new Schema({
  role: { type: String, enum: ['user', 'expected-agent', 'actual-agent'], required: true },
  content: { type: String, required: true },
  timing: { type: Number },
  metadata: { type: Schema.Types.Mixed },
}, { _id: false });

const TestResponseSchema = new Schema<TestResponse>({
  id: { type: String, required: true },
  executionId: { type: String, required: true },
  testCaseId: { type: String, required: true },
  conversationTurns: [ConversationTurnSchema],
  latency: { type: Number, required: true },
  rawResponse: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
}, { _id: false });

const CriteriaResultSchema = new Schema<CriteriaResult>({
  criterionId: { type: String, required: true },
  passed: { type: Boolean, required: true },
  score: { 
    type: Number, 
    required: true,
    min: 0,
    max: 1
  },
  reasoning: { type: String, required: true },
}, { _id: false });

const EvaluationSchema = new Schema<Evaluation>({
  testCaseId: { type: String, required: true },
  passed: { type: Boolean, required: true },
  criteriaResults: [CriteriaResultSchema],
  overallScore: { 
    type: Number, 
    required: true,
    min: 0,
    max: 1
  },
  reasoning: { type: String, required: true },
  confidence: { 
    type: Number, 
    required: true,
    min: 0,
    max: 1
  },
}, { _id: false });

export interface ExecutionResultDocument extends Omit<ExecutionResult, 'id'>, Document {}

const ExecutionResultSchema = new Schema<ExecutionResultDocument>({
  suiteId: { type: String, required: true, index: true },
  agentId: { type: String, required: true, index: true },
  responses: [TestResponseSchema],
  evaluations: [EvaluationSchema],
  duration: { type: Number, required: true },
  status: { 
    type: String, 
    enum: Object.values(ExecutionStatus),
    default: ExecutionStatus.PENDING,
    index: true
  },
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  error: { type: String },
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (_doc: Document, ret: Record<string, unknown>) => {
      ret.id = (ret._id as mongoose.Types.ObjectId).toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Compound indexes
ExecutionResultSchema.index({ executionId: 1, testCaseId: 1 });
ExecutionResultSchema.index({ suiteId: 1, createdAt: -1 });

export const ExecutionResultModel: Model<ExecutionResultDocument> = mongoose.model<ExecutionResultDocument>('ExecutionResult', ExecutionResultSchema);
