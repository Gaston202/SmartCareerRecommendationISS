import logging
import uuid
from typing import Dict, Any, Optional, List
from app.core.config import settings

logger = logging.getLogger(__name__)


# Queue names
CV_ANALYSIS_QUEUE = 'cv-analysis'
AI_PROCESSING_QUEUE = 'ai-processing'
ROADMAP_GENERATION_QUEUE = 'roadmap-generation'


class QueueService:
    """
    Queue service for background job processing.
    Equivalent to NestJS QueueService (BullMQ).
    Uses Redis-backed queue for job management.
    """

    def __init__(self):
        self.redis_url = settings.redis_url
        self.queues: Dict[str, Any] = {}
        self.workers: List[Any] = []
        self._initialize_queues()

    def _initialize_queues(self):
        """Initialize queue connections."""
        try:
            import redis
            from rq import Queue

            self.redis_conn = redis.from_url(self.redis_url, decode_responses=True)

            for queue_name in [CV_ANALYSIS_QUEUE, AI_PROCESSING_QUEUE, ROADMAP_GENERATION_QUEUE]:
                queue = Queue(queue_name, connection=self.redis_conn, default_timeout=3600)
                self.queues[queue_name] = queue
                logger.info(f'Queue initialized: {queue_name}')
        except ImportError:
            logger.warning('RQ not available, using in-memory queue fallback')
            self.redis_conn = None
        except Exception as e:
            logger.warning(f'Failed to initialize Redis queue: {e}, using in-memory fallback')
            self.redis_conn = None

    def get_queue(self, name: str):
        """Get a queue by name."""
        if name not in self.queues:
            raise ValueError(f'Queue not found: {name}')
        return self.queues[name]

    async def add_job(
        self,
        queue_name: str,
        name: str,
        data: Dict[str, Any],
        opts: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Add a job to the queue.
        Returns job info.
        """
        try:
            if self.redis_conn:
                from rq import Queue

                # rq.Queue.enqueue requires a callable, not a string.
                # Route job names to their handler functions.
                _job_handlers = {
                    'generate-roadmap': 'app.workers.tasks.roadmap_generation.process_roadmap_generation',
                    'cv-analysis':      'app.workers.tasks.cv_analysis.process_cv_analysis',
                    'ai-processing':    'app.workers.tasks.ai_processing.process_ai_task',
                }
                handler_path = _job_handlers.get(name)
                if not handler_path:
                    raise ValueError(f"Unknown job name: {name!r}. Register it in _job_handlers.")

                queue = self.get_queue(queue_name)
                job = queue.enqueue(
                    handler_path,
                    data,
                    job_id=str(uuid.uuid4()),
                    **(opts or {}),
                )

                return {
                    'id': job.id,
                    'name': name,
                    'status': 'queued',
                    'data': data,
                }
            else:
                # In-memory fallback
                job_id = str(uuid.uuid4())
                return {
                    'id': job_id,
                    'name': name,
                    'status': 'queued',
                    'data': data,
                }
        except Exception as e:
            logger.error(f'Failed to add job to queue {queue_name}: {e}')
            raise

    async def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """
        Get job status by ID.
        """
        try:
            if self.redis_conn:
                from rq import Queue

                for queue_name, queue in self.queues.items():
                    try:
                        job = queue.fetch_job(job_id)
                        if job:
                            return {
                                'id': job.id,
                                'name': job.description,
                                'status': job.get_status(),
                                'data': job.args[0] if job.args else {},
                                'result': job.result,
                                'exc_info': job.exc_info,
                            }
                    except Exception:
                        continue
                return None
            else:
                # In-memory fallback
                return {
                    'id': job_id,
                    'name': 'unknown',
                    'status': 'unknown',
                    'data': {},
                }
        except Exception as e:
            logger.error(f'Failed to get job status for {job_id}: {e}')
            return None

    async def process_job(self, job_id: str) -> None:
        """
        Process a queued job (called by worker).
        """
        try:
            job_status = await self.get_job_status(job_id)
            if not job_status:
                raise ValueError(f'Job not found: {job_id}')

            logger.info(f'Processing job {job_id}: {job_status["name"]}')

            # Route to appropriate handler
            if job_status['name'] == 'generate-roadmap':
                from app.workers.tasks.roadmap_generation import process_roadmap_generation
                await process_roadmap_generation(job_id, job_status['data'])
            elif job_status['name'] == 'cv-analysis':
                from app.workers.tasks.cv_analysis import process_cv_analysis
                await process_cv_analysis(job_id)
            elif job_status['name'] == 'ai-processing':
                from app.workers.tasks.ai_processing import process_ai_task
                await process_ai_task(job_id)
            else:
                logger.warning(f'Unknown job type: {job_status["name"]}')

        except Exception as e:
            logger.error(f'Failed to process job {job_id}: {e}')
            raise

    def shutdown(self):
        """Shutdown queue service."""
        logger.info('Shutting down queue service...')
        for worker in self.workers:
            try:
                worker.close()
            except Exception:
                pass
        self.workers.clear()