# ADR-003: Ollama for Local LLM Inference

**Status:** Accepted  
**Date:** 2025-05-27

## Context

The AI agent needs an LLM for reasoning, SQL generation, and insight synthesis. Options:
1. OpenAI / Anthropic API
2. Local Ollama
3. HuggingFace Inference

## Decision

Ollama as the default LLM backend, with a pluggable client interface that could support OpenAI-compatible APIs.

## Rationale

- **Privacy** — User data never leaves the deployment environment
- **Cost** — No per-token cost for inference
- **Offline** — Works without internet connectivity
- **Model flexibility** — qwen2.5, llama3, deepseek-r1 all supported
- **OpenAI API compatible** — Easy to swap to cloud if needed
- **Docker-native** — Official `ollama/ollama` Docker image

## Model Recommendations

| Model | VRAM | Use Case |
|-------|------|----------|
| qwen2.5:7b | 8GB | Development / small datasets |
| qwen2.5:14b | 16GB | Production (recommended) |
| deepseek-r1:14b | 16GB | Complex reasoning |
| llama3.1:8b | 8GB | Fast responses |

## Agentic Prompt Strategy

We use structured tool-call prompting with a temperature of 0.1 to maximize determinism in SQL generation. The agent loop enforces a max iteration limit (15) to prevent infinite loops.

## Consequences

- Requires GPU for acceptable inference speed on 14B models (CPU works but slow)
- Ollama must be running before API starts
- Cold start for model loading ~30s — mitigated by `OLLAMA_KEEP_ALIVE=24h`
