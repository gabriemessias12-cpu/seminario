import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const defaultAdminAccount = {
  nome: 'Ralfer',
  email: 'ralfer@vinhanova.com',
  senha: 'ralfer123',
  papel: 'admin',
  telefone: '(11) 99999-0003'
};

export async function ensureSystemAccounts(): Promise<void> {
  const senhaHash = await bcrypt.hash(defaultAdminAccount.senha, 10);

  await prisma.user.upsert({
    where: { email: defaultAdminAccount.email },
    update: {
      nome: defaultAdminAccount.nome,
      senhaHash,
      papel: defaultAdminAccount.papel,
      telefone: defaultAdminAccount.telefone,
      ativo: true
    },
    create: {
      nome: defaultAdminAccount.nome,
      email: defaultAdminAccount.email,
      senhaHash,
      papel: defaultAdminAccount.papel,
      telefone: defaultAdminAccount.telefone,
      ativo: true
    }
  });
}
