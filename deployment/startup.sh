#!/bin/bash
# AIAIC Platform Runtime - Startup Script
# Usage: ./startup.sh [environment]

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

# Check environment
check_environment() {
    log_step "Checking environment..."
    
    case $ENVIRONMENT in
        development|staging|production)
            log_info "Environment: $ENVIRONMENT"
            ;;
        *)
            log_error "Invalid environment: $ENVIRONMENT"
            exit 1
            ;;
    esac
    
    export AIAIC_ENV=$ENVIRONMENT
}

# Check Docker
check_docker() {
    log_step "Checking Docker..."
    
    if ! docker info > /dev/null 2>&1; then
        log_error "Docker is not running"
        log_info "Please start Docker and try again"
        exit 1
    fi
    
    log_info "Docker is running"
}

# Create network
create_network() {
    log_step "Creating Docker network..."
    
    docker network create aiaic-network 2>/dev/null || true
    
    log_info "Network ready"
}

# Start services
start_services() {
    log_step "Starting services..."
    
    if docker compose version &> /dev/null; then
        docker compose -f $COMPOSE_FILE -p $PROJECT_NAME up -d
    else
        docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME up -d
    fi
    
    log_info "Services starting..."
}

# Wait for gateway
wait_for_gateway() {
    log_step "Waiting for gateway..."
    
    local max_wait=120
    local wait_time=0
    local check_interval=5
    
    while [ $wait_time -lt $max_wait ]; do
        if curl -sf http://localhost:8000/platform/health > /dev/null 2>&1; then
            log_info "Gateway is ready!"
            return 0
        fi
        
        sleep $check_interval
        wait_time=$((wait_time + check_interval))
        echo -n "."
    done
    
    log_error "Gateway did not start within ${max_wait}s"
    return 1
}

# Print status
print_status() {
    echo ""
    echo "=========================================="
    echo "AIAIC Platform Runtime"
    echo "=========================================="
    echo ""
    echo -e "Environment:  ${GREEN}$ENVIRONMENT${NC}"
    echo -e "Gateway:      ${GREEN}http://localhost:8000${NC}"
    echo -e "API Docs:     ${GREEN}http://localhost:8000/docs${NC}"
    echo -e "Health:       ${GREEN}http://localhost:8000/platform/health${NC}"
    echo ""
    log_info "Platform is running!"
}

# Main
main() {
    echo "=========================================="
    echo "AIAIC Platform Runtime Startup"
    echo "=========================================="
    echo ""
    
    check_environment
    check_docker
    create_network
    start_services
    wait_for_gateway
    print_status
}

main
