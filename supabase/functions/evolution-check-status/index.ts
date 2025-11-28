import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StatusRequest {
  instanceName: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { instanceName } = await req.json() as StatusRequest;

    console.log('Checking status for instance:', instanceName);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar configurações do banco
    const { data: settings, error: settingsError } = await supabase
      .from('evolution_settings')
      .select('*')
      .single();

    if (settingsError || !settings) {
      throw new Error('Configurações da Evolution API não encontradas');
    }

    // Normalizar URL - remover trailing slash
    const evolutionApiUrl = settings.api_url.replace(/\/$/, '');
    const evolutionApiKey = settings.api_key;

    const response = await fetch(`${evolutionApiUrl}/instance/connectionState/${instanceName}`, {
      method: 'GET',
      headers: {
        'apikey': evolutionApiKey
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Evolution API Error:', response.status, errorText);
      throw new Error(`Evolution API returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log('Instance status:', data);

    return new Response(JSON.stringify({
      status: data.state || 'disconnected',
      connected: data.state === 'open',
      instanceName
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in evolution-check-status:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});