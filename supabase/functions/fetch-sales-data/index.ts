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

// Helper function to convert DD/MM/YYYY [HH:MM:SS] to YYYYMMDD
function convertToYYYYMMDD(dateString: string): string {
  const parts = dateString.split(' ')[0].split('/'); // Get DD/MM/YYYY and split
  if (parts.length === 3) {
    return `${parts[2]}${parts[1]}${parts[0]}`; // YYYYMMDD
  }
  return ''; // Invalid format
}

// Helper function to convert YYYYMMDD to YYYY/MM/DD
function formatDateToYYYYSlashMMSlashDD(dateYYYYMMDD: string): string {
  if (dateYYYYMMDD.length === 8) {
    const year = dateYYYYMMDD.substring(0, 4);
    const month = dateYYYYMMDD.substring(4, 6);
    const day = dateYYYYMMDD.substring(6, 8);
    return `${year}/${month}/${day}`;
  }
  return dateYYYYMMDD; // Return as is if format is not YYYYMMDD
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { dataInicial, dataFinal, empresasOrigem } = await req.json() as SalesDataRequest;

    const externalApiDataVendaInicial = formatDateToYYYYSlashMMSlashDD(dataInicial);
    const externalApiDataVendaFinal = formatDateToYYYYSlashMMSlashDD(dataFinal);

    console.log('Fetching sales data for external API:', { externalApiDataVendaInicial, externalApiDataVendaFinal, empresasOrigem });

    const username = 'MOISES';
    const password = Deno.env.get('TORRES_CABRAL_PASSWORD');
    const credentials = btoa(`${username}:${password}`);

    let allRecords: any[] = [];
    let currentPage = 1;
    const maxPagesSafetyLimit = 100; // Safety limit to prevent infinite loops

    while (currentPage <= maxPagesSafetyLimit) {
      const requestBody: any = {
        paginacao: currentPage,
        quantidade: 1000,
        dataVendaInicial: externalApiDataVendaInicial,
        dataVendaFinal: externalApiDataVendaFinal,
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
          const errorText = await response.text();
          console.error(`API Error on page ${currentPage}:`, response.status, errorText);
          // If it's not the first page and we get an error, we can assume no more data
          if (currentPage > 1) break; 
          throw new Error(`API returned ${response.status}: ${errorText}`);
        }

        const pageData = await response.json();
        console.log(`Page ${currentPage}: Raw data received from external API:`, JSON.stringify(pageData, null, 2));
        
        const records = pageData.content || [];
        const lastPage = pageData.lastPage || false; // Use lastPage from API response
        const totalRecordsFromApi = pageData.total || 0; // Use total from API response

        console.log(`Page ${currentPage}: Fetched ${records.length} records. Total from API for this query: ${totalRecordsFromApi}. Last page: ${lastPage}`);

        // Filter records by date within the edge function (internal fallback)
        const filteredRecords = records.filter((sale: any) => {
          const saleDateYYYYMMDD = convertToYYYYMMDD(sale.dataVenda);
          return saleDateYYYYMMDD >= dataInicial && saleDateYYYYMMDD <= dataFinal;
        });

        console.log(`Page ${currentPage}: ${filteredRecords.length} records after internal filtering by date range (${dataInicial} to ${dataFinal})`);
        
        allRecords = allRecords.concat(filteredRecords);

        if (lastPage || records.length === 0) { // Break if it's the last page or no records were returned
          console.log(`Stopping pagination: lastPage is ${lastPage} or records.length is ${records.length}`);
          break;
        }
        
        currentPage++;
        
      } catch (error) {
        console.error(`Error during fetch for page ${currentPage}:`, error);
        // If an error occurs, stop fetching further pages
        break;
      }
    }

    console.log(`Total records fetched and internally filtered: ${allRecords.length} across ${currentPage - 1} pages`);
    
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