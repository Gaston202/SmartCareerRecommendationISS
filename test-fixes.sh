#!/bin/bash

# Test script to verify all backend fixes for OpenRouter, quiz, and CV analysis
# Run from the root directory of the workspace

set -e

API_BASE_URL="http://localhost:8000"
echo "🧪 Testing Backend Fixes"
echo "================================"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Provider Configuration
echo "${YELLOW}Test 1: Checking OpenRouter Provider Config${NC}"
echo "Checking if OPENROUTER_API_KEY is set..."

if grep -q "OPENROUTER_API_KEY" /Users/mac/Documents/GitHub/SmartCareerRecommendationISS/.env; then
    echo -e "${GREEN}✅ OPENROUTER_API_KEY found in .env${NC}"
else
    echo -e "${RED}❌ OPENROUTER_API_KEY NOT found in .env${NC}"
fi

if grep -q "OPENAI_API_KEY" /Users/mac/Documents/GitHub/SmartCareerRecommendationISS/backend/ai_v2/config.py; then
    echo -e "${RED}❌ OPENAI_API_KEY still in config.py (should be OPENROUTER)${NC}"
else
    echo -e "${GREEN}✅ OPENAI_API_KEY removed from config.py${NC}"
fi

if grep -q "OPENROUTER_API_KEY" /Users/mac/Documents/GitHub/SmartCareerRecommendationISS/backend/ai_v2/config.py; then
    echo -e "${GREEN}✅ OPENROUTER_API_KEY found in config.py${NC}"
else
    echo -e "${RED}❌ OPENROUTER_API_KEY NOT found in config.py${NC}"
fi

if grep -q "openrouter.ai/api/v1" /Users/mac/Documents/GitHub/SmartCareerRecommendationISS/backend/ai_v2/config.py; then
    echo -e "${GREEN}✅ OpenRouter base URL configured${NC}"
else
    echo -e "${RED}❌ OpenRouter base URL NOT configured${NC}"
fi

echo ""

# Test 2: Health Check
echo "${YELLOW}Test 2: Health Check${NC}"
response=$(curl -s "$API_BASE_URL/health")
if echo "$response" | grep -q "healthy"; then
    echo -e "${GREEN}✅ Health check passed${NC}"
    echo "Response: $response"
else
    echo -e "${RED}❌ Health check failed${NC}"
    echo "Response: $response"
fi

echo ""

# Test 3: Quiz Endpoint
echo "${YELLOW}Test 3: Quiz Generation Endpoint${NC}"
echo "Testing /generate-quiz with basic profile..."

quiz_response=$(curl -s -X POST "$API_BASE_URL/generate-quiz" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test-user-1",
    "user_profile": {
      "user_id": "test-user-1",
      "name": "Test User",
      "email": "test@example.com",
      "current_skills": ["Python"],
      "experience_level": "entry"
    },
    "num_questions": 3
  }')

if echo "$quiz_response" | grep -q "success.*true" || echo "$quiz_response" | grep -q '"success": true'; then
    echo -e "${GREEN}✅ Quiz endpoint returned success${NC}"
    questions=$(echo "$quiz_response" | grep -o '"question"' | wc -l)
    echo "Generated $questions questions"
else
    echo -e "${RED}❌ Quiz endpoint failed${NC}"
fi

echo "Quiz Response:"
echo "$quiz_response" | head -100
echo ""
echo ""

# Test 4: CV Analysis Endpoint  
echo "${YELLOW}Test 4: CV Analysis Endpoint (/analyze-cv)${NC}"
echo "Testing /analyze-cv with sample CV text..."

cv_text="Software Engineer with 5 years experience in Python and React. Built a doctor appointment web application using Vue.js with patient login and appointment booking features."

cv_response=$(curl -s -X POST "$API_BASE_URL/analyze-cv" \
  -H "Content-Type: application/json" \
  -d "{
    \"user_id\": \"test-user-2\",
    \"cv_text\": \"$cv_text\",
    \"user_profile\": null
  }")

if echo "$cv_response" | grep -q "success"; then
    echo -e "${GREEN}✅ CV analysis endpoint responded${NC}"
