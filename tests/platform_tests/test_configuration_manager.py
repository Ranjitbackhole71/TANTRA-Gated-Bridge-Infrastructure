"""Tests for ConfigurationManager."""

import pytest
from pathlib import Path
from runtime.configuration_manager import (
    ConfigurationManager,
    ConfigFormat,
    ConfigValidationResult,
    ServiceConfig,
)


class TestConfigurationManager:
    """Tests for ConfigurationManager class."""
    
    def test_init_default(self):
        """Test default initialization."""
        manager = ConfigurationManager()
        assert manager.config_dir == Path.cwd() / "config"
        assert manager.environment == "development"
    
    def test_init_with_dir(self):
        """Test initialization with custom directory."""
        path = Path("/tmp/config")
        manager = ConfigurationManager(config_dir=path)
        assert manager.config_dir == path
    
    def test_load_returns_validation(self):
        """Test load returns validation result."""
        manager = ConfigurationManager()
        result = manager.load()
        assert isinstance(result, ConfigValidationResult)
    
    def test_get_value(self):
        """Test getting configuration value."""
        manager = ConfigurationManager()
        manager.load()
        
        value = manager.get("platform.name")
        assert value == "AIAIC Platform"
    
    def test_get_default(self):
        """Test getting with default value."""
        manager = ConfigurationManager()
        value = manager.get("nonexistent.key", "default")
        assert value == "default"
    
    def test_set_value(self):
        """Test setting configuration value."""
        manager = ConfigurationManager()
        manager.load()
        
        manager.set("test.key", "test_value")
        assert manager.get("test.key") == "test_value"
    
    def test_get_service_config(self):
        """Test getting service configuration."""
        manager = ConfigurationManager()
        manager.load()
        
        config = manager.get_service_config("gateway")
        assert config is not None
        assert config.name == "gateway"
        assert config.port == 8000
    
    def test_get_all_services(self):
        """Test getting all services."""
        manager = ConfigurationManager()
        manager.load()
        
        services = manager.get_all_services()
        assert len(services) > 0
        assert "gateway" in services
    
    def test_get_runtime_config(self):
        """Test getting runtime configuration."""
        manager = ConfigurationManager()
        manager.load()
        
        config = manager.get_runtime_config()
        assert "max_workers" in config
    
    def test_get_workers_config(self):
        """Test getting workers configuration."""
        manager = ConfigurationManager()
        manager.load()
        
        config = manager.get_workers_config()
        assert "max_concurrent" in config
    
    def test_to_dict(self):
        """Test exporting to dictionary."""
        manager = ConfigurationManager()
        manager.load()
        
        config = manager.to_dict()
        assert isinstance(config, dict)
        assert "platform" in config
    
    def test_validate_valid(self):
        """Test validation with valid config."""
        manager = ConfigurationManager()
        result = manager.load()
        assert result.valid is True
    
    def test_set_nested(self):
        """Test setting nested values."""
        manager = ConfigurationManager()
        manager.load()
        
        manager.set("a.b.c", "nested_value")
        assert manager.get("a.b.c") == "nested_value"
    
    def test_add_watcher(self):
        """Test adding configuration watcher."""
        manager = ConfigurationManager()
        
        watched = []
        manager.add_watcher(lambda k, v: watched.append((k, v)))
        
        manager.set("test", "value")
        assert len(watched) == 1
    
    def test_config_merge(self):
        """Test configuration merging."""
        manager = ConfigurationManager()
        manager.load()
        
        base_value = manager.get("platform.name")
        assert base_value == "AIAIC Platform"


class TestServiceConfig:
    """Tests for ServiceConfig dataclass."""
    
    def test_default_values(self):
        """Test default configuration values."""
        config = ServiceConfig(name="test")
        assert config.name == "test"
        assert config.enabled is True
        assert config.port == 8000
        assert config.host == "0.0.0.0"
        assert config.health_check_path == "/health"
        assert config.retry_count == 3
    
    def test_custom_values(self):
        """Test custom configuration values."""
        config = ServiceConfig(
            name="test",
            port=9000,
            host="127.0.0.1",
            dependencies=["dep1", "dep2"],
        )
        assert config.port == 9000
        assert config.host == "127.0.0.1"
        assert len(config.dependencies) == 2


class TestConfigValidationResult:
    """Tests for ConfigValidationResult."""
    
    def test_valid_result(self):
        """Test valid result."""
        result = ConfigValidationResult(valid=True)
        assert result.valid is True
        assert result.errors == []
    
    def test_invalid_result(self):
        """Test invalid result."""
        result = ConfigValidationResult(
            valid=False,
            errors=["Error 1", "Error 2"]
        )
        assert result.valid is False
        assert len(result.errors) == 2


class TestConfigFormat:
    """Tests for ConfigFormat enum."""
    
    def test_formats(self):
        """Test config format values."""
        assert ConfigFormat.JSON.value == "json"
        assert ConfigFormat.YAML.value == "yaml"
