import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SalesData {
  empresaOrigem: {
    nome: string;
    cnpj: string;
    codigo: number;
  };
  valorProdutos: number;
  valorFrete: number;
  data: string;
  produtos: Array<{
    tipo: string;
    valorLiquido: number;
  }>;
}

interface ProcessInsightsRequest {
  dataInicial: string;
  dataFinal: string;
  empresasOrigem?: string[];
  reportType: 'daily_sales' | 'monthly_sales' | 'sales_by_type';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { dataInicial, dataFinal, empresasOrigem, reportType } = await req.json() as ProcessInsightsRequest;

    console.log('Processing insights:', { dataInicial, dataFinal, reportType });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar dados de vendas
    const { data: salesResponse } = await supabase.functions.invoke('fetch-sales-data', {
      body: { dataInicial, dataFinal, empresasOrigem }
    });

    if (!salesResponse || !salesResponse.content) {
      throw new Error('Falha ao buscar dados de vendas');
    }

    const salesData: SalesData[] = salesResponse.content;

    // Processar insights baseado no tipo de relatório
    let insights: any = {};

    if (reportType === 'daily_sales') {
      insights = processDailySales(salesData);
    } else if (reportType === 'monthly_sales') {
      insights = processMonthlySales(salesData);
    } else if (reportType === 'sales_by_type') {
      insights = processSalesByType(salesData);
    }

    return new Response(JSON.stringify(insights), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in process-insights:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function processDailySales(salesData: SalesData[]) {
  const salesByStoreAndDate: { [key: string]: { [date: string]: number } } = {};

  salesData.forEach(sale => {
    const storeCodigo = sale.empresaOrigem.codigo;
    const storeName = `LOJA-${String(storeCodigo).padStart(2, '0')}`;
    const date = sale.data;
    // Somar o valorLiquido de cada produto da venda
    const valueWithoutFreight = sale.produtos.reduce((sum, product) => sum + product.valorLiquido, 0);

    if (!salesByStoreAndDate[storeName]) {
      salesByStoreAndDate[storeName] = {};
    }

    if (!salesByStoreAndDate[storeName][date]) {
      salesByStoreAndDate[storeName][date] = 0;
    }

    salesByStoreAndDate[storeName][date] += valueWithoutFreight;
  });

  return {
    type: 'daily_sales',
    data: salesByStoreAndDate,
    total: Object.values(salesByStoreAndDate).reduce((acc, dates) => {
      return acc + Object.values(dates).reduce((sum, val) => sum + val, 0);
    }, 0)
  };
}

function processMonthlySales(salesData: SalesData[]) {
  const salesByStoreAndMonth: { [key: string]: { [month: string]: number } } = {};

  salesData.forEach(sale => {
    const storeCodigo = sale.empresaOrigem.codigo;
    const storeName = `LOJA-${String(storeCodigo).padStart(2, '0')}`;
    const month = sale.data.substring(3); // Pega MM/YYYY de DD/MM/YYYY
    // Somar o valorLiquido de cada produto da venda
    const valueWithoutFreight = sale.produtos.reduce((sum, product) => sum + product.valorLiquido, 0);

    if (!salesByStoreAndMonth[storeName]) {
      salesByStoreAndMonth[storeName] = {};
    }

    if (!salesByStoreAndMonth[storeName][month]) {
      salesByStoreAndMonth[storeName][month] = 0;
    }

    salesByStoreAndMonth[storeName][month] += valueWithoutFreight;
  });

  return {
    type: 'monthly_sales',
    data: salesByStoreAndMonth,
    total: Object.values(salesByStoreAndMonth).reduce((acc, months) => {
      return acc + Object.values(months).reduce((sum, val) => sum + val, 0);
    }, 0)
  };
}

function processSalesByType(salesData: SalesData[]) {
  const salesByStoreAndType: { [key: string]: { [type: string]: number } } = {};

  salesData.forEach(sale => {
    const storeCodigo = sale.empresaOrigem.codigo;
    const storeName = `LOJA-${String(storeCodigo).padStart(2, '0')}`;

    if (!salesByStoreAndType[storeName]) {
      salesByStoreAndType[storeName] = {};
    }

    sale.produtos.forEach(product => {
      const type = product.tipo || 'SEM TIPO';
      const value = product.valorLiquido;

      if (!salesByStoreAndType[storeName][type]) {
        salesByStoreAndType[storeName][type] = 0;
      }

      salesByStoreAndType[storeName][type] += value;
    });
  });

  return {
    type: 'sales_by_type',
    data: salesByStoreAndType,
    total: Object.values(salesByStoreAndType).reduce((acc, types) => {
      return acc + Object.values(types).reduce((sum, val) => sum + val, 0);
    }, 0)
  };
}