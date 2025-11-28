import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw } from "lucide-react";

export const InsightsPreview = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<any>(null);
  const [formData, setFormData] = useState({
    dataInicial: "",
    dataFinal: "",
    reportType: "daily_sales",
    empresasOrigem: "",
    testPhoneNumbers: "",
  });

  const handlePreview = async () => {
    if (!formData.dataInicial || !formData.dataFinal) {
      toast({
        title: "Erro",
        description: "Preencha as datas inicial e final",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const empresasOrigemArray = formData.empresasOrigem
        .split(",")
        .map(c => c.trim())
        .filter(c => c);

      const { data, error } = await supabase.functions.invoke("process-insights", {
        body: {
          dataInicial: formData.dataInicial.replace(/-/g, ""),
          dataFinal: formData.dataFinal.replace(/-/g, ""),
          reportType: formData.reportType,
          empresasOrigem: empresasOrigemArray.length > 0 ? empresasOrigemArray : undefined,
        },
      });

      if (error) throw error;

      setInsights(data);
      toast({
        title: "Sucesso",
        description: "Insights gerados com sucesso",
      });
    } catch (error) {
      console.error("Error generating insights:", error);
      toast({
        title: "Erro",
        description: "Falha ao gerar insights",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const sendTestNotification = async () => {
    if (!insights) {
      toast({
        title: "Erro",
        description: "Gere os insights antes de enviar",
        variant: "destructive",
      });
      return;
    }

    if (!formData.testPhoneNumbers) {
      toast({
        title: "Erro",
        description: "Adicione pelo menos um número de telefone",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const phoneNumbersArray = formData.testPhoneNumbers
        .split(",")
        .map(p => p.trim())
        .filter(p => p);

      // Formatar mensagem com os insights
      let message = `📊 *Relatório de Vendas*\n\n`;
      message += `📅 Período: ${formData.dataInicial} a ${formData.dataFinal}\n\n`;
      
      Object.entries(insights.data || {}).forEach(([store, data]: [string, any]) => {
        message += `🏪 *${store}*\n`;
        Object.entries(data).forEach(([key, value]: [string, any]) => {
          message += `   ${key}: ${formatCurrency(value)}\n`;
        });
        message += `\n`;
      });
      
      message += `💰 *Total Geral: ${formatCurrency(insights.total || 0)}*`;

      const { data: sendData, error } = await supabase.functions.invoke("send-whatsapp-notification", {
        body: {
          phoneNumbers: phoneNumbersArray,
          message
        }
      });

      if (error) throw error;

      toast({
        title: "Notificação Enviada",
        description: `Enviada para ${sendData.successful} número(s)`,
      });
    } catch (error) {
      console.error("Error sending test notification:", error);
      toast({
        title: "Erro",
        description: "Falha ao enviar notificação de teste",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold text-foreground mb-6">Preview de Insights</h2>

      <div className="space-y-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="dataInicial">Data Inicial</Label>
            <Input
              id="dataInicial"
              type="date"
              value={formData.dataInicial}
              onChange={(e) => setFormData({ ...formData, dataInicial: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="dataFinal">Data Final</Label>
            <Input
              id="dataFinal"
              type="date"
              value={formData.dataFinal}
              onChange={(e) => setFormData({ ...formData, dataFinal: e.target.value })}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="reportTypePreview">Tipo de Relatório</Label>
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
          <Label htmlFor="empresasOrigemPreview">Códigos das Lojas (opcional)</Label>
          <Input
            id="empresasOrigemPreview"
            value={formData.empresasOrigem}
            onChange={(e) => setFormData({ ...formData, empresasOrigem: e.target.value })}
            placeholder="1, 2, 3"
          />
        </div>

        <Button onClick={handlePreview} disabled={loading} className="w-full">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Gerando..." : "Gerar Preview"}
        </Button>
      </div>

      {insights && (
        <>
          <div className="border-t border-border pt-6">
            <h3 className="font-semibold text-foreground mb-4">Resultados:</h3>
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Total Geral</p>
                <p className="text-2xl font-bold text-success">
                  {formatCurrency(insights.total || 0)}
                </p>
              </div>

              <div className="space-y-2">
                {Object.entries(insights.data || {}).map(([store, data]: [string, any]) => (
                  <div key={store} className="p-4 border border-border rounded-lg">
                    <p className="font-semibold text-foreground mb-2">{store}</p>
                    <div className="text-sm text-muted-foreground space-y-1">
                      {Object.entries(data).map(([key, value]: [string, any]) => (
                        <div key={key} className="flex justify-between">
                          <span>{key}:</span>
                          <span className="font-medium text-foreground">
                            {formatCurrency(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-6 mt-6 space-y-4">
            <h3 className="font-semibold text-foreground mb-4">Enviar Notificação de Teste</h3>
            <div>
              <Label htmlFor="testPhoneNumbers">Números WhatsApp (com DDI, separados por vírgula)</Label>
              <Input
                id="testPhoneNumbers"
                value={formData.testPhoneNumbers}
                onChange={(e) => setFormData({ ...formData, testPhoneNumbers: e.target.value })}
                placeholder="5511999999999, 5511888888888"
              />
            </div>
            <Button onClick={sendTestNotification} disabled={loading} variant="secondary" className="w-full">
              {loading ? "Enviando..." : "Enviar Notificação de Teste"}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
};