# API Documentation - Smart Career Recommendation Backend

## Overview

The FastAPI backend exposes the AI v2 career recommendation pipeline to mobile apps and web dashboards via HTTP endpoints. It provides:

- **Career Matching**: AI-powered career recommendations based on user profile and CV
- **Quiz Generation**: Personalized assessment questions
- **Learning Roadmaps**: Step-by-step learning paths to target careers

## Quick Start

### Prerequisites

- Python 3.8+
- Virtual environment (recommended)
- Dependencies from `requirements.txt`

### Installation

```bash
cd backend

# Create virtual environment (optional but recommended)
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### Running the Server

#### Option 1: Using the startup script (Recommended)
```bash
chmod +x start-api.sh
./start-api.sh
```

#### Option 2: Direct uvicorn command
```bash
uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
```

#### Option 3: Python module execution
```bash
python -m api.main
```

### Verify It's Working

```bash
# Test health endpoint
curl http://localhost:8000/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2025-03-25T10:30:00",
  "service": "career-recommendation-api",
  "version": "1.0.0"
}
```

## API Endpoints

### 1. Health Check

**Endpoint**: `GET /health`

**Purpose**: Verify backend connectivity from mobile apps

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2025-03-25T10:30:00",
  "service": "career-recommendation-api",
  "version": "1.0.0"
}
```

**Usage from Mobile**:
```javascript
// Example using fetch in React Native
const response = await fetch('http://YOUR_IP:8000/health');
const data = await response.json();
console.log(data.status); // "healthy"
```

---

### 2. Career Matching

**Endpoint**: `POST /career-matching`

**Purpose**: Generate career recommendations based on user profile and CV

**Request Schema**:
```json
{
  "user_id": "user_123",
  "user_profile": {
    "user_id": "user_123",
    "name": "John Doe",
    "email": "john@example.com",
    "current_skills": ["Python", "JavaScript", "SQL"],
    "experience_level": "entry",
    "education": "Bachelor's in Computer Science"
  },
  "cv_text": "Software developer with 2 years experience in web development...",
  "job_market_data": null,
  "preferences": {
    "preferred_roles": ["Backend Engineer", "DevOps"],
    "preferred_locations": ["Remote", "US"]
  }
}
```

**Response Schema**:
```json
{
  "success": true,
  "user_id": "user_123",
  "careers": [
    {
      "role": "Backend Engineer",
      "match_score": 0.92,
      "growth_trajectory": "Senior Backend Engineer → Tech Lead",
      "salary_range": "$80k - $120k",
      "market_demand": "high",
      "description": "Strong match for your Python and SQL skills"
    },
    {
      "role": "Full Stack Developer",
      "match_score": 0.85,
      "growth_trajectory": "Senior Full Stack → Solution Architect",
      "salary_range": "$75k - $110k",
      "market_demand": "high",
      "description": "Great fit using JavaScript and Python"
    }
  ],
  "confidence_score": 0.88,
  "timestamp": "2025-03-25T10:30:00"
}
```

**Error Response**:
```json
{
  "success": false,
  "user_id": "user_123",
  "error": "Failed to process request: ...",
  "timestamp": "2025-03-25T10:30:00"
}
```

**Usage from Mobile**:
```javascript
const response = await fetch('http://YOUR_IP:8000/career-matching', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    user_id: 'user_123',
    user_profile: {
      user_id: 'user_123',
      name: 'John Doe',
      email: 'john@example.com',
      current_skills: ['Python', 'JavaScript'],
      experience_level: 'entry',
    },
  }),
});

const result = await response.json();
if (result.success) {
  result.careers.forEach(career => {
    console.log(`${career.role}: ${Math.round(career.match_score * 100)}% match`);
  });
}
```

---

### 3. Generate Quiz

**Endpoint**: `POST /generate-quiz`

**Purpose**: Generate personalized quiz questions for career assessment

**Request Schema**:
```json
{
  "user_id": "user_123",
  "user_profile": {
    "user_id": "user_123",
    "name": "John Doe",
    "email": "john@example.com",
    "current_skills": ["Python"],
    "experience_level": "entry"
  },
  "num_questions": 5,
  "quiz_type": "career_assessment"
}
```

