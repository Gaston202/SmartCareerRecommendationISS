import logging
import time
import signal
import sys
from typing import Optional
from app.core.queue import QueueService
from app.workers.tasks.cv_analysis import process_cv_analysis_sync
from app.workers.tasks.ai_processing import process_ai_task_sync
from app.workers.tasks.roadmap_generation import process_roadmap_generation_sync

logger = logging.getLogger(__name__)


class Worker:
    """Background worker for processing queued jobs."""

    def __init__(self):
        self.queue_service = QueueService()
        self.running = False
        self.current_job: Optional[str] = None

    def signal_handler(self, signum, frame):
        """Handle shutdown signals."""
        logger.info(f'Received signal {signum}, shutting down...')
        self.running = False

    def run(self):
        """Main worker loop."""
        self.running = True
        signal.signal(signal.SIGTERM, self.signal_handler)
        signal.signal(signal.SIGINT, self.signal_handler)

        logger.info('Worker started. Waiting for jobs...')

        while self.running:
            try:
                # Check for jobs (simplified - in production use RQ worker)
                time.sleep(5)

            except Exception as e:
                logger.error(f'Worker error: {e}')
                time.sleep(10)

        logger.info('Worker stopped.')


def run_worker():
    """Entry point for worker process."""
    worker = Worker()
    worker.run()


if __name__ == '__main__':
    run_worker()