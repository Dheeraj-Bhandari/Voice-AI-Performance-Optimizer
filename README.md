# Voice AI Performance Optimizer

An Agent Performance Copilot that automates the "Test" and "Optimize" phases for HighLevel Voice AI agents. This tool acts as a "Validation Flywheel" - moving beyond manual trial-and-error by using AI to autonomously define test cases and refine agent prompts based on performance results.

![Voice AI Optimizer](https://img.shields.io/badge/Status-Demo%20Ready-green) ![Node.js](https://img.shields.io/badge/Node.js-20+-blue) ![React](https://img.shields.io/badge/React-18+-61DAFB) ![TypeScript](https://img.shields.io/badge/TypeScript-5+-3178C6)

---

## 🎯 Problem Statement

Current Voice AI setups require significant manual effort to ensure agents follow scripts and meet success criteria. Testing prompts involves:
- Manual conversation simulations
- Subjective quality assessment
- Trial-and-error prompt refinement
- No structured metrics or tracking

**This tool solves these problems through automation.**

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React + Vite)                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │ControlPanel │  │  LogViewer  │  │ResultsPanel │  │ StatsPanel  │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      BACKEND (Node.js + Express)                     │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                      OptimizerService                            ││
│  │  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐   ││
│  │  │ generateTests │───▶│ executeTests  │───▶│   optimize    │   ││
│  │  └───────────────┘    └───────────────┘    └───────────────┘   ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │   LLMClient     │  │HighLevelClient  │  │    Models       │     │
│  │  (OpenRouter)   │  │  (Mock/Real)    │  │   (MongoDB)     │     │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
                    │                               │
                    ▼                               ▼
            ┌─────────────┐                 ┌─────────────┐
            │  OpenRouter │                 │   MongoDB   │
            │  (GPT-4o)   │                 │   + Redis   │
            └─────────────┘                 └─────────────┘
```

### Two-Loop System

**Loop 1: Test Generation (Auto-Generation)**
```
Agent Prompt → LLM Analysis → Test Case Generation → Success Criteria Definition
```

**Loop 2: Optimization (Auto-Refining)**
```
Execute Tests → Evaluate (LLM-as-Judge) → Analyze Failures → Generate Optimized Prompt → Repeat
```

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React 18 + TypeScript | Interactive dashboard UI |
| **Build Tool** | Vite | Fast development & bundling |
| **Backend** | Node.js + Express | REST API server |
| **Database** | MongoDB 7 | Persist agents, test suites, results |
| **Queue** | Redis + BullMQ | Background job processing |
| **AI/LLM** | OpenRouter API (GPT-4o-mini) | All AI operations |
| **Container** | Docker Compose | Easy deployment |

### Key Dependencies

```json
// Backend
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "bullmq": "^5.1.0",
  "axios": "^1.6.0",
  "uuid": "^9.0.0"
}

// Frontend
{
  "react": "^18.2.0",
  "vite": "^5.0.0",
  "typescript": "^5.0.0"
}
```

---

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- OpenRouter API Key ([Get one here](https://openrouter.ai/keys))

### Installation

1. **Clone and navigate:**
```bash
cd voice-ai-optimizer
```

2. **Add your OpenRouter API key** in `docker-compose.yml`:
```yaml
environment:
  - OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

3. **Start all services:**
```bash
docker-compose up --build
```

4. **Access the application:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- MongoDB: localhost:27017

---

## 📋 Features

### One-Click Optimization
- Single button to start the entire optimization cycle
- Configurable max iterations (1-10)
- Stop button for manual intervention

### Real-Time Logging
- Terminal-style log viewer
- Color-coded messages (info, success, warning, error)
- Live updates during optimization

### Performance Metrics
- **Relevance**: Does the response address the user's question?
- **Accuracy**: Is the information correct (prices, hours, dates)?
- **Completeness**: Are all necessary details included?
- **Helpfulness**: Does it help the user achieve their goal?

### Test Categories
| Category | Purpose | Examples |
|----------|---------|----------|
| **Happy Path** | Normal interactions | Scheduling appointments, service inquiries |
| **Edge Cases** | Boundary conditions | Invalid dates (Feb 30), holidays, closed days |
| **Adversarial** | Challenging scenarios | Ambiguous requests, incomplete info |

### Before/After Comparison
- Side-by-side prompt comparison
- Score improvement visualization
- Detailed change log

---

## 🔄 How It Works

### Step 1: Analyze Agent Prompt
The LLM analyzes the existing prompt to extract:
- Intents (what the agent should do)
- Constraints (rules to follow)
- Expected behaviors
- Data to collect

### Step 2: Generate Test Cases
Based on analysis, generates tests for:
- Happy path scenarios (2 tests)
- Edge cases (2 tests)
- Adversarial scenarios (2 tests)

Each test includes:
- Conversation script (user inputs)
- Success criteria with weights
- Priority level

### Step 3: Execute Tests
- Simulates conversations with the agent
- Captures all responses
- Stores conversation history

### Step 4: Evaluate (LLM-as-Judge)
Each response is evaluated on:
- Relevance (0-1)
- Accuracy (0-1)
- Completeness (0-1)
- Helpfulness (0-1)

Overall score = average of all metrics

### Step 5: Optimize Prompt
If score < 100%:
- Analyze failure patterns
- Generate targeted improvements
- Create optimized prompt with:
  - Specific services and prices
  - Working hours
  - Edge case handling instructions
  - Clarification prompts

### Step 6: Iterate
Repeat steps 3-5 until:
- Score reaches 100%, OR
- Max iterations reached

---

## 👤 Team of One - Role Ownership

This project was built with a "Team of One" approach, handling all aspects of product development:

### 🎯 Product Manager Role
**Decisions Made:**
- Defined the two-loop architecture (Test → Optimize)
- Chose LLM-as-Judge pattern for objective evaluation
- Prioritized one-click UX over complex configuration
- Selected structured metrics (relevance, accuracy, completeness, helpfulness) over single scores

**Trade-offs:**
- Simplicity over configurability (fixed test categories vs custom)
- Speed over comprehensiveness (6 tests vs exhaustive coverage)
- Automation over manual control (auto-optimize vs step-by-step)

### 🎨 Designer Role
**UI/UX Decisions:**
- Single-page dashboard with all information visible
- Terminal-style logs for developer familiarity
- Color-coded status indicators (red=before, green=after)
- Expandable test conversations for detail-on-demand
- Progress metrics with visual bars

**Design Principles:**
- Minimal clicks to start optimization
- Real-time feedback during long operations
- Clear before/after comparison
- Mobile-responsive layout

### 💻 Engineering Role
**Architecture Decisions:**
- Separated concerns: LLMClient, HighLevelClient, OptimizerService
- Used dependency injection for testability
- Implemented retry logic with exponential backoff
- Added prompt injection sanitization
- Chose MongoDB for flexible schema evolution

**Code Quality:**
- TypeScript for type safety
- Consistent error handling
- Comprehensive logging
- Docker for reproducible environments

### 🧪 QA Role
**Testing Strategy:**
- The tool itself IS a testing tool - dogfooding the concept
- Built-in test categories ensure coverage
- LLM-as-Judge provides consistent evaluation
- Mock mode allows testing without API costs

**Quality Measures:**
- Input sanitization prevents prompt injection
- Rate limiting handles API throttling
- Graceful degradation on failures
- Persistent storage prevents data loss

---

## ✅ Functional vs Mocked Components

### ✅ FUNCTIONAL (Real Implementation)

| Component | Description | Technology |
|-----------|-------------|------------|
| **LLM Operations** | All AI calls are real | OpenRouter API (GPT-4o-mini) |
| **Test Generation** | Dynamically creates test cases | LLM-powered analysis |
| **Response Evaluation** | LLM-as-Judge pattern | Structured metric scoring |
| **Prompt Optimization** | AI-generated improvements | Targeted failure fixes |
| **Data Persistence** | Stores all data | MongoDB |
| **Job Queue** | Background processing | Redis + BullMQ |
| **Frontend UI** | Full interactive dashboard | React + TypeScript |
| **REST API** | Complete backend | Express.js |

### 🔶 MOCKED (Simulated)

| Component | Reason | Implementation |
|-----------|--------|----------------|
| **HighLevel Voice AI API** | Sandbox doesn't allow API key creation | Intelligent mock that varies responses based on prompt quality |
| **Voice Conversations** | No real voice processing | Text-based simulation |
| **Agent Updates** | Can't modify real agents | In-memory + database storage |

### How the Mock Works

The `HighLevelClient` mock is **intelligent** - it doesn't return static responses:

```typescript
// Mock responses vary based on prompt quality score (0-1)
private getPromptQualityScore(): number {
  const prompt = currentMockPrompt.toLowerCase();
  const checks = [
    prompt.includes('dental') || prompt.includes('clinic'),
    prompt.includes('cleaning') || prompt.includes('whitening'),
    prompt.includes('price') || prompt.includes('$99'),
    prompt.includes('monday') || prompt.includes('hours'),
    prompt.includes('sunday') || prompt.includes('closed'),
    prompt.includes('email') || prompt.includes('confirm'),
    prompt.includes('february') || prompt.includes('invalid'),
    prompt.includes('clarif') || prompt.includes('ambiguous'),
    prompt.includes('vaccination') || prompt.includes('flu'),
    currentMockPrompt.length > 400,
  ];
  return checks.filter(Boolean).length / checks.length;
}
```

**Low quality prompt (score < 0.5):**
- Returns generic responses
- Doesn't handle edge cases
- Missing specific information

**High quality prompt (score >= 0.5):**
- Returns detailed responses with prices
- Handles invalid dates correctly
- Suggests alternatives for closed days
- Asks clarifying questions

This allows the optimization loop to demonstrate real improvement even without the actual HighLevel API.

---

## 📁 Project Structure

```
voice-ai-optimizer/
├── backend/
│   ├── src/
│   │   ├── config/          # Environment configuration
│   │   ├── models/          # MongoDB schemas
│   │   │   ├── Agent.ts
│   │   │   ├── TestSuite.ts
│   │   │   ├── OptimizedPrompt.ts
│   │   │   └── ExecutionResult.ts
│   │   ├── routes/          # API endpoints
│   │   │   └── api.ts
│   │   ├── services/        # Business logic
│   │   │   ├── LLMClient.ts        # OpenRouter integration
│   │   │   ├── HighLevelClient.ts  # HighLevel API (mocked)
│   │   │   └── OptimizerService.ts # Core optimization logic
│   │   ├── types/           # TypeScript definitions
│   │   └── utils/           # Helpers (database, queue)
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   │   ├── ControlPanel.tsx
│   │   │   ├── LogViewer.tsx
│   │   │   ├── ResultsPanel.tsx
│   │   │   ├── StatsPanel.tsx
│   │   │   └── ConversationPanel.tsx
│   │   ├── hooks/           # Custom React hooks
│   │   │   └── useOptimizer.ts
│   │   ├── App.tsx
│   │   ├── api.ts           # Backend API client
│   │   ├── types.ts
│   │   └── styles.ts
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
└── README.md
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/agents/:agentId` | Get agent configuration |
| GET | `/api/agents/:agentId/optimized-prompt` | Get saved optimized prompt |
| DELETE | `/api/agents/:agentId/optimized-prompt` | Reset optimization |
| POST | `/api/agents/:agentId/check-optimized` | Run tests on current prompt |
| POST | `/api/agents/:agentId/generate-tests` | Generate test suite |
| GET | `/api/agents/:agentId/test-suites` | List test suites |
| POST | `/api/test-suites/:suiteId/execute` | Run tests |
| POST | `/api/test-suites/:suiteId/optimize` | Run optimization loop |

---

## 🧠 AI/LLM Usage

### Where AI is Used

1. **Prompt Analysis** (`LLMClient.analyzePrompt`)
   - Extracts intents, constraints, behaviors from agent prompt

2. **Test Generation** (`LLMClient.generateTestCases`)
   - Creates realistic test scenarios based on business context

3. **Response Evaluation** (`LLMClient.evaluateResponse`)
   - LLM-as-Judge pattern with structured metrics
   - Consistent, objective scoring

4. **Insight Generation** (`LLMClient.generateInsights`)
   - Identifies failure patterns across tests
   - Prioritizes fixes by impact

5. **Prompt Optimization** (`LLMClient.optimizePrompt`)
   - Generates improved prompt targeting specific failures
   - Includes all necessary business details

### Prompt Engineering Techniques

- **Structured Output**: JSON-only responses for reliable parsing
- **Few-shot Examples**: Business context in system prompts
- **Chain-of-Thought**: Reasoning required in evaluations
- **Constraint Injection**: Specific rules for dental clinic domain

---

## 🔒 Security Considerations

- **Prompt Injection Prevention**: Input sanitization removes malicious patterns
- **Rate Limiting**: Handles API throttling gracefully
- **No Secrets in Code**: API keys via environment variables
- **Input Validation**: All user inputs validated before processing

---

## 📈 Future Improvements

If this were a production system:

1. **Real HighLevel Integration**: Use actual Voice AI API when available
2. **Custom Test Cases**: Allow users to define their own tests
3. **A/B Testing**: Compare multiple prompt versions
4. **Historical Tracking**: Track optimization history over time
5. **Webhook Notifications**: Alert when optimization completes
6. **Multi-Agent Support**: Optimize multiple agents in parallel
7. **Export/Import**: Share optimized prompts between accounts

---

## 📝 License

MIT License - Built for HighLevel Interview Assignment

---

## 🙏 Acknowledgments

- HighLevel for the challenge specification
- OpenRouter for LLM API access
- The open-source community for excellent tooling
