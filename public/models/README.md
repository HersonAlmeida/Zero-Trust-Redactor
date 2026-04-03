# Models Directory (not tracked)

Models are downloaded locally via `npm run setup` (or `npm run setup:bert` / `npm run setup:llama`).

- No model weights are committed to git.
- BERT and Llama manifests plus weights are fetched from Hugging Face/CDN during setup.
- Runtime expects models here; if missing, run the setup commands.
