import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SalesDataRequest {
  dataInicial: string; // Expected YYYYMMDD
  dataFinal: string;   // Expected YYYYMMDD
  empresasOrigem?: string[]; // Códigos das lojas como strings, ex: ["1", "2", "3"]
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { dataInicial, dataFinal, empresasOrigem } = await req.json() as SalesDataRequest;

    // Convert YYYYMMDD to YYYY/MM/DD for the external API
    const formatToExternalApiDate = (dateStr: string) => {
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);
      return `${year}/${month}/${day}`;
    };

    const externalApiDataInicial = formatToExternalApiDate(dataInicial);
    const externalApiDataFinal = formatToExternalApiDate(dataFinal);

    console.log('Fetching sales data for external API:', { externalApiDataInicial, externalApiDataFinal, empresasOrigem });

    const username = 'MOISES';
    const password = Deno.env.get('TORRES_CABRAL_PASSWORD');
    const credentials = btoa(`${username}:${password}`);

    let allRecords: any[] = [];
    let currentPage = 1;
    const maxPages = 100; // Limite de segurança

    while (currentPage <= maxPages) {
      const requestBody: any = {
        paginacao: currentPage,
        quantidade: 1000,
        // Usar APENAS dataVendaInicial e dataVendaFinal para filtrar pela data da venda
        dataVendaInicial: externalApiDataInicial,
        dataVendaFinal: externalApiDataFinal,
        incluirCanceladas: "NAO",
        mostraRentabilidade: "NAO",
        mostraQuestionario: "N"
      };

      if (empresasOrigem && empresasOrigem.length > 0) {
        requestBody.empresasOrigem = empresasOrigem.map(codigo => parseInt(codigo, 10));
      }

      console.log(`Fetching page ${currentPage} with request body sent to external API:`, JSON.stringify(requestBody, null, 2));

      try {
        const response = await fetch('https://int.torrescabral.com.br/shx-integracao-servicos/notas', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${credentials}`
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          if (currentPage > 1) {
            console.log(`No more pages after page ${currentPage - 1}`);
            break;
          }
          const errorText = await response.text();
          console.error('API Error on first page:', response.status, errorText);
          throw new Error(`API returned ${response.status}: ${errorText}`);
        }

        const pageData = await response.json();
        console.log(`Page ${currentPage}: Raw data received from external API:`, JSON.stringify(pageData, null, 2));
        const records = pageData.content || [];
        
        console.log(`Page ${currentPage}: Fetched ${records.length} records`);
        
        if (records.length === 0) {
          console.log('No more records found');
          break;
        }
        
        allRecords = allRecords.concat(records);
        currentPage++;
        
      } catch (error) {
        if (currentPage > 1) {
          console.log(`Error on page ${currentPage}, stopping. Error:`, error);
          break;
        } else {
          throw error;
        }
      }
    }

    console.log(`Total records fetched: ${allRecords.length} across ${currentPage - 1} pages`);
    
    const data = { content: allRecords };

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in fetch-sales-data:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});