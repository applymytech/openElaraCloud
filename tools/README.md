# OpenElara Cloud Development Tools

This directory contains development, testing, and verification tools for OpenElara Cloud. These tools are **not deployed** but are essential for maintaining API compatibility and code quality.

## Directory Structure

```
tools/
├── model-verification/     # API model testing and verification
│   ├── verify-image-models.ts      # Basic image model MVP testing
│   ├── verify-with-personas.ts     # Full persona + signing test
│   └── test-images-*/              # Output (gitignored)
├── deployment-testing/     # Deployment verification
│   ├── test-csp.js                 # CSP policy testing
│   └── test-endpoints.js           # API endpoint testing
├── signing/                # Content signing development
│   ├── signing-core.ts             # Canonical signing implementation
│   └── signing-core.test.ts        # Signing unit tests
└── shared-types/           # Shared TypeScript definitions
    ├── model-registry.ts           # Model registry interfaces
    ├── verified-image-models.ts    # Verified image model definitions
    └── verified-video-models.ts    # Verified video model definitions
```

## Quick Start

```bash
cd tools
npm install
```

## Environment Variables

```bash
# Required for API tests
$env:TOGETHER_API_KEY = "your_api_key"
```

## Available Tools

### Model Verification

**Basic MVP Test**:
```bash
npm run verify:images
```

**Full Persona Test** (generates images):
```bash
npm run verify:images:full
```

### Deployment Testing

**Test CSP Policies**:
```bash
npm run test:csp
```

**Test API Endpoints**:
```bash
npm run test:endpoints
```

### Signing Core

**Run Signing Tests**:
```bash
npm run test:signing
```

## Syncing with Desktop

The shared-types in this directory should be kept in sync with the Desktop app. When making changes:

1. Update `tools/shared-types/` (canonical TypeScript)
2. Run verification tests
3. Copy to Cloud `src/lib/`
4. Convert to JS and copy to Desktop `src/utils/`

## Output

Test results and generated images are gitignored. Verification summaries can be committed to `docs/verification/` for audit trails.
