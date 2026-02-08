# Backend Test Structure

This directory contains two separate test suites with different purposes and configurations.

## 📁 Directory Structure

```
backend/tests/
├── local/              # Unit tests (mocked services)
│   ├── conftest.py     # Async test configuration with mocks
│   ├── test_api.py     # API endpoint unit tests
│   └── test_utils.py   # Utility function tests
│
└── deployment/         # Integration tests (real deployed API)
    ├── conftest.py     # Sync test configuration for deployment
    ├── run_tests.sh    # Test runner script
    ├── README.md       # Deployment test documentation
    ├── SUMMARY.md      # Comprehensive summary
    ├── smoke/          # Fast, critical path tests
    ├── integration/    # Full workflow tests (expensive)
    └── security/       # Security & auth tests
```

## 🎯 Test Suites

### 1. Local Unit Tests (`tests/local/`)

**Purpose**: Test individual components in isolation with mocked external services

**Characteristics**:
- ✅ Fast execution (seconds)
- ✅ No external dependencies
- ✅ Uses mocked Redis, RQ, and Modal
- ✅ Async tests with pytest-asyncio
- ✅ Run during development

**Run**:
```bash
# All local tests
pytest tests/local/ -v

# Specific test file
pytest tests/local/test_api.py -v
```

**Configuration**: Uses `tests/local/conftest.py` which:
- Mocks Redis and RQ
- Provides async test client
- Patches external services

---

### 2. Deployment Tests (`tests/deployment/`)

**Purpose**: Test the actual deployed API end-to-end

**Characteristics**:
- ⚠️ Hits real deployed API
- ⚠️ May consume Modal GPU credits (integration tests)
- ✅ Sync tests (no async)
- ✅ Tests real authentication, rate limiting, etc.
- ✅ Run after deployment or before releases

**Run**:
```bash
# Using the helper script (recommended)
./tests/deployment/run_tests.sh smoke      # Fast, safe
./tests/deployment/run_tests.sh security   # Security tests
./tests/deployment/run_tests.sh all        # All tests (prompts for confirmation)

# Or directly with pytest
export API_URL=https://your-api.com
pytest tests/deployment/smoke/ -v -p no:asyncio
```

**Configuration**: Uses `tests/deployment/conftest.py` which:
- Loads API URL from environment
- Provides session fixtures
- Verifies API accessibility

---

## 🔑 Key Differences

| Aspect | Local Tests | Deployment Tests |
|--------|-------------|------------------|
| **Target** | Local code with mocks | Deployed API |
| **Speed** | Fast (~5s) | Varies (10s - 5min) |
| **Cost** | Free | May cost (GPU usage) |
| **Async** | Yes (pytest-asyncio) | No (sync only) |
| **Dependencies** | Mocked | Real services |
| **When to run** | During development | After deployment |
| **Conftest** | `local/conftest.py` | `deployment/conftest.py` |

---

## 🚀 Quick Start

### Local Development
```bash
# Run unit tests while developing
pytest tests/local/ -v

# Watch mode (requires pytest-watch)
ptw tests/local/
```

### After Deployment
```bash
# Quick smoke test
export API_URL=https://your-deployed-api.com
./tests/deployment/run_tests.sh smoke

# Full validation (before release)
./tests/deployment/run_tests.sh all
```

---

## 📝 Best Practices

### Local Tests
- ✅ Run before every commit
- ✅ Keep tests fast (mock everything)
- ✅ Test edge cases and error handling
- ✅ Maintain high code coverage

### Deployment Tests
- ✅ Run after every deployment (smoke tests)
- ✅ Run before major releases (all tests)
- ⚠️ Be mindful of costs (integration tests use GPU)
- ✅ Use environment variables for API URLs
- ✅ Never commit `.env.test` files

---

## 🔧 CI/CD Integration

### GitHub Actions Example

```yaml
name: Test Suite

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.12'
      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt
      - name: Run unit tests
        run: |
          cd backend
          pytest tests/local/ -v

  deployment-smoke-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.12'
      - name: Install test dependencies
        run: |
          cd backend
          pip install pytest requests python-dotenv
      - name: Run smoke tests
        env:
          API_URL: ${{ secrets.PRODUCTION_API_URL }}
        run: |
          cd backend
          ./tests/deployment/run_tests.sh smoke
```

---

## 📚 Additional Resources

- **Local Tests**: Standard pytest documentation
- **Deployment Tests**: See `tests/deployment/README.md` and `tests/deployment/SUMMARY.md`
- **API Documentation**: See `API_USAGE.md` in project root

---

**Last Updated**: 2026-02-07
