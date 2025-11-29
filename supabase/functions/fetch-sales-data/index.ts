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
    
    // Se for consulta de um único dia (dataInicial === dataFinal), filtrar pelo dia específico usando data
    let filteredRecords = allRecords;
    if (dataInicial === dataFinal) {
      const targetDateStr = dataInicial; // YYYYMMDD
      const targetYear = parseInt(targetDateStr.substring(0, 4), 10);
      const targetMonth = parseInt(targetDateStr.substring(4, 6), 10) - 1; // Month is 0-indexed
      const targetDay = parseInt(targetDateStr.substring(6, 8), 10);

      // Create a Date object for the target day, at midnight UTC to avoid timezone issues
      const targetDate = new Date(Date.UTC(targetYear, targetMonth, targetDay));
      
      console.log(`fetch-sales-data: Applying single-day filter for target date (YYYYMMDD): ${targetDateStr}`);
      console.log(`fetch-sales-data: Parsed target Date (UTC): ${targetDate.toISOString()}`);

      const initialCount = allRecords.length;
      filteredRecords = allRecords.filter(record => {
        if (typeof record.data !== 'string' || !record.data) {
          return false; // Skip records without a valid date string
        }
        // Parse record.data (DD/MM/YYYY) into a Date object (UTC)
        const [day, month, year] = record.data.split(' ')[0].split('/').map(Number);
        const recordDate = new Date(Date.UTC(year, month - 1, day)); // Month is 0-indexed

        // Compare dates by their UTC day, month, and year
        const isSameDay = recordDate.getUTCFullYear() === targetDate.getUTCFullYear() &&
                          recordDate.getUTCMonth() === targetDate.getUTCMonth() &&
                          recordDate.getUTCDate() === targetDate.getUTCDate();

        if (!isSameDay) {
          console.log(`fetch-sales-data: Skipping record with date "${record.data}" (parsed UTC: ${recordDate.toISOString()}) as it does not match target (UTC: ${targetDate.toISOString()})`);
        }
        return isSameDay;
      });
      console.log(`fetch-sales-data: Filtered from ${initialCount} to ${filteredRecords.length} records for data ${targetDateStr}`);
    }
    
    const data = { content: filteredRecords };

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