import axios, { AxiosInstance, AxiosError } from 'axios';
import { config } from '../config/index.js';
import { AgentConfig, VoiceSettings } from '../types/index.js';
import { OptimizedPromptModel } from '../models/index.js';

// Store current prompt separately from cache for mock responses
let currentMockPrompt: string = '';

// Cache for agent configurations
const agentCache = new Map<string, { data: AgentConfig; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Rate limiting state
let rateLimitedUntil: number | null = null;

export interface HighLevelAgent {
  id: string;
  name: string;
  prompt: string;
  voiceSettings?: VoiceSettings;
  metadata?: {
    industry?: string;
    useCase?: string;
  };
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  message: string;
  conversationId: string;
}

class HighLevelClient {
  private client: AxiosInstance;
  private useMock: boolean;

  constructor() {
    this.useMock = !config.HIGHLEVEL_API_KEY || config.NODE_ENV === 'development';
    
    this.client = axios.create({
      baseURL: config.HIGHLEVEL_API_BASE_URL,
      headers: {
        'Authorization': `Bearer ${config.HIGHLEVEL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // Add response interceptor for rate limiting
    this.client.interceptors.response.use(
      response => response,
      async (error: AxiosError) => {
        if (error.response?.status === 429) {
          const retryAfter = parseInt(error.response.headers['retry-after'] || '60', 10);
          rateLimitedUntil = Date.now() + (retryAfter * 1000);
          console.warn(`⚠️ Rate limited. Retry after ${retryAfter} seconds`);
        }
        throw error;
      }
    );

    if (this.useMock) {
      console.log('📝 Using mock HighLevel API client');
    }
  }

  private checkRateLimit(): void {
    if (rateLimitedUntil && Date.now() < rateLimitedUntil) {
      const waitTime = Math.ceil((rateLimitedUntil - Date.now()) / 1000);
      throw new Error(`Rate limited. Please wait ${waitTime} seconds.`);
    }
    rateLimitedUntil = null;
  }

  private async withRetry<T>(operation: () => Promise<T>, maxRetries: number = 3): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        this.checkRateLimit();
        return await operation();
      } catch (error) {
        lastError = error as Error;
        if (axios.isAxiosError(error)) {
          if (error.response?.status && error.response.status >= 400 && error.response.status < 500 && error.response.status !== 429) {
            throw error;
          }
        }
        if (attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError;
  }

  async getAgent(agentId: string): Promise<AgentConfig> {
    const cached = agentCache.get(agentId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    if (this.useMock) {
      return await this.getMockAgent(agentId);
    }

    return this.withRetry(async () => {
      const response = await this.client.get<HighLevelAgent>(`/voice-ai/agents/${agentId}`);
      const agent = response.data;
      
      const agentConfig: AgentConfig = {
        agentId: agent.id,
        systemPrompt: agent.prompt,
        voiceSettings: agent.voiceSettings,
        businessContext: {
          industry: agent.metadata?.industry,
          useCase: agent.metadata?.useCase,
        },
      };

      agentCache.set(agentId, { data: agentConfig, timestamp: Date.now() });
      return agentConfig;
    });
  }

  async updateAgentPrompt(agentId: string, newPrompt: string): Promise<void> {
    if (this.useMock) {
      console.log(`📝 [MOCK] Updated agent ${agentId} prompt (${newPrompt.length} chars)`);
      // Update BOTH the cache AND the current mock prompt
      currentMockPrompt = newPrompt;
      const cached = agentCache.get(agentId);
      if (cached) {
        cached.data.systemPrompt = newPrompt;
        cached.timestamp = Date.now();
      }
      return;
    }

    return this.withRetry(async () => {
      await this.client.put(`/voice-ai/agents/${agentId}`, { prompt: newPrompt });
      agentCache.delete(agentId);
    });
  }

  async chat(agentId: string, message: string, conversationId?: string): Promise<ChatResponse> {
    if (this.useMock) {
      return this.getMockChatResponse(agentId, message);
    }

    return this.withRetry(async () => {
      const response = await this.client.post<ChatResponse>(`/voice-ai/agents/${agentId}/chat`, {
        message,
        conversationId,
      });
      return response.data;
    });
  }

  async simulateConversation(agentId: string, messages: string[]): Promise<{ turns: ChatMessage[]; conversationId: string }> {
    const turns: ChatMessage[] = [];
    let conversationId: string | undefined;

    for (const message of messages) {
      turns.push({ role: 'user', content: message });
      const response = await this.chat(agentId, message, conversationId);
      conversationId = response.conversationId;
      turns.push({ role: 'assistant', content: response.message });
    }

    return { turns, conversationId: conversationId! };
  }

  // ============================================
  // Mock implementations
  // ============================================

  private async getMockAgent(agentId: string): Promise<AgentConfig> {
    const cached = agentCache.get(agentId);
    if (cached) {
      return cached.data;
    }

    // Check DB for saved optimized prompt
    const savedOptimized = await OptimizedPromptModel.findOne({ agentId });
    
    let systemPrompt: string;
    
    if (savedOptimized) {
      console.log(`📦 [MOCK] Using saved optimized prompt for ${agentId} (score: ${(savedOptimized.score * 100).toFixed(0)}%)`);
      systemPrompt = savedOptimized.optimizedPrompt;
    } else {
      console.log(`⚠️ [MOCK] Using BAD initial prompt for ${agentId} (needs optimization)`);
      systemPrompt = `You are a customer service agent.

Answer customer questions.

Be helpful.`;
    }

    // Set the current mock prompt
    currentMockPrompt = systemPrompt;

    const mockAgent: AgentConfig = {
      agentId,
      systemPrompt,
      voiceSettings: { voice: 'alloy', speed: 1.0, pitch: 1.0 },
      businessContext: {
        industry: 'Healthcare',
        useCase: 'Appointment Scheduling',
        targetAudience: 'Dental patients',
        complianceRequirements: ['HIPAA'],
      },
    };

    agentCache.set(agentId, { data: mockAgent, timestamp: Date.now() });
    return mockAgent;
  }

  /**
   * Calculate prompt quality score (0-1) based on key features
   */
  private getPromptQualityScore(): number {
    const prompt = currentMockPrompt.toLowerCase();
    let score = 0;
    const checks = [
      prompt.includes('dental') || prompt.includes('clinic') || prompt.includes('bright smile'),
      prompt.includes('cleaning') || prompt.includes('whitening') || prompt.includes('filling'),
      prompt.includes('$') || prompt.includes('price') || prompt.includes('99'),
      prompt.includes('monday') || prompt.includes('hours') || prompt.includes('8:00'),
      prompt.includes('sunday') || prompt.includes('closed') || prompt.includes('holiday'),
      prompt.includes('email') || prompt.includes('confirm'),
      prompt.includes('february') || prompt.includes('invalid') || prompt.includes('28'),
      prompt.includes('clarif') || prompt.includes('ambiguous') || prompt.includes('what type'),
      prompt.includes('vaccination') || prompt.includes('flu') || prompt.includes('covid'),
      currentMockPrompt.length > 400,
    ];
    
    score = checks.filter(Boolean).length / checks.length;
    console.log(`  📊 Prompt quality score: ${(score * 100).toFixed(0)}% (length: ${currentMockPrompt.length})`);
    return score;
  }

  private getMockChatResponse(agentId: string, message: string): ChatResponse {
    const quality = this.getPromptQualityScore();
    const msg = message.toLowerCase();
    let response: string;

    // INVALID DATE TESTS (Feb 30, 30/02, etc.)
    if (msg.includes('february 30') || msg.includes('feb 30') || msg.includes('30/02') || msg.includes('30-02')) {
      if (quality >= 0.5) {
        response = "I notice that February 30th isn't a valid date - February only has 28 or 29 days. Could you please provide a different date? I'd be happy to check our availability.";
      } else {
        response = "I'd be happy to help you schedule an appointment! Could you please provide your preferred date and time?";
      }
    }
    // HOLIDAY TESTS (Jan 1, New Year)
    else if (msg.includes('january 1') || msg.includes('jan 1') || msg.includes('new year')) {
      if (quality >= 0.5) {
        response = "I'm sorry, but January 1st is New Year's Day and our clinic is closed. We reopen on January 2nd. Would you like me to schedule your appointment for January 2nd instead? I have openings at 9:00 AM, 11:00 AM, and 2:00 PM.";
      } else {
        response = "I'd be happy to help you schedule an appointment! Could you please provide your preferred date and time?";
      }
    }
    // SUNDAY TESTS
    else if (msg.includes('sunday')) {
      if (quality >= 0.5) {
        response = "I'm sorry, but we're closed on Sundays. Our hours are Monday-Friday 8AM-6PM and Saturday 9AM-2PM. Would you like to schedule for Monday instead?";
      } else {
        response = "I'd be happy to help you schedule an appointment! Could you please provide your preferred date and time?";
      }
    }
    // SERVICE INQUIRY
    else if (msg.includes('service') || msg.includes('offer') || msg.includes('what do you')) {
      if (quality >= 0.5) {
        response = "At Bright Smile Dental Clinic, we offer:\n• Routine Cleanings - $99\n• Teeth Whitening - $299\n• Dental Fillings - $150-$300\n• Root Canal - $800-$1200\n• Crowns - $900-$1500\n• Pediatric Dentistry - $75-$200\n• Flu shots - $25\n• COVID-19 vaccines - Free\n\nWould you like to schedule an appointment for any of these services?";
      } else {
        response = "We offer various services. What can I help you with today?";
      }
    }
    // VACCINATION INQUIRY
    else if (msg.includes('vaccination') || msg.includes('vaccine') || msg.includes('flu') || msg.includes('covid')) {
      if (quality >= 0.5) {
        response = "Yes! We offer vaccinations:\n• Flu shots - $25\n• COVID-19 vaccines - Free\n\nWould you like to schedule a vaccination appointment?";
      } else {
        response = "Thank you for reaching out! What can I help you with today?";
      }
    }
    // AMBIGUOUS/CLARIFICATION NEEDED
    else if (msg.includes('appointment') && (msg.includes('don\'t know') || msg.includes('what type') || msg.includes('what kind'))) {
      if (quality >= 0.5) {
        response = "No problem! Let me help you. What type of appointment do you need?\n1. Routine Cleaning & Checkup\n2. Teeth Whitening\n3. Dental Filling\n4. Emergency/Pain\n5. Consultation\n\nWhich one sounds closest to what you need?";
      } else {
        response = "Thank you for reaching out! What can I help you with today?";
      }
    }
    // APPOINTMENT SCHEDULING (general)
    else if (msg.includes('appointment') || msg.includes('schedule') || msg.includes('book')) {
      if (quality >= 0.6) {
        response = "I'd be happy to help you schedule an appointment at Bright Smile Dental Clinic! What type of service do you need? We offer cleanings ($99), whitening ($299), fillings, and more. Once you let me know, I can check our availability.";
      } else {
        response = "I'd be happy to help you schedule an appointment! Could you please provide your preferred date and time?";
      }
    }
    // CONFIRMATION WITH DETAILS
    else if (msg.includes('monday') || msg.includes('tuesday') || msg.includes('next week')) {
      if (quality >= 0.6) {
        response = "Great! I can schedule that for you. To confirm your appointment, I'll need:\n1. The specific service you need\n2. Your preferred time\n3. Your email address for confirmation\n\nCould you provide these details?";
      } else {
        response = "Thank you for reaching out! What can I help you with today?";
      }
    }
    // DEFAULT
    else {
      if (quality >= 0.5) {
        response = "Welcome to Bright Smile Dental Clinic! I can help you with:\n• Scheduling appointments\n• Information about our services and pricing\n• Vaccination appointments\n\nHow can I assist you today?";
      } else {
        response = "Thank you for reaching out! I'm here to help. What can I assist you with today?";
      }
    }

    return {
      message: response,
      conversationId: `mock-conv-${Date.now()}`,
    };
  }

  clearCache(): void {
    agentCache.clear();
    currentMockPrompt = '';
    console.log('🗑️ Agent cache cleared');
  }

  getRateLimitStatus(): { isLimited: boolean; retryAfter?: number } {
    if (rateLimitedUntil && Date.now() < rateLimitedUntil) {
      return { isLimited: true, retryAfter: Math.ceil((rateLimitedUntil - Date.now()) / 1000) };
    }
    return { isLimited: false };
  }
}

export const highLevelClient = new HighLevelClient();
