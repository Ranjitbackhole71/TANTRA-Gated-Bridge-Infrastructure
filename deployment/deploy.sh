#!/bin/bash
# AIAIC Platform Runtime - Deployment Script
# Usage: ./deploy.sh [environment]
# Environments: development, staging, production

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
ENVIRONMENT=${1:-development}
COMPOSE_FILE="docker-compose.yml"
PROJECT_NAME="aiaic-platform"

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Pre-flight checks
preflight_checks() {
    log_step "Running pre-flight checks..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    
    # Check .env file
    if [ ! -f ".env" ]; then
        log_warn ".env file not found, copying from .env.example"
        cp .env.example .env
    fi
    
    log_info "Pre-flight checks passed"
}

# Validate environment
validate_environment() {
    log_step "Validating environment: $ENVIRONMENT"
    
    case $ENVIRONMENT in
        development|staging|production)
            log_info "Environment: $ENVIRONMENT"
            ;;
        *)
            log_error "Invalid environment: $ENVIRONMENT"
            log_info "Valid environments: development, staging, production"
            exit 1
            ;;
    esac
    
    # Check environment-specific config
    if [ ! -f "config/$ENVIRONMENT.yaml" ]; then
        log_warn "No config/$ENVIRONMENT.yaml found, using base config"
    fi
}

# Build images
build_images() {
    log_step "Building Docker images..."
    
    if docker compose version &> /dev/null; then
        docker compose -f $COMPOSE_FILE build --no-cache
    else
        docker-compose -f $COMPOSE_FILE build --no-cache
    fi
    
    log_info "Docker images built successfully"
}

# Deploy services
deploy_services() {
    log_step "Deploying services..."
    
    export AIAIC_ENV=$ENVIRONMENT
    
    if docker compose version &> /dev/null; then
        docker compose -f $COMPOSE_FILE -p $PROJECT_NAME up -d
    else
        docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME up -d
    fi
    
    log_info "Services deployed successfully"
}

# Wait for health
wait_for_health() {
    log_step "Waiting for services to become healthy..."
    
    local max_wait=120
    local wait_time=0
    local check_interval=5
    
    while [ $wait_time -lt $max_wait ]; do
        if curl -sf http://localhost:8000/platform/health > /dev/null 2>&1; then
            log_info "Platform is healthy!"
            return 0
        fi
        
        sleep $check_interval
        wait_time=$((wait_time + check_interval))
        echo -n "."
    done
    
    log_error "Platform did not become healthy within ${max_wait}s"
    return 1
}

# Print status
print_status() {
    log_step "Deployment Status:"
    
    if docker compose version &> /dev/null; then
        docker compose -f $COMPOSE_FILE -p $PROJECT_NAME ps
    else
        docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME ps
    fi
    
    echo ""
    log_info "Gateway URL: http://localhost:8000"
    log_info "API Docs: http://localhost:8000/docs"
    log_info "Health Check: http://localhost:8000/platform/health"
}

# Main
main() {
    echo "=========================================="
    echo "AIAIC Platform Runtime Deployment"
    echo "=========================================="
    echo ""
    
    preflight_checks
    validate_environment
    build_images
    deploy_services
    wait_for_health
    print_status
    
    echo ""
    log_info "Deployment completed successfully!"
}

main
