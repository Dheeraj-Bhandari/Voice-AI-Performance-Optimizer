import mongoose, { Schema, Document, Model } from 'mongoose';
import { 
  TestSuite, 
  TestCase, 
  SuccessCriteria, 
  ConversationTurn,
  TestCategory,
  CriteriaType,
  EvaluatorType,
  TestSuiteStatus,
  Priority
} from '../types/index.js';

// Sub-schemas
const ConversationTurnSchema = new Schema<ConversationTurn>({
  role: { 
    type: String, 
    enum: ['user', 'expected-agent', 'actual-agent'],
    required: true 
  },
  content: { type: String, required: true },
  timing: { type: Number },
  metadata: { type: Schema.Types.Mixed },
}, { _id: false });

const EvaluatorConfigSchema = new Schema({
  type: { 
    type: String, 
    enum: Object.values(EvaluatorType),
    required: true 
  },
  config: { type: Schema.Types.Mixed, required: true },
}, { _id: false });

const SuccessCriteriaSchema = new Schema<SuccessCriteria>({
  id: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  type: { 
    type: String, 
    enum: Object.values(CriteriaType),
    required: true 
  },
  evaluator: { type: EvaluatorConfigSchema, required: true },
  weight: { 
    type: Number, 
    required: true,
    min: 0,
    max: 1,
    validate: {
      validator: function(this: SuccessCriteria, v: number) {
        // Required criteria must have weight >= 0.5
        if (this.required && v < 0.5) {
          return false;
        }
        return true;
      },
      message: 'Required criteria must have weight >= 0.5'
    }
  },
  required: { type: Boolean, default: false },
}, { _id: false });

const TestCaseSchema = new Schema<TestCase>({
  id: { type: String, required: true },
  suiteId: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  category: { 
    type: String, 
    enum: Object.values(TestCategory),
    required: true 
  },
  conversationScript: {
    type: [ConversationTurnSchema],
    required: true,
    validate: {
      validator: function(v: ConversationTurn[]) {
        // Must have at least one turn and start with 'user'
        return v.length > 0 && v[0].role === 'user';
      },
      message: 'Conversation script must start with a user turn'
    }
  },
  successCriteria: {
    type: [SuccessCriteriaSchema],
    required: true,
    validate: {
      validator: function(v: SuccessCriteria[]) {
        // Must have at least one criterion
        if (v.length === 0) return false;
        // Weights should sum to 1 (with tolerance)
        const sum = v.reduce((acc, c) => acc + c.weight, 0);
        return Math.abs(sum - 1) < 0.01;
      },
      message: 'Test case must have at least one criterion and weights must sum to 1'
    }
  },
  priority: { 
    type: String, 
    enum: Object.values(Priority),
    default: Priority.MEDIUM 
  },
  tags: [{ type: String }],
}, { _id: false });

// Main TestSuite schema
export interface TestSuiteDocument extends Omit<TestSuite, 'id'>, Document {}

const TestSuiteSchema = new Schema<TestSuiteDocument>({
  agentId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  testCases: {
    type: [TestCaseSchema],
    required: true,
    validate: {
      validator: function(v: TestCase[]) {
        // Must have at least one test case
        if (v.length === 0) return false;
        // Names must be unique within suite
        const names = v.map(tc => tc.name);
        return names.length === new Set(names).size;
      },
      message: 'Test suite must have at least one test case with unique names'
    }
  },
  globalCriteria: [SuccessCriteriaSchema],
  version: { type: Number, default: 1 },
  status: { 
    type: String, 
    enum: Object.values(TestSuiteStatus),
    default: TestSuiteStatus.DRAFT,
    index: true
  },
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

// Auto-increment version on update
TestSuiteSchema.pre<TestSuiteDocument>('save', function(next) {
  if (!this.isNew && this.isModified()) {
    this.version += 1;
  }
  next();
});

// Compound index for common queries
TestSuiteSchema.index({ agentId: 1, status: 1 });
TestSuiteSchema.index({ agentId: 1, createdAt: -1 });

export const TestSuiteModel: Model<TestSuiteDocument> = mongoose.model<TestSuiteDocument>('TestSuite', TestSuiteSchema);
