-- Tabela de configurações de notificações agendadas
CREATE TABLE public.notification_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('daily_sales', 'monthly_sales', 'sales_by_type')),
  schedule_time TIME NOT NULL,
  schedule_days INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5], -- 1=Monday, 7=Sunday
  phone_number TEXT NOT NULL,
  empresas_origem TEXT[], -- CNPJs das lojas
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de histórico de notificações enviadas
CREATE TABLE public.notification_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID REFERENCES public.notification_schedules(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
  error_message TEXT,
  report_data JSONB
);

-- Habilitar RLS
ALTER TABLE public.notification_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_history ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (acesso público para admin - ajustar depois se necessário)
CREATE POLICY "Allow all operations on notification_schedules"
  ON public.notification_schedules
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on notification_history"
  ON public.notification_history
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_notification_schedules_updated_at
  BEFORE UPDATE ON public.notification_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para melhor performance
CREATE INDEX idx_notification_schedules_active ON public.notification_schedules(active);
CREATE INDEX idx_notification_history_sent_at ON public.notification_history(sent_at DESC);
CREATE INDEX idx_notification_history_schedule_id ON public.notification_history(schedule_id);