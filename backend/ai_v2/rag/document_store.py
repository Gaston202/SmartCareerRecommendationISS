"""
Document store for RAG system.

In-memory knowledge base containing career documents, skill descriptions,
and learning resources. Designed to be easily migratable to pgvector/Qdrant.
"""

from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from enum import Enum


class DocumentType(str, Enum):
    """Types of documents in knowledge base."""
    CAREER = "career"
    SKILL = "skill"
    RESOURCE = "resource"
    LEARNING_PATH = "learning_path"
    MARKET_DATA = "market_data"


@dataclass
class Document:
    """Document with metadata and content."""
    id: str
    title: str
    content: str
    doc_type: DocumentType
    metadata: Dict[str, Any]
    tags: List[str]


class DocumentStore:
    """
    In-memory document store with full-text search.
    
    Features:
        - Store documents with embeddings
        - Metadata filtering
        - Tag-based retrieval
        - Easy migration path to vector DB
    """
    
    def __init__(self):
        """Initialize document store."""
        self.documents: Dict[str, Document] = {}
        self.embeddings: Dict[str, List[float]] = {}
        self.index_by_type: Dict[DocumentType, List[str]] = {
            doc_type: [] for doc_type in DocumentType
        }
        self.index_by_tag: Dict[str, List[str]] = {}
        self._init_career_knowledge_base()
    
    def _init_career_knowledge_base(self) -> None:
        """Initialize with real career documents."""
        career_docs = [
            Document(
                id="career-backend-engineer",
                title="Backend Engineer Role",
                content=(
                    "Backend Engineer: Develops server-side logic, APIs, and databases. "
                    "Core responsibilities include designing scalable systems, writing clean code, "
                    "optimizing database queries, and ensuring system reliability. "
                    "Best suited for: Problem solvers who enjoy system design. "
                    "Key skills needed: Programming (Python, Java, Go), SQL/NoSQL, REST APIs, "
                    "Docker & Kubernetes, CI/CD, microservices architecture. "
                    "Career progression: Junior → Mid → Senior → Architect. "
                    "Salary range: $80k-$250k depending on experience and location. "
                    "Typical learning time: 2-3 years from junior developer to mid-level."
                ),
                doc_type=DocumentType.CAREER,
                metadata={
                    "level": "mid",
                    "salary_min": 80000,
                    "salary_max": 250000,
                    "demand": "very_high"
                },
                tags=["backend", "systems", "scalability", "high-demand"]
            ),
            Document(
                id="career-data-scientist",
                title="Data Scientist Role",
                content=(
                    "Data Scientist: Extracts insights from data using statistics and ML. "
                    "Core responsibilities include exploratory data analysis, model development, "
                    "data visualization, and communicating insights to stakeholders. "
                    "Best suited for: Analytical thinkers who enjoy solving puzzles. "
                    "Key skills needed: Python, Statistics, SQL, Machine Learning frameworks "
                    "(scikit-learn, TensorFlow, PyTorch), Pandas, visualization (Matplotlib, Tableau), "
                    "experimental design. "
                    "Career progression: Junior Data Analyst → Data Scientist → Senior/Lead. "
                    "Salary range: $90k-$300k depending on specialization and location. "
                    "Typical learning time: 1-2 years from analytics background."
                ),
                doc_type=DocumentType.CAREER,
                metadata={
                    "level": "mid",
                    "salary_min": 90000,
                    "salary_max": 300000,
                    "demand": "high"
                },
                tags=["data", "ml", "analytics", "high-demand"]
            ),
            Document(
                id="career-devops-engineer",
                title="DevOps Engineer Role",
                content=(
                    "DevOps Engineer: Bridges development and operations by automating deployment "
                    "and infrastructure. Core responsibilities include CI/CD pipelines, "
                    "infrastructure provisioning, monitoring, and incident response. "
                    "Best suited for: Automation enthusiasts who enjoy reliability. "
                    "Key skills needed: Docker, Kubernetes, cloud platforms (AWS/GCP/Azure), "
                    "Infrastructure as Code (Terraform), CI/CD tools (Jenkins, GitLab CI), "
                    "Linux administration, monitoring tools (Prometheus, ELK). "
                    "Career progression: DevOps Engineer → Senior DevOps → Architect. "
                    "Salary range: $100k-$280k depending on expertise and location. "
                    "Typical learning time: 2-3 years building ops experience."
                ),
                doc_type=DocumentType.CAREER,
                metadata={
                    "level": "mid",
                    "salary_min": 100000,
                    "salary_max": 280000,
                    "demand": "very_high"
                },
                tags=["infrastructure", "automation", "systems", "high-demand"]
            ),
            Document(
                id="skill-python",
                title="Python Programming Mastery",
                content=(
                    "Python is essential for backend, data science, and DevOps roles. "
                    "Learning path: Fundamentals (2-3 weeks) → OOP & design patterns (2-3 weeks) → "
                    "Advanced (async, decorators, metaclasses: 2-3 weeks) → Frameworks (Flask/Django: 2-3 weeks). "
                    "Best practices: Type hints, testing, documentation, version control. "
                    "Key libraries: requests, pandas, numpy, asyncio. "
                    "Practice: Build 3-5 small projects, contribute to open source. "
                    "Total time commitment: 12-16 weeks for intermediate proficiency. "
                    "Resources: Python Docs, RealPython, Codewars, LeetCode."
                ),
                doc_type=DocumentType.SKILL,
                metadata={
                    "difficulty": "beginner",
                    "weeks_to_learn": 16,
                    "people_learning": 500000
                },
                tags=["programming", "python", "foundational"]
            ),
            Document(
                id="skill-sql-databases",
                title="SQL and Database Design",
                content=(
                    "SQL mastery is critical for backend and data roles. "
                    "Learning path: DDL/DML basics (2 weeks) → Joins & queries (2 weeks) → "
                    "Optimization & indexing (2 weeks) → Transactions & ACID (1 week) → NoSQL intro (1 week). "
                    "Key concepts: ACID transactions, normalization, query optimization, indexes, "
                    "connection pooling, replication. "
                    "Popular databases: PostgreSQL (relational), MongoDB (document), Redis (cache). "
                    "Practice: Optimize slow queries, design schemas, handle millions of rows. "
                    "Total time commitment: 8-12 weeks for working proficiency. "
                    "Resources: PostgreSQL Docs, Mode SQL Tutorial, Leetcode Database problems."
                ),
                doc_type=DocumentType.SKILL,
                metadata={
                    "difficulty": "intermediate",
                    "weeks_to_learn": 12,
                    "people_learning": 400000
                },
                tags=["databases", "sql", "data", "essential"]
            ),
            Document(
                id="skill-docker-kubernetes",
                title="Docker and Kubernetes Mastery",
                content=(
                    "Containerization and orchestration are essential for backend and DevOps. "
                    "Learning path: Docker basics (3 weeks) → Multi-container apps (2 weeks) → "
                    "Kubernetes basics (3 weeks) → Production patterns (2 weeks) → Monitoring (1 week). "
                    "Key concepts: Images, layers, networking, volumes, services, deployments, "
                    "scaling, resource management, canary deployments. "
                    "Practice: Dockerize existing apps, deploy to K8s cluster, set up CI/CD. "
                    "Tools: Docker Compose, minikube, Helm, Prometheus. "
                    "Total time commitment: 11-13 weeks for production-ready skills. "
                    "Resources: Docker Docs, Kubernetes.io, Linux Academy courses."
                ),
                doc_type=DocumentType.SKILL,
                metadata={
                    "difficulty": "intermediate",
                    "weeks_to_learn": 12,
                    "prerequisites": ["Linux", "networking"]
                },
                tags=["devops", "containers", "infrastructure"]
            ),
            Document(
                id="skill-system-design",
                title="System Design and Architecture",
                content=(
                    "System design is crucial for senior backend roles and interviews. "
                    "Topics: Scalability (vertical vs horizontal), databases (sharding, replication), "
                    "caching (Redis, memcached), message queues (RabbitMQ, Kafka), "
                    "load balancing, CDNs, microservices, event-driven architecture. "
                    "Learning approach: Study existing systems (Twitter, Netflix, Discord), "
                    "design systems from scratch, prepare for system design interviews. "
                    "Key trade-offs: consistency vs availability, latency vs throughput, "
                    "cost vs performance. "
                    "Practice: Design Twitter with 1M concurrent users, Netflix streaming platform, "
                    "real-time chat application. "
                    "Time commitment: Ongoing skill - 2-3 months for first mastery. "
                    "Resources: System Design Interview book, YouTube experts (Alex Xu)."
                ),
                doc_type=DocumentType.SKILL,
                metadata={
                    "difficulty": "advanced",
                    "weeks_to_learn": 12,
                    "prerequisites": ["Backend fundamentals", "Databases"]
                },
                tags=["architecture", "backend", "senior"]
            ),
            Document(
                id="path-junior-to-backend",
                title="Learning Path: Junior Developer to Backend Engineer",
                content=(
                    "Month 1-2: Master Python fundamentals and OOP. "
                    "Month 3: Learn SQL and database design through building a real app. "
                    "Month 4-5: Build REST APIs with Flask/Django, understand HTTP and web basics. "
                    "Month 6: Deploy using Docker, learn basic DevOps. "
                    "Month 7-9: Build a scalable system with databases, caching, message queues. "
                    "Month 10-12: System design, microservices, event-driven architecture. "
                    "Throughout: Build 3-5 portfolio projects, contribute to open source, read code. "
                    "Assessment: Can you design a Twitter/Netflix clone? Can you optimize slow queries? "
                    "Can you explain trade-offs in a system? "
                    "Certification path: AWS Solutions Architect optional (validates cloud skills). "
                    "Total time: 12-18 months from junior to mid-level backend engineer."
                ),
                doc_type=DocumentType.LEARNING_PATH,
                metadata={
                    "target_role": "Backend Engineer",
                    "starting_level": "junior",
                    "months": 18,
                    "success_rate": 0.75
                },
                tags=["backend", "learning-path", "structured"]
            ),
            Document(
                id="path-developer-to-devops",
                title="Learning Path: Developer to DevOps Engineer",
                content=(
                    "Month 1: Deep dive into Linux (Ubuntu). Comfortable with shell scripting. "
                    "Month 2-3: Learn Docker and containerization. Build and run containers. "
                    "Month 4-5: Master Kubernetes - deployments, services, configuration. "
                    "Month 6-7: Cloud platform (AWS/GCP). IAM, networking, storage, compute. "
                    "Month 8: Infrastructure as Code (Terraform or CloudFormation). "
                    "Month 9: CI/CD pipelines (Jenkins, GitLab CI, GitHub Actions). "
                    "Month 10-12: Monitoring, logging, observability (Prometheus, ELK). "
                    "Month 13+: Advanced patterns - GitOps, service mesh, multi-cloud. "
                    "Throughout: Build actual infrastructure, maintain production systems. "
                    "Assessment: Can you deploy an app to K8s? Version and rollback deployments? "
                    "Certifications: Kubernetes CKA, AWS Solutions Architect (valuable). "
                    "Total time: 12-18 months from developer to production DevOps engineer."
                ),
                doc_type=DocumentType.LEARNING_PATH,
                metadata={
                    "target_role": "DevOps Engineer",
                    "starting_level": "backend_dev",
                    "months": 18,
                    "success_rate": 0.80
                },
                tags=["devops", "learning-path", "infrastructure"]
            ),
            Document(
                id="resource-python-realpython",
                title="Real Python - Comprehensive Python Tutorials",
                content=(
                    "Real Python (realpython.com): Premium tutorials for Python developers. "
                    "Strengths: In-depth, well-tested code examples, free articles + premium courses. "
                    "Best for: Intermediate developers wanting deep understanding. "
                    "Cost: Free for articles, $90/year for premium. "
                    "Topics: OOP, decorators, async/await, databases, APIs, testing, deployment. "
                    "Recommendation: Start with free articles, upgrade when ready for structured courses."
                ),
                doc_type=DocumentType.RESOURCE,
                metadata={
                    "type": "tutorial_site",
                    "cost": "free+premium",
                    "rating": 4.8,
                    "hours": 100,
                    "url": "https://realpython.com",
                    "description": "Free and premium tutorials for Python from beginner to advanced. "
                    "Coverage includes basics, OOP, async programming, web frameworks, testing. "
                    "Quality: Industry standard, regularly updated."
                },
                tags=["python", "tutorial", "resource", "recommended"]
            ),
            Document(
                id="resource-system-design-interview",
                title="System Design Interview Book",
                content=(
                    "System Design Interview book by Alex Xu: Comprehensive guide to system design. "
                    "Coverage: Scalability, databases, caching, message queues, microservices. "
                    "Format: Case studies of real systems (Netflix, Twitter, Discord). "
                    "Cost: $40-50 for physical book or PDF. "
                    "Best for: Preparing for senior backend or architect interviews. "
                    "Strengths: Practical examples, clear explanations, interview tips. "
                    "Time to complete: 40-60 hours of study. "
                    "Recommendation: Essential reading for any backend engineer aiming for senior roles."
                ),
                doc_type=DocumentType.RESOURCE,
                metadata={
                    "type": "book",
                    "cost": 50,
                    "rating": 4.9,
                    "hours": 60,
                    "format": "physical+digital"
                },
                tags=["system-design", "resource", "book", "recommended"]
            ),
        ]
        
        for doc in career_docs:
            self.add_document(doc)
    
    def add_document(self, doc: Document) -> None:
        """Add document to store."""
        self.documents[doc.id] = doc
        
        # Index by type
        self.index_by_type[doc.doc_type].append(doc.id)
        
        # Index by tags
        for tag in doc.tags:
            if tag not in self.index_by_tag:
                self.index_by_tag[tag] = []
            self.index_by_tag[tag].append(doc.id)
    
    def get_document(self, doc_id: str) -> Optional[Document]:
        """Get document by ID."""
        return self.documents.get(doc_id)
    
    def search_by_type(self, doc_type: DocumentType) -> List[Document]:
        """Get all documents of a specific type."""
        doc_ids = self.index_by_type.get(doc_type, [])
        return [self.documents[doc_id] for doc_id in doc_ids]
    
    def search_by_tag(self, tag: str) -> List[Document]:
        """Get all documents with a specific tag."""
        doc_ids = self.index_by_tag.get(tag, [])
        return [self.documents[doc_id] for doc_id in doc_ids]
    
    def search_by_tags(self, tags: List[str]) -> List[Document]:
        """Get documents matching any of the given tags."""
        matching_ids = set()
        for tag in tags:
            matching_ids.update(self.index_by_tag.get(tag, []))
        return [self.documents[doc_id] for doc_id in matching_ids]
    
    def get_all_documents(self) -> List[Document]:
        """Get all documents in store."""
        return list(self.documents.values())
    
    def count(self) -> int:
        """Get total document count."""
        return len(self.documents)
