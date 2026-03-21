import { PrismaClient } from '@prisma/client';
import type { AuthRequest } from '../middleware/auth.js';

type ChangeEntity = 'modulo' | 'aula';
type ChangeAction = 'criado' | 'atualizado' | 'excluido';

interface ContentChangeInput {
  entity: ChangeEntity;
  action: ChangeAction;
  entityId?: string | null;
  title: string;
  details?: Record<string, unknown> | null;
}

export async function logContentChange(
  prisma: PrismaClient,
  req: AuthRequest,
  input: ContentChangeInput,
): Promise<void> {
  try {
    await prisma.registroMudancaConteudo.create({
      data: {
        usuarioId: req.user?.userId ?? null,
        usuarioNome: req.user?.nome || req.user?.email || 'Sistema',
        entidade: input.entity,
        entidadeId: input.entityId ?? null,
        entidadeTitulo: input.title,
        acao: input.action,
        detalhes: input.details ? JSON.stringify(input.details) : null,
      },
    });
  } catch (error) {
    console.error('Erro ao registrar mudanca de conteudo:', error);
  }
}
