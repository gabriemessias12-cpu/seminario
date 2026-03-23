import { describe, it, expect, beforeEach } from 'vitest';
import { readDraft, writeDraft, clearDraft } from '../draft-storage';

const KEY = 'test:draft:key';

beforeEach(() => {
  localStorage.clear();
});

describe('readDraft', () => {
  it('retorna null para chave inexistente', () => {
    expect(readDraft(KEY)).toBeNull();
  });

  it('retorna null para JSON inválido no storage', () => {
    localStorage.setItem(KEY, '{ invalido json');
    expect(readDraft(KEY)).toBeNull();
  });

  it('retorna o valor armazenado corretamente', () => {
    const value = { titulo: 'Rascunho', publicado: false };
    localStorage.setItem(KEY, JSON.stringify(value));
    expect(readDraft(KEY)).toEqual(value);
  });
});

describe('writeDraft', () => {
  it('persiste objeto no localStorage', () => {
    const value = { titulo: 'Aula Nova', descricao: 'Texto' };
    writeDraft(KEY, value);
    const raw = localStorage.getItem(KEY);
    expect(JSON.parse(raw!)).toEqual(value);
  });

  it('substitui rascunho existente', () => {
    writeDraft(KEY, { v: 1 });
    writeDraft(KEY, { v: 2 });
    expect(readDraft<{ v: number }>(KEY)?.v).toBe(2);
  });

  it('persiste tipos primitivos', () => {
    writeDraft(KEY, 42);
    expect(readDraft<number>(KEY)).toBe(42);
  });
});

describe('clearDraft', () => {
  it('remove a chave do storage', () => {
    writeDraft(KEY, { x: 1 });
    clearDraft(KEY);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('não lança erro ao limpar chave inexistente', () => {
    expect(() => clearDraft('chave-inexistente')).not.toThrow();
  });
});

describe('ciclo completo write → read → clear', () => {
  it('funciona de ponta a ponta', () => {
    const data = { titulo: 'Módulo 1', savedAt: Date.now() };
    writeDraft(KEY, data);
    expect(readDraft(KEY)).toEqual(data);
    clearDraft(KEY);
    expect(readDraft(KEY)).toBeNull();
  });
});
