# AI Agent Phased Deployment Guide

**Quick Links**:
- 📋 Full Plan: [AGENT_DEPLOYMENT_PLAN.md](../AGENT_DEPLOYMENT_PLAN.md)
- ⚙️ Config: [deployment_config.py](ai_v2/deployment_config.py)
- 🏥 Monitoring: [health_monitor.py](ai_v2/health_monitor.py)
- 🧪 Tests: [tests/poc_tests.py](ai_v2/tests/poc_tests.py)
- 📝 Env Template: [.env.deployment-phases](.env.deployment-phases)

---

## Quick Start

### Phase 1: Proof of Concept (3-5 days)

**Goal**: Validate all agents work with known inputs, no crashes, <10s latency

```bash
# 1. Set environment
cd backend
cp .env.deployment-phases .env.poc
# Edit .env.poc: set OPENROUTER_API_KEY

# 2. Run PoC tests
DEPLOYMENT_PHASE=poc pytest ai_v2/tests/poc_tests.py -v

# 3. Check logs
# Should see [REAL_LLM] tags (not mocked)
# Should see all tests pass
# Response times <10 seconds per agent

# 4. Validate all 4 agent PoC tests pass:
# ✅ ProfileAgent: Extracts skills from 5 test CVs
# ✅ CareerAgent: Generates 3 careers with match_scores
# ✅ GapAgent: Identifies realistic skill gaps
# ✅ RoadmapAgent: Creates 5-phase learning roadmap

# 5. If all pass → Get approval to proceed to Pilot
```

**Success Criteria Chart**:
```
ProfileAgent:  3+ skills extracted, 0 crashes, <5s latency ✅
CareerAgent:   3 careers, sorted by match_score ✅
GapAgent:      2+ gaps identified, priority ranked ✅
RoadmapAgent:  5 phases generated, realistic progression ✅
```

---

### Phase 2: Pilot Program (5-7 days)

**Goal**: Test with 10-25 real users under supervision, >80% satisfaction

```bash
# 1. Prepare pilot environment
docker compose -f docker-compose.pilot.yml up -d

# 2. Configure pilot users
export PILOT_USER_IDS="user1,user2,...,user25"

# 3. Set environment for pilot
cp .env.deployment-phases .env.pilot
# Edit .env.pilot: set API keys, database, Slack webhook

# 4. Deploy pilot
docker compose -f docker-compose.pilot.yml up

# 5. Monitor real-time metrics
# Prometheus: http://localhost:9090
# Grafana: http://localhost:3000

# 6. Collect feedback daily
# Check Slack alerts for issues
# Review user satisfaction forms
# Document issues in incident log

# 7. Run daily health checks
curl http://localhost:8000/health/status
# Expected: all agents healthy, <5% error rate, >70% satisfaction

# 8. If metrics stable after 5 days → Get approval for Production
```

**Pilot Success Checklist**:
- [ ] All 10-25 users successfully processed
- [ ] Error rate <5%
- [ ] Response time <15s p99
- [ ] User satisfaction NPS >50
- [ ] No crashes reported
- [ ] Monitoring dashboard stable
- [ ] Rollback procedure tested

---

### Phase 3: Production Deployment (Ongoing)

#### 3a. Canary (5% of users, 1 hour)

```bash
# 1. Deploy canary version
kubectl set env deployment/smartcareer-api CANARY_ROLLOUT=0.05
kubectl rollout status deployment/smartcareer-api

# 2. Monitor closely (1 hour)
# Error rate should be <2%
# Latency p99 should be <10s
# Watch PagerDuty for critical alerts

# 3. If healthy → proceed to staged rollout
# If issues → automatic rollback

# 4. Check canary dashboard
# Open: http://prometheus:9090/graph
# Query: agent_error_rate{canary="true"}
```

#### 3b. Staged Rollout (5% → 100%)

```bash
# Stage 1: 5% → 25% (after canary 1 hour)
kubectl set env deployment/smartcareer-api CANARY_ROLLOUT=0.25
# Monitor for 2 hours...

# Stage 2: 25% → 50%
kubectl set env deployment/smartcareer-api CANARY_ROLLOUT=0.50
# Monitor for 4 hours...

# Stage 3: 50% → 100% (full production)
kubectl set env deployment/smartcareer-api CANARY_ROLLOUT=0.0
# Continuous monitoring...
```

#### 3c. Rollback (if needed)

```bash
# Automatic rollback if:
# - Error rate > 10% for >5 minutes
# - p99 latency > 30s
# - LLM API quota exceeded

# Manual rollback
kubectl rollout undo deployment/smartcareer-api

# Or disable specific agents
kubectl set env deployment/smartcareer-api ENABLE_CAREER_AGENT=false
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│ User Request                                                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
         ┌──────────────────────────┐
         │ Deployment Config Check  │
         │ (which phase? agents on?)│
         └────────────┬─────────────┘
                      │
                      ▼
         ┌──────────────────────────┐
         │ Route to Agent Pipeline  │
         │ (1. Profile              │
         │  2. Career               │
         │  3. Gap                  │
         │  4. Roadmap)             │
         └────────────┬─────────────┘
                      │
                      ▼
         ┌──────────────────────────┐
         │ Execute Agents           │
         │ (Real LLM or Mock)       │
         └────────────┬─────────────┘
                      │
                      ▼
       ┌─────────────────────────────────┐
       │ Health Monitor (if enabled)     │
       │ - Track latency                 │
       │ - Count errors                  │
       │ - Disable if unhealthy          │
       └────────────┬────────────────────┘
                    │
                    ▼
       ┌─────────────────────────────────┐
       │ Metrics to Prometheus (if enabled)
       │ - agent_calls_total             │
       │ - agent_latency_seconds         │
       │ - agent_error_rate              │
       └────────────┬────────────────────┘
                    │
                    ▼
       ┌─────────────────────────────────┐
       │ Alert if thresholds exceeded    │
       │ (PagerDuty/Slack)               │
       └────────────┬────────────────────┘
                    │
                    ▼
              Return Result
```

