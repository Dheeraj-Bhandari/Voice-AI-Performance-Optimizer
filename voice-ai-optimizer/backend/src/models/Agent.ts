import mongoose, { Document, Schema } from 'mongoose';

export interface AgentDocument extends Document {
  agentId: string;
  name: string;
  initialPrompt: string;
  currentPrompt: string;
  businessContext: {
    industry: string;
    useCase: string;
    services: string[];
    workingHours: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const AgentSchema = new Schema<AgentDocument>(
  {
    agentId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    initialPrompt: { type: String, required: true },
    currentPrompt: { type: String, required: true },
    businessContext: {
      industry: { type: String, default: 'Healthcare' },
      useCase: { type: String, default: 'Appointment Scheduling' },
      services: [{ type: String }],
      workingHours: { type: String },
    },
  },
  { timestamps: true }
);

export const AgentModel = mongoose.model<AgentDocument>('Agent', AgentSchema);

// Default bad prompt for new agents
export const DEFAULT_BAD_PROMPT = `You are a customer service agent.

Answer customer questions.

Be helpful.`;

// Create or get agent
export async function getOrCreateAgent(agentId: string): Promise<AgentDocument> {
  let agent = await AgentModel.findOne({ agentId });
  
  if (!agent) {
    agent = await AgentModel.create({
      agentId,
      name: 'Bright Smile Dental Clinic Agent',
      initialPrompt: DEFAULT_BAD_PROMPT,
      currentPrompt: DEFAULT_BAD_PROMPT,
      businessContext: {
        industry: 'Healthcare',
        useCase: 'Dental Appointment Scheduling',
        services: [
          'Routine Dental Cleanings ($99)',
          'Teeth Whitening ($299)',
          'Dental Fillings ($150-$300)',
          'Root Canal Treatment ($800-$1200)',
          'Dental Crowns ($900-$1500)',
          'Orthodontic Consultations (Free)',
          'Pediatric Dentistry ($75-$200)',
          'Flu shots ($25)',
          'COVID-19 vaccines (Free)',
        ],
        workingHours: 'Mon-Fri 8AM-6PM, Sat 9AM-2PM, Sun CLOSED',
      },
    });
    console.log(`✅ Created new agent: ${agentId}`);
  }
  
  return agent;
}
