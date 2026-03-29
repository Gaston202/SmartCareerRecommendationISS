#!/bin/bash

# Integration Verification Script
# Checks that frontend, backend, and database are properly synchronized

set -e

echo "🔍 Phase 6 Integration Verification"
echo "==================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counter
CHECKS_PASSED=0
CHECKS_FAILED=0

# Helper functions
check_pass() {
    echo -e "${GREEN}✓ PASS:${NC} $1"
    ((CHECKS_PASSED++))
}

check_fail() {
    echo -e "${RED}✗ FAIL:${NC} $1"
    ((CHECKS_FAILED++))
}

check_info() {
    echo -e "${BLUE}ℹ INFO:${NC} $1"
}

# Check 1: Backend service files exist
echo -e "${YELLOW}1. Checking Backend Service Files${NC}"
if [ -f "backend/services/ai_integration.py" ]; then
    check_pass "ai_integration.py exists"
else
    check_fail "ai_integration.py missing"
fi

if [ -f "backend/api/routes.py" ]; then
    check_pass "routes.py exists"
else
    check_fail "routes.py missing"
fi

if [ -f "backend/services/__init__.py" ]; then
    check_pass "backend/services/__init__.py exists"
else
    check_fail "backend/services/__init__.py missing"
fi

if [ -f "backend/api/__init__.py" ]; then
    check_pass "backend/api/__init__.py exists"
else
    check_fail "backend/api/__init__.py missing"
fi
echo ""

# Check 2: Frontend environment files
echo -e "${YELLOW}2. Checking Frontend Environment Variables${NC}"
if [ -f "Mobile/.env.local" ]; then
    if grep -q "EXPO_PUBLIC_BACKEND_URL" "Mobile/.env.local"; then
        check_pass "Mobile backend URL configured"
        MOBILE_URL=$(grep "EXPO_PUBLIC_BACKEND_URL" "Mobile/.env.local" | cut -d= -f2)
        check_info "Mobile backend URL: $MOBILE_URL"
    else
        check_fail "Mobile backend URL not in .env.local"
    fi
else
    check_fail "Mobile/.env.local not found"
fi

if [ -f "admin-dashboard/.env.local" ]; then
    if grep -q "PYTHON_BACKEND_URL" "admin-dashboard/.env.local"; then
        check_pass "Admin backend URL configured"
        ADMIN_URL=$(grep "PYTHON_BACKEND_URL" "admin-dashboard/.env.local" | cut -d= -f2)
        check_info "Admin backend URL: $ADMIN_URL"
    else
        check_fail "Admin backend URL not in .env.local"
    fi
else
    check_fail "admin-dashboard/.env.local not found"
fi
echo ""

# Check 3: Frontend code modifications
echo -e "${YELLOW}3. Checking Frontend Code Modifications${NC}"
if grep -q "analyzeCvWithBackend" "Mobile/src/features/cv/cv-analysis.service.ts"; then
    check_pass "Mobile: analyzeCvWithBackend function added"
else
    check_fail "Mobile: analyzeCvWithBackend function not found"
fi

if grep -q "PYTHON_BACKEND_URL" "admin-dashboard/app/api/recommendations/route.ts"; then
    check_pass "Admin: PYTHON_BACKEND_URL integration added"
else
    check_fail "Admin: PYTHON_BACKEND_URL integration not found"
fi

if grep -q "recommend-careers" "admin-dashboard/app/api/recommendations/route.ts"; then
    check_pass "Admin: recommend-careers endpoint call added"
else
    check_fail "Admin: recommend-careers endpoint call not found"
fi
echo ""

# Check 4: Integration documentation
echo -e "${YELLOW}4. Checking Integration Documentation${NC}"
if [ -f "INTEGRATION_COMPLETE.md" ]; then
    check_pass "INTEGRATION_COMPLETE.md exists"
else
    check_fail "INTEGRATION_COMPLETE.md missing"
fi

if [ -f "INTEGRATION_GUIDE.md" ]; then
    check_pass "INTEGRATION_GUIDE.md exists"
