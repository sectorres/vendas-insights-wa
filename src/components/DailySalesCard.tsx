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
      const dateStrYYYYMMDD = `${year}${month}${day}`; // Formato YYYYMMDD para a requisição da API
      const dateStrDDMMYYYY = `${day}/${month}/${year}`; // Formato DD/MM/YYYY para filtrar a resposta

      console.log("DailySalesCard: Solicitando vendas para a data (YYYYMMDD):", dateStrYYYYMMDD);

      const { data, error } = await supabase.functions.invoke("fetch-sales-data", {
        body: {
          dataInicial: dateStrYYYYMMDD,
          dataFinal: dateStrYYYYMMDD,
        }
      });

      if (error) throw error;

      if (data && data.content) {
        console.log("DailySalesCard: Conteúdo bruto dos dados recebidos:", data.content);

        // Filtrar os registros para garantir que o campo 'dataVenda' corresponda à data de hoje no formato DD/MM/YYYY
        const filteredSales = data.content.filter((sale: any) => {
          // O campo 'dataVenda' na resposta da API está no formato 'DD/MM/YYYY'
          return sale.dataVenda === dateStrDDMMYYYY;
        });

        const total = filteredSales.reduce((sum: number, sale: any) => {
          return sum + (sale.valorProdutos || 0);
        }, 0);
        setTotalSales(total);
        console.log("DailySalesCard: Vendas filtradas para hoje (DD/MM/YYYY):", dateStrDDMMYYYY, "Quantidade:", filteredSales.length, "Total:", total);
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
          <p className="text-sm text-muted-foreground">Vendas Hoje</p>
          <p className="text-2xl font-bold text-foreground">
            {loading ? "..." : formatCurrency(totalSales)}
          </p>
        </div>
      </div>
    </Card>
  );
};