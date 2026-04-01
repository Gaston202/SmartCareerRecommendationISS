# Roadmap Endpoint Fix - March 31, 2026

## Problem
Roadmap endpoint was returning empty phases despite the roadmap agent successfully generating them.

## Root Causes Identified & Fixed

### Issue 1: Wrong Data Key (FIXED ✅)
**Files**: `backend/api/main.py` (line 608), `backend/ai_v2/agents/orchestrator.py` (line 151)

**Problem**: 
- Roadmap agent returns: `data = {"phases": [...], ...}`
- But extraction code looked for: `roadmap_agent_output.data.get("roadmap_steps", [])`

**Solution**: Changed both locations to use correct key `"phases"`:
```python
# Before
raw_phases = roadmap_agent_output.data.get("roadmap_steps", [])

# After  
raw_phases = roadmap_agent_output.data.get("phases", [])
```

### Issue 2: Field Name Mismatch (FIXED ✅)
**File**: `backend/api/main.py` (line 639)

**Problem**:
- RoadmapStep serializes to dict with key `"skills_to_learn"`
- But endpoint looked for key `"skills"`

**Solution**: Updated field extraction to check both keys:
```python
# Before
"skills_to_learn": phase.get("skills", [])

# After
"skills_to_learn": phase.get("skills_to_learn", phase.get("skills", []))
```

## Data Flow Verification

```
RoadmapAgent.run()
├─ LLM returns: {"phases": [...], "resources": [...], ...}
│  └─ Each phase: {"title": "...", "skills": [...], "duration_months": N}
│
├─ Convert to RoadmapStep objects
│  └─ Fields: phase, title, duration_months, skills_to_learn, resources, milestones
│
├─ Serialize to dict: [step.dict() for step in roadmap_steps]
│  └─ Each dict now has key "skills_to_learn" (not "skills")
│
└─ Return in data: {"phases": [dict1, dict2, ...], ...}

API Endpoint receives:
├─ Get from agent_outputs: roadmap_agent_output = result.agent_outputs.get("roadmap")
├─ Extract phases: raw_phases = roadmap_agent_output.data.get("phases", [])  ✅ FIXED
└─ For each phase:
   └─ Get skills: phase.get("skills_to_learn", phase.get("skills", []))  ✅ FIXED
```

## Implementation Status

### Completed ✅
- [x] Identify data key mismatch ("roadmap_steps" vs "phases")
- [x] Fix main.py endpoint to use correct key
- [x] Fix orchestrator.py to use correct key
- [x] Fix field name mismatch ("skills" vs "skills_to_learn")
- [x] Verify no syntax errors

### Pending ⏳
- [ ] Run Supabase migration 003_quiz_responses_saved_at.sql (blocks quiz saving)
- [ ] Restart backend server
- [ ] Test roadmap endpoint end-to-end
- [ ] Verify roadmap phases returned to mobile

## Testing Steps

### 1. Restart Backend
```bash
cd /Users/mac/Documents/GitHub/SmartCareerRecommendationISS/backend
# Kill running instance with Ctrl+C
python -m uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Test Roadmap Endpoint
```bash
curl -X POST http://localhost:8000/generate-roadmap \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test-user-001",
    "user_profile": {
      "user_id": "test-user-001",
      "name": "Test User",
      "email": "test@example.com",
      "current_skills": ["Python", "JavaScript"],
      "experience_level": "intermediate"
    },
    "target_career": "Backend Engineer"
  }'
```

### 3. Expected Response
```json
{
  "success": true,
  "user_id": "test-user-001",
  "target_career": "Backend Engineer",
  "roadmap": [
    {
      "phase": 1,
      "title": "Foundation & Core Concepts",
      "duration_months": 2,
      "skills_to_learn": ["Docker", "PostgreSQL", ...],
      "difficulty": "intermediate",
      "resources": [...],
      "milestones": [...],
      "estimated_cost": null
    },
    ...
  ],
  "total_phases": 3,
  "estimated_total_months": 6,
  "timestamp": "2026-03-31T..."
}
```

## Related Fixes Applied This Session

See `/memories/session/roadmap-fix-mar-31-2026.md` for additional context.

## Critical Path Items

1. **HIGHEST PRIORITY**: Run Supabase migration 003 → unblocks quiz functionality
2. **HIGH PRIORITY**: Test roadmap endpoint → verifies this fix works
3. **MEDIUM PRIORITY**: Add HuggingFace token → improves embedding speed
4. **LOW PRIORITY**: Upload real CV → improves test data quality

## Files Modified
- ✅ `backend/api/main.py` - 2 changes (lines 608, 639)
- ✅ `backend/ai_v2/agents/orchestrator.py` - 1 change (line 151)
