FROM node:20-alpine

WORKDIR /app
ENV PORT=3001

# Install ffmpeg, yt-dlp, and faster-whisper (local transcription — $0, no limits)
# build-base + pkgconfig + ffmpeg-dev needed to compile PyAV (faster-whisper dep); removed after build
RUN apk add --no-cache ffmpeg curl python3 py3-pip && \
    apk add --no-cache --virtual .build-deps pkgconfig build-base ffmpeg-dev && \
    pip3 install faster-whisper --break-system-packages && \
    apk del .build-deps && \
    curl -SsL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
    -o /usr/local/bin/yt-dlp && chmod +x /usr/local/bin/yt-dlp

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY whisper_transcribe.py ./

RUN npm run build && test -f dist/src/index.js
ENV NODE_ENV=production

# Pre-download Whisper small model to avoid first-run delay (~460MB)
RUN python3 -c "from faster_whisper import WhisperModel; WhisperModel('small', device='cpu', compute_type='int8', download_root='/app/whisper-models')"

RUN mkdir -p /app/uploads/materials /app/uploads/thumbnails /app/uploads/videos /app/uploads/submissions /app/uploads/avatars

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/index.js"]
