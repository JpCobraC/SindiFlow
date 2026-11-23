-- ============================================================================
-- SindiFlow — Schema e Dados Iniciais para o Supabase
-- Cole e execute este script no "SQL Editor" do Supabase:
-- https://supabase.com/dashboard/project/csuhowrxbrkorrpslfur/sql/new
-- ============================================================================

-- 1. Tabela de Vistorias
CREATE TABLE IF NOT EXISTS public.vistorias (
  id TEXT PRIMARY KEY NOT NULL,
  condominio_id TEXT NOT NULL,
  inspetor_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('RASCUNHO', 'EM_ANDAMENTO', 'FINALIZADA', 'CANCELADA', 'APROVADA', 'DEVOLVIDA')),
  latitude REAL,
  longitude REAL,
  precisao REAL,
  data_criacao TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_finalizacao TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vistorias_condominio ON public.vistorias(condominio_id);
CREATE INDEX IF NOT EXISTS idx_vistorias_status ON public.vistorias(status);

-- 2. Tabela de Itens do Checklist
CREATE TABLE IF NOT EXISTS public.itens_checklist (
  id TEXT PRIMARY KEY NOT NULL,
  vistoria_id TEXT NOT NULL REFERENCES public.vistorias(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  categoria TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK(status IN ('PENDENTE', 'OK', 'AVISO', 'CRITICO')),
  observacao TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_itens_vistoria ON public.itens_checklist(vistoria_id);

-- 3. Tabela de Ocorrências / Chamados
CREATE TABLE IF NOT EXISTS public.ocorrencias (
  id TEXT PRIMARY KEY NOT NULL,
  vistoria_id TEXT NOT NULL REFERENCES public.vistorias(id) ON DELETE CASCADE,
  item_id TEXT REFERENCES public.itens_checklist(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  gravidade TEXT NOT NULL CHECK(gravidade IN ('BAIXA', 'MEDIA', 'ALTA')),
  status TEXT NOT NULL DEFAULT 'ABERTA' CHECK(status IN ('ABERTA', 'EM_ANDAMENTO', 'RESOLVIDA', 'CANCELADA')),
  sla_horas INTEGER NOT NULL,
  data_limite_sla TIMESTAMPTZ NOT NULL,
  data_criacao TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_resolucao TIMESTAMPTZ,
  data_cancelamento TIMESTAMPTZ,
  solucao TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ocorrencias_vistoria ON public.ocorrencias(vistoria_id);

-- 4. Tabela de Evidências Fotográficas
CREATE TABLE IF NOT EXISTS public.fotos_evidencia (
  id TEXT PRIMARY KEY NOT NULL,
  item_id TEXT REFERENCES public.itens_checklist(id) ON DELETE CASCADE,
  ocorrencia_id TEXT REFERENCES public.ocorrencias(id) ON DELETE CASCADE,
  caminho_arquivo TEXT NOT NULL,
  resolucao TEXT,
  hash TEXT NOT NULL,
  tamanho_bytes INTEGER,
  data_captura TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Tabela de Comunicados Prediais (Mural do Síndico)
CREATE TABLE IF NOT EXISTS public.comunicados (
  id TEXT PRIMARY KEY NOT NULL,
  condominio_id TEXT NOT NULL,
  autor_id TEXT NOT NULL,
  autor_nome TEXT NOT NULL,
  titulo TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  data_criacao TIMESTAMPTZ NOT NULL DEFAULT now(),
  fixado BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comunicados_condominio ON public.comunicados(condominio_id);

-- 6. Tabela de Usuários / Perfis do Condomínio
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY NOT NULL,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK(role IN ('SINDICO', 'CONDOMINO', 'INSPETOR', 'ADMIN')),
  condominio_id TEXT NOT NULL,
  unidade TEXT,
  registro_profissional TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ultimo_acesso TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_condominio ON public.users(condominio_id);

-- 7. Ativação de Row Level Security (RLS) e Políticas de Acesso
ALTER TABLE public.vistorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocorrencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fotos_evidencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comunicados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso total para desenvolvimento e demonstração
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Acesso Total SindiFlow" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Acesso Total SindiFlow" ON public.%I FOR ALL USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

-- 8. Usuários padrão pré-cadastrados na tabela pública
INSERT INTO public.users (id, nome, email, role, condominio_id, unidade, registro_profissional, ativo)
VALUES 
  ('usr-sindico-carlos', 'Dr. Carlos Alberto', 'sindico@solar.com', 'SINDICO', 'cond-solar-palmeiras', NULL, NULL, true),
  ('usr-inspetor-carlos', 'Eng. Carlos Eduardo', 'inspetor@solar.com', 'INSPETOR', 'cond-solar-palmeiras', NULL, 'CREA 50692-SP', true),
  ('usr-condomino-mariana', 'Mariana de Souza', 'condomino@solar.com', 'CONDOMINO', 'cond-solar-palmeiras', 'Apto 402 - Bloco B', NULL, true)
ON CONFLICT (id) DO UPDATE SET
  nome = excluded.nome,
  role = excluded.role,
  condominio_id = excluded.condominio_id;
