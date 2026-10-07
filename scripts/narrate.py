"""Render one WAV per scene with the pinned local Kokoro voice."""
import argparse
import json
import wave
from pathlib import Path

import numpy as np
import onnxruntime as ort
from kokoro_onnx import Kokoro


def write_wav(destination: Path, samples: np.ndarray, sample_rate: int) -> None:
    lead = np.zeros(round(sample_rate * 0.4), dtype=np.float32)
    tail = np.zeros(round(sample_rate * 0.2), dtype=np.float32)
    samples = np.concatenate((lead, np.asarray(samples, dtype=np.float32), tail))
    pcm = (np.clip(samples, -1, 1) * 32767).astype('<i2')
    with wave.open(str(destination), 'wb') as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(sample_rate)
        output.writeframes(pcm.tobytes())


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--story', type=Path, required=True)
    parser.add_argument('--audio-dir', type=Path, required=True)
    parser.add_argument('--model', type=Path, required=True)
    parser.add_argument('--voices', type=Path, required=True)
    args = parser.parse_args()
    args.audio_dir.mkdir(parents=True, exist_ok=True)
    scenes = json.loads(args.story.read_text())['scenes']
    ort.set_default_logger_severity(3)
    tts = Kokoro(str(args.model), str(args.voices))
    try:
        for index, scene in enumerate(scenes, start=1):
            samples, sample_rate = tts.create(
                scene['narration'], voice='af_heart', speed=0.98, lang='en-us',
                sentence_pause=0.35, clause_pause=0.14,
            )
            destination = args.audio_dir / f'scene-{index:02}.wav'
            write_wav(destination, samples, sample_rate)
            print(f'{index}/{len(scenes)}: {destination.name}', flush=True)
    finally:
        tts.voices.close()


if __name__ == '__main__':
    main()
