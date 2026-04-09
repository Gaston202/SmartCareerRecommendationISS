// This entry point starts all workers
import { bootstrap } from '../../workers/worker.bootstrap';

bootstrap().catch((error) => {
  console.error('Worker failed to start:', error);
  process.exit(1);
});