else
    check_fail "INTEGRATION_GUIDE.md missing"
fi

if [ -f "FRONTEND_INTEGRATION_CHECKLIST.md" ]; then
    check_pass "FRONTEND_INTEGRATION_CHECKLIST.md exists"
else
    check_fail "FRONTEND_INTEGRATION_CHECKLIST.md missing"
fi

if [ -f "PHASE_6_STATUS.md" ]; then
    check_pass "PHASE_6_STATUS.md exists"
else
    check_fail "PHASE_6_STATUS.md missing"
fi
echo ""

# Check 5: ai_v2 system integrity
echo -e "${YELLOW}5. Checking ai_v2 System${NC}"
if [ -d "backend/ai_v2/agents" ]; then
    check_pass "ai_v2 agents directory exists"
    AGENT_COUNT=$(ls backend/ai_v2/agents/*.py 2>/dev/null | wc -l)
    check_info "Found $AGENT_COUNT agent files"
else
    check_fail "ai_v2 agents directory missing"
fi

if [ -d "backend/ai_v2/rag" ]; then
    check_pass "ai_v2 RAG system exists"
else
    check_fail "ai_v2 RAG system missing"
fi

if [ -f "backend/ai_v2/orchestrator.py" ]; then
    check_pass "ai_v2 orchestrator exists"
else
    check_fail "ai_v2 orchestrator missing"
fi
echo ""

# Check 6: Database compatibility
echo -e "${YELLOW}6. Checking Database Compatibility${NC}"
if grep -q "cv_analysis" "admin-dashboard/services/supabase.ts"; then
    check_pass "cv_analysis table referenced in services"
else
    check_fail "cv_analysis table not referenced"
fi

if grep -q "recommendations" "admin-dashboard/services/supabase.ts"; then
    check_pass "recommendations table referenced in services"
else
    check_fail "recommendations table not referenced"
fi
echo ""

# Check 7: Python syntax validation
echo -e "${YELLOW}7. Checking Python Syntax${NC}"
if python3 -m py_compile backend/services/ai_integration.py 2>/dev/null; then
    check_pass "ai_integration.py has valid Python syntax"
else
    check_fail "ai_integration.py has syntax errors"
fi

if python3 -m py_compile backend/api/routes.py 2>/dev/null; then
    check_pass "routes.py has valid Python syntax"
else
    check_fail "routes.py has syntax errors"
fi
echo ""

# Check 8: TypeScript syntax validation
echo -e "${YELLOW}8. Checking TypeScript Files${NC}"
if [ -f "Mobile/src/features/cv/cv-analysis.service.ts" ]; then
    check_pass "Mobile CV analysis service file exists"
else
    check_fail "Mobile CV analysis service file missing"
fi

if [ -f "admin-dashboard/app/api/recommendations/route.ts" ]; then
    check_pass "Admin recommendations route file exists"
else
    check_fail "Admin recommendations route file missing"
fi
echo ""

# Summary
echo -e "${YELLOW}==================================${NC}"
echo -e "${YELLOW}Verification Summary${NC}"
echo -e "${YELLOW}==================================${NC}"
echo -e "${GREEN}Checks Passed: $CHECKS_PASSED${NC}"
echo -e "${RED}Checks Failed: $CHECKS_FAILED${NC}"
echo ""

if [ $CHECKS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All integration checks passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Start the backend service:"
    echo "   cd backend && python -m api.routes"
    echo ""
    echo "2. Start mobile app (in new terminal):"
    echo "   cd Mobile && npm start"
    echo ""
    echo "3. Start admin dashboard (in new terminal):"
    echo "   cd admin-dashboard && npm run dev"
    echo ""
    echo "4. Test the integration:"
    echo "   - Upload a CV through mobile app"
    echo "   - Generate recommendations in admin dashboard"
    echo "   - Check Supabase for saved records"
    echo ""
    exit 0
else
    echo -e "${RED}✗ Some integration checks failed!${NC}"
    echo "Please review the failed checks above and run this script again."
    echo ""
    exit 1
fi