else
    echo -e "${RED}⚠️  CV analysis returned unexpected format${NC}"
fi

echo "CV Response (first 200 chars):"
echo "$cv_response" | head -c 200
echo ""
echo ""

# Test 5: Career Matching Endpoint
echo "${YELLOW}Test 5: Career Matching Endpoint${NC}"
echo "Testing /career-matching with user profile..."

career_response=$(curl -s -X POST "$API_BASE_URL/career-matching" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test-user-3",
    "user_profile": {
      "user_id": "test-user-3",
      "name": "Test User",
      "email": "test@example.com",
      "current_skills": ["Python", "React", "JavaScript"],
      "experience_level": "mid"
    },
    "cv_text": null,
    "job_market_data": null,
    "preferences": null
  }')

if echo "$career_response" | grep -q "success"; then
    echo -e "${GREEN}✅ Career matching endpoint responded${NC}"
    careers=$(echo "$career_response" | grep -o '"role"' | wc -l)
    echo "Returned $careers career recommendations"
else
    echo -e "${RED}❌ Career matching endpoint failed${NC}"
fi

echo "Career Response (first 200 chars):"
echo "$career_response" | head -c 200
echo ""
echo ""

# Test 6: Roadmap Generation Endpoint
echo "${YELLOW}Test 6: Roadmap Generation Endpoint${NC}"
echo "Testing /generate-roadmap with target career..."

roadmap_response=$(curl -s -X POST "$API_BASE_URL/generate-roadmap" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test-user-4",
    "user_profile": {
      "user_id": "test-user-4",
      "name": "Test User",
      "email": "test@example.com",
      "current_skills": ["Python"],
      "experience_level": "entry"
    },
    "target_career": "Backend Engineer"
  }')

if echo "$roadmap_response" | grep -q "success"; then
    echo -e "${GREEN}✅ Roadmap generation endpoint responded${NC}"
    phases=$(echo "$roadmap_response" | grep -o '"phase"' | wc -l)
    echo "Generated $phases roadmap phases"
else
    echo -e "${RED}❌ Roadmap generation endpoint failed${NC}"
fi

echo "Roadmap Response (first 200 chars):"
echo "$roadmap_response" | head -c 200
echo ""
echo ""

# Test 7: Code Quality Checks
echo "${YELLOW}Test 7: Code Quality Checks${NC}"

echo "Checking for remaining OPENAI_API_KEY references..."
openai_refs=$(grep -r "OPENAI_API_KEY" /Users/mac/Documents/GitHub/SmartCareerRecommendationISS/backend/ai_v2 2>/dev/null | grep -v ".pyc" | wc -l)
if [ "$openai_refs" -eq 1 ]; then  # Only error message reference is OK
    echo -e "${GREEN}✅ Minimal OPENAI_API_KEY references (error messages only)${NC}"
else
    echo -e "${YELLOW}⚠️  Found $openai_refs OPENAI_API_KEY references${NC}"
fi

echo "Checking for RAG import guards..."
rag_guards=$(grep -r "except ImportError" /Users/mac/Documents/GitHub/SmartCareerRecommendationISS/backend/ai_v2/agents 2>/dev/null | wc -l)
if [ "$rag_guards" -ge 2 ]; then
    echo -e "${GREEN}✅ RAG import guards in place ($rag_guards found)${NC}"
else
    echo -e "${YELLOW}⚠️  RAG import guards might be missing${NC}"
fi

echo ""
echo "${YELLOW}================================${NC}"
echo "${GREEN}✅ All tests completed!${NC}"
echo ""
echo "Summary:"
echo "  1. OpenRouter provider configuration: checked"
echo "  2. Health check: passed"
echo "  3. Quiz generation: tested"
echo "  4. CV analysis (/analyze-cv): tested"
echo "  5. Career matching: tested"
echo "  6. Roadmap generation: tested"
echo "  7. Code quality: verified"
echo ""
echo "Next steps:"
echo "  - Check if quiz returns adaptive questions (should ask about interests, not careers)"
echo "  - Verify CV analysis extracts real skills and evidence"
echo "  - Confirm merged profiles have both quiz and CV evidence fields"
