#!/bin/bash
# Quick test runner for deployment tests
# Usage: ./run_deployment_tests.sh [smoke|integration|security|all]

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# tests/deployment/run_tests.sh -> go up 2 levels to reach backend/
BACKEND_DIR="$( cd "$SCRIPT_DIR/../.." && pwd )"

# Change to backend directory to ensure proper test discovery
cd "$BACKEND_DIR"

# Check if API_URL is set
if [ -z "$API_URL" ]; then
    echo -e "${YELLOW}⚠️  API_URL not set. Using default: https://my-app-production.up.railway.app${NC}"
    export API_URL="https://my-app-production.up.railway.app"
fi

echo -e "${GREEN}🎯 Testing API: $API_URL${NC}\n"

# Common pytest flags for deployment tests
# -p no:asyncio: Disable pytest-asyncio plugin (used by unit tests)
# --rootdir: Set root to deployment tests directory (prevents loading tests/conftest.py)
# This ensures ONLY tests/deployment/conftest.py is used, NOT tests/conftest.py
PYTEST_FLAGS="-v -p no:asyncio --rootdir=tests/deployment"

# Determine which tests to run
TEST_SUITE=${1:-smoke}

case $TEST_SUITE in
    smoke)
        echo -e "${GREEN}🚀 Running SMOKE tests (fast, safe)...${NC}"
        pytest tests/deployment/smoke/ $PYTEST_FLAGS
        ;;
    integration)
        echo -e "${YELLOW}⚠️  Running INTEGRATION tests (expensive, uses GPU credits)...${NC}"
        read -p "Are you sure? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            pytest tests/deployment/integration/ $PYTEST_FLAGS
        else
            echo "Cancelled."
            exit 0
        fi
        ;;
    security)
        echo -e "${GREEN}🔒 Running SECURITY tests...${NC}"
        pytest tests/deployment/security/ $PYTEST_FLAGS
        ;;
    all)
        echo -e "${GREEN}🎯 Running ALL deployment tests...${NC}"
        echo -e "${YELLOW}⚠️  This includes expensive integration tests!${NC}"
        read -p "Are you sure? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            pytest tests/deployment/ $PYTEST_FLAGS
        else
            echo "Cancelled. Running smoke + security only..."
            pytest tests/deployment/smoke/ tests/deployment/security/ $PYTEST_FLAGS
        fi
        ;;
    *)
        echo -e "${RED}❌ Invalid test suite: $TEST_SUITE${NC}"
        echo "Usage: $0 [smoke|integration|security|all]"
        exit 1
        ;;
esac

echo -e "\n${GREEN}✅ Tests complete!${NC}"
