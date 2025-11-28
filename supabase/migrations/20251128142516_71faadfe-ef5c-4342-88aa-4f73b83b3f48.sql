-- Adicionar suporte para múltiplos números de telefone
ALTER TABLE public.notification_schedules 
DROP COLUMN phone_number;

ALTER TABLE public.notification_schedules 
ADD COLUMN phone_numbers TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Atualizar constraint para aceitar pelo menos um número
ALTER TABLE public.notification_schedules
ADD CONSTRAINT check_phone_numbers_not_empty 
CHECK (array_length(phone_numbers, 1) > 0);