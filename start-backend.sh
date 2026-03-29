#!/bin/bash
# Quick start script for Smart Career Recommendation System
# This script prepares and starts the backend for iOS/mobile development

set -e

echo "🚀 Smart Career Recommendation - Backend Setup & Start"
echo "======================================================="
echo ""

# 1. Check Python
echo "1️⃣  Checking Python..."
python3 --version

# 2. Get network IP
echo ""
echo "2️⃣  Detecting network IP..."
NETWORK_IP=$(ifconfig | grep "inet " | grep -v "127.0.0.1" | head -1 | awk '{print $2}')
echo "   Network IP detected: $NETWORK_IP"

# 3. Verify/Update Mobile .env
echo ""
echo "3️⃣  Checking Mobile/.env configuration..."
BACKEND_URL="http://${NETWORK_IP}:8000"
if ! grep -q "EXPO_PUBLIC_BACKEND_URL=${BACKEND_URL}" Mobile/.env 2>/dev/null; then
    echo "   ⚠️  Updating Mobile/.env with correct backend URL..."
    if [ -f "Mobile/.env" ]; then
        sed -i '' "s|EXPO_PUBLIC_BACKEND_URL=.*|EXPO_PUBLIC_BACKEND_URL=${BACKEND_URL}|g" Mobile/.env
    fi
    echo "   ✅ Updated: EXPO_PUBLIC_BACKEND_URL=${BACKEND_URL}"
else
    echo "   ✅ Mobile/.env already configured correctly"
fi

# 4. Install dependencies
echo ""
echo "4️⃣  Installing/verifying Python dependencies..."
pip3 install -q numpy scikit-learn sentence-transformers pydantic langchain openai fastapi uvicorn supabase requests python-multipart python-dotenv 2>/dev/null || true
echo "   ✅ Dependencies ready"

# 5. Start backend
echo ""
echo "5️⃣  Starting backend server..."
echo "   Backend URL: ${BACKEND_URL}"
echo ""
cd backend
python3 -m uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload

# Backend will keep running - press Ctrl+C to stop
