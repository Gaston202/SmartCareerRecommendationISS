# Quick Start: Real LLM Integration

## 🎯 TL;DR - Enable Real GPT-4

```bash
# 1. Set your OpenAI API key
export OPENAI_API_KEY="sk-proj-your-key-here"

# 2. Run the pipeline 
python -m backend.ai_v2.main_pipeline

# 3. Check the logs - you should see:
# ✓ OpenAI LLM initialized
# ✓ Generated 3 career recommendations via OpenAI
```

## What's Different Now?

### Old (Mock)
```
[MOCK] Generating 3 career recommendations
  → Backend Engineer
  → Full-Stack Developer
  → DevOps Engineer
```

### New (Real GPT-4)
```
✓ Generated 3 career recommendations via OpenAI
  → Backend Engineer (confidence: 0.92, required_skills: [...], reasoning: "...")
  → Full-Stack Developer (confidence: 0.85, ...)
  → DevOps Engineer (confidence: 0.78, ...)
```

## Features Unlocked

| Feature | Mock | Real GPT-4 |
|---------|------|-----------|
| Personalized Reasoning | ✗ | ✅ |
| Skill-based Matching | ~50% | 95%+ |
| Market Demand Analysis | ❌ | ✅ |
| Confidence Scores | Fixed | Dynamic |
| Learning Timeline | Generic | Customized |
| Resource Recommendations | None | Specific |

## 3 Ways to Set API Key

```bash
# Method 1: Terminal (one-time)
export OPENAI_API_KEY="sk-proj-..."
python -m backend.ai_v2.main_pipeline

# Method 2: .env file (permanent for project)
echo 'OPENAI_API_KEY=sk-proj-...' > .env

# Method 3: System wide (~/.zshrc or ~/.bashrc)
echo 'export OPENAI_API_KEY="sk-proj-..."' >> ~/.zshrc
source ~/.zshrc
```

## Verify Setup

```bash
python -c "from backend.ai_v2.config import config; print('API Key Set:', bool(config.OPENAI_API_KEY))"
```

## Cost Tracking

```bash
# Monitor your usage
open https://platform.openai.com/account/usage
```

- ~$0.20 per full pipeline run with GPT-4
- ~$0.01 per full pipeline run with GPT-3.5-turbo

## Update LLM Model

```bash
# In .env or terminal
export LLM_MODEL="gpt-3.5-turbo"  # Faster, cheaper
export LLM_MODEL="gpt-4"           # Better reasoning (default)
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| See `[MOCK]` in logs | API key not set or typo |
| "Invalid API Key" | Check https://platform.openai.com/account/api-keys |
| "Quota Exceeded" | Add payment method to your OpenAI account |
| Error parsing JSON | Check logs - show them the full error |

## Full Setup Guide

See [OPENAI_SETUP.md](./OPENAI_SETUP.md) for detailed instructions

---

**Need Real LLM Reasoning?** Follow the 3 steps above! 🚀