---

## Key Files & What They Do

| File | Purpose |
|------|---------|
| `AGENT_DEPLOYMENT_PLAN.md` | Full detailed plan (60+ pages) |
| `deployment_config.py` | Runtime config for each phase |
| `health_monitor.py` | Monitor agent health + auto-remediate |
| `poc_tests.py` | PoC validation test cases |
| `.env.deployment-phases` | Environment templates for each phase |

---

## Monitoring Dashboards

### Phase 1 (PoC): Manual
- Check test output: `pytest ai_v2/tests/poc_tests.py -v`
- Look for `[REAL_LLM]` tags in logs

### Phase 2 (Pilot): Prometheus + Grafana
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000/d/agent-production
- Query examples:
  ```
  # Error rate
  rate(agent_calls_total{status="failure"}[5m]) / rate(agent_calls_total[5m])
  
  # Latency p99
  histogram_quantile(0.99, agent_latency_seconds)
  
  # User satisfaction
  recommendation_quality_score
  ```

### Phase 3 (Production): Real-time Alerting
- **PagerDuty**: Critical alerts page on-call engineer
- **Slack**: #alerts channel for all warnings
- **CloudWatch**: Central logging for error investigation

---

## Common Issues & Fixes

| Issue | Likely Cause | Fix |
|-------|--------------|-----|
| All tests fail | OPENROUTER_API_KEY not set | Set key in .env, verify API access |
| Tests slow (>15s) | LLM API rate limited | Add delay + retry logic |
| Crashes during PoC | RAG service unavailable | Set `ENABLE_RAG=false` temporarily |
| Pilot had 8% error rate | Specific agent unhealthy | Check agent logs, disable + fix |
| Production latency high | Many concurrent users | Increase timeout, enable caching |

---

## Success Metrics by Phase

### Phase 1 ✅
- All PoC tests pass (0 failures)
- Response time: <10s per agent
- Error rate: 0% (no crashes)

### Phase 2 ✅
- Error rate: <5%
- Latency p99: <15s
- User satisfaction NPS: >50
- Successful recommendations: 100% (no timeouts)

### Phase 3 ✅
- Error rate: <1%
- Latency p95: <10s
- Uptime: >99.5%
- Cost per recommendation: <$0.10

---

## Timeline & Resource Estimate

| Phase | Duration | Team | Effort | Cost |
|-------|----------|------|--------|------|
| PoC | 3-5 days | 1 dev + 1 QA | 40h | 0 |
| Pilot | 5-7 days | 2 devs + 1 ops | 60h | <$100 LLM API |
| Prod (Canary + Staged) | 1 day | 1 ops + on-call | 20h | <$500 LLM API |
| **Total** | **~2 weeks** | **4 people** | **~120h** | **<$600** |

---

## Troubleshooting

### "All tests failing"
```bash
# Check if API key is set
echo $OPENROUTER_API_KEY

# Check if we're in mock mode
grep -i "fallback_mock" backend/ai_v2/logs/*.log

# Try with mock mode
OPENROUTER_API_KEY= pytest ai_v2/tests/poc_tests.py -v
```

### "High latency during pilot"
```bash
# Check LLM response times
curl -X POST http://localhost:8000/debug/agent-latency

# Check if RAG is slow
curl -X POST http://localhost:8000/debug/rag-latency

# Reduce LLM timeout if needed
sed -i 's/TIMEOUT_SECONDS=60/TIMEOUT_SECONDS=45/' .env.pilot
```

### "Auto-rollback triggered in production"
```bash
# Check what triggered it
kubectl logs deployment/smartcareer-api --tail=100 | grep "rollback"

# Re-enable after fix
kubectl set env deployment/smartcareer-api ENABLE_CAREER_AGENT=true
kubectl rollout status deployment/smartcareer-api
```

---

## Next Steps

1. **Today**: Read `AGENT_DEPLOYMENT_PLAN.md` (full plan)
2. **Week 1**: Run Phase 1 PoC tests
3. **Week 2**: Deploy Phase 2 Pilot with 10-25 users
4. **Week 3**: Production Canary + Staged Rollout
5. **Ongoing**: Monitor + Optimize

---

## Questions?

- **Phase 1 issues**: Contact backend team
- **Phase 2 issues**: Contact product manager
- **Phase 3 critical**: Page on-call via PagerDuty
- **General questions**: Post in #ai-deployment Slack channel

---

**Last Updated**: April 2, 2026  
**Document Version**: 1.0  
**Status**: Ready for Phase 1 Execution
