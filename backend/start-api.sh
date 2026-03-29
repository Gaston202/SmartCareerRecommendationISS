#!/bin/bash
# FastAPI Backend Startup Script
# Runs the Smart Career Recommendation API server

set -e  # Exit on error

echo "🚀 Starting Smart Career Recommendation API..."

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Navigate to backend directory
cd "$SCRIPT_DIR"

# Check if .venv exists, create if not
if [ ! -d ".venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv .venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source .venv/bin/activate

# Install/upgrade dependencies
echo "📚 Installing dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Load environment variables if .env exists
if [ -f ".env" ]; then
    echo "📝 Loading environment variables from .env"
    export $(cat .env | grep -v '^#' | xargs)
fi

# Create necessary directories
mkdir -p logs

# Start the API server
echo "✅ Starting FastAPI server..."
echo "📍 Server will be available at: http://localhost:8000"
echo "📖 API docs at: http://localhost:8000/docs"
echo ""

uvicorn api.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --reload \
    --log-level info
