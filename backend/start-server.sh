#!/bin/bash
# Backend API Server Startup Script
# Starts the Flask API server that connects frontend/mobile apps to ai_v2 pipeline

set -e

echo "🚀 Starting Backend API Server..."
echo ""

# Get absolute path to backend directory
BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$BACKEND_DIR")"

echo "📁 Project Root: $PROJECT_ROOT"
echo "📁 Backend Dir:  $BACKEND_DIR"
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.10 or higher."
    exit 1
fi

# Get Python version
PYTHON_VERSION=$(python3 --version 2>&1)
echo "🐍 Using: $PYTHON_VERSION"
echo ""

# Create Python virtual environment if it doesn't exist
if [ ! -d "$BACKEND_DIR/.venv" ]; then
    echo "📦 Creating virtual environment..."
    cd "$BACKEND_DIR"
    python3 -m venv .venv
    echo "✓ Virtual environment created"
fi

# Activate virtual environment
echo "🔗 Activating virtual environment..."
source "$BACKEND_DIR/.venv/bin/activate"
echo "✓ Virtual environment activated"
echo ""

# Install requirements
echo "📚 Installing dependencies..."
if [ -f "$BACKEND_DIR/requirements.txt" ]; then
    pip install -q -r "$BACKEND_DIR/requirements.txt"
    echo "✓ Dependencies installed"
else
    echo "⚠️  requirements.txt not found at $BACKEND_DIR/requirements.txt"
fi

if [ -f "$BACKEND_DIR/ai_v2/requirements.txt" ]; then
    pip install -q -r "$BACKEND_DIR/ai_v2/requirements.txt"
    echo "✓ AI v2 dependencies installed"
fi

echo ""

# Check for .env file
if [ ! -f "$PROJECT_ROOT/.env" ]; then
    echo "⚠️  .env file not found at $PROJECT_ROOT/.env"
    echo "    Please create one with your environment variables"
    echo ""
fi

# Display startup info
echo "════════════════════════════════════════════════════════"
echo "✅ Backend API Server Ready"
echo "════════════════════════════════════════════════════════"
echo ""
echo "🌐 Server will start on:   http://localhost:8000"
echo "🏥 Health check endpoint:  http://localhost:8000/health"
echo "📊 CV Analysis endpoint:   POST http://localhost:8000/analyze-cv"
echo "🎯 Recommendations endpoint: POST http://localhost:8000/recommend-careers"
echo ""
echo "📱 For Mobile App Development:"
echo "   Replace localhost with your machine IP in Mobile/.env"
echo "   Get IP with: ifconfig | grep 'inet ' | grep -v 127.0.0.1"
echo ""
echo "Ctrl+C to stop the server"
echo "════════════════════════════════════════════════════════"
echo ""

# Set environment variables
export PYTHONUNBUFFERED=1
export FLASK_ENV=development
export FLASK_DEBUG=1

# Change to backend directory for imports to work
cd "$BACKEND_DIR"

# Run the Flask server
python -m api.routes
