import { PrismaClient, PapelUsuario } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const systemAccounts = [
  {
    nome: 'Pr. Ralfer Fernandes',
    email: 'ralfer@vinhanova.com',
    senha: 'ralfer123',
    papel: 'admin',
    telefone: '(22) 99999-0001'
  },
  {
    nome: 'F\u00e1bia Vieira',
    email: 'fabiavieiradossantos@gmail.com',
    senha: 'admin 123',
    papel: 'admin',
    telefone: '(22) 99999-0002'
  }
];

export async function ensureSystemAccounts(): Promise<void> {
  for (const account of systemAccounts) {
    const senhaHash = await bcrypt.hash(account.senha, 10);
    await prisma.user.upsert({
      where: { email: account.email },
      update: {
        nome: account.nome,
        senhaHash,
        papel: account.papel as PapelUsuario,
        telefone: account.telefone,
        ativo: true
      },
      create: {
        nome: account.nome,
        email: account.email,
        senhaHash,
        papel: account.papel as PapelUsuario,
        telefone: account.telefone,
        ativo: true
      }
    });
  }
}

