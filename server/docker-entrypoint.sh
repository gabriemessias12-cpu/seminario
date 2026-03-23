#!/bin/sh
set -eu

echo "Aplicando schema do banco antes de iniciar a API..."

if npx prisma migrate deploy; then
  echo "Prisma migrate deploy concluido."
else
  echo "Prisma migrate deploy falhou. Aplicando fallback com prisma db push para liberar o boot."
  npx prisma db push --skip-generate
fi

exec node dist/src/index.js
