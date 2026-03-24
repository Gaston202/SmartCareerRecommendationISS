# LLM Tool-Calling & RAG Implementation

## What's New

This upgrade introduces intelligent decision-making to the career recommendation system:

### 1. **LLM Tool-Calling** 
The LLM now decides which tools to call based on the user's situation, instead of following a fixed pipeline.

**Tools Available:**
- `extract_skills_from_profile` - Analyze user's current skills with proficiency levels
- `get_career_requirements` - Retrieve required skills for a target career role
- `compute_skill_gap` - Analyze gaps between current and required skills
- `generate_learning_roadmap` - Create structured learning plan with milestones
- `retrieve_career_resources` - Find courses, articles, tutorials for specific skills

**How it Works:**
1. User provides career goal or CV
2. LLM receives context + list of available tools
3. LLM decides which tools to call (0 or more)
4. Tools execute and return results
5. Results fed back to LLM
6. LLM generates final recommendation (repeat 3-5 as needed)
7. LLM's response includes reasoning with tool calls shown

**Example Flow:**
```
User: "I'm a Python developer, can I become a backend engineer?"
↓
LLM decides to call:
  1. extract_skills_from_profile(user_id)
  2. get_career_requirements("Backend Engineer")
  3. compute_skill_gap(current, required)  
  4. generate_learning_roadmap(target_role, missing_skills)
  5. retrieve_career_resources("Backend Engineer REST APIs")
↓
LLM receives all results and provides comprehensive recommendation
```

### 2. **Real RAG (Retrieval-Augmented Generation)**
Recommendations are now grounded in actual data instead of just prompts.

**Features:**
- OpenAI embeddings for semantic search
- Supabase pgvector for vector database
- Real career documents and learning resources
- Semantic similarity search
- Metadata filtering

**Knowledge Base Contains:**
- Career role requirements and competencies
- Learning paths for different skills
- Resource recommendations (courses, tutorials, projects)
- Market data integration ready

**Implementation Files:**

```
backend/ai_v2/
├── tools/
│   ├── definitions.py      # Tool schemas for LLM function calling
│   ├── executor.py         # Tool implementations
│   └── __init__.py         # Tool exports (updated)
├── services/
│   ├── tool_caller.py      # LLM tool-calling orchestrator
│   ├── supabase_rag.py     # RAG integration with Supabase
│   └── llm.py              # Updated with tool support
├── rag/
│   ├── embeddings.py       # Real OpenAI embeddings (updated)
│   └── retriever.py        # RAG orchestrator
└── config.py               # Added SUPABASE_* and ENABLE_RAG (updated)
```

## Usage

### Enable Tool-Calling in Pipeline

```python
from ai_v2.services.tool_caller import ToolCallingOrchestrator
from ai_v2.rag.embeddings import EmbeddingService
from ai_v2.services.supabase_rag import SupabaseRAG

# Initialize
embeddings = EmbeddingService()
rag = SupabaseRAG(embedding_service=embeddings)
tool_orchestrator = ToolCallingOrchestrator(llm_client=openai_client, rag_retriever=rag)

# Use in explanation agent
result = tool_orchestrator.call_with_tools(
    initial_prompt="Why should I become a backend engineer?",
    user_context={
        "current_experience": "5 years Python development",
        "target_role": "Backend Engineer",
        "learning_availability": "10 hours/week"
    }
)

# Result includes:
# - response: LLM's final recommendation
# - tool_calls: List of tools called with inputs/outputs
# - iterations: Number of LLM turns
# - mode: "tool_calling" (successful) or error status
```

### Initialize RAG with Documents

```python
from ai_v2.services.supabase_rag import SupabaseRAG

rag = SupabaseRAG(embedding_service=embeddings)

# Load career documents into knowledge base
result = rag.add_career_documents()

# Or add custom documents
docs = [
    {
        "id": "java-backend-guide",
        "title": "Java Backend Development Guide",
        "type": "resource",
        "content": "...",
        "metadata": {"skill": "Java", "level": "advanced"}
    }
]
rag.index_documents(docs, collection="career_resources")

# Search documents
results = rag.search(
    query="how to transition to backend engineering",
    top_k=5,
    threshold=0.7
)
```

## Configuration

Add to `.env`:

```bash
# OpenAI (required for real embeddings)
OPENAI_API_KEY=sk-...
EMBEDDING_MODEL=text-embedding-3-small

# Supabase RAG
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
ENABLE_RAG=true

# Feature flags
ENABLE_TOOL_CALLING=true
ENABLE_EXPLANATION_AGENT=true
```

## Supabase Setup

The RAG system expects these tables in Supabase:

### 1. Create `documents` table with vector column:

```sql
create table documents (
  id text primary key,
  collection text not null,
  title text,
  content text not null,
  content_type text,
  metadata jsonb,
  embedding vector(1536),
  created_at timestamp default now()
);

create index documents_embedding_idx on documents 
using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create index documents_collection_idx on documents(collection);
```

### 2. Optional: Create RPC for efficient vector search:

```sql
create or replace function search_documents(
  query_embedding vector(1536),
  match_threshold float default 0.5,
  match_count int default 5,
  collection_filter text default null
)
returns table (
  id text,
  title text,
  content text,
  similarity float
) language sql stable as $$
  select
    id,
    title,
    content,
    1 - (embedding <=> query_embedding) as similarity
  from documents
  where
    (collection_filter is null or collection = collection_filter)
    and 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;
```

## Integration Points

### In ExplanationAgent

```python
def run(self, input_data):
    # Initialize tool caller with RAG
    tool_orchestrator = ToolCallingOrchestrator(
        llm_client=self.llm.client,
        rag_retriever=self.rag
    )
    
    # Get career with intelligent tool use
    result = tool_orchestrator.call_with_tools(
        initial_prompt=f"Explain why this is a good career for the user",
        user_context={
            "user_profile": input_data["user_profile"],
            "career_recommendation": input_data["career_recommendation"],
            "current_skills": input_data["user_skills"]
        }
    )
    
    return self._create_output(
        success=result["success"],
        data={"explanation": result["response"], "tools_used": result["tool_calls"]}
    )
```

## Fallback Mode

If OpenAI API unavailable or no SUPABASE_URL configured:
- Embeddings: Uses mock deterministic vectors
- RAG: Returns mock documents
- Tool-calling: Returns mock tool results
- Pipeline continues with reduced accuracy

## Next Steps

1. **Production Deployment:**
   - Enable Supabase pgvector extension
   - Create tables with SQL migrations
   - Load real career/resource documents
   
2. **Enhanced RAG:**
   - Add hybrid search (semantic + keyword)
   - Implement reranking for better results
   - Add metadata filtering UI
   - Multi-hop retrieval for complex queries

3. **Advanced Tool-Calling:**
   - Tool use caching to reduce API calls
   - Parallel tool execution
   - Tool dependency management
   - Cost tracking

4. **User Feedback Loop:**
   - Track which recommendations matched reality
   - Update embeddings based on feedback
   - A/B test different tool calling strategies

## Performance Notes

- **Embeddings:** ~200ms per text with OpenAI API
- **Vector Search:** ~50-100ms for semantic search (Supabase pgvector)
- **Tool-Calling:** 2-5 LLM turns = 30-60 seconds for full recommendation
- **Mock Mode:** All operations <50ms

## Troubleshooting

**Problem:** "supabase library not installed"
```bash
pip install supabase
```

**Problem:** Vector search returns no results
- Check embedding dimensions match (should be 1536)
- Verify pgvector extension enabled: `CREATE EXTENSION IF NOT EXISTS vector;`
- Check similarity threshold not too high

**Problem:** Tool-calling loops infinitely
- Check `max_iterations` in ToolCallingOrchestrator (default: 10)
- Verify tool termination conditions in LLM prompts

**Problem:** High embedding API costs
- Use batch processing (embed_batch)
- Cache results (cached in memory)
- Consider local embeddings for non-production

## Testing

Run full pipeline with tool-calling:

```bash
python -m backend.ai_v2.main_pipeline --enable-tools --enable-rag
```

Test individual tools:

```python
from ai_v2.tools.executor import ToolExecutor

executor = ToolExecutor()
result = executor.execute("extract_skills_from_profile", {"user_id": "user123"})
print(result)
```

Test RAG:

```python
from ai_v2.services.supabase_rag import SupabaseRAG
from ai_v2.rag.embeddings import EmbeddingService

rag = SupabaseRAG(embedding_service=EmbeddingService())
results = rag.search("Python backend engineer")
print(f"Found {len(results)} results")
```
