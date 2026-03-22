#!/usr/bin/env python3
"""
Local Whisper transcription via faster-whisper.
Usage: python3 whisper_transcribe.py <audio_file>
Outputs the transcription text to stdout.
"""
import sys
import os

def main():
    if len(sys.argv) < 2:
        print("Usage: whisper_transcribe.py <audio_file>", file=sys.stderr)
        sys.exit(1)

    audio_file = sys.argv[1]
    if not os.path.isfile(audio_file):
        print(f"File not found: {audio_file}", file=sys.stderr)
        sys.exit(1)

    from faster_whisper import WhisperModel

    model_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "whisper-models")
    model = WhisperModel("small", device="cpu", compute_type="int8", download_root=model_dir)

    segments, _ = model.transcribe(audio_file, language="pt", beam_size=5)
    text = " ".join(seg.text.strip() for seg in segments if seg.text.strip())
    print(text)

if __name__ == "__main__":
    main()
