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
  data: string; // Data de emissão/processamento da nota
  dataVenda: string; // Data real da venda
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

    console.log('Processing insights request:', { dataInicial, dataFinal, empresasOrigem, reportType });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar dados de vendas
    console.log('Invoking fetch-sales-data with:', { dataInicial, dataFinal, empresasOrigem });
    const { data: salesResponse, error: fetchSalesError } = await supabase.functions.invoke('fetch-sales-data', {
      body: { dataInicial, dataFinal, empresasOrigem }
    });

    if (fetchSalesError) {
      console.error('Error invoking fetch-sales-data:', fetchSalesError);
      throw fetchSalesError;
    }

    if (!salesResponse || !salesResponse.content) {
      console.warn('No sales data content received from fetch-sales-data. Returning empty insights.');
      // Return empty insights if no data
      return new Response(JSON.stringify({ type: reportType, data: {}, total: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const salesData: SalesData[] = salesResponse.content;
    console.log(`Received ${salesData.length} sales records from fetch-sales-data.`);
    // Log a sample of salesData to avoid overwhelming logs if it's huge
    console.log('Sample sales data (first 5 records):', salesData.slice(0, 5)); 

    // Processar insights baseado no tipo de relatório
    let insights: any = {};

    if (reportType === 'daily_sales') {
      insights = processDailySales(salesData, dataInicial);
    } else if (reportType === 'monthly_sales') {
      insights = processMonthlySales(salesData);
    } else if (reportType === 'sales_by_type') {
      insights = processSalesByType(salesData);
    }
    
    console.log('Final insights generated:', insights);

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

function processDailySales(salesData: SalesData[], targetDate: string) {
  const salesByStoreAndDate: { [key: string]: { [date: string]: number } } = {};
  
  // Converter targetDate de YYYYMMDD para DD/MM/YYYY para comparação
  const year = targetDate.substring(0, 4);
  const month = targetDate.substring(4, 6);
  const day = targetDate.substring(6, 8);
  const formattedTargetDate = `${day}/${month}/${year}`;
  
  console.log(`processDailySales: Target date for filtering: ${formattedTargetDate}`);

  salesData.forEach(sale => {
    const storeCodigo = sale.empresaOrigem.codigo;
    const storeName = `LOJA-${String(storeCodigo).padStart(2, '0')}`;
    const valueWithoutFreight = sale.valorProdutos;
    const saleDate = typeof sale.dataVenda === 'string' ? sale.dataVenda.split(' ')[0] : '';

    console.log(`processDailySales: Evaluating sale - Store: ${storeName} (Code: ${storeCodigo}), Sale Date (raw): "${sale.dataVenda}", Extracted Date: "${saleDate}", Value: ${valueWithoutFreight}`);

    if (saleDate !== formattedTargetDate) {
      console.log(`processDailySales: Skipping sale from ${storeName} (Code: ${storeCodigo}) with date "${saleDate}" as it does not match target "${formattedTargetDate}"`);
      return;
    }
    
    if (!salesByStoreAndDate[storeName]) {
      salesByStoreAndDate[storeName] = {};
    }

    if (!salesByStoreAndDate[storeName][saleDate]) {
      salesByStoreAndDate[storeName][saleDate] = 0;
    }

    salesByStoreAndDate[storeName][saleDate] += valueWithoutFreight;
    console.log(`processDailySales: Added ${valueWithoutFreight} to ${storeName} for ${saleDate}. Current total: ${salesByStoreAndDate[storeName][saleDate]}`);
  });
  
  console.log(`processDailySales: Final aggregated data for daily sales:`, salesByStoreAndDate);

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
    const valueWithoutFreight = sale.valorProdutos;
    const month = typeof sale.dataVenda === 'string' ? sale.dataVenda.substring(3) : ''; // Pega MM/YYYY de DD/MM/YYYY

    console.log(`processMonthlySales: Evaluating sale - Store: ${storeName} (Code: ${storeCodigo}), Sale Date (raw): "${sale.dataVenda}", Extracted Month: "${month}", Value: ${valueWithoutFreight}`);

    if (!salesByStoreAndMonth[storeName]) {
      salesByStoreAndMonth[storeName] = {};
    }

    if (!salesByStoreAndMonth[storeName][month]) {
      salesByStoreAndMonth[storeName][month] = 0;
    }

    salesByStoreAndMonth[storeName][month] += valueWithoutFreight;
    console.log(`processMonthlySales: Added ${valueWithoutFreight} to ${storeName} for ${month}. Current total: ${salesByStoreAndMonth[storeName][month]}`);
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