import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Clock, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Schedule {
  id: string;
  name: string;
  report_type: string;
  schedule_time: string;
  phone_number: string;
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
                <p>WhatsApp: {schedule.phone_number}</p>
                {schedule.empresas_origem && schedule.empresas_origem.length > 0 && (
                  <p>Lojas: {schedule.empresas_origem.length} selecionadas</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
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