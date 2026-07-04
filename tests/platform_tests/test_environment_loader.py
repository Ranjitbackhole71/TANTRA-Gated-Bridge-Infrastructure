"""Tests for EnvironmentLoader."""

import os
import pytest
from pathlib import Path
from runtime.environment_loader import EnvironmentLoader, Environment, EnvironmentValidationResult


class TestEnvironmentLoader:
    """Tests for EnvironmentLoader class."""
    
    def test_init_default(self):
        """Test default initialization."""
        loader = EnvironmentLoader()
        assert loader.base_path == Path.cwd()
        assert loader.environment == Environment.DEVELOPMENT
    
    def test_init_with_path(self):
        """Test initialization with custom path."""
        path = Path("/tmp/test")
        loader = EnvironmentLoader(base_path=path)
        assert loader.base_path == path
    
    def test_load_returns_validation(self):
        """Test load returns validation result."""
        loader = EnvironmentLoader()
        result = loader.load()
        assert isinstance(result, EnvironmentValidationResult)
    
    def test_validate_with_required_vars(self):
        """Test validation with required variables."""
        loader = EnvironmentLoader()
        os.environ["AIAIC_ENV"] = "test"
        os.environ["AIAIC_LOG_LEVEL"] = "INFO"
        
        result = loader.validate()
        assert result.valid is True
        
        del os.environ["AIAIC_ENV"]
        del os.environ["AIAIC_LOG_LEVEL"]
    
    def test_validate_missing_required(self):
        """Test validation with missing required variables."""
        loader = EnvironmentLoader()
        
        original_env = os.environ.get("AIAIC_ENV")
        if "AIAIC_ENV" in os.environ:
            del os.environ["AIAIC_ENV"]
        
        result = loader.validate()
        assert "AIAIC_ENV" in result.missing_required
        
        if original_env:
            os.environ["AIAIC_ENV"] = original_env
    
    def test_get_value(self):
        """Test getting environment variable."""
        loader = EnvironmentLoader()
        os.environ["TEST_VAR"] = "test_value"
        
        value = loader.get("TEST_VAR")
        assert value == "test_value"
        
        del os.environ["TEST_VAR"]
    
    def test_get_default(self):
        """Test getting with default value."""
        loader = EnvironmentLoader()
        value = loader.get("NONEXISTENT_VAR", "default")
        assert value == "default"
    
    def test_get_int(self):
        """Test getting integer value."""
        loader = EnvironmentLoader()
        os.environ["TEST_INT"] = "42"
        
        value = loader.get_int("TEST_INT")
        assert value == 42
        
        del os.environ["TEST_INT"]
    
    def test_get_int_invalid(self):
        """Test getting invalid integer."""
        loader = EnvironmentLoader()
        os.environ["TEST_INT"] = "not_a_number"
        
        value = loader.get_int("TEST_INT", 0)
        assert value == 0
        
        del os.environ["TEST_INT"]
    
    def test_get_bool_true(self):
        """Test getting boolean true."""
        loader = EnvironmentLoader()
        
        for val in ["true", "1", "yes", "on"]:
            os.environ["TEST_BOOL"] = val
            assert loader.get_bool("TEST_BOOL") is True
            del os.environ["TEST_BOOL"]
    
    def test_get_bool_false(self):
        """Test getting boolean false."""
        loader = EnvironmentLoader()
        os.environ["TEST_BOOL"] = "false"
        
        assert loader.get_bool("TEST_BOOL") is False
        del os.environ["TEST_BOOL"]
    
    def test_get_list(self):
        """Test getting list value."""
        loader = EnvironmentLoader()
        os.environ["TEST_LIST"] = "a,b,c"
        
        value = loader.get_list("TEST_LIST")
        assert value == ["a", "b", "c"]
        
        del os.environ["TEST_LIST"]
    
    def test_get_list_empty(self):
        """Test getting empty list."""
        loader = EnvironmentLoader()
        value = loader.get_list("NONEXISTENT")
        assert value == []
    
    def test_set_value(self):
        """Test setting environment variable."""
        loader = EnvironmentLoader()
        loader.set("NEW_VAR", "new_value")
        
        assert os.environ["NEW_VAR"] == "new_value"
        assert loader.get("NEW_VAR") == "new_value"
        
        del os.environ["NEW_VAR"]
    
    def test_get_all(self):
        """Test getting all variables."""
        loader = EnvironmentLoader()
        loader.set("VAR1", "val1")
        loader.set("VAR2", "val2")
        
        all_vars = loader.get_all()
        assert "VAR1" in all_vars
        assert "VAR2" in all_vars
        
        del os.environ["VAR1"]
        del os.environ["VAR2"]
    
    def test_get_platform_config(self):
        """Test getting platform configuration."""
        loader = EnvironmentLoader()
        os.environ["AIAIC_PORT"] = "9000"
        
        config = loader.get_platform_config()
        assert config["port"] == 9000
        
        del os.environ["AIAIC_PORT"]
    
    def test_loaded_files_tracking(self):
        """Test loaded files tracking."""
        loader = EnvironmentLoader()
        assert len(loader.loaded_files) == 0
    
    def test_environment_detection(self):
        """Test environment detection."""
        loader = EnvironmentLoader()
        os.environ["AIAIC_ENV"] = "production"
        
        loader._detect_environment()
        
        del os.environ["AIAIC_ENV"]
    
    def test_load_file_not_found(self):
        """Test loading nonexistent file."""
        loader = EnvironmentLoader(base_path=Path("/nonexistent"))
        result = loader.load()
        assert isinstance(result, EnvironmentValidationResult)


class TestEnvironmentValidationResult:
    """Tests for EnvironmentValidationResult."""
    
    def test_valid_result(self):
        """Test valid result."""
        result = EnvironmentValidationResult(valid=True)
        assert result.valid is True
        assert result.missing_required == []
    
    def test_invalid_result(self):
        """Test invalid result."""
        result = EnvironmentValidationResult(
            valid=False,
            missing_required=["VAR1", "VAR2"]
        )
        assert result.valid is False
        assert len(result.missing_required) == 2
    
    def test_warnings(self):
        """Test warnings."""
        result = EnvironmentValidationResult(
            valid=True,
            warnings=["Warning 1", "Warning 2"]
        )
        assert len(result.warnings) == 2