**Response Schema**:
```json
{
  "success": true,
  "user_id": "user_123",
  "questions": [
    {
      "id": 1,
      "question": "How interested are you in a career as a Backend Engineer?",
      "type": "rating",
      "options": ["Not interested", "Somewhat interested", "Very interested"],
      "context": {
        "role": "Backend Engineer",
        "match_score": 0.92
      }
    },
    {
      "id": 2,
      "question": "Which technologies are you most comfortable with?",
      "type": "multiple",
      "options": ["Python", "JavaScript", "Java", "Go", "Rust"],
      "context": {}
    }
  ],
  "total_questions": 2,
  "timestamp": "2025-03-25T10:30:00"
}
```

**Parameters**:
- `num_questions` (int, 1-20): Number of questions to generate (default: 5)
- `quiz_type` (string): Type of quiz - `career_assessment`, `skill_check`, or `interest_exploration`

---

### 4. Generate Roadmap

**Endpoint**: `POST /generate-roadmap`

**Purpose**: Create a personalized learning roadmap to reach target career

**Request Schema**:
```json
{
  "user_id": "user_123",
  "user_profile": {
    "user_id": "user_123",
    "name": "John Doe",
    "email": "john@example.com",
    "current_skills": ["Python"],
    "experience_level": "entry"
  },
  "target_career": "Backend Engineer",
  "timeframe_months": 12
}
```

**Response Schema**:
```json
{
  "success": true,
  "user_id": "user_123",
  "target_career": "Backend Engineer",
  "roadmap": [
    {
      "phase": 1,
      "title": "Python Fundamentals",
      "duration_months": 3,
      "skills_to_learn": ["Python basics", "OOP", "Testing"],
      "difficulty": "beginner",
      "resources": [
        "Python.org Tutorial",
        "Codecademy Python Course",
        "Real Python Articles"
      ],
      "milestones": [
        "Complete Python basics",
        "Build first small project",
        "Understand OOP principles"
      ],
      "estimated_cost": "$50-100"
    },
    {
      "phase": 2,
      "title": "Web Frameworks & APIs",
      "duration_months": 3,
      "skills_to_learn": ["FastAPI", "Django", "REST APIs"],
      "difficulty": "intermediate",
      "resources": [
        "FastAPI Official Docs",
        "Full Stack Python",
        "Real Project Development"
      ],
      "milestones": [
        "Build first API",
        "Implement authentication",
        "Deploy to production"
      ],
      "estimated_cost": "Free"
    },
    {
      "phase": 3,
      "title": "Advanced Backend Topics",
      "duration_months": 6,
      "skills_to_learn": ["Database optimization", "Caching", "Message queues"],
      "difficulty": "advanced",
      "resources": [
        "System Design Interview prep",
        "Advanced Backend courses"
      ],
      "milestones": [
        "Optimize database queries",
        "Implement caching",
        "Build distributed system"
      ],
      "estimated_cost": "$100-200"
    }
  ],
  "total_phases": 3,
  "estimated_total_months": 12,
  "timestamp": "2025-03-25T10:30:00"
}
```

---

## Integration with Mobile App

### Example: React Native / Expo

```typescript
// backend.service.ts
import { BackendConfig } from '../config/backend';

interface CareerMatchingPayload {
  user_id: string;
  user_profile: {
    user_id: string;
    name: string;
    email: string;
    current_skills: string[];
    experience_level: string;
  };
  cv_text?: string;
}

export async function getCareerMatches(
  payload: CareerMatchingPayload
): Promise<any> {
  try {
    const response = await fetch(
      `${BackendConfig.baseUrl}/career-matching`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      throw new Error(`Backend error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[Backend] Career matching failed:', error);
    throw error;
  }
}
```

---

## Environment Configuration

### `.env` File (Backend)

```bash
# Backend API Configuration
ENVIRONMENT=development
LOG_LEVEL=INFO

# AI Pipeline Configuration
OPENAI_API_KEY=sk-...
LLM_MODEL=gpt-4
EMBEDDING_MODEL=text-embedding-3-small

# Feature Flags
ENABLE_PROFILE_AGENT=true
ENABLE_CV_AGENT=true
ENABLE_CAREER_AGENT=true
ENABLE_GAP_AGENT=true
ENABLE_ROADMAP_AGENT=true
```

### Mobile App `.env` Configuration

```bash
# Mobile API Configuration
EXPO_PUBLIC_BACKEND_URL=http://192.168.0.9:8000  # Change IP to your Mac's IP
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

---

## CORS Configuration

The API has CORS enabled for development. Current allowed origins:

- `http://localhost:3000` - Admin dashboard
- `http://localhost:3001` - Admin alternative port
- `http://localhost:8081` - Expo web
- `http://192.168.0.9:8081` - Mobile on local network

**For Production**: Update the `ALLOWED_ORIGINS` in `api/main.py` to restrict to specific domains.

---

## Logging

The API logs all requests and responses. Check logs for debugging:

```
2025-03-25 10:30:00 - api.main - INFO - Career matching request for user: user_123
2025-03-25 10:30:02 - api.main - INFO - ✅ Career matching completed for user_123
```

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Detailed error message",
  "timestamp": "2025-03-25T10:30:00",
  "user_id": "user_123"  // If applicable
}
```

**Common HTTP Status Codes**:
- `200` - Success
- `400` - Bad request (validation error)
- `500` - Server error (check logs)

---

## Auto-Generated API Documentation

Visit `http://localhost:8000/docs` for interactive Swagger UI documentation.

Visit `http://localhost:8000/redoc` for ReDoc alternative.

---

## Development Tips

### Running in Production Mode

```bash
uvicorn api.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### Debugging

Enable debug logging:
```bash
uvicorn api.main:app --host 0.0.0.0 --port 8000 --log-level debug
```

### Testing Endpoints

```bash
# Using curl
curl -X POST http://localhost:8000/career-matching \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test_user",
    "user_profile": {
      "user_id": "test_user",
      "name": "Test User",
      "email": "test@example.com",
      "current_skills": ["Python"],
      "experience_level": "entry"
    }
  }'
```

---

## Architecture

```
Mobile App (iOS/Android)
         ↓
   HTTP Request
         ↓
  FastAPI (api/main.py)
         ↓
  Request Validation (Pydantic schemas)
         ↓
  AI Pipeline (ai_v2/main_pipeline.py)
         ↓
  Multi-Agent System
    ├─ Profile Agent
    ├─ CV Agent
    ├─ Career Agent
    ├─ Gap Agent
    └─ Roadmap Agent
         ↓
  JSON Response
         ↓
  Mobile App receives data
```

---

## Troubleshooting

### Backend Connection Failed

**Problem**: Mobile app shows "Failed to connect to backend"

**Solutions**:
1. Ensure backend is running: `./start-api.sh`
2. Check your IP address: `ifconfig | grep "inet "`
3. Update mobile `.env` with correct IP: `EXPO_PUBLIC_BACKEND_URL=http://YOUR_IP:8000`
4. Clear app cache: `npm start -c` in Mobile directory
5. Check firewall: Port 8000 should be accessible

### Module Import Errors

**Problem**: "Cannot import from ai_v2"

**Solutions**:
1. Ensure you're in the backend directory: `cd backend`
2. Install dependencies: `pip install -r requirements.txt`
3. Verify PYTHONPATH includes backend: Check `sys.path` in `api/main.py`

### Dependency Conflicts

**Problem**: Requirements installation fails

**Solutions**:
1. Update pip: `pip install --upgrade pip`
2. Create fresh venv: `rm -rf .venv && python3 -m venv .venv`
3. Install dependencies again: `pip install -r requirements.txt`

---

## Next Steps

1. **Update Mobile App**: Configure `EXPO_PUBLIC_BACKEND_URL` in `Mobile/.env`
2. **Test Endpoints**: Use Swagger UI at `http://localhost:8000/docs`
3. **Production Deployment**: Deploy to cloud (AWS, GCP, Azure, Heroku)
4. **Monitor Performance**: Add APM (Application Performance Monitoring)
5. **Scale**: Use load balancer and multiple API instances
