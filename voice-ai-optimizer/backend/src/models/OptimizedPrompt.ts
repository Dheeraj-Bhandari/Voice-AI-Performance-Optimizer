import mongoose, { Document, Schema } from 'mongoose';

export interface OptimizedPromptDocument extends Document {
  agentId: string;
  originalPrompt: string;
  optimizedPrompt: string;
  score: number;
  iterations: number;
  createdAt: Date;
  updatedAt: Date;
}

const OptimizedPromptSchema = new Schema<OptimizedPromptDocument>(
  {
    agentId: { type: String, required: true, unique: true, index: true },
    originalPrompt: { type: String, required: true },
    optimizedPrompt: { type: String, required: true },
    score: { type: Number, required: true },
    iterations: { type: Number, required: true },
  },
  { timestamps: true }
);

export const OptimizedPromptModel = mongoose.model<OptimizedPromptDocument>(
  'OptimizedPrompt',
  OptimizedPromptSchema
);
