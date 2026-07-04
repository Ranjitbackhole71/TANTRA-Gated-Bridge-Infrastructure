"""Tests for WorkerManager."""

import asyncio
import pytest
from runtime.worker_manager import (
    WorkerManager,
    WorkerStatus,
    TaskStatus,
    WorkerInfo,
    TaskInfo,
    RetryPolicy,
)


class TestWorkerManager:
    """Tests for WorkerManager class."""
    
    def test_init(self):
        """Test initialization."""
        manager = WorkerManager(max_workers=2)
        assert manager.max_workers == 2
    
    def test_init_with_retry_policy(self):
        """Test initialization with retry policy."""
        policy = RetryPolicy(max_retries=5)
        manager = WorkerManager(default_retry_policy=policy)
        assert manager.default_retry_policy.max_retries == 5
    
    def test_initial_stats(self):
        """Test initial statistics."""
        manager = WorkerManager()
        stats = manager.get_stats()
        assert stats["total_workers"] == 0
        assert stats["total_tasks"] == 0
    
    @pytest.mark.asyncio
    async def test_start_stop(self):
        """Test start and stop."""
        manager = WorkerManager(max_workers=2)
        await manager.start()
        
        assert len(manager.workers) == 2
        
        await manager.stop()
        
        for worker in manager.workers.values():
            assert worker.status == WorkerStatus.STOPPED
    
    @pytest.mark.asyncio
    async def test_submit_task(self):
        """Test submitting a task."""
        manager = WorkerManager(max_workers=1)
        await manager.start()
        
        async def sample_task():
            return "completed"
        
        task = await manager.submit_task("test-task", sample_task)
        assert task.status == TaskStatus.PENDING
        
        await asyncio.sleep(0.5)
        await manager.stop()
    
    def test_cancel_task(self):
        """Test canceling a task."""
        manager = WorkerManager()
        
        task = TaskInfo(
            task_id="test-id",
            name="test-task",
            status=TaskStatus.PENDING,
        )
        manager._tasks["test-id"] = task
        
        result = manager.cancel_task("test-id")
        assert result is True
        assert task.status == TaskStatus.CANCELLED
    
    def test_cancel_nonexistent_task(self):
        """Test canceling nonexistent task."""
        manager = WorkerManager()
        result = manager.cancel_task("nonexistent")
        assert result is False
    
    def test_get_task(self):
        """Test getting task."""
        manager = WorkerManager()
        
        task = TaskInfo(task_id="test-id", name="test-task")
        manager._tasks["test-id"] = task
        
        result = manager.get_task("test-id")
        assert result is not None
    
    def test_get_worker(self):
        """Test getting worker."""
        manager = WorkerManager()
        
        worker = WorkerInfo(worker_id="w-1", name="worker-1")
        manager._workers["w-1"] = worker
        
        result = manager.get_worker("w-1")
        assert result is not None
    
    @pytest.mark.asyncio
    async def test_drain_empty(self):
        """Test draining empty queue."""
        manager = WorkerManager(max_workers=1)
        await manager.start()
        
        result = await manager.drain(timeout=1.0)
        assert result is True
        
        await manager.stop()


class TestWorkerInfo:
    """Tests for WorkerInfo dataclass."""
    
    def test_default_values(self):
        """Test default values."""
        info = WorkerInfo(worker_id="w-1", name="worker-1")
        assert info.worker_id == "w-1"
        assert info.status == WorkerStatus.IDLE
        assert info.tasks_completed == 0


class TestTaskInfo:
    """Tests for TaskInfo dataclass."""
    
    def test_default_values(self):
        """Test default values."""
        info = TaskInfo(task_id="t-1", name="task-1")
        assert info.task_id == "t-1"
        assert info.status == TaskStatus.PENDING
        assert info.retry_count == 0


class TestRetryPolicy:
    """Tests for RetryPolicy dataclass."""
    
    def test_default_values(self):
        """Test default values."""
        policy = RetryPolicy()
        assert policy.max_retries == 3
        assert policy.backoff_factor == 2.0
    
    def test_custom_values(self):
        """Test custom values."""
        policy = RetryPolicy(max_retries=5, max_delay=120.0)
        assert policy.max_retries == 5
        assert policy.max_delay == 120.0
