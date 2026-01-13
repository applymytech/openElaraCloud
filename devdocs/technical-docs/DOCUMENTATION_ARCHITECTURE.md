# Documentation Architecture

This document explains the documentation philosophy for OpenElara projects (Desktop and Cloud).

## Core Principle

**All documentation is written primarily for LLM consumption.** A happy byproduct is that LLM-optimized docs also happen to be excellent human documentation.

## Directory Structure

```
project/
├── docs/               # USER MANUAL - RAG-ingested, for the AI assistant
│   └── USER_MANUAL.md  # Primary user-facing documentation
│   └── ...             # Supporting guides, policies
│
└── devdocs/            # DEVELOPER DOCS - for coding copilots
    ├── technical-docs/ # Important, version-controlled technical docs
    ├── working-docs/   # LLM scratch space (gitignored)
    └── archive/        # Historical docs (optional)
```

## `/docs` - The User Manual

### Purpose
The user manual lives here. It's "misnamed" because while it IS a user manual, its PRIMARY purpose is to be RAG-ingested by the app's AI assistant.

### Why This Matters
- The AI assistant can **always access** these docs
- When users ask "how do I...?", the AI has authoritative answers
- Reduces hallucination - the AI has the source of truth
- Enables agentic workflows - the AI knows what tools exist and how to use them

### Writing Style
```markdown
## Feature Name

**What it does**: Brief description

**How to use it**:
1. Step one with specific UI elements
2. Step two with expected results
3. Step three with verification

**Tips**:
- Helpful context the AI can relay to users
- Edge cases and limitations
- Related features to suggest
```

### Content Should Include
- All features and how to use them
- Workflows for common tasks
- Troubleshooting guides
- Keyboard shortcuts and UI navigation
- What the AI CAN and CANNOT do
- Available tools for agentic operations

### Agentic Workflow Support
The user manual should describe:
- Available AI tools and their capabilities
- Token limits and constraints
- Recommended workflows ("for image generation, try...")
- When to use which features
- How features chain together

This enables the LLM to make intelligent decisions about HOW to help the user, not just WHAT to tell them.

## `/devdocs` - Developer Documentation

### Purpose
For developers (human and AI) working ON the application code.

### `technical-docs/` (Version Controlled)
- Architecture decisions and rationale
- Implementation patterns
- Module documentation
- API contracts
- Integration guides

### `working-docs/` (Gitignored)
- LLM scratch space
- Session notes
- Investigation drafts
- Temporary analysis
- **Can be nuked periodically without loss**

### Why Separate Folders?
Coding copilots generate a LOT of notes. By having a gitignored working-docs folder:
- The repo stays clean
- LLMs have a place to dump context
- Good content can be promoted to technical-docs
- Bad content disappears naturally

## Writing for LLM Consumption

### Do
- Use clear, hierarchical headers
- Be explicit about prerequisites
- Include actual code, not pseudo-code
- State constraints and limitations clearly
- Cross-reference related documents
- Use consistent terminology
- Break complex info into digestible sections

### Don't
- Use vague language ("usually", "sometimes")
- Assume context the LLM won't have
- Bury critical info in paragraphs
- Use images without alt text / descriptions
- Leave implicit knowledge unstated

## RAG Ingestion

### How It Works
1. Documents in `/docs` are chunked and embedded
2. Stored in vector database (local RAG or cloud)
3. Retrieved when relevant to user queries
4. Injected into system prompt as context

### Document Design for RAG
- Each section should be **self-contained enough** to be useful in isolation
- Include section identifiers that survive chunking
- Front-load the most important info
- Avoid long preambles before getting to the point

## System Prompt Integration

The user manual enables dynamic system prompts:
```
Instead of hardcoding:
  "You can generate images using FLUX models"

We can say:
  "Refer to the user manual for available features.
   You have {X} tokens available.
   The user has asked about {topic}.
   Here is the relevant documentation: {RAG_RESULTS}"
```

This gives the LLM creative freedom while keeping it grounded in accurate information.

## Maintenance

### Regular Tasks
1. Keep user manual in sync with features
2. Update technical docs with architectural changes
3. Nuke working-docs periodically (it's just scratch)
4. Verify RAG ingestion picks up changes

### When Adding Features
1. Update USER_MANUAL.md with user-facing documentation
2. Add technical-docs for implementation details
3. Include agentic workflow guidance if AI-assisted
