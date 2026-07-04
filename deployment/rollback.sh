#!/bin/bash
# AIAIC Platform Runtime - Rollback Script
# Usage: ./rollback.sh [version]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
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

# Stop current services
stop_services() {
    log_step "Stopping current services..."
    
    if docker compose version &> /dev/null; then
        docker compose -f $COMPOSE_FILE -p $PROJECT_NAME down
    else
        docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME down
    fi
    
    log_info "Services stopped"
}

# Pull previous image
pull_image() {
    local version=$1
    
    log_step "Pulling previous version: $version"
    
    # This is a placeholder - in production, you would pull from a registry
    # docker pull aiaic-platform:$version
    
    log_info "Image pulled"
}

# Start services
start_services() {
    log_step "Starting services..."
    
    export AIAIC_ENV=production
    
    if docker compose version &> /dev/null; then
        docker compose -f $COMPOSE_FILE -p $PROJECT_NAME up -d
    else
        docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME up -d
    fi
    
    log_info "Services started"
}

# Verify rollback
verify_rollback() {
    log_step "Verifying rollback..."
    
    local max_wait=60
    local wait_time=0
    local check_interval=5
    
    while [ $wait_time -lt $max_wait ]; do
        if curl -sf http://localhost:8000/platform/health > /dev/null 2>&1; then
            log_info "Rollback verified - platform is healthy"
            return 0
        fi
        
        sleep $check_interval
        wait_time=$((wait_time + check_interval))
        echo -n "."
    done
    
    log_error "Rollback verification failed"
    return 1
}

# Main
main() {
    local version=${1:-"previous"}
    
    echo "=========================================="
    echo "AIAIC Platform Runtime Rollback"
    echo "=========================================="
    echo ""
    
    log_warn "Rolling back to version: $version"
    echo ""
    
    stop_services
    pull_image $version
    start_services
    verify_rollback
    
    echo ""
    log_info "Rollback completed successfully!"
}

main "$@"
