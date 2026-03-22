FROM node:20-alpine

WORKDIR /app
ENV PORT=3001

# Install ffmpeg (audio extraction) and yt-dlp (YouTube download)
RUN apk add --no-cache ffmpeg curl python3 && \
    curl -SsL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
    -o /usr/local/bin/yt-dlp && chmod +x /usr/local/bin/yt-dlp

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build && test -f dist/src/index.js
ENV NODE_ENV=production

RUN mkdir -p /app/uploads/materials /app/uploads/thumbnails /app/uploads/videos /app/uploads/submissions

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/index.js"]
