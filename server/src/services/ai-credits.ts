import { PrismaClient } from '@prisma/client';

const CREDITOS_BASE = 3;
const BONUS_COMPARTILHAMENTO = 5;

type UserAIFields = {
  id: string;
  compartilhaDadosIA: boolean;
  aiCreditosDisponiveis: number;
  aiCreditosUltimaRecarga: Date | null;
};

function isSameLocalDay(a: Date | null | undefined, b: Date) {
  if (!a) {
    return false;
  }

  return (
    a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
  );
}

function getDailyCreditLimit(user: Pick<UserAIFields, 'compartilhaDadosIA'>) {
  return CREDITOS_BASE + (user.compartilhaDadosIA ? BONUS_COMPARTILHAMENTO : 0);
}

async function selectAIFields(prisma: PrismaClient, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      compartilhaDadosIA: true,
      aiCreditosDisponiveis: true,
      aiCreditosUltimaRecarga: true
    }
  });

  if (!user) {
    throw new Error('USUARIO_NAO_ENCONTRADO');
  }

  return user;
}

export async function syncDailyAICredits(prisma: PrismaClient, userId: string) {
  const user = await selectAIFields(prisma, userId);
  const now = new Date();
  const limiteDiario = getDailyCreditLimit(user);

  if (isSameLocalDay(user.aiCreditosUltimaRecarga, now)) {
    return { ...user, limiteDiario };
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      aiCreditosDisponiveis: limiteDiario,
      aiCreditosUltimaRecarga: now
    },
    select: {
      id: true,
      compartilhaDadosIA: true,
      aiCreditosDisponiveis: true,
      aiCreditosUltimaRecarga: true
    }
  });

  return { ...updated, limiteDiario };
}

export async function updateAIConsent(prisma: PrismaClient, userId: string, compartilhaDadosIA: boolean) {
  const base = await prisma.user.update({
    where: { id: userId },
    data: { compartilhaDadosIA },
    select: {
      id: true,
      compartilhaDadosIA: true,
      aiCreditosDisponiveis: true,
      aiCreditosUltimaRecarga: true
    }
  });

  const limiteDiario = getDailyCreditLimit(base);
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      aiCreditosDisponiveis: compartilhaDadosIA
        ? Math.max(base.aiCreditosDisponiveis, limiteDiario)
        : Math.min(base.aiCreditosDisponiveis, limiteDiario),
      aiCreditosUltimaRecarga: new Date()
    },
    select: {
      id: true,
      compartilhaDadosIA: true,
      aiCreditosDisponiveis: true,
      aiCreditosUltimaRecarga: true
    }
  });

  return { ...updated, limiteDiario };
}

export async function consumeAICredit(prisma: PrismaClient, userId: string) {
  const status = await syncDailyAICredits(prisma, userId);
  if (status.aiCreditosDisponiveis <= 0) {
    throw new Error('SEM_CREDITOS_IA');
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      aiCreditosDisponiveis: {
        decrement: 1
      }
    },
    select: {
      id: true,
      compartilhaDadosIA: true,
      aiCreditosDisponiveis: true,
      aiCreditosUltimaRecarga: true
    }
  });

  return { ...updated, limiteDiario: getDailyCreditLimit(updated) };
}

export const aiCreditSettings = {
  creditosBase: CREDITOS_BASE,
  bonusCompartilhamento: BONUS_COMPARTILHAMENTO
};
