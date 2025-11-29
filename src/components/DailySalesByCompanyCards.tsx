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

// Helper function to convert DD/MM/YYYY [HH:MM:SS] to YYYYMMDD
function convertToYYYYMMDD(dateString: string): string {
  const parts = dateString.split(' ')[0].split('/'); // Get DD/MM/YYYY and split
  if (parts.length === 3) {
    return `${parts[2]}${parts[1]}${parts[0]}`; // YYYYMMDD
  }
  return ''; // Invalid format
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
      // Não passamos dataInicial e dataFinal, a Edge Function usará a data de São Paulo como padrão
      console.log("DailySalesByCompanyCards: Solicitando vendas para a data padrão da Edge Function.");

      const { data, error } = await supabase.functions.invoke("fetch-sales-data", {
        body: {
          // dataInicial e dataFinal serão definidos pela Edge Function
        }
      });

      if (error) throw error;

      if (data && data.content) {
        console.log("DailySalesByCompanyCards: Conteúdo bruto dos dados recebidos da Edge Function:", data.content);

        // A filtragem por data agora é feita na Edge Function se dataInicial/dataFinal não forem passados.
        // Se forem passados, a Edge Function já filtra.
        // Portanto, aqui, apenas agregamos os dados já filtrados.
        const salesByCompanyCode: { [code: number]: number } = {};
        const companyNames: { [code: number]: string } = {};

        data.content.forEach((sale: any, index: number) => {
          const companyCode = sale.empresaOrigem?.codigo;
          const companyName = sale.empresaOrigem?.nome || `Empresa ${companyCode || 'Desconhecida'}`;
          const value = sale.valorProdutos || 0;
          
          console.log(`DailySalesByCompanyCards: Agregando venda ${index}: Código da Empresa: ${companyCode}, Nome da Empresa: ${companyName}, Valor: ${value}`);

          if (companyCode !== undefined) {
            if (!salesByCompanyCode[companyCode]) {
              salesByCompanyCode[companyCode] = 0;
            }
            salesByCompanyCode[companyCode] += value;
            companyNames[companyCode] = companyName; 
          } else {
            console.warn(`DailySalesByCompanyCards: Venda ${index} sem código de empresa definido:`, sale);
          }
        });

        console.log("DailySalesByCompanyCards: salesByCompanyCode após agregação:", salesByCompanyCode);
        console.log("DailySalesByCompanyCards: companyNames após agregação:", companyNames);

        const formattedSales = Object.entries(salesByCompanyCode).map(([code, total]) => ({
          code: parseInt(code, 10),
          name: companyNames[parseInt(code, 10)],
          total,
        }));
        setCompanySales(formattedSales);
        console.log("DailySalesByCompanyCards: Vendas por empresa (agrupadas por código) para renderização:", formattedSales);
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