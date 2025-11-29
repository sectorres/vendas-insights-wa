import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const DailySalesCard = () => {
  const { toast } = useToast();
  const [totalSales, setTotalSales] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDailySales();
  }, []);

  const fetchDailySales = async () => {
    try {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const dateStrYYYYMMDD = `${year}${month}${day}`; // Formato YYYYMMDD para a requisição da Edge Function

      console.log("DailySalesCard: Solicitando vendas para a data (YYYYMMDD):", dateStrYYYYMMDD);
      console.log("DailySalesCard: Filtrando apenas a empresa com código 1 para teste.");

      const { data, error } = await supabase.functions.invoke("fetch-sales-data", {
        body: {
          dataInicial: dateStrYYYYMMDD,
          dataFinal: dateStrYYYYMMDD,
          empresasOrigem: ["1"], // Adicionando o filtro para a empresa de código 1
        }
      });

      if (error) throw error;

      if (data && data.content) {
        console.log("DailySalesCard: Conteúdo bruto dos dados recebidos da Edge Function:", data.content);

        const total = data.content.reduce((sum: number, sale: any) => {
          return sum + (sale.valorProdutos || 0);
        }, 0);
        setTotalSales(total);
        console.log("DailySalesCard: Total de vendas somadas (empresa 1):", total);
      } else {
        setTotalSales(0);
        console.log("DailySalesCard: Nenhum dado de vendas recebido ou conteúdo vazio.");
      }
    } catch (error) {
      console.error("Erro ao buscar vendas diárias:", error);
      toast({
        title: "Aviso",
        description: "Não foi possível carregar as vendas do dia",
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

  return (
    <Card className="p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
          <TrendingUp className="h-6 w-6 text-primary" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Vendas Hoje (Empresa 1)</p>
          <p className="text-2xl font-bold text-foreground">
            {loading ? "..." : formatCurrency(totalSales)}
          </p>
        </div>
      </div>
    </Card>
  );
};