"""Tests for ServiceRegistry."""

import pytest
from runtime.service_registry import (
    ServiceRegistry,
    ServiceStatus,
    ServiceHealth,
    ServiceInfo,
    ServiceDependency,
)


class TestServiceRegistry:
    """Tests for ServiceRegistry class."""
    
    def test_init(self):
        """Test initialization."""
        registry = ServiceRegistry()
        assert len(registry.services) == 0
    
    def test_register_service(self):
        """Test registering a service."""
        registry = ServiceRegistry()
        service = registry.register_service("test-service", port=8080)
        
        assert service.name == "test-service"
        assert service.port == 8080
        assert service.status == ServiceStatus.REGISTERED
    
    def test_register_duplicate(self):
        """Test registering duplicate service."""
        registry = ServiceRegistry()
        registry.register_service("test-service")
        
        with pytest.raises(ValueError):
            registry.register_service("test-service")
    
    def test_deregister_service(self):
        """Test deregistering a service."""
        registry = ServiceRegistry()
        registry.register_service("test-service")
        
        result = registry.deregister_service("test-service")
        assert result is True
        assert len(registry.services) == 0
    
    def test_deregister_nonexistent(self):
        """Test deregistering nonexistent service."""
        registry = ServiceRegistry()
        result = registry.deregister_service("nonexistent")
        assert result is False
    
    def test_get_service(self):
        """Test getting service."""
        registry = ServiceRegistry()
        registry.register_service("test-service")
        
        service = registry.get_service("test-service")
        assert service is not None
        assert service.name == "test-service"
    
    def test_get_nonexistent_service(self):
        """Test getting nonexistent service."""
        registry = ServiceRegistry()
        service = registry.get_service("nonexistent")
        assert service is None
    
    def test_get_services_by_status(self):
        """Test getting services by status."""
        registry = ServiceRegistry()
        registry.register_service("service1")
        registry.register_service("service2")
        
        services = registry.get_services_by_status(ServiceStatus.REGISTERED)
        assert len(services) == 2
    
    def test_get_services_by_health(self):
        """Test getting services by health."""
        registry = ServiceRegistry()
        registry.register_service("service1")
        
        services = registry.get_services_by_health(ServiceHealth.UNKNOWN)
        assert len(services) == 1
    
    def test_update_service_status(self):
        """Test updating service status."""
        registry = ServiceRegistry()
        registry.register_service("test-service")
        
        service = registry.update_service_status(
            "test-service",
            ServiceStatus.RUNNING
        )
        assert service.status == ServiceStatus.RUNNING
    
    def test_update_service_health(self):
        """Test updating service health."""
        registry = ServiceRegistry()
        registry.register_service("test-service")
        
        service = registry.update_service_health(
            "test-service",
            ServiceHealth.HEALTHY
        )
        assert service.health == ServiceHealth.HEALTHY
    
    def test_register_health_check(self):
        """Test registering health check."""
        registry = ServiceRegistry()
        
        def health_check():
            return ServiceHealth.HEALTHY
        
        registry.register_health_check("test-service", health_check)
    
    def test_get_dependencies(self):
        """Test getting dependencies."""
        registry = ServiceRegistry()
        registry.register_service("service1", dependencies=["service2"])
        
        deps = registry.get_dependencies("service1")
        assert len(deps) == 1
        assert deps[0].target == "service2"
    
    def test_get_dependents(self):
        """Test getting dependents."""
        registry = ServiceRegistry()
        registry.register_service("service1", dependencies=["service2"])
        
        dependents = registry.get_dependents("service2")
        assert len(dependents) == 1
        assert dependents[0].source == "service1"
    
    def test_are_dependencies_met(self):
        """Test checking dependencies."""
        registry = ServiceRegistry()
        registry.register_service("service1", dependencies=["service2"])
        registry.register_service("service2")
        
        result = registry.are_dependencies_met("service1")
        assert result is False
        
        registry.update_service_status("service2", ServiceStatus.RUNNING)
        result = registry.are_dependencies_met("service1")
        assert result is True
    
    def test_get_startup_order(self):
        """Test getting startup order."""
        registry = ServiceRegistry()
        registry.register_service("service1", dependencies=["service2"])
        registry.register_service("service2")
        
        order = registry.get_startup_order()
        assert order.index("service2") < order.index("service1")
    
    def test_to_dict(self):
        """Test exporting to dictionary."""
        registry = ServiceRegistry()
        registry.register_service("test-service")
        
        data = registry.to_dict()
        assert "services" in data
        assert "dependencies" in data


class TestServiceInfo:
    """Tests for ServiceInfo dataclass."""
    
    def test_default_values(self):
        """Test default values."""
        info = ServiceInfo(name="test", service_id="id-123")
        assert info.name == "test"
        assert info.status == ServiceStatus.REGISTERED
        assert info.health == ServiceHealth.UNKNOWN
    
    def test_custom_values(self):
        """Test custom values."""
        info = ServiceInfo(
            name="test",
            service_id="id-123",
            host="127.0.0.1",
            port=9000,
            dependencies=["dep1"],
        )
        assert info.host == "127.0.0.1"
        assert info.port == 9000
        assert len(info.dependencies) == 1


class TestServiceDependency:
    """Tests for ServiceDependency dataclass."""
    
    def test_default_values(self):
        """Test default values."""
        dep = ServiceDependency(source="s1", target="s2")
        assert dep.source == "s1"
        assert dep.target == "s2"
        assert dep.required is True
