-- Tabela para configurações da Evolution API
CREATE TABLE public.evolution_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  instance_name TEXT NOT NULL DEFAULT 'notifyhub',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Apenas uma configuração permitida
CREATE UNIQUE INDEX unique_evolution_settings ON public.evolution_settings ((true));

-- Habilitar RLS
ALTER TABLE public.evolution_settings ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (acesso público para admin)
CREATE POLICY "Allow all operations on evolution_settings"
  ON public.evolution_settings
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_evolution_settings_updated_at
  BEFORE UPDATE ON public.evolution_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();