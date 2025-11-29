import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Clock, Trash2, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Schedule {
  id: string;
  name: string;
  report_type: string;
  schedule_time: string;
  phone_numbers: string[];
  empresas_origem: string[] | null;
  active: boolean;
  created_at: string;
}

export const NotificationScheduleList = ({ refresh }: { refresh: number }) => {
  const { toast } = useToast();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSchedules();
  }, [refresh]);

  const fetchSchedules = async () => {
    try {
      const { data, error } = await supabase
        .from("notification_schedules")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSchedules(data || []);
    } catch (error) {
      console.error("Error fetching schedules:", error);
      toast({
        title: "Erro",
        description: "Falha ao carregar notificações agendadas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (id: string, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from("notification_schedules")
        .update({ active: !currentActive })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Atualizado",
        description: `Notificação ${!currentActive ? "ativada" : "desativada"}`,
      });

      fetchSchedules();
    } catch (error) {
      console.error("Error toggling schedule:", error);
      toast({
        title: "Erro",
        description: "Falha ao atualizar notificação",
        variant: "destructive",
      });
    }
  };

  const deleteSchedule = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta notificação?")) return;

    try {
      const { error } = await supabase
        .from("notification_schedules")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Excluído",
        description: "Notificação excluída com sucesso",
      });

      fetchSchedules();
    } catch (error) {
      console.error("Error deleting schedule:", error);
      toast({
        title: "Erro",
        description: "Falha ao excluir notificação",
        variant: "destructive",
      });
    }
  };

  const getReportTypeName = (type: string) => {
    const types: Record<string, string> = {
      daily_sales: "Vendas Diárias",
      monthly_sales: "Vendas Mensais",
      sales_by_type: "Vendas por Tipo",
    };
    return types[type] || type;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const executeManually = async (schedule: Schedule) => {
    setLoading(true);
    try {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const dateStrYYYYMMDD = `${year}${month}${day}`;

      let dataInicial = dateStrYYYYMMDD;
      let dataFinal = dateStrYYYYMMDD;

      if (schedule.report_type === 'monthly_sales') {
        const firstDay = `${year}${month}01`;
        const lastDayOfMonth = new Date(year, today.getMonth() + 1, 0);
        const lastDay = `${year}${month}${String(lastDayOfMonth.getDate()).padStart(2, '0')}`;
        dataInicial = firstDay;
        dataFinal = lastDay;
      }
      
      // Processar insights
      const { data: insights, error: insightsError } = await supabase.functions.invoke('process-insights', {
        body: {
          dataInicial,
          dataFinal,
          empresasOrigem: schedule.empresas_origem,
          reportType: schedule.report_type
        }
      });

      if (insightsError) throw insightsError;

      // Formatar mensagem
      let message = `📊 *Relatório: ${schedule.name}* (TESTE MANUAL)\n\n`;
      
      if (insights.type === 'daily_sales') {
        message += `📅 *Vendas Diárias* (${new Date().toLocaleDateString('pt-BR')})\n\n`;
        Object.entries(insights.data || {}).forEach(([store, dates]: [string, any]) => {
          const storeTotal = Object.values(dates).reduce((sum: number, val: any) => sum + val, 0);
          message += `🏪 *${store}*: ${formatCurrency(storeTotal)}\n`;
        });
      } else if (insights.type === 'monthly_sales') {
        message += `📅 *Vendas Mensais* (${new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })})\n\n`;
        Object.entries(insights.data || {}).forEach(([store, months]: [string, any]) => {
          const storeTotal = Object.values(months).reduce((sum: number, val: any) => sum + val, 0);
          message += `🏪 *${store}*: ${formatCurrency(storeTotal)}\n`;
        });
      } else if (insights.type === 'sales_by_type') {
        message += `📅 *Vendas por Tipo de Produto* (${new Date().toLocaleDateString('pt-BR')})\n\n`;
        Object.entries(insights.data || {}).forEach(([store, types]: [string, any]) => {
          message += `🏪 *${store}*\n`;
          Object.entries(types).forEach(([type, value]: [string, any]) => {
            message += `  📦 ${type}: ${formatCurrency(value)}\n`;
          });
          message += '\n';
        });
      }
      
      message += `💰 *Total Geral: ${formatCurrency(insights.total || 0)}*`;

      // Enviar WhatsApp
      const { error: whatsappError } = await supabase.functions.invoke('send-whatsapp-notification', {
        body: {
          phoneNumbers: schedule.phone_numbers,
          message
        }
      });

      if (whatsappError) throw whatsappError;

      toast({
        title: "Sucesso",
        description: "Notificação enviada manualmente!",
      });
    } catch (error) {
      console.error("Error executing manually:", error);
      toast({
        title: "Erro",
        description: "Falha ao executar manualmente",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      fetchSchedules();
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <p className="text-center text-muted-foreground">Carregando...</p>
      </Card>
    );
  }

  if (schedules.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-center text-muted-foreground">
          Nenhuma notificação agendada. Crie uma nova acima!
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {schedules.map((schedule) => (
        <Card key={schedule.id} className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="font-semibold text-foreground">{schedule.name}</h3>
                <Badge variant={schedule.active ? "default" : "secondary"}>
                  {schedule.active ? "Ativa" : "Inativa"}
                </Badge>
              </div>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {schedule.schedule_time} - {getReportTypeName(schedule.report_type)}
                </p>
                <p>
                  WhatsApp: {schedule.phone_numbers.length} número{schedule.phone_numbers.length > 1 ? 's' : ''}
                  {schedule.phone_numbers.length <= 2 && ` (${schedule.phone_numbers.join(', ')})`}
                </p>
                {schedule.empresas_origem && schedule.empresas_origem.length > 0 && (
                  <p>Lojas: {schedule.empresas_origem.length} selecionadas</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => executeManually(schedule)}
                disabled={loading}
                title="Executar agora"
              >
                <Play className="h-4 w-4" />
              </Button>
              <Switch
                checked={schedule.active}
                onCheckedChange={() => toggleActive(schedule.id, schedule.active)}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteSchedule(schedule.id)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};