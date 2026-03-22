FROM node:20-slim

WORKDIR /app
ENV PORT=3001

# node:20-slim is Debian-based (glibc) — pre-built manylinux wheels work for ctranslate2/PyAV
# Alpine (musl libc) is incompatible with manylinux wheels and requires full source compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg curl python3 python3-pip \
    && rm -rf /var/lib/apt/lists/* \
    && pip3 install faster-whisper --break-system-packages \
    && curl -SsL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
    -o /usr/local/bin/yt-dlp && chmod +x /usr/local/bin/yt-dlp

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY whisper_transcribe.py ./

RUN npm run build && test -f dist/src/index.js
ENV NODE_ENV=production

# Pre-download Whisper small model (~460MB) so first transcription is instant
RUN python3 -c "from faster_whisper import WhisperModel; WhisperModel('small', device='cpu', compute_type='int8', download_root='/app/whisper-models')"

RUN mkdir -p /app/uploads/materials /app/uploads/thumbnails /app/uploads/videos /app/uploads/submissions /app/uploads/avatars

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/index.js"]
