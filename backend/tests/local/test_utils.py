import pytest
from app.services.job_queue import JobQueueService

def test_generate_session_id():
    session_id = JobQueueService.generate_session_id()
    assert isinstance(session_id, str)
    assert len(session_id) > 20
    
def test_job_queue_singleton():
    from app.services.job_queue import job_queue
    assert job_queue is not None
