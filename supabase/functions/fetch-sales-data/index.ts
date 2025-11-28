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

    const requestBody: any = {
      paginacao: 1,
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
      // Converter códigos de string para número
      requestBody.empresasOrigem = empresasOrigem.map(codigo => parseInt(codigo, 10));
    }

    console.log('Request body:', JSON.stringify(requestBody));

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
      console.error('API Error:', response.status, errorText);
      throw new Error(`API returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log(`Fetched ${data.content?.length || 0} records`);

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