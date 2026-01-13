# Developer Documentation

This folder contains technical documentation for developers and AI coding assistants working on OpenElara Cloud.

## Structure

```
devdocs/
├── technical-docs/     # Important technical documentation (version controlled)
│   └── ...             # Architecture, patterns, implementation details
│
└── working-docs/       # LLM scratch space (GITIGNORED)
    └── ...             # Temporary notes, experiments, drafts
```

## Folder Purpose

### `technical-docs/`
**Version controlled** - Contains important technical documentation that should persist:
- Architecture decisions and rationale
- Implementation patterns and conventions
- API documentation
- Integration guides
- System diagrams

### `working-docs/`
**GITIGNORED** - A scratch space for LLM assistants to write working notes:
- Session notes and context
- Investigation results
- Draft documentation
- Temporary analysis
- Can be periodically nuked without consequence

## Documentation Philosophy

These docs are written to be **LLM-consumable** - structured for RAG ingestion and AI comprehension, which makes them excellent for humans too. Each document should:

1. Have clear headers and logical structure
2. Include code examples where relevant
3. State assumptions explicitly
4. Cross-reference related docs
5. Be self-contained enough to be useful in isolation

## Relationship to `/docs`

- **`/devdocs`** → For developers and coding copilots (how to build/modify the app)
- **`/docs`** → User manual (how to use the app) - also RAG-ingested for the assistant
