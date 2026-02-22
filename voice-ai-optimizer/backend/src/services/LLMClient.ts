import axios, { AxiosInstance, AxiosError } from 'axios';
import { config } from '../config/index.js';

// Sanitization patterns for prompt injection prevention
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?)/gi,
  /disregard\s+(all\s+)?(previous|above|prior)/gi,
  /forget\s+(everything|all)/gi,
  /you\s+are\s+now/gi,
  /new\s+instructions?:/gi,
  /system\s*:\s*/gi,
  /\[INST\]/gi,
  /<<SYS>>/gi,
];

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface StructuredResponse<T> {
  data: T;
  raw: string;
  usage: LLMResponse['usage'];
}

class LLMClient {
  private client: AxiosInstance;
  private model: string;

  constructor() {
    this.model = 'openai/gpt-4o-mini'; // Cost-effective model on OpenRouter
    
    this.client = axios.create({
      baseURL: config.OPENROUTER_BASE_URL,
      headers: {
        'Authorization': `Bearer ${config.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://voice-ai-optimizer.local', // Required by OpenRouter
        'X-Title': 'Voice AI Optimizer',
      },
      timeout: 120000, // 2 minutes for long generations
    });
    
    console.log('🔑 LLM Client initialized with model:', this.model);
  }

  /**
   * Sanitize user input to prevent prompt injection
   */
  sanitizeInput(input: string): string {
    let sanitized = input;
    
    for (const pattern of INJECTION_PATTERNS) {
      sanitized = sanitized.replace(pattern, '[FILTERED]');
    }
    
    // Remove any potential control characters
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    return sanitized;
  }

  /**
   * Exponential backoff retry logic
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (axios.isAxiosError(error)) {
          const status = error.response?.status;
          
          // Don't retry on 4xx errors (except 429 rate limit)
          if (status && status >= 400 && status < 500 && status !== 429) {
            throw error;
          }
          
          // Handle rate limiting
          if (status === 429) {
            const retryAfter = parseInt(error.response?.headers['retry-after'] || '60', 10);
            console.warn(`⚠️ Rate limited. Waiting ${retryAfter} seconds...`);
            await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
            continue;
          }
        }
        
        if (attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`⏳ LLM retry attempt ${attempt + 1}/${maxRetries} in ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Basic chat completion
   */
  async chat(
    messages: ChatMessage[],
    options: {
      temperature?: number;
      maxTokens?: number;
      model?: string;
    } = {}
  ): Promise<LLMResponse> {
    const { temperature = 0.7, maxTokens = 4096, model = this.model } = options;

    return this.withRetry(async () => {
      try {
        const response = await this.client.post('/chat/completions', {
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
        });

        const data = response.data;
        
        return {
          content: data.choices[0].message.content,
          usage: {
            promptTokens: data.usage?.prompt_tokens || 0,
            completionTokens: data.usage?.completion_tokens || 0,
            totalTokens: data.usage?.total_tokens || 0,
          },
        };
      } catch (error) {
        if (axios.isAxiosError(error)) {
          console.error('❌ OpenRouter API error:', error.response?.status, error.response?.data);
        }
        throw error;
      }
    });
  }


  /**
   * Chat completion with JSON structured output
   */
  async chatJSON<T>(
    messages: ChatMessage[],
    options: {
      temperature?: number;
      maxTokens?: number;
      model?: string;
    } = {}
  ): Promise<StructuredResponse<T>> {
    // Add instruction to return JSON
    const systemMessage = messages.find(m => m.role === 'system');
    if (systemMessage) {
      systemMessage.content += '\n\nIMPORTANT: You must respond with valid JSON only. No markdown, no explanations, just the JSON object.';
    }

    const response = await this.chat(messages, {
      ...options,
      temperature: options.temperature ?? 0.3, // Lower temperature for structured output
    });

    // Parse JSON from response
    let jsonContent = response.content.trim();
    
    // Remove markdown code blocks if present
    if (jsonContent.startsWith('```json')) {
      jsonContent = jsonContent.slice(7);
    } else if (jsonContent.startsWith('```')) {
      jsonContent = jsonContent.slice(3);
    }
    if (jsonContent.endsWith('```')) {
      jsonContent = jsonContent.slice(0, -3);
    }
    jsonContent = jsonContent.trim();

    try {
      const data = JSON.parse(jsonContent) as T;
      return {
        data,
        raw: response.content,
        usage: response.usage,
      };
    } catch (error) {
      console.error('Failed to parse LLM JSON response:', jsonContent);
      throw new Error(`Failed to parse LLM response as JSON: ${(error as Error).message}`);
    }
  }

  /**
   * Analyze an agent's system prompt
   */
  async analyzePrompt(systemPrompt: string): Promise<{
    intents: string[];
    constraints: string[];
    expectedBehaviors: string[];
    dataToCollect: string[];
    tone: string;
    summary: string;
  }> {
    const sanitizedPrompt = this.sanitizeInput(systemPrompt);
    
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are an expert at analyzing AI agent prompts. Analyze the given prompt and extract key information.
        
Return a JSON object with these fields:
- intents: array of main purposes/goals of the agent
- constraints: array of rules/limitations the agent must follow
- expectedBehaviors: array of specific behaviors the agent should exhibit
- dataToCollect: array of information the agent should collect from users
- tone: the expected communication tone (e.g., "professional", "friendly", "formal")
- summary: a brief 1-2 sentence summary of what this agent does`,
      },
      {
        role: 'user',
        content: `Analyze this Voice AI agent prompt:\n\n${sanitizedPrompt}`,
      },
    ];

    const response = await this.chatJSON<{
      intents: string[];
      constraints: string[];
      expectedBehaviors: string[];
      dataToCollect: string[];
      tone: string;
      summary: string;
    }>(messages, { temperature: 0.2 });

    return response.data;
  }


  /**
   * Generate test cases for an agent
   */
  async generateTestCases(params: {
    promptAnalysis: {
      intents: string[];
      constraints: string[];
      expectedBehaviors: string[];
      dataToCollect: string[];
    };
    category: string;
    count: number;
    businessContext?: {
      industry?: string;
      useCase?: string;
    };
  }): Promise<Array<{
    name: string;
    description: string;
    category: string;
    conversationScript: Array<{ role: 'user' | 'expected-agent'; content: string }>;
    successCriteria: Array<{
      name: string;
      description: string;
      type: string;
      evaluatorType: string;
      weight: number;
      required: boolean;
    }>;
    priority: string;
    tags: string[];
  }>> {
    // Define specific test scenarios based on category
    let categoryGuidance = '';
    if (params.category === 'happy-path') {
      categoryGuidance = `Generate HAPPY PATH tests that verify basic functionality:
- Scheduling a routine appointment successfully
- Asking about services and getting detailed information with prices
- Getting vaccination information`;
    } else if (params.category === 'edge-case') {
      categoryGuidance = `Generate EDGE CASE tests that verify boundary conditions:
- User provides invalid date like February 30th (should be caught)
- User requests appointment on a holiday like January 1st (should suggest alternative)
- User asks about services without specifying which one`;
    } else if (params.category === 'adversarial') {
      categoryGuidance = `Generate ADVERSARIAL tests that verify robustness:
- User provides ambiguous requests that need clarification
- User asks about services in a confusing way
- User provides incomplete information`;
    }

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are an expert QA engineer specializing in Voice AI testing for a DENTAL CLINIC.

${categoryGuidance}

BUSINESS CONTEXT - Bright Smile Dental Clinic:
- Services: Cleanings ($99), Whitening ($299), Fillings ($150-$300), Root Canal ($800-$1200), Crowns ($900-$1500), Pediatric ($75-$200), Vaccinations (Flu $25, COVID Free)
- Hours: Mon-Fri 8AM-6PM, Sat 9AM-2PM, Sun CLOSED, Holidays CLOSED
- Must collect: email for confirmations
- Must validate: dates (Feb has 28/29 days), working days

IMPORTANT: Return a JSON object with this EXACT structure:
{
  "testCases": [
    {
      "name": "Test Name",
      "description": "What this test validates",
      "category": "${params.category}",
      "conversationScript": [
        {"role": "user", "content": "User says this"},
        {"role": "expected-agent", "content": "Agent should respond like this"}
      ],
      "successCriteria": [
        {
          "name": "Criterion Name",
          "description": "What to check - be specific about what the agent should do",
          "type": "custom-llm",
          "evaluatorType": "llm",
          "weight": 1.0,
          "required": true
        }
      ],
      "priority": "high",
      "tags": ["dental", "appointment"]
    }
  ]
}

CRITICAL RULES:
1. conversationScript MUST start with a "user" turn
2. Use ONLY "user" or "expected-agent" for role values
3. Make success criteria SPECIFIC and MEASURABLE
4. Return valid JSON only, no markdown`,
      },
      {
        role: 'user',
        content: `Generate ${params.count} ${params.category} test cases for the dental clinic Voice AI agent.

The agent's current capabilities based on prompt analysis:
- Intents: ${params.promptAnalysis.intents.join(', ')}
- Constraints: ${params.promptAnalysis.constraints.join(', ')}
- Expected Behaviors: ${params.promptAnalysis.expectedBehaviors.join(', ')}
- Data to Collect: ${params.promptAnalysis.dataToCollect.join(', ')}

Generate realistic test conversations that a dental clinic customer might have.`,
      },
    ];

    const response = await this.chatJSON<{
      testCases: Array<{
        name: string;
        description: string;
        category: string;
        conversationScript: Array<{ role: 'user' | 'expected-agent'; content: string }>;
        successCriteria: Array<{
          name: string;
          description: string;
          type: string;
          evaluatorType: string;
          weight: number;
          required: boolean;
        }>;
        priority: string;
        tags: string[];
      }>;
    }>(messages, { temperature: 0.7, maxTokens: 8000 });

    console.log(`  📦 LLM returned ${response.data.testCases?.length || 0} test cases`);
    
    return response.data.testCases || [];
  }


  /**
   * Evaluate a response against criteria (LLM-as-Judge) with structured performance metrics
   */
  async evaluateResponse(params: {
    criterion: {
      name: string;
      description: string;
      prompt?: string;
    };
    conversationTurns: Array<{ role: string; content: string }>;
    businessContext?: {
      services?: string[];
      workingHours?: string;
    };
  }): Promise<{
    passed: boolean;
    score: number;
    reasoning: string;
    metrics: {
      relevance: number;      // How relevant was the response (0-1)
      accuracy: number;       // How accurate was the information (0-1)
      completeness: number;   // How complete was the response (0-1)
      helpfulness: number;    // How helpful was the response (0-1)
    };
  }> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are an expert evaluator for Voice AI agents at a dental clinic. Evaluate the agent's response using these metrics:

PERFORMANCE METRICS (score each 0-1):
1. relevance: Does the response address the user's actual question/need?
2. accuracy: Is the information provided correct? (services, prices, hours, dates)
3. completeness: Does the response include all necessary information?
4. helpfulness: Does the response help the user achieve their goal?

BUSINESS CONTEXT:
- Services: Cleanings ($99), Whitening ($299), Fillings ($150-$300), Root Canal ($800-$1200), Crowns ($900-$1500), Pediatric ($75-$200), Flu shots ($25), COVID vaccines (Free)
- Hours: Mon-Fri 8AM-6PM, Sat 9AM-2PM, Sun CLOSED, Holidays CLOSED
- Must validate dates (Feb has 28/29 days only)
- Must recognize non-working days and suggest alternatives

Return a JSON object with:
{
  "passed": boolean (true if overall score >= 0.7),
  "score": number (average of all metrics, 0-1),
  "reasoning": "detailed explanation",
  "metrics": {
    "relevance": number (0-1),
    "accuracy": number (0-1),
    "completeness": number (0-1),
    "helpfulness": number (0-1)
  }
}`,
      },
      {
        role: 'user',
        content: `Evaluate this conversation:

CRITERION: ${params.criterion.name}
DESCRIPTION: ${params.criterion.description}

CONVERSATION:
${params.conversationTurns.map(t => `${t.role.toUpperCase()}: ${t.content}`).join('\n')}

Score each metric 0-1 and provide detailed reasoning.`,
      },
    ];

    const response = await this.chatJSON<{
      passed: boolean;
      score: number;
      reasoning: string;
      metrics: {
        relevance: number;
        accuracy: number;
        completeness: number;
        helpfulness: number;
      };
    }>(messages, { temperature: 0.1 });

    // Ensure all scores are within bounds
    const metrics = response.data.metrics || { relevance: 0, accuracy: 0, completeness: 0, helpfulness: 0 };
    metrics.relevance = Math.max(0, Math.min(1, metrics.relevance || 0));
    metrics.accuracy = Math.max(0, Math.min(1, metrics.accuracy || 0));
    metrics.completeness = Math.max(0, Math.min(1, metrics.completeness || 0));
    metrics.helpfulness = Math.max(0, Math.min(1, metrics.helpfulness || 0));

    // Calculate overall score as average of metrics
    const overallScore = (metrics.relevance + metrics.accuracy + metrics.completeness + metrics.helpfulness) / 4;
    
    return {
      passed: overallScore >= 0.7,
      score: Math.max(0, Math.min(1, overallScore)),
      reasoning: response.data.reasoning || 'No reasoning provided',
      metrics,
    };
  }

  /**
   * Generate an optimized prompt based on failure analysis
   */
  async optimizePrompt(params: {
    currentPrompt: string;
    failurePatterns: Array<{
      description: string;
      affectedTestCases: string[];
      suggestedFix?: string;
    }>;
    recommendations: string[];
    businessContext?: {
      industry?: string;
      useCase?: string;
    };
  }): Promise<{
    optimizedPrompt: string;
    changes: Array<{
      type: 'addition' | 'modification' | 'removal' | 'restructure';
      description: string;
      targetedFailure: string;
      before?: string;
      after?: string;
    }>;
    explanation: string;
  }> {
    const sanitizedPrompt = this.sanitizeInput(params.currentPrompt);
    
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are an expert prompt engineer specializing in Voice AI agents for healthcare/dental clinics. Your task is to improve the given prompt based on identified failure patterns.

CRITICAL: The optimized prompt MUST include these specific details for a dental clinic:

1. SERVICES WITH PRICES:
   - Routine Dental Cleanings ($99)
   - Teeth Whitening ($299)
   - Dental Fillings ($150-$300)
   - Root Canal Treatment ($800-$1200)
   - Dental Crowns ($900-$1500)
   - Orthodontic Consultations (Free)
   - Emergency Dental Care
   - Pediatric Dentistry ($75-$200)
   - Vaccinations: Flu shots ($25), COVID-19 (Free)

2. WORKING HOURS:
   - Monday to Friday: 8:00 AM - 6:00 PM
   - Saturday: 9:00 AM - 2:00 PM
   - Sunday: CLOSED
   - Holidays: CLOSED (New Year's Day, etc.)

3. BEHAVIORS:
   - Validate dates (February only has 28/29 days)
   - Recognize non-working days and suggest alternatives
   - Ask clarifying questions for ambiguous requests
   - Confirm appointments with date, time, and service type
   - Always collect email for confirmations

Guidelines:
1. Make targeted changes that address specific failures
2. Include ALL the business details above
3. Be specific about services, prices, and hours
4. Provide clear instructions for handling edge cases

Return a JSON object with:
- optimizedPrompt: the improved prompt (MUST include services, prices, hours, and behaviors)
- changes: array of changes made, each with type, description, targetedFailure
- explanation: overall explanation of the optimization strategy`,
      },
      {
        role: 'user',
        content: `Optimize this Voice AI agent prompt for a dental clinic:

CURRENT PROMPT:
${sanitizedPrompt}

FAILURE PATTERNS:
${params.failurePatterns.map((f, i) => `${i + 1}. ${f.description}
   Affected tests: ${f.affectedTestCases.join(', ')}
   ${f.suggestedFix ? `Suggested fix: ${f.suggestedFix}` : ''}`).join('\n')}

RECOMMENDATIONS:
${params.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}

IMPORTANT: The optimized prompt MUST include specific services with prices, working hours, and clear instructions for handling invalid dates, holidays, and ambiguous requests.`,
      },
    ];

