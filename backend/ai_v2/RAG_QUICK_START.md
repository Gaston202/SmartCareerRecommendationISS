# RAG System - Quick Reference Card

## 🚀 Get Started in 2 Minutes

```bash
# 1. Install dependencies
pip install sentence-transformers torch

# 2. Run your pipeline (uses free local embeddings)
python -m backend.ai_v2.main_pipeline
```

Done! ✅ Your RAG system is working with FREE embeddings.

---

## ⚙️ Configuration

### In-Memory Mode (Default)
```bash
EMBEDDING_PROVIDER=local
EMBEDDING_MODEL=all-MiniLM-L6-v2
ENABLE_RAG=true
USE_SUPABASE_RAG=false
```

### Supabase Mode (Production)
```bash
EMBEDDING_PROVIDER=local
EMBEDDING_MODEL=all-MiniLM-L6-v2
ENABLE_RAG=true
USE_SUPABASE_RAG=true

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key
```

---

## 📝 Common Tasks

### Search for careers
```python
from backend.ai_v2.rag import RAGRetriever

retriever = RAGRetriever()
results = retriever.search("backend engineer", top_k=3)

for doc in results:
    print(f"{doc['title']} ({doc['similarity']:.2f})")
```

### Get role information
```python
retriever = RAGRetriever()
info = retriever.search_by_role("Backend Engineer")
print(f"Career: {info['career']}")
print(f"Skills: {info['skills']}")
print(f"Learning Path: {info['learning_path']}")
```

### Use in tools
```python
from backend.ai_v2.tools.base import retrieve_documents

result = retrieve_documents("Python learning resources", top_k=5)
print(f"Found: {result['count']} documents")
```

---

## 📊 Comparison

| Feature | In-Memory | Supabase | OpenAI |
|---------|-----------|----------|--------|
| **Cost** | $0 | ~$25-50/mo | $1000+/mo |
| **Speed** | ~50ms | ~100ms | ~300ms |
| **Storage** | RAM only | Persistent | - |
| **Scale** | <10K docs | Millions | Via API |
| **Setup** | Automatic | 5 minutes | API key only |

---

## 🔧 Switching Modes

**In-Memory → Supabase:**
1. Set up Supabase (see SUPABASE_SETUP.md)
2. Update `.env`: `USE_SUPABASE_RAG=true`
3. Run: `python -m backend.ai_v2.main_pipeline`

**Supabase → In-Memory:**
1. Update `.env`: `USE_SUPABASE_RAG=false`
2. Run: `python -m backend.ai_v2.main_pipeline`

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| "sentence-transformers not installed" | `pip install sentence-transformers torch` |
| Empty search results | Run `store.load_initial_documents()` |
| Supabase connection failed | Check credentials in `.env` |
| Slow embeddings | Normal on first run (model caches after) |

---

## 📚 Full Guides

- **Setup Guide**: `RAG_LOCAL_EMBEDDINGS.md`
- **SQL Schema**: `SUPABASE_SETUP.md`
- **Implementation Details**: `RAG_REFACTORING_SUMMARY.md`

---

## 🎯 What Changed?

✅ **Free embeddings** - No more OpenAI API costs  
✅ **Flexible storage** - In-memory or Supabase  
✅ **Better performance** - Local embeddings are fast  
✅ **Production ready** - Supabase pgvector for scale  
✅ **Fully compatible** - Your existing code still works  

---

## 💡 Pro Tips

1. **Cache embeddings** - They're cached automatically after first use
2. **Batch operations** - Use `embed_batch()` for 10x faster embedding
3. **Use metadata filters** - Narrow results by document type
4. **Monitor logs** - Look for `[LOCAL_EMBEDDINGS]` and `[RAG]` tags
5. **Test both modes** - Compare in-memory and Supabase performance

---

## 📞 Need Help?

1. Check logs: `export LOG_LEVEL=DEBUG`
2. Read guides in `backend/ai_v2/rag/`
3. Review code docstrings for examples
4. Check `[LOCAL_EMBEDDINGS]` / `[RAG]` / `[SUPABASE_RAG]` log messages

---

## 🎉 Next Steps

1. ✅ Install dependencies: `pip install sentence-transformers torch`
2. ✅ Run pipeline: `python -m backend.ai_v2.main_pipeline`
3. ✅ (Optional) Set up Supabase for production
4. ✅ (Optional) Add more career documents to knowledge base

**Your free, powerful RAG system is ready!** 🚀
