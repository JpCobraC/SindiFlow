/**
 * Testes da fábrica do cliente Supabase.
 * Garante persistência de sessão via storage injetado (SecureStore) e que
 * nenhuma detecção de callback web é habilitada (§1.1).
 */
import { createClient } from '@supabase/supabase-js';
import { criarClienteSupabase } from '../../src/infra/supabase-client';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ auth: {} })),
}));

const mockCreateClient = createClient as jest.Mock;

const storageFake = {
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
};

describe('criarClienteSupabase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('cria o cliente com persistência e sem detecção de URL', () => {
    criarClienteSupabase(
      'https://projeto.supabase.co',
      'anon-key',
      storageFake
    );

    expect(mockCreateClient).toHaveBeenCalledWith(
      'https://projeto.supabase.co',
      'anon-key',
      {
        auth: {
          storage: storageFake,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      }
    );
  });
});
