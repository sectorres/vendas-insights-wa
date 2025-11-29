import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SalesDataRequest {
  dataInicial: string;
  dataFinal: string;
  empresasOrigem?: string[]; // Códigos das lojas como strings, ex: ["1", "2", "3"]
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { dataInicial, dataFinal, empresasOrigem } = await req.json() as SalesDataRequest;

    console.log('Fetching sales data:', { dataInicial, dataFinal, empresasOrigem });

    const username = 'MOISES';
    const password = Deno.env.get('TORRES_CABRAL_PASSWORD');
    const credentials = btoa(`${username}:${password}`);

    // Buscar todas as páginas de dados
    let allRecords: any[] = [];
    let currentPage = 1;
    const maxPages = 100; // Limite de segurança

    while (currentPage <= maxPages) {
      const requestBody: any = {
        paginacao: currentPage,
        quantidade: 1000,
        dataInicial,
        dataFinal,
        dataVendaInicial: dataInicial,
        dataVendaFinal: dataFinal,
        incluirCanceladas: "NAO",
        mostraRentabilidade: "NAO",
        mostraQuestionario: "N"
      };

      if (empresasOrigem && empresasOrigem.length > 0) {
        requestBody.empresasOrigem = empresasOrigem.map(codigo => parseInt(codigo, 10));
      }

      console.log(`Fetching page ${currentPage}`);

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
          // Se der erro na página > 1, assumimos que não há mais páginas
          if (currentPage > 1) {
            console.log(`No more pages after page ${currentPage - 1}`);
            break;
          }
          const errorText = await response.text();
          console.error('API Error on first page:', response.status, errorText);
          throw new Error(`API returned ${response.status}: ${errorText}`);
        }

        const pageData = await response.json();
        const records = pageData.content || [];
        
        console.log(`Page ${currentPage}: Fetched ${records.length} records`);
        
        // Se não retornou nenhum registro, acabaram as páginas
        if (records.length === 0) {
          console.log('No more records found');
          break;
        }
        
        allRecords = allRecords.concat(records);
        currentPage++;
        
      } catch (error) {
        // Se der erro em páginas posteriores, para mas mantém o que já coletou
        if (currentPage > 1) {
          console.log(`Error on page ${currentPage}, stopping. Error:`, error);
          break;
        } else {
          throw error;
        }
      }
    }

    console.log(`Total records fetched: ${allRecords.length} across ${currentPage - 1} pages`);
    
    // Removendo a filtragem interna aqui, confiando que a API externa já filtrou pelos parâmetros dataInicial e dataFinal
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