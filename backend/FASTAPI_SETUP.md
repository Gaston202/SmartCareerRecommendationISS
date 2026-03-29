# FastAPI Backend Setup - Mobile Integration Guide

## ⚡ Quick Start (5 Minutes)

### Step 1: Start Backend Server (Terminal 1)

```bash
cd backend

# Make startup script executable (Mac/Linux)
chmod +x start-api.sh

# Start the server
./start-api.sh

# Expected output:
# ✅ Starting FastAPI server...
# 📍 Server will be available at: http://localhost:8000
# 📖 API docs at: http://localhost:8000/docs
```

Or run directly:
```bash
uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
```

### Step 2: Get Your Mac's IP Address

```bash
# Find your local IP (NOT 127.0.0.1)
ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1

# Output looks like: inet 192.168.0.9
# Copy the IP address (e.g., 192.168.0.9)
```

### Step 3: Update Mobile .env File

Edit `Mobile/.env`:

```bash
# Add this line with YOUR IP from Step 2:
EXPO_PUBLIC_BACKEND_URL=http://192.168.0.9:8000
```

Complete file should look like:
```bash
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://tipysihegnyvwxibhbue.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Backend API
EXPO_PUBLIC_BACKEND_URL=http://192.168.0.9:8000

# OpenRouter (optional)
OPENAI_API_KEY=sk-proj-...
OPENROUTER_API_KEY=sk-or-v1-...
```

### Step 4: Restart Mobile App (Terminal 2)

```bash
cd Mobile

# Clear cache and restart
npm start -c

# When Expo menu appears:
# Press 'i' for iOS simulator
# OR
# Press 'a' for Android emulator
```

### Step 5: Verify Connection

In the iOS simulator/Android emulator logs, you should see:

```
LOG  [AI_CONFIG] Backend URL configured: http://192.168.0.9:8000
LOG  [AI_CONFIG] Verifying backend connection...
LOG  [AI_CONFIG] ✅ Backend connected successfully
```

✅ **You're done!** The mobile app can now communicate with the backend.

---

## 🧪 Testing the Connection

### Option 1: Via Simulator Console

Once the app starts, you should see:
```
✅ Backend connected successfully
```

### Option 2: Direct API Test

```bash
# Test health endpoint
curl http://192.168.0.9:8000/health

# Should return:
{
  "status": "healthy",
  "timestamp": "2025-03-25T10:30:00",
  "service": "career-recommendation-api",
  "version": "1.0.0"
}
```

### Option 3: Interactive Swagger UI

Open in browser:
```
http://192.168.0.9:8000/docs
```

You can test all endpoints here with a visual interface.

---

## 🔧 Troubleshooting

### Issue: "Network request failed" in app logs

**Cause**: iOS simulator can't reach `localhost`. Must use your Mac's IP.

**Solution**:
```bash
# 1. Get Mac IP
ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1

# 2. Update Mobile/.env
EXPO_PUBLIC_BACKEND_URL=http://192.168.0.9:8000

# 3. Restart app
npm start -c
```

### Issue: Connection refused / timeout

**Cause**: Backend not running on port 8000.

**Solution**:
```bash
# Check if backend is running
lsof -i :8000

# If nothing, start it:
cd backend && ./start-api.sh
```

### Issue: "Backend URL not configured" error

**Cause**: `.env` file missing `EXPO_PUBLIC_BACKEND_URL`.

**Solution**:
```bash
cd Mobile

# Check .env file
cat .env

# Should contain:
# EXPO_PUBLIC_BACKEND_URL=http://192.168.0.9:8000

# If missing, add it to .env
echo "EXPO_PUBLIC_BACKEND_URL=http://192.168.0.9:8000" >> .env

# Restart app
npm start -c
```

### Issue: "Firewall blocking connection"

**Cause**: Mac firewall prevents simulator from accessing port 8000.

**Solution** (macOS):
1. System Preferences → Security & Privacy → Firewall Options
2. Allow `python` or `uvicorn` through firewall
3. Or temporarily disable firewall for testing: `sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate off`

### Issue: Wrong IP address / not connecting

**Debug steps**:
```bash
# 1. Confirm backend is listening on all interfaces
lsof -i :8000
# Should show: uvicorn 0.0.0.0:8000

# 2. Test from another device
# From iPhone/Android on same network:
curl http://192.168.0.9:8000/health

# 3. Check iOS simulator can reach Mac
# In simulator terminal:
ping 192.168.0.9

# 4. If ping fails, try host IP
ifconfig | grep "name lo" -A 1
```

---

## 📱 API Endpoints Available

Once connected, the mobile app can use these endpoints:

### 1. Health Check
```bash
GET /health
```
Used for: Verifying connection on app startup

### 2. Career Matching
```bash
POST /career-matching
```
Request:
```json
{
  "user_id": "user_123",
  "user_profile": {
    "user_id": "user_123",
    "name": "John Doe",
    "email": "john@example.com",
    "current_skills": ["Python", "JavaScript"],
    "experience_level": "entry"
  },
  "cv_text": "optional CV content"
}
```

### 3. Quiz Generation
```bash
POST /generate-quiz
```
Request:
```json
{
  "user_id": "user_123",
  "user_profile": { ... },
  "num_questions": 5
}
```

### 4. Roadmap Generation
```bash
POST /generate-roadmap
```
Request:
```json
{
  "user_id": "user_123",
  "user_profile": { ... },
  "target_career": "Backend Engineer"
}
```

---

## 🚀 Next Steps

1. **Test Quiz**: Open mobile app → Go to Quiz screen → Take test
2. **Test Career Matching**: Go to Career Matching → See recommendations
3. **Test Roadmap**: Select a career → View learning path

---

## 📊 Architecture

```
┌─────────────────────┐
│   Mobile App (iOS)  │
│ (React Native/Expo) │
└──────────┬──────────┘
           │
           │ HTTP POST
           │ (JSON payload)
           ▼
┌─────────────────────────────────┐
│  FastAPI Backend (Port 8000)    │
│  - /health                      │
│  - /career-matching             │
│  - /generate-quiz               │
│  - /generate-roadmap            │
└──────────┬──────────────────────┘
           │
           │ Python Function Calls
           ▼
┌─────────────────────────────────┐
│  AI v2 Pipeline                 │
│  - Profile Agent                │
│  - CV Agent                      │
│  - Career Agent                  │
│  - Gap Agent                     │
│  - Roadmap Agent                 │
└─────────────────────────────────┘
```

---

## 🔐 Security Notes

For **development** only, CORS is set to allow all origins. For **production**:

Edit `backend/api/main.py`:
```python
ALLOWED_ORIGINS = [
    "https://yourapp.com",
    "https://youradmin.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,  # Change this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## 💡 Pro Tips

### Tip 1: Keep Logs Visible
Run backend in one terminal and keep it visible to see request logs:
```
2025-03-25 10:30:00 - api.main - INFO - Career matching request for user: user_123
2025-03-25 10:30:02 - api.main - INFO - ✅ Career matching completed for user_123
```

### Tip 2: Use Swagger UI for Testing
Open `http://192.168.0.9:8000/docs` in browser to test endpoints interactively before implementing in mobile app.

### Tip 3: Monitor Network Requests
In React Native, enable network logs:
```javascript
// In App.tsx
if (__DEV__) {
  require('./config/network-logger');
}
```

### Tip 4: Cache Responses
For better UX, cache API responses in the mobile app using React Query:
```javascript
const { data, isLoading } = useQuery(
  ['career-matching', userId],
  () => getCareerMatches(userId),
  { staleTime: 1000 * 60 * 5 } // 5 minutes
);
```

---

## 📚 Full Documentation

See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for:
- Complete endpoint specifications
- Request/response schemas
- Error handling
- Production deployment
- Performance tips

---

## ✅ Verification Checklist

- [ ] Backend running: `./start-api.sh` in terminal
- [ ] Backend accessible: `curl http://YOUR_IP:8000/health`
- [ ] Mobile `.env` has `EXPO_PUBLIC_BACKEND_URL=http://YOUR_IP:8000`
- [ ] Mobile app logs show "Backend connected successfully"
- [ ] Swagger UI works: `http://YOUR_IP:8000/docs`
- [ ] Quiz/Career Matching/Roadmap features work in app

All set! 🎉
