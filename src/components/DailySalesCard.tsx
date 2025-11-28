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
      const dateStr = `${year}${month}${day}`;
      const formattedDate = `${day}/${month}/${year}`;

      const { data, error } = await supabase.functions.invoke("fetch-sales-data", {
        body: {
          dataInicial: dateStr,
          dataFinal: dateStr,
        }
      });

      if (error) throw error;

      if (data && data.content) {
        // Filtrar apenas vendas do dia específico usando data
        const todaySales = data.content.filter((sale: any) => sale.data === formattedDate);
        const total = todaySales.reduce((sum: number, sale: any) => {
          return sum + (sale.valorProdutos || 0);
        }, 0);
        setTotalSales(total);
      }
    } catch (error) {
      console.error("Error fetching daily sales:", error);
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