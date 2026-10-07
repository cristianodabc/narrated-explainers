# Narrated Explainers

[![CI](https://github.com/cristianodabc/narrated-explainers/actions/workflows/ci.yml/badge.svg)](https://github.com/cristianodabc/narrated-explainers/actions/workflows/ci.yml)
[![MIT license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js 22+](https://img.shields.io/badge/Node.js-22%2B-339933.svg)](package.json)

Make a documentary-style whiteboard explainer from a topic and your LLM. The LLM writes a structured script. A fixed local renderer draws 1080p animation, narrates it with Kokoro's `af_heart` voice, and exports an H.264/AAC MP4. The visual style, voice, pacing, and export settings are the same for every video.

```text
Topic + brief → LLM (HTTP) → story.json → local SVG + Kokoro renderer → MP4
```

## Quick start

Requirements: Node.js 22+, Python 3.11 via [`uv`](https://docs.astral.sh/uv/), FFmpeg (including `ffprobe`), and `rsvg-convert` (librsvg). On macOS with Homebrew: `brew install uv ffmpeg librsvg`.

```bash
npm run setup
cp .env.example .env
```

Set `EXPLAINER_LLM_BASE_URL`, `EXPLAINER_LLM_MODEL`, and `EXPLAINER_LLM_API_KEY` in `.env`. The endpoint must support OpenAI-style `/chat/completions`. OpenRouter works with the example base URL; other hosted or local compatible endpoints work too. For a local endpoint that ignores keys, use a placeholder value.

```bash
npm run make -- --topic "How heat pumps work"
```

The finished video is `videos/<slug>.mp4`. Its editable script, narration, manifest, and poster are in `videos/<slug>/`. The first setup downloads the Kokoro model and voice data, verifies their checksums, and installs the pinned Python package. Generated media, model files, and `.env` stay outside Git.

## Review the script first

```bash
npm run draft -- --topic "How heat pumps work" --brief notes.txt
# Read and edit videos/<slug>/story.json
npm run render -- --story videos/<slug>/story.json
```

The `--brief` file is sent to your chosen LLM with the topic. Check the generated narration for factual claims before rendering. `--replace` permits overwriting an existing draft or MP4.

## Use any other LLM

```bash
npm run prompt -- --topic "How heat pumps work" > prompt.txt
# Paste prompt.txt into your LLM and save its JSON answer as story.json
npm run render -- --story story.json
```

See [the sample story](examples/sample.story.json) for the schema. Every video has 5–10 scenes. Each scene has spoken narration, a short title and caption, and three labels for one of five layouts: `intro`, `flow`, `cards`, `focus`, or `summary`. The first scene must introduce the subject using `intro`; the last uses `summary`. The renderer accepts data only, so an LLM cannot inject rendering code.

Run `npm test` for schema, LLM, CLI, and SVG raster tests. CI runs these without API credentials or a voice model download. Run `npm run render -- --story examples/sample.story.json` for an end-to-end sample with narration.

## Output settings

1920×1080, 24 fps, H.264 CRF 18, AAC 192 kb/s. Kokoro ONNX 0.6.1 with `af_heart`, speed 0.98, and short pauses. Loudness normalization targets −16 LUFS. The model is downloaded from [Kokoro ONNX releases](https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.1); this repository contains no model weights.

The source code in this repository is [MIT licensed](LICENSE). Review any separate terms for the LLM endpoint and downloaded voice model you choose.
