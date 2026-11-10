/**
 * Testes para supabase-client.ts (FA 3.2)
 *
 * Como `@supabase/supabase-js` não está disponível para testes Jest
 * sem configuração específica, mockamos o módulo e testamos que o
 * cliente é criado com URL e anon key corretas.
 */
jest.mock('@supabase/supabase-js', () => {
  return {
    createClient: jest.fn(() => ({
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({ data: null, error: null })),
          })),
        })),
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => ({ data: null, error: null })),
          })),
        })),
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn(() => ({ data: null, error: null })),
            })),
          })),
        })),
        delete: jest.fn(() => ({
          eq: jest.fn(() => ({ data: null, error: null })),
        })),
        upsert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => ({ data: null, error: null })),
          })),
        })),
      })),
      rpc: jest.fn(() => ({ data: null, error: null })),
      auth: {
        signInWithPassword: jest.fn(() => ({ data: null, error: null })),
        signOut: jest.fn(() => ({ error: null })),
        getUser: jest.fn(() => ({ data: { user: null }, error: null })),
        onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      },
    })),
  };
});

import { createClient } from '@supabase/supabase-js';
import { criarSupabaseClient } from '../../../src/infra/supabase/supabase-client';

const mockCreateClient = createClient as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('criarSupabaseClient', () => {
  it('deve criar o cliente Supabase com URL e anon key', () => {
    criarSupabaseClient('https://exemplo.supabase.co', 'anon-key-teste');

    expect(mockCreateClient).toHaveBeenCalledWith(
      'https://exemplo.supabase.co',
      'anon-key-teste'
    );
  });

  it('deve retornar uma instância com métodos from, rpc e auth', () => {
    const client = criarSupabaseClient('https://exemplo.supabase.co', 'anon-key-teste');

    expect(client).toBeDefined();
    expect(typeof client.from).toBe('function');
    expect(typeof client.rpc).toBe('function');
    expect(client.auth).toBeDefined();
    expect(typeof client.auth.signInWithPassword).toBe('function');
  });
});
