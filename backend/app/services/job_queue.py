import redis
from rq import Queue
from rq.job import Job
from rq.exceptions import NoSuchJobError
import secrets
from app.core.config import settings

class JobQueueService:
    def __init__(self):
        self.redis_conn = redis.from_url(settings.REDIS_URL)
        self.queue = Queue(connection=self.redis_conn)

    def enqueue_job(self, task_func, *args, **kwargs):
        """Enqueue a job to the Redis queue."""
        job = self.queue.enqueue(task_func, *args, **kwargs)
        return job

    def get_job(self, job_id: str):
        """Get a job by ID."""
        try:
            job = Job.fetch(job_id, connection=self.redis_conn)
            return job
        except NoSuchJobError:
            return None

    def cancel_job(self, job_id: str):
        """Cancel a job if it exists."""
        job = self.get_job(job_id)
        if job:
            job.cancel()
            return True
        return False

    @staticmethod
    def generate_session_id():
        """Generate a secure session ID."""
        return secrets.token_urlsafe(32)

job_queue = JobQueueService()
