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
  if (!dateString) return ''; // Handle null/undefined dateString
  const parts = dateString.split(' ')[0].split('/'); // Get DD/MM/YYYY and split
  if (parts.length === 3) {
    // Ensure parts are numbers before constructing
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      return `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`; // YYYYMMDD
    }
  }
  console.warn(`convertToYYYYMMDD: Could not parse dateString "${dateString}". Returning empty string.`);
  return ''; // Invalid format
}

// Helper function to convert YYYYMMDD to YYYY/MM/DD
function formatDateToYYYYSlashMMSlashDD(dateYYYYMMDD: string): string {
  if (dateYYYYMMDD && dateYYYYMMDD.length === 8) {
    const year = dateYYYYMMDD.substring(0, 4);
    const month = dateYYYYMMDD.substring(4, 6);
    const day = dateYYYYMMDD.substring(6, 8);
    return `${year}/${month}/${day}`;
  }
  console.warn(`formatDateToYYYYSlashMMSlashDD: Invalid YYYYMMDD format "${dateYYYYMMDD}". Returning original string.`);
  return dateYYYYMMDD;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { dataInicial, dataFinal, empresasOrigem } = await req.json() as SalesDataRequest;

    // Log the incoming dates from the frontend
    console.log(`Edge Function received: dataInicial=${dataInicial}, dataFinal=${dataFinal}`);

    const externalApiDataVendaInicial = formatDateToYYYYSlashMMSlashDD(dataInicial);
    const externalApiDataVendaFinal = formatDateToYYYYSlashMMSlashDD(dataFinal);

    console.log('Fetching sales data for external API with formatted dates:', { externalApiDataVendaInicial, externalApiDataVendaFinal, empresasOrigem });

    const username = 'MOISES';
    const password = Deno.env.get('TORRES_CABRAL_PASSWORD');
    const credentials = btoa(`${username}:${password}`);

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

      console.log(`Page ${currentPage}: Request body to external API:`, JSON.stringify(requestBody, null, 2));

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
          console.error(`Page ${currentPage}: API Error:`, response.status, errorText);
          if (currentPage > 1) { 
            console.log(`Stopping pagination due to API error on page ${currentPage}.`);
            break;
          }
          throw new Error(`API returned ${response.status}: ${errorText}`);
        }

        const pageData = await response.json();
        let records = pageData.content || [];
        const lastPage = pageData.lastPage || false;
        const totalRecordsFromApi = pageData.total || 0; // This total might be for the entire dataset

        console.log(`Page ${currentPage}: Raw records from external API: ${records.length}. Last page flag: ${lastPage}. API reported total: ${totalRecordsFromApi}`);
        
        // Internal filtering by date
        const filteredRecords = records.filter((sale: any, index: number) => {
          const saleDateYYYYMMDD = convertToYYYYMMDD(sale.dataVenda);
          const isMatch = saleDateYYYYMMDD >= dataInicial && saleDateYYYYMMDD <= dataFinal;
          
          // Log a sample of records being processed by the filter
          if (index < 5 || Math.random() < 0.01) { // Log first 5 and 1% randomly
            console.log(`Page ${currentPage}, Record ${index}: rawDate="${sale.dataVenda}", convertedDate="${saleDateYYYYMMDD}", targetDates="${dataInicial}-${dataFinal}", isMatch=${isMatch}`);
          }
          
          return isMatch;
        });

        console.log(`Page ${currentPage}: ${filteredRecords.length} records after internal filtering.`);
        
        allRecords = allRecords.concat(filteredRecords);

        // Stop if it's the last page from the external API, or if no records were returned in this page
        if (lastPage || records.length === 0) { 
          console.log(`Stopping pagination: lastPage is ${lastPage} or raw records.length is ${records.length}.`);
          break;
        }
        
        currentPage++;
        
      } catch (error) {
        console.error(`Error during fetch for page ${currentPage}:`, error);
        break;
      }
    }

    console.log(`Final result: Total records fetched and internally filtered: ${allRecords.length}`);
    
    const data = { content: allRecords };

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in fetch-sales-data (top level):', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});