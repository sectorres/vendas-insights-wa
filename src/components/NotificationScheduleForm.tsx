import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export const NotificationScheduleForm = ({ onSuccess }: { onSuccess: () => void }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    reportType: "daily_sales",
    scheduleTime: "08:00",
    phoneNumbers: "",
    empresasOrigem: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const empresasOrigemArray = formData.empresasOrigem
        .split(",")
        .map(c => c.trim())
        .filter(c => c);

      const phoneNumbersArray = formData.phoneNumbers
        .split(",")
        .map(p => p.trim())
        .filter(p => p);

      if (phoneNumbersArray.length === 0) {
        throw new Error("Adicione pelo menos um número de telefone");
      }

      const { error } = await supabase
        .from("notification_schedules")
        .insert({
          name: formData.name,
          report_type: formData.reportType,
          schedule_time: formData.scheduleTime,
          phone_numbers: phoneNumbersArray,
          empresas_origem: empresasOrigemArray.length > 0 ? empresasOrigemArray : null,
          active: true,
        });

      if (error) throw error;

      toast({
        title: "Notificação Criada",
        description: "A notificação agendada foi criada com sucesso",
      });

      setFormData({
        name: "",
        reportType: "daily_sales",
        scheduleTime: "08:00",
        phoneNumbers: "",
        empresasOrigem: "",
      });

      onSuccess();
    } catch (error) {
      console.error("Error creating schedule:", error);
      toast({
        title: "Erro",
        description: "Falha ao criar notificação agendada",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold text-foreground mb-6">Nova Notificação Agendada</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="name">Nome da Notificação</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Ex: Vendas Diárias - Loja 1"
            required
          />
        </div>

        <div>
          <Label htmlFor="reportType">Tipo de Relatório</Label>
          <Select
            value={formData.reportType}
            onValueChange={(value) => setFormData({ ...formData, reportType: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily_sales">Vendas Diárias</SelectItem>
              <SelectItem value="monthly_sales">Vendas Mensais</SelectItem>
              <SelectItem value="sales_by_type">Vendas por Tipo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="scheduleTime">Horário de Envio</Label>
          <Input
            id="scheduleTime"
            type="time"
            value={formData.scheduleTime}
            onChange={(e) => setFormData({ ...formData, scheduleTime: e.target.value })}
            required
          />
        </div>

        <div>
          <Label htmlFor="phoneNumbers">Números WhatsApp (com DDI, separados por vírgula)</Label>
          <Input
            id="phoneNumbers"
            value={formData.phoneNumbers}
            onChange={(e) => setFormData({ ...formData, phoneNumbers: e.target.value })}
            placeholder="5511999999999, 5511888888888"
            required
          />
          <p className="text-xs text-muted-foreground mt-1">
            Separe múltiplos números com vírgula
          </p>
        </div>

        <div>
          <Label htmlFor="empresasOrigem">CNPJs das Lojas (opcional, separados por vírgula)</Label>
          <Input
            id="empresasOrigem"
            value={formData.empresasOrigem}
            onChange={(e) => setFormData({ ...formData, empresasOrigem: e.target.value })}
            placeholder="55728224001111, 55728224009999"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Deixe vazio para incluir todas as lojas
          </p>
        </div>

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Criando..." : "Criar Notificação"}
        </Button>
      </form>
    </Card>
  );
};