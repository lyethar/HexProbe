# LLMmap sidecar (`llmmap_server.py`)

HexProbe's **Model Fingerprint** tab identifies the LLM behind an endpoint using
[LLMmap](https://github.com/pasquini-dario/LLMmap) — *"like nmap, but for LLMs."*
LLMmap is PyTorch-based and can't run in the browser, so this script exposes it
over a tiny local HTTP API that the HexProbe UI calls (the same way it talks to
a local Ollama instance).

## One-time setup

From the HexProbe repo root:

```bash
# 1. Clone LLMmap into ./tools (gitignored — it ships a ~12 MB model + weights)
git clone https://github.com/pasquini-dario/LLMmap tools/LLMmap

# 2. Install its Python deps (Python 3.11 recommended; torch + transformers)
pip install -r tools/LLMmap/requirements.txt
```

The shipped pretrained model (`tools/LLMmap/data/pretrained_models/default`)
covers 52 LLMs and needs no training.

## Run

```bash
python scripts/llmmap_server.py            # serves on http://localhost:8765
```

The **first** request loads the embedding model
(`intfloat/multilingual-e5-large-instruct`, ~2 GB, downloaded from HuggingFace
once). `GET /health` reports `loading` until it's ready. Then in HexProbe:

> **Prompt Lab → Model Fingerprint → Connect** (default URL `http://localhost:8765`)

### Options

| Flag | Default | Purpose |
|---|---|---|
| `--port` | `8765` | Listen port |
| `--host` | `127.0.0.1` | Bind address |
| `--llmmap-root` | `./tools/LLMmap` | Path to the cloned LLMmap repo |
| `--model-path` | `<llmmap-root>/data/pretrained_models/default` | Pretrained model dir |
| `--mock` | off | Serve canned data **without** loading PyTorch — for UI testing |

```bash
# Quick UI smoke test without installing torch:
python scripts/llmmap_server.py --mock
```

## API

| Method | Path | Body | Returns |
|---|---|---|---|
| `GET` | `/health` | — | `{ ready, loading, error, mock, n_queries, llms_supported, model_path }` |
| `GET` | `/queries` | — | `{ queries: string[], max_chars: number }` |
| `POST` | `/fingerprint` | `{ answers: string[], top_k?: number }` | `{ top_model, predictions: [{ rank, model, distance }] }` |

`answers` must have the same length as `queries` (8 for the default model), one
per probe, in order. **Lower distance = closer match.** All responses are
CORS-enabled (`Access-Control-Allow-Origin: *`) for browser access.

## How HexProbe uses it

1. `GET /queries` → the 8 fixed probe prompts.
2. For each probe, send it to the target endpoint. In **Auto** mode HexProbe
   reuses the interaction spec from **Direct Interaction** (`sendToTarget`); in
   **Manual** mode you paste each response yourself.
3. `POST /fingerprint` with the 8 collected answers → ranked model predictions.
