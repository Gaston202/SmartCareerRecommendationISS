#!/usr/bin/env python3
"""
Knowledge Base Population Script

Populates the career knowledge base with document embeddings.
Supports both Supabase pgvector storage and fallback modes.

Usage:
    python backend/ai_v2/scripts/populate_kb.py [--mode supabase|fallback] [--force]

Examples:
    # Populate with Supabase (if available)
    python backend/ai_v2/scripts/populate_kb.py

    # Force populate even if docs exist
    python backend/ai_v2/scripts/populate_kb.py --force

    # Use fallback (no Supabase needed)
    python backend/ai_v2/scripts/populate_kb.py --mode fallback
"""

import sys
import json
from pathlib import Path
from typing import Dict, List, Any, Optional

# Add the backend directory to the path
backend_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(backend_dir))

from ai_v2.config import config
from ai_v2.services.embedding import EmbeddingService
from ai_v2.utils import get_logger

logger = get_logger(__name__)


# Career knowledge base documents
CAREER_DOCUMENTS: List[Dict[str, Any]] = [
    {
        "id": "career_backend_engineer",
        "title": "Backend Engineer",
        "category": "career",
        "content": """Backend Engineer - Server-side developer building APIs and services.

Overview:
Backend engineers build the server-side logic that powers applications. They work with databases, APIs, and systems that handle data processing and business logic.

Core Skills Required:
- Programming languages: Python, Java, Go, Rust, Node.js
- Databases: SQL (PostgreSQL, MySQL), NoSQL (MongoDB, Redis)
- API design: REST, GraphQL, gRPC
- System design and architecture
- Version control (Git)
- Testing and debugging
- Message queues and event streaming (RabbitMQ, Kafka)
- Containerization (Docker, Kubernetes)
- Cloud platforms (AWS, GCP, Azure)

Career Progression:
- Junior Backend Developer (0-2 years): Learning fundamentals, working on assigned features
- Mid-Level Backend Developer (2-5 years): Leading features, system design input, mentoring
- Senior Backend Developer (5+ years): Architecture decisions, performance optimization
- Staff/Principal Engineer (7+ years): Company-wide technical decisions, strategy

Learning Path:
1. Master one primary language deeply (typically 6 months)
2. Learn fundamental CS concepts (data structures, algorithms)
3. Understand databases: SQL queries, indexing, transactions
4. Study API design and REST principles
5. Learn containerization and orchestration
6. Study system design: scalability, reliability, performance
7. Get cloud experience (at least one major cloud platform)

Typical Salary Range:
- Junior: $80k-$120k
- Mid-Level: $120k-$180k
- Senior: $180k-$250k+
- Staff: $250k-$400k+

Job Market: Very High Demand (shortage of experienced backend engineers)
Companies: Google, Amazon, Microsoft, Meta, Netflix, Uber, Airbnb""",
        "metadata": {
            "level": "all",
            "field": "backend",
            "demand": "very_high",
            "salary_range": "$80k-$400k",
            "growth_potential": "high",
            "required_skills": [
                "Python",
                "Java",
                "Go",
                "Node.js",
                "SQL",
                "PostgreSQL",
                "MongoDB",
                "REST APIs",
                "System Design",
                "Docker",
                "Kubernetes",
                "AWS",
                "Git"
            ],
            "core_skills": ["Backend Development", "API Design", "Database Management", "System Architecture"],
            "experience_level": ["0-2 years", "2-5 years", "5+ years"]
        }
    },
    {
        "id": "career_frontend_engineer",
        "title": "Frontend Engineer",
        "category": "career",
        "content": """Frontend Engineer - User-facing developer building interfaces and experiences.

Overview:
Frontend engineers create the visual and interactive parts of applications that users see and interact with. They focus on performance, accessibility, and user experience.

Core Skills Required:
- HTML, CSS, JavaScript (TypeScript preferred)
- Modern frameworks: React, Vue, Angular, Svelte
- State management: Redux, Zustand, MobX
- Testing: Jest, React Testing Library, Cypress
- Build tools: Webpack, Vite, Parcel
- Version control (Git)
- API integration (REST, GraphQL)
- Performance optimization
- Responsive design and CSS patterns
- Accessibility (WCAG standards)

Career Progression:
- Junior Frontend Developer (0-2 years): Learning frameworks, building components
- Mid-Level Frontend Developer (2-5 years): System design, performance, mentoring
- Senior Frontend Developer (5+ years): Architecture, testing strategy, leadership
- Staff/Principal Engineer (7+ years): Platform decisions, company standards

Learning Path:
1. Master HTML, CSS, and vanilla JavaScript (3-6 months)
2. Learn one major framework deeply (React recommended, 3-4 months)
3. Study modern tooling (Webpack, npm/yarn, package management)
4. Learn API integration patterns (REST, GraphQL)
5. Master state management for complex applications
6. Study performance optimization and web vitals
7. Learn testing frameworks and practices
8. Understand accessibility standards

Typical Salary Range:
- Junior: $75k-$110k
- Mid-Level: $110k-$170k
- Senior: $170k-$240k+
- Staff: $240k-$380k+

Job Market: Very High Demand
Companies: FAANG, Startups, Product companies""",
        "metadata": {
            "level": "all",
            "field": "frontend",
            "demand": "very_high",
            "salary_range": "$75k-$380k",
            "growth_potential": "high",
            "required_skills": [
                "HTML",
                "CSS",
                "JavaScript",
                "TypeScript",
                "React",
                "Vue",
                "Angular",
                "State Management",
                "REST APIs",
                "GraphQL",
                "Testing",
                "Git",
                "Responsive Design"
            ],
            "core_skills": ["Frontend Development", "UI/UX Implementation", "JavaScript Frameworks", "Performance Optimization"],
            "experience_level": ["0-2 years", "2-5 years", "5+ years"]
        }
    },
    {
        "id": "career_fullstack_engineer",
        "title": "Full Stack Engineer",
        "category": "career",
        "content": """Full Stack Engineer - Developer skilled in both frontend and backend development.

Overview:
Full stack engineers are versatile developers who can build complete applications from database to user interface. They understand the full technology stack and can work across the entire application architecture.

Core Skills Required:
- Backend: Python, Node.js, Go, or similar
- Frontend: React, Vue, or similar
- Databases: SQL and NoSQL
- API design and integration
- DevOps basics: Docker, basic cloud deployment
- Git and version control
- System design fundamentals
- Testing frameworks and practices

Career Progression:
- Junior Full Stack Developer (0-2 years): Learning full stack, working on small features
- Mid-Level Full Stack Developer (2-5 years): Feature ownership, system design input
- Senior Full Stack Developer (5+ years): Architecture decisions, mentoring
- Lead / Principal Full Stack Engineer (7+ years): Technical strategy

Learning Path:
1. Master one backend language (3-6 months)
2. Learn one frontend framework (3-4 months)
3. Understand relational and NoSQL databases
4. Study API design and REST principles
5. Learn basic DevOps (Docker, basic deployment)
6. Study system design for full-stack applications
7. Practice building complete projects end-to-end

Typical Salary Range:
- Junior: $80k-$125k
- Mid-Level: $125k-$190k
- Senior: $190k-$280k+
- Lead: $280k-$380k+

Job Market: High Demand
Best For: Startups, smaller teams, rapid feature development
Growth: Can specialize into backend, frontend, or DevOps later""",
        "metadata": {
            "level": "all",
            "field": "fullstack",
            "demand": "high",
            "salary_range": "$80k-$380k",
            "growth_potential": "very_high",
            "required_skills": [
                "JavaScript",
                "TypeScript",
                "Python",
                "Node.js",
                "React",
                "SQL",
                "MongoDB",
                "Docker",
                "REST APIs",
                "System Design",
                "Git",
                "AWS",
                "Testing"
            ],
            "core_skills": ["Full Stack Development", "Database Design", "API Development", "DevOps Basics"],
            "experience_level": ["0-2 years", "2-5 years", "5+ years"]
        }
    },
    {
        "id": "career_data_scientist",
        "title": "Data Scientist",
        "category": "career",
        "content": """Data Scientist - Knowledge worker extracting insights from data.

Overview:
Data scientists use statistics, machine learning, and programming to extract insights from data and drive business decisions. They work across the data pipeline from exploration to deployment.

Core Skills Required:
- Python or R programming
- Statistical analysis and probability
- Machine learning: supervised, unsupervised, deep learning
- Data visualization: matplotlib, seaborn, Tableau, Power BI
- SQL and database querying
- Big data tools: Spark, Hadoop
- Model evaluation and validation
- Feature engineering
- Business acumen
- Communication skills

Career Progression:
- Junior Data Scientist (0-2 years): Data analysis, basic model building
- Data Scientist (2-5 years): Model ownership, feature engineering
- Senior Data Scientist (5+ years): Project leadership, strategy
- ML Engineer / ML Architect (7+ years): Infrastructure, production systems
- ML Manager / Director (8+ years): Team leadership, strategy

Learning Path:
1. Master statistics and probability (3-4 months)
2. Learn Python data stack: NumPy, Pandas, scikit-learn (3-4 months)
3. Study machine learning algorithms and models
4. Learn SQL for data extraction and manipulation
5. Master data visualization and storytelling
6. Study feature engineering and model optimization
7. Learn deep learning (TensorFlow, PyTorch)
8. Understand deployment and MLOps

Typical Salary Range:
- Junior: $85k-$130k
- Senior: $130k-$200k
- ML Engineer: $200k-$300k+
- Staff/Principal: $300k-$450k+

Job Market: Very High Demand
Growth Areas: MLOps, AI/ML applications, data infrastructure""",
        "metadata": {
            "level": "all",
            "field": "data_science",
            "demand": "very_high",
            "salary_range": "$85k-$450k",
            "growth_potential": "very_high",
            "required_skills": [
                "Python",
                "R",
                "SQL",
                "Machine Learning",
                "Statistics",
                "Data Visualization",
                "TensorFlow",
                "PyTorch",
                "Pandas",
                "NumPy",
                "Spark",
                "Git",
                "Big Data"
            ],
            "core_skills": ["Data Analysis", "Machine Learning", "Statistical Modeling", "Data Visualization"],
            "experience_level": ["0-2 years", "2-5 years", "5+ years"]
        }
    },
    {
        "id": "skill_python",
        "title": "Python Programming",
        "category": "skill",
        "content": """Python - Versatile, beginner-friendly programming language.

Use Cases:
- Backend web development (Django, FastAPI, Flask)
- Data science and machine learning (scikit-learn, TensorFlow, PyTorch)
- Automation and scripting
- DevOps and infrastructure
- AI applications

Learning Resources:
- Official Python tutorial: python.org
- Real Python: In-depth articles and tutorials
- Codecademy: Interactive Python course
- LeetCode: 1000+ Python coding problems

Time to Proficiency:
- Basics: 1-3 months
- Intermediate: 6-12 months
- Advanced: 1-2 years

Key Topics:
- Variables, data types, control flow
- Functions and modules
- Object-oriented programming
- File handling and regular expressions
- Testing (unittest, pytest)
- Virtual environments and package management

Popular Frameworks:
- Web: Django, Flask, FastAPI
- Data: Pandas, NumPy, scikit-learn
- ML: TensorFlow, PyTorch, Keras
- Automation: Selenium, requests

Companies Using Python: Google, Amazon, Netflix, Uber, Instagram, Spotify
Salary Potential: Python skills add 15-30% to base salary
Job Market: Extremely high demand across all roles""",
        "metadata": {
            "level": "beginner",
            "category": "programming_language",
            "demand": "very_high",
            "learning_time": "3-12 months",
            "used_in_roles": ["Backend Engineer", "Data Scientist", "Full Stack Engineer"],
            "difficulty_level": 2,
            "prerequisites": []
        }
    },
    {
        "id": "skill_javascript_typescript",
        "title": "JavaScript and TypeScript",
        "category": "skill",
        "content": """JavaScript/TypeScript - Essential frontend and increasingly backend language.

JavaScript:
- Runs in browsers for interactive web pages
- Event handling, DOM manipulation
- Async programming (Promises, async/await)
- ES6+ modern features

TypeScript:
- Superset of JavaScript with static typing
- Compile-time error checking
- Better IDE support and autocomplete
- Used in React (very common)

Learning Resources:
- MDN Web Docs: Comprehensive reference
- Eloquent JavaScript: Free online book
- freeCodeCamp: Complete courses
- Frontend Masters: Advanced courses

Time to Proficiency:
- JavaScript basics: 2-4 months
- Advanced JavaScript: 6-12 months
- TypeScript: Add 1-2 months

Key Topics:
- Variables, functions, objects
- Array methods and functional programming
- DOM manipulation
- Event handling
- Promises and async/await
- Type system (TypeScript)

Frameworks & Libraries:
- Frontend: React, Vue, Angular, Svelte
- Backend: Node.js, Express, NestJS
- Full Stack: Next.js, Remix

Companies: Every tech company uses JavaScript
Salary Impact: JavaScript/TypeScript skills add 20-40% to salary
Job Market: Highest demand for frontend/web roles""",
        "metadata": {
            "level": "beginner",
            "category": "programming_language",
            "demand": "very_high",
            "learning_time": "2-12 months",
            "used_in_roles": ["Frontend Engineer", "Full Stack Engineer", "Backend Engineer"],
            "difficulty_level": 2,
            "prerequisites": []
        }
    },
    {
        "id": "skill_system_design",
        "title": "System Design",
        "category": "skill",
        "content": """System Design - Architecting large-scale, reliable systems.

Key Concepts:
- Scalability: Vertical vs. horizontal scaling
- Load balancing: Distributing traffic
- Caching: Redis, Memcached for performance
- Database design: Sharding, replication, partitioning
- API design: REST vs. GraphQL vs. gRPC
- Message queues: Async processing, decoupling
- Microservices vs. monolithic architecture
- Consistency models: ACID, CAP theorem, eventual consistency

Components:
- Load Balancers: Nginx, HAProxy
- Caching Layers: Redis, Memcached
- Databases: PostgreSQL, MongoDB, Cassandra
- Message Queues: RabbitMQ, Kafka
- CDN: CloudFront, CloudFlare
- Container Orchestration: Kubernetes
- Monitoring: Prometheus, ELK stack

Design Patterns:
- API Gateway
- Service Discovery
- Circuit Breaker
- Rate Limiting
- Cache-Aside
- Event Sourcing

Interview Preparation (Common Questions):
- Design Twitter / Instagram / Facebook
- Design YouTube / Netflix recommendation
- Design Uber / Lyft matching system
- Design Amazon shopping cart
- Design real-time chat system

Learning Resources:
- "Designing Data-Intensive Applications" (Kleppmann) - Essential book
- System Design Interview YouTube channel
- Mock interview practice
- Real-world architecture case studies

Time to Proficiency: 6-12 months of focused study
Prerequisite Knowledge: 2-3 years of software engineering
Salary Impact: System design knowledge increases offers by 30-50%
Job Market: Required for mid-level+ engineering roles""",
        "metadata": {
            "level": "intermediate",
            "category": "architecture",
            "demand": "very_high",
            "learning_time": "6-12 months",
            "used_in_roles": ["Backend Engineer", "Full Stack Engineer"],
            "difficulty_level": 4,
            "prerequisites": ["Python", "JavaScript", "SQL"]
        }
    },
    {
        "id": "skill_react",
        "title": "React JavaScript Framework",
        "category": "skill",
        "content": """React - Most popular JavaScript frontend framework.

Core Concepts:
- Components: Reusable UI building blocks
- JSX: HTML-like syntax in JavaScript
- Props: Component input / configuration
- State: Dynamic component data
- Hooks: useState, useEffect, useContext, useReducer
- Effect hooks: Side effects and lifecycle
- Custom hooks: Reusable logic

Advanced Topics:
- State management: Redux, Zustand, Jotai
- Performance optimization: React.memo, useMemo, useCallback
- Code splitting and lazy loading
- Server-side rendering (Next.js)
- Testing: React Testing Library, Jest
- Component composition patterns
- TypeScript with React

Learning Resources:
- Official React documentation: react.dev (excellent for 2024+)
- freecodecamp React course on YouTube
- React docs beta: Newest interactive tutorial
- scrimba: Interactive React course
- Udemy: Advanced React patterns

Projects to Build:
1. Todo app (basic)
2. Weather app with API (intermediate)
3. E-commerce shop (advanced)
4. Dashboard with charts (advanced)
5. Social media app (complex)

Time to Proficiency:
- React basics: 4-6 weeks
- Intermediate React: 2-3 months
- Advanced React: 3-6 months
- Production-ready: 6-12 months

Ecosystem:
- Build tools: Vite (modern choice), Create React App (legacy)
- State: Redux, Zustand, Jotai, Recoil
- Routing: React Router
- Forms: React Hook Form, Formik
- HTTP: Axios, React Query, SWR
- UI Components: Material-UI, shadcn/ui, Chakra UI

Job Market:
- React is the #1 frontend framework by job postings
- Salary boost: 15-25% for React expertise
- Demand: Very high across all company sizes
- Career path: React engineer → full stack → architect""",
        "metadata": {
            "level": "beginner",
            "category": "framework",
            "demand": "very_high",
            "learning_time": "1-6 months",
            "used_in_roles": ["Frontend Engineer", "Full Stack Engineer"],
            "difficulty_level": 3,
            "prerequisites": ["JavaScript", "HTML", "CSS"]
        }
    },
    {
        "id": "learning_path_backend_basics",
        "title": "Become a Backend Engineer",
        "category": "learning_path",
        "content": """Learning Path to Backend Engineering

Phase 1: Programming Fundamentals (2-3 months)
Choose one language and master basics:
- Python recommended for beginners (easier syntax, great for learning)
- Alternative: Java or JavaScript
Topics:
- Variables, data types, control flow
- Functions and modularity
- OOP: Classes, inheritance, polymorphism
- Error handling and debugging
Practice: Build 5-10 small command-line projects

Phase 2: Data Structures & Algorithms (3-4 months)
Essential for interviews and good code:
- Arrays, linked lists, trees, graphs
- Sorting and searching algorithms
- Big O notation and complexity analysis
- Recursion and dynamic programming
Practice: LeetCode easy (50), then medium (30)

Phase 3: Databases (2-3 months)
Learn data persistence:
- SQL fundamentals: SELECT, JOIN, aggregation
- Database design: normalization, relationships
- Indexes and query optimization
- Transactions and ACID properties
- NoSQL basics: MongoDB or Redis
Practice: Design 3-5 database schemas

Phase 4: Web APIs & REST (2 months)
Build your first API:
- HTTP methods and status codes
- RESTful design principles
- API authentication (JWT, OAuth)
- Error handling and validation
- Choose framework: FastAPI, Flask (Python), Express (Node.js), Spring (Java)
Practice: Build 2-3 REST APIs

Phase 5: System Design Basics (2-3 months)
Understand scalability:
- Load balancing
- Caching strategies
- Database scaling: sharding, replication
- API design for scale
- Message queues for async processing

Phase 6: DevOps Essentials (1-2 months)
Deploy your applications:
- Docker basics and containerization
- Docker Compose
- Basic Kubernetes
- Cloud platforms: AWS, GCP, or Azure
Practice: Deploy 2-3 projects to cloud

Total Time: 12-16 months of dedicated learning
Expected Salary: $80k-$120k for junior position

Recommended Project Progression:
1. Simple API: Todo list with CRUD
2. Medium API: Blog/E-commerce backend
3. Complex API: Real-time chat or notification system
4. Distributed system: Multi-service architecture

Resources:
- Backend Roadmap: roadmap.sh
- YouTube: Hussein Nasser (system design), Traversy Media
- Books: "Designing Data-Intensive Applications"
- Platforms: Udemy, Coursera, Backend Masters""",
        "metadata": {
            "level": "beginner",
            "category": "learning_path",
            "estimated_duration_months": 16,
            "target_role": "Backend Engineer",
            "skills_covered": ["Python", "SQL", "REST APIs", "System Design", "Docker"],
            "prerequisites": []
        }
    },
    {
        "id": "learning_path_frontend_basics",
        "title": "Become a Frontend Engineer",
        "category": "learning_path",
        "content": """Learning Path to Frontend Engineering

Phase 1: Web Fundamentals (1-2 months)
Master the basics:
- HTML: Semantic HTML, forms, accessibility
- CSS: Selectors, flexbox, grid, responsive design
- JavaScript: Variables, functions, objects, async
Practice: Build 5-10 static websites with HTML/CSS

Phase 2: JavaScript Mastery (2-3 months)
Go deep on JavaScript:
- DOM manipulation
- Event handling
- Async programming: Promises, async/await
- Array methods and functional programming
- ES6+ features: arrow functions, destructuring, spreads
Practice: Build 3-5 vanilla JavaScript projects

Phase 3: React Framework (2-3 months)
Use the most popular framework:
- React components and JSX
- Props and state
- Hooks: useState, useEffect, useContext
- Event handling
- Component lifecycle
Practice: Build 5-7 React projects

Phase 4: Advanced React (1-2 months)
Go beyond basics:
- Custom hooks
- State management: Redux or Zustand
- Performance optimization
- Testing: Jest and React Testing Library
- TypeScript with React
Practice: Refactor previous projects

Phase 5: Full Application Development (2-3 months)
Build complete features:
- API integration (REST or GraphQL)
- Form handling and validation
- Error handling
- Authentication flows
- Navigation: React Router
Practice: Build 2-3 full-featured projects

Phase 6: Tooling & Deployment (1-2 months)
Prepare for production:
- Build tools: Webpack, Vite
- Package management: npm/yarn
- Git and GitHub workflows
- Deployment: Vercel, Netlify
- Monitoring and debugging
Practice: Deploy 2-3 projects to production

Total Time: 10-16 months of dedicated learning
Expected Salary: $75k-$110k for junior position

Recommended Project Progression:
1. Personal portfolio website (static + interactive)
2. Simple CRUD app: Todo or notes app
3. Medium app: Weather app with API, movie search
4. Complex app: E-commerce shop, social media clone
5. Advanced app: Collaborative tool, multi-user app

Resources:
- Frontend Roadmap: roadmap.sh
- React Docs: react.dev
- YouTube: Traversy Media, Web Dev Simplified
- Interactive: Scrimba, Frontend Masters
- Books: "You Don't Know JS" series

Career Growth:
- Junior: 0-2 years, learning framework patterns
- Mid-level: 2-5 years, system design, performance
- Senior: 5+ years, architecture, mentoring
- Staff: 7+ years, company standards, full-stack""",
        "metadata": {
            "level": "beginner",
            "category": "learning_path",
            "estimated_duration_months": 14,
            "target_role": "Frontend Engineer",
            "skills_covered": ["HTML", "CSS", "JavaScript", "React", "TypeScript"],
            "prerequisites": []
        }
    },
]


def populate_knowledge_base(force: bool = False, mode: str = "auto") -> Dict[str, Any]:
    """
    Populate the knowledge base with career documents.
    
    Args:
        force: Force populate even if documents exist
        mode: "auto" (try Supabase, fallback), "supabase", "fallback"
    
    Returns:
        Dict with status and results
    """
    logger.info("=" * 70)
    logger.info("Starting Knowledge Base Population")
    logger.info("=" * 70)
    
    # Try the selected mode
    if mode == "auto" or mode == "supabase":
        try:
            result = _populate_supabase(force)
            if result["success"]:
                return result
            elif mode == "supabase":
                logger.error("Supabase mode failed and no fallback allowed")
                return result
            logger.info("Supabase not available, trying fallback mode...")
        except Exception as e:
            logger.warning(f"Supabase population failed: {e}")
            if mode == "supabase":
                return {
                    "success": False,
                    "error": str(e),
                    "indexed": 0,
                    "mode": "supabase_failed"
                }
    
    # Fallback mode
    logger.info("Using fallback mode (built-in knowledge base)")
    return {
        "success": True,
        "mode": "fallback",
        "message": "Knowledge base uses built-in fallback documents",
        "indexed": len(CAREER_DOCUMENTS),
        "documents": [
            {"id": doc["id"], "title": doc["title"], "category": doc["category"]}
            for doc in CAREER_DOCUMENTS
        ],
    }


def _populate_supabase(force: bool = False) -> Dict[str, Any]:
    """
    Populate knowledge base in Supabase using embeddings.
    """
    try:
        from ai_v2.services.supabase_rag import SupabaseRAG
        from services.supabase_client import get_supabase_client
        
        logger.info("[Supabase] Checking Supabase connection...")
        
        supabase = get_supabase_client()
        if not supabase:
            raise ValueError("Could not initialize Supabase client")
        
        logger.info("[Supabase] ✓ Connected to Supabase")
        
        # Initialize embedding service
        logger.info("[Embedding] Initializing embedding service...")
        embedder = EmbeddingService(provider=config.EMBEDDING_PROVIDER)
        logger.info(f"[Embedding] ✓ Using {config.EMBEDDING_PROVIDER} embeddings")
        
        # Initialize RAG
        rag = SupabaseRAG(client=supabase, embedding_service=embedder)
        
        # Check if documents already exist
        if not force:
            logger.info("[Supabase] Checking for existing documents...")
            try:
                result = supabase.table("documents").select("id").limit(1).execute()
                if result.data:
                    logger.info(
                        "[Supabase] Documents already exist. Use --force to replace."
                    )
                    return {
                        "success": False,
                        "error": "Documents already exist",
                        "indexed": 0,
                        "mode": "supabase",
                    }
            except Exception:
                logger.debug("[Supabase] Could not check existing documents")
        
        # Index documents
        logger.info(f"[Supabase] Indexing {len(CAREER_DOCUMENTS)} documents...")
        
        result = rag.index_documents(
            documents=[
                {
                    "id": doc["id"],
                    "content": doc["content"],
                    "title": doc["title"],
                    "type": doc["category"],
                    "metadata": doc.get("metadata", {}),
                }
                for doc in CAREER_DOCUMENTS
            ],
            collection="career_knowledge",
        )
        
        if result.get("success"):
            logger.info(f"[Supabase] ✓ Successfully indexed {result['indexed']} documents")
            return {
                "success": True,
                "mode": "supabase",
                "indexed": result["indexed"],
                "message": f"Knowledge base populated with {result['indexed']} documents in Supabase",
                "documents": [
                    {"id": doc["id"], "title": doc["title"], "category": doc["category"]}
                    for doc in CAREER_DOCUMENTS[:10]
                ],
            }
        else:
            logger.error(f"[Supabase] Indexing failed: {result.get('error')}")
            raise ValueError(f"Indexing failed: {result.get('error')}")
            
    except ImportError as e:
        logger.warning(f"[Supabase] Dependencies not available: {e}")
        raise
    except Exception as e:
        logger.error(f"[Supabase] Population error: {e}")
        raise


def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Populate the knowledge base")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force populate even if documents exist"
    )
    parser.add_argument(
        "--mode",
        choices=["auto", "supabase", "fallback"],
        default="auto",
        help="Population mode"
    )
    
    args = parser.parse_args()
    
    try:
        result = populate_knowledge_base(force=args.force, mode=args.mode)
        
        if result["success"]:
            logger.info("=" * 70)
            logger.info(f"✅ Knowledge Base Population Successful")
            logger.info(f"   Mode: {result.get('mode')}")
            logger.info(f"   Documents indexed: {result.get('indexed', 0)}")
            logger.info(f"   Message: {result.get('message', 'Success')}")
            logger.info("=" * 70)
            return 0
        else:
            logger.error("=" * 70)
            logger.error("❌ Knowledge Base Population Failed")
            logger.error(f"   Error: {result.get('error')}")
            logger.error("=" * 70)
            return 1
            
    except Exception as e:
        logger.error("=" * 70)
        logger.error(f"❌ Population Error: {e}")
        logger.error("=" * 70)
        return 1


if __name__ == "__main__":
    sys.exit(main())