    const response = await this.chatJSON<{
      optimizedPrompt: string;
      changes: Array<{
        type: 'addition' | 'modification' | 'removal' | 'restructure';
        description: string;
        targetedFailure: string;
        before?: string;
        after?: string;
      }>;
      explanation: string;
    }>(messages, { temperature: 0.4, maxTokens: 8000 });

    return response.data;
  }


  /**
   * Generate insights from analysis report
   */
  async generateInsights(params: {
    evaluations: Array<{
      testCaseId: string;
      testCaseName: string;
      passed: boolean;
      overallScore: number;
      reasoning: string;
    }>;
    passRate: number;
    overallScore: number;
  }): Promise<{
    failurePatterns: Array<{
      description: string;
      affectedTestCases: string[];
      frequency: number;
      severity: string;
      suggestedFix: string;
    }>;
    recommendations: string[];
    prioritizedFixes: string[];
  }> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are an expert at analyzing Voice AI agent test results. Identify patterns in failures and provide actionable recommendations.

Return a JSON object with:
- failurePatterns: array of identified patterns with description, affected test cases, frequency (0-1), severity (critical/high/medium/low), and suggested fix
- recommendations: array of general recommendations for improvement
- prioritizedFixes: array of fixes ordered by impact (most impactful first)`,
      },
      {
        role: 'user',
        content: `Analyze these test results:

Overall Pass Rate: ${(params.passRate * 100).toFixed(1)}%
Overall Score: ${(params.overallScore * 100).toFixed(1)}%

Test Results:
${params.evaluations.map(e => `- ${e.testCaseName}: ${e.passed ? 'PASSED' : 'FAILED'} (score: ${(e.overallScore * 100).toFixed(1)}%)
  Reasoning: ${e.reasoning}`).join('\n')}`,
      },
    ];

    const response = await this.chatJSON<{
      failurePatterns: Array<{
        description: string;
        affectedTestCases: string[];
        frequency: number;
        severity: string;
        suggestedFix: string;
      }>;
      recommendations: string[];
      prioritizedFixes: string[];
    }>(messages, { temperature: 0.3 });

    return response.data;
  }
}

// Export singleton instance
export const llmClient = new LLMClient();
