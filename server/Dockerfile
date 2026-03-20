FROM node:20-alpine

WORKDIR /app
ENV PORT=3001

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build && test -f dist/index.js
ENV NODE_ENV=production

RUN mkdir -p /app/uploads/materials /app/uploads/thumbnails /app/uploads/videos

EXPOSE 3001

CMD ["sh", "-c", "npx prisma db push && node dist/index.js"]
