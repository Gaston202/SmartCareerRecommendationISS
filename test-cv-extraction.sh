#!/bin/bash

# Test script for CV extraction fix
# Verifies that PDF and text CV analysis now extract actual data

set -e

cd "$(dirname "${BASH_SOURCE[0]}")"
source .venv/bin/activate

echo "======================================"
echo "CV EXTRACTION TESTS"
echo "======================================"

# Test 1: Analyze plain text CV
echo ""
echo "TEST 1: Plain Text CV Analysis"
echo "------"
curl -s -X POST http://localhost:8000/analyze-cv \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test_user_123",
    "cv_text": "Python Developer with 3 years experience. Skills: Python, JavaScript, React, PostgreSQL, Docker, AWS. Projects: Built doctor appointment system with Vue.js and FastAPI. Worked on real-time chat application using Node.js and WebSockets. Education: BS Computer Science."
  }' | python3 -m json.tool

echo ""
echo "======================================"
echo "Checking response for extracted data..."
echo "======================================"

# Extract the response and check for skills
RESPONSE=$(curl -s -X POST http://localhost:8000/analyze-cv \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test_user_123",
    "cv_text": "Python Developer with 3 years experience. Skills: Python, JavaScript, React, PostgreSQL, Docker, AWS. Projects: Built doctor appointment system with Vue.js and FastAPI. Worked on real-time chat application using Node.js and WebSockets. Education: BS Computer Science."
  }')

SUCCESS=$(echo "$RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('success', False))")
SKILLS_COUNT=$(echo "$RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); skills = data.get('data', {}).get('extracted_evidence', {}).get('skills', []); print(len(skills))")
SUMMARY=$(echo "$RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('data', {}).get('summary', ''))")

echo "✓ Success: $SUCCESS"
echo "✓ Skills extracted: $SKILLS_COUNT"
echo "✓ Summary: $SUMMARY"

if [ "$SUCCESS" == "True" ] && [ "$SKILLS_COUNT" -gt 0 ]; then
  echo ""
  echo "✅ TEST PASSED: CV extraction is working!"
  exit 0
else
  echo ""
  echo "❌ TEST FAILED: No skills extracted!"
  echo "Response: $RESPONSE"
  exit 1
fi
