import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CompanySales {
  code: number;
  name: string;
  total: number;
}

export const DailySalesByCompanyCards = () => {
  const { toast } = useToast();
  const [companySales, setCompanySales] = useState<CompanySales[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDailySalesByCompany();
  }, []);

  const fetchDailySalesByCompany = async () => {
    try {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const dateStrYYYYMMDD = `${year}${month}${day}`; // Formato YYYYMMDD para a requisição da Edge Function

      console.log("DailySalesByCompanyCards: Solicitando vendas para a data (YYYYMMDD):", dateStrYYYYMMDD);

      const { data, error } = await supabase.functions.invoke("fetch-sales-data", {
        body: {
          dataInicial: dateStrYYYYMMDD,
          dataFinal: dateStrYYYYMMDD,
        }
      });

      if (error) throw error;

      if (data && data.content) {
        console.log("DailySalesByCompanyCards: Conteúdo bruto dos dados recebidos da Edge Function:", data.content);

        const salesByCompanyCode: { [code: number]: number } = {};
        const companyNames: { [code: number]: string } = {};

        data.content.forEach((sale: any) => {
          const companyCode = sale.empresaOrigem?.codigo;
          const companyName = sale.empresaOrigem?.nome || `Empresa ${companyCode || 'Desconhecida'}`;
          const value = sale.valorProdutos || 0;
          
          if (companyCode !== undefined) {
            if (!salesByCompanyCode[companyCode]) {
              salesByCompanyCode[companyCode] = 0;
            }
            salesByCompanyCode[companyCode] += value;
            companyNames[companyCode] = companyName; // Armazena o nome para exibição
          }
        });

        const formattedSales = Object.entries(salesByCompanyCode).map(([code, total]) => ({
          code: parseInt(code, 10),
          name: companyNames[parseInt(code, 10)],
          total,
        }));
        setCompanySales(formattedSales);
        console.log("DailySalesByCompanyCards: Vendas por empresa (agrupadas por código):", formattedSales);
      } else {
        setCompanySales([]);
        console.log("DailySalesByCompanyCards: Nenhum dado de vendas recebido ou conteúdo vazio.");
      }
    } catch (error) {
      console.error("Erro ao buscar vendas diárias por empresa:", error);
      toast({
        title: "Aviso",
        description: "Não foi possível carregar as vendas do dia por empresa",
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

  if (loading) {
    return (
      <Card className="p-6 hover:shadow-lg transition-shadow">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <TrendingUp className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Vendas Hoje</p>
            <p className="text-2xl font-bold text-foreground">...</p>
          </div>
        </div>
      </Card>
    );
  }

  if (companySales.length === 0) {
    return (
      <Card className="p-6 hover:shadow-lg transition-shadow">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <TrendingUp className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Vendas Hoje</p>
            <p className="text-2xl font-bold text-foreground">Nenhuma venda</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <>
      {companySales.map((company) => (
        <Card key={company.code} className="p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{company.name} (Cód: {company.code})</p>
              <p className="text-2xl font-bold text-foreground">
                {formatCurrency(company.total)}
              </p>
            </div>
          </div>
        </Card>
      ))}
    </>
  );
};