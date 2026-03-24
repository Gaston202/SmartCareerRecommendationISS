# OpenAI API Setup Guide

## 🚀 Enable Real LLM Reasoning

By default, the AI v2 pipeline uses **mock LLM implementations** for testing. To enable real OpenAI API calls with actual reasoning and better recommendations, follow these steps.

## Prerequisites

1. **OpenAI Account**: Create one at https://platform.openai.com
2. **API Key**: Get your API key from https://platform.openai.com/account/api-keys
3. **Active Billing**: Ensure your account has active billing set up (GPT-4 required)

## Setup Steps

### Option 1: Environment Variable (Recommended)

#### macOS / Linux
```bash
# Option A: Export in terminal (temporary)
export OPENAI_API_KEY="sk-your-actual-api-key-here"
python -m backend.ai_v2.main_pipeline

# Option B: Add to ~/.zshrc (permanent for terminal sessions)
echo 'export OPENAI_API_KEY="sk-your-actual-api-key-here"' >> ~/.zshrc
source ~/.zshrc
```

#### Windows (PowerShell)
```powershell
$env:OPENAI_API_KEY="sk-your-actual-api-key-here"
python -m backend.ai_v2.main_pipeline
```

### Option 2: .env File

Create a `.env` file in the project root:

```bash
# .env
OPENAI_API_KEY=sk-your-actual-api-key-here
LLM_MODEL=gpt-4
```

Then run:
```bash
python -m backend.ai_v2.main_pipeline
```

### Option 3: Verify Configuration

```bash
python -c "
from backend.ai_v2.config import config
from backend.ai_v2.services import LLMService

print(f'API Key Set: {bool(config.OPENAI_API_KEY)}')
print(f'Model: {config.LLM_MODEL}')

llm = LLMService()
print(f'Using Mock: {llm.use_mock}')
"
```

## Expected Output

### With Real API ✅
```
✓ OpenAI LLM initialized
✓ Generated 3 career recommendations via OpenAI
✓ Career recommendation completed - 3 careers recommended
```

### Without API Key (Mock Mode)
```
OPENAI_API_KEY not set - using mock LLM implementations for testing
[MOCK] Generating 3 career recommendations
[MOCK] Analyzing gaps for Backend Engineer
```

## What Changes with Real LLM

### 1. Career Recommendations
- **Real**: Personalized analysis of your skills and market demand
- **Mock**: Generic list of roles

### 2. Skill Gap Analysis
- **Real**: Specific recommendations for learning priorities
- **Mock**: Fixed gap list

### 3. Learning Roadmap
- **Real**: Customized phases with realistic timelines
- **Mock**: Generic 3-phase structure

## Cost Estimates

### GPT-4 Pricing (as of March 2024)
- **Input**: $0.03 per 1K tokens
- **Output**: $0.06 per 1K tokens

### Typical Usage Per Pipeline Run
- 3 agents × 1000 tokens input = ~$0.09
- 3 agents × 500 tokens output = ~$0.09
- **Total**: ~$0.20 per recommendation run

### Cost Control

```python
# In backend/ai_v2/config.py
LLM_MODEL = "gpt-3.5-turbo"  # Cheaper: $0.0005/$0.0015 per 1K tokens
# vs
LLM_MODEL = "gpt-4"          # Better reasoning: $0.03/$0.06 per 1K tokens
```

## Testing

### Run Full Pipeline with Real LLM
```bash
export OPENAI_API_KEY="sk-..."
python -m backend.ai_v2.main_pipeline
```

### Test Individual Agent
```python
from backend.ai_v2.agents import CareerAgent
from backend.ai_v2.schemas import UserProfile

agent = CareerAgent()
profile = UserProfile(
    user_id="test1",
    name="John Doe",
    email="john@example.com",
    current_skills=["Python", "SQL"],
    experience_level="mid"
)

result = agent.run({"user_profile": profile})
print(result.data)
```

## Troubleshooting

### Error: "Invalid API Key"
- Check that your key starts with `sk-`
- Verify it's properly set: `echo $OPENAI_API_KEY`
- Try copying from https://platform.openai.com/account/api-keys again

### Error: "Quota Exceeded"
- Check your billing at https://platform.openai.com/account/billing/overview
- Ensure you have available credits or active payment method

### Error: "Rate Limited"
- OpenAI has rate limits. Wait a few seconds before retrying
- Upgrade account for higher rate limits

### Getting Mock Output Despite API Key
- Verify API key is properly exported:
  ```bash
  python -c "import os; print(os.getenv('OPENAI_API_KEY'))"
  ```
- Restart Python/terminal after setting environment variable
- Check for typos in API key

## Security Best Practices

1. **Never commit API keys** to version control
2. **Use .env files** locally (add to `.gitignore`)
3. **Rotate keys** regularly in OpenAI dashboard
4. **Monitor usage** at https://platform.openai.com/account/usage
5. **Set spending limits** to prevent unexpected charges

## Next Steps

- Run the full pipeline: `python -m backend.ai_v2.main_pipeline`
- Test with your own CV and skills profile
- Check logs for real LLM reasoning
- Monitor costs in OpenAI dashboard

Need help? Check the logs in `backend/ai_v2/utils/logging.py`
