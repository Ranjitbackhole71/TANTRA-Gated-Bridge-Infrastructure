"""Pytest configuration and fixtures for platform tests."""

import asyncio
import pytest
from pathlib import Path
from typing import AsyncGenerator, Generator

from runtime.environment_loader import EnvironmentLoader
from runtime.configuration_manager import ConfigurationManager
from runtime.service_registry import ServiceRegistry
from runtime.worker_manager import WorkerManager
from runtime.runtime_supervisor import RuntimeSupervisor
from runtime.platform_runtime import PlatformRuntime
from observability.health_aggregator import HealthAggregator
from observability.metrics_collector import MetricsCollector
from observability.structured_logger import StructuredLogger
from observability.telemetry_service import TelemetryService
from operations.scheduler_supervisor import SchedulerSupervisor
from operations.background_worker_controller import BackgroundWorkerController
from operations.retry_manager import RetryManager
from operations.recovery_manager import RecoveryManager


@pytest.fixture(scope="session")
def event_loop() -> Generator[asyncio.AbstractEventLoop, None, None]:
    """Create event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def env_loader() -> EnvironmentLoader:
    """Create EnvironmentLoader instance."""
    return EnvironmentLoader(base_path=Path.cwd())


@pytest.fixture
def config_manager() -> ConfigurationManager:
    """Create ConfigurationManager instance."""
    return ConfigurationManager(config_dir=Path.cwd() / "config")


@pytest.fixture
def service_registry() -> ServiceRegistry:
    """Create ServiceRegistry instance."""
    return ServiceRegistry()


@pytest.fixture
def worker_manager() -> WorkerManager:
    """Create WorkerManager instance."""
    return WorkerManager(max_workers=2)


@pytest.fixture
def runtime_supervisor() -> RuntimeSupervisor:
    """Create RuntimeSupervisor instance."""
    return RuntimeSupervisor()


@pytest.fixture
def platform_runtime() -> PlatformRuntime:
    """Create PlatformRuntime instance."""
    return PlatformRuntime(environment="testing")


@pytest.fixture
def health_aggregator() -> HealthAggregator:
    """Create HealthAggregator instance."""
    return HealthAggregator()


@pytest.fixture
def metrics_collector() -> MetricsCollector:
    """Create MetricsCollector instance."""
    return MetricsCollector()


@pytest.fixture
def structured_logger() -> StructuredLogger:
    """Create StructuredLogger instance."""
    return StructuredLogger("test-logger", service="test")


@pytest.fixture
def telemetry_service() -> TelemetryService:
    """Create TelemetryService instance."""
    return TelemetryService()


@pytest.fixture
def scheduler_supervisor() -> SchedulerSupervisor:
    """Create SchedulerSupervisor instance."""
    return SchedulerSupervisor()


@pytest.fixture
def background_worker_controller() -> BackgroundWorkerController:
    """Create BackgroundWorkerController instance."""
    return BackgroundWorkerController()


@pytest.fixture
def retry_manager() -> RetryManager:
    """Create RetryManager instance."""
    return RetryManager()


@pytest.fixture
def recovery_manager() -> RecoveryManager:
    """Create RecoveryManager instance."""
    return RecoveryManager()
