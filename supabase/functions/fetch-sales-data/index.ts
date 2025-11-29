import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SalesDataRequest {
  dataInicial?: string; // Optional: Expected YYYYMMDD
  dataFinal?: string;   // Optional: Expected YYYYMMDD
  empresasOrigem?: string[]; // Códigos das lojas como strings, ex: ["1", "2", "3"]
}

// Helper function to get current date in São Paulo timezone as YYYYMMDD
function getSaoPauloDateYYYYMMDD(): string {
  const now = new Date();
  const saoPauloTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const year = saoPauloTime.getFullYear();
  const month = String(saoPauloTime.getMonth() + 1).padStart(2, '0');
  const day = String(saoPauloTime.getDate()).padStart(2, '0');
  const formattedDate = `${year}${month}${day}`;
  console.log(`[getSaoPauloDateYYYYMMDD] Calculated São Paulo date: ${formattedDate}`);
  return formattedDate;
}

// Helper function to convert DD/MM/YYYY [HH:MM:SS] to YYYYMMDD
function convertToYYYYMMDD(dateString: string): string {
  if (!dateString) {
    console.warn(`[convertToYYYYMMDD] Received empty or null dateString. Returning empty string.`);
    return '';
  }
  const parts = dateString.split(' ')[0].split('/'); // Get DD/MM/YYYY and split
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      const convertedDate = `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`; // YYYYMMDD
      console.log(`[convertToYYYYMMDD] Converted "${dateString}" to "${convertedDate}"`);
      return convertedDate;
    }
  }
  console.warn(`[convertToYYYYMMDD] Could not parse dateString "${dateString}" into DD/MM/YYYY format. Returning empty string.`);
  return ''; // Invalid format
}

// Helper function to convert YYYYMMDD to YYYY/MM/DD
function formatDateToYYYYSlashMMSlashDD(dateYYYYMMDD: string): string {
  if (dateYYYYMMDD && dateYYYYMMDD.length === 8) {
    const year = dateYYYYMMDD.substring(0, 4);
    const month = dateYYYYMMDD.substring(4, 6);
    const day = dateYYYYMMDD.substring(6, 8);
    const formattedDate = `${year}/${month}/${day}`;
    console.log(`[formatDateToYYYYSlashMMSlashDD] Converted "${dateYYYYMMDD}" to "${formattedDate}"`);
    return formattedDate;
  }
  console.warn(`[formatDateToYYYYSlashMMSlashDD] Invalid YYYYMMDD format "${dateYYYYMMDD}". Returning original string.`);
  return dateYYYYMMDD;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let { dataInicial, dataFinal, empresasOrigem } = await req.json() as SalesDataRequest;

    // If dataInicial and dataFinal are not provided, default to today in São Paulo timezone
    if (!dataInicial || !dataFinal) {
      const todaySaoPaulo = getSaoPauloDateYYYYMMDD();
      dataInicial = todaySaoPaulo;
      dataFinal = todaySaoPaulo;
      console.log(`[fetch-sales-data] Defaulting to São Paulo date: dataInicial=${dataInicial}, dataFinal=${dataFinal}`);
    } else {
      console.log(`[fetch-sales-data] Edge Function received: dataInicial=${dataInicial}, dataFinal=${dataFinal}`);
    }

    const externalApiDataVendaInicial = formatDateToYYYYSlashMMSlashDD(dataInicial);
    const externalApiDataVendaFinal = formatDateToYYYYSlashMMSlashDD(dataFinal);

    console.log('[fetch-sales-data] Fetching sales data for external API with formatted dates:', { externalApiDataVendaInicial, externalApiDataVendaFinal, empresasOrigem });

    const username = 'MOISES';
    const password = Deno.env.get('TORRES_CABRAL_PASSWORD');
    
    if (password === undefined) {
      console.error('[fetch-sales-data] ERROR: TORRES_CABRAL_PASSWORD environment variable is UNDEFINED!');
      throw new Error('TORRES_CABRAL_PASSWORD environment variable is not set.');
    } else if (password === null) {
      console.error('[fetch-sales-data] ERROR: TORRES_CABRAL_PASSWORD environment variable is NULL!');
      throw new Error('TORRES_CABRAL_PASSWORD environment variable is not set.');
    } else if (password === '') {
      console.error('[fetch-sales-data] ERROR: TORRES_CABRAL_PASSWORD environment variable is EMPTY STRING!');
      throw new Error('TORRES_CABRAL_PASSWORD environment variable is not set.');
    }
    console.log(`[fetch-sales-data] TORRES_CABRAL_PASSWORD environment variable is successfully retrieved. Length: ${password.length}`);

    const credentials = btoa(`${username}:${password}`);
    console.log(`[fetch-sales-data] Basic Auth credentials generated for user: ${username}. (Password masked)`);

    let allRecords: any[] = [];
    let currentPage = 1;
    const maxPagesSafetyLimit = 100; 

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

      console.log(`[fetch-sales-data] Page ${currentPage}: Request body to external API:`, JSON.stringify(requestBody, null, 2));

      try {
        console.log(`[fetch-sales-data] Page ${currentPage}: Making fetch request to external API...`);
        const response = await fetch('https://int.torrescabral.com.br/shx-integracao-servicos/notas', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${credentials}`
          },
          body: JSON.stringify(requestBody)
        });
        console.log(`[fetch-sales-data] Page ${currentPage}: Received response from external API. Status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[fetch-sales-data] Page ${currentPage}: API Error:`, response.status, errorText);
          if (currentPage > 1) { 
            console.log(`[fetch-sales-data] Stopping pagination due to API error on page ${currentPage}.`);
            break;
          }
          throw new Error(`API returned ${response.status}: ${errorText}`);
        }

        const pageData = await response.json();
        let records = pageData.content || [];
        const lastPage = pageData.lastPage || false;
        const totalRecordsFromApi = pageData.total || 0; 

        console.log(`[fetch-sales-data] Page ${currentPage}: Raw records from external API: ${records.length}. Last page flag: ${lastPage}. API reported total: ${totalRecordsFromApi}`);
        
        // Internal filtering by date
        const filteredRecords = records.filter((sale: any, index: number) => {
          const saleDateYYYYMMDD = convertToYYYYMMDD(sale.dataVenda);
          const isMatch = saleDateYYYYMMDD >= dataInicial && saleDateYYYYMMDD <= dataFinal;
          
          console.log(`[fetch-sales-data] Page ${currentPage}, Record ${index}: rawDate="${sale.dataVenda}", convertedDate="${saleDateYYYYMMDD}", targetDates="${dataInicial}-${dataFinal}", isMatch=${isMatch}`);
          
          return isMatch;
        });

        console.log(`[fetch-sales-data] Page ${currentPage}: ${filteredRecords.length} records after internal filtering.`);
        
        allRecords = allRecords.concat(filteredRecords);

        if (lastPage || records.length === 0) { 
          console.log(`[fetch-sales-data] Stopping pagination: lastPage is ${lastPage} or raw records.length is ${records.length}.`);
          break;
        }
        
        currentPage++;
        
      } catch (error) {
        console.error(`[fetch-sales-data] Error during fetch for page ${currentPage}:`, error);
        // Re-throw to be caught by the outer try-catch and return 500
        throw error; 
      }
    }

    console.log(`[fetch-sales-data] Final result: Total records fetched and internally filtered: ${allRecords.length}`);
    
    const data = { content: allRecords };

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[fetch-sales-data] Error in top-level catch block:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});