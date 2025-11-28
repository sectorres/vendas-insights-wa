import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');

    if (!evolutionApiUrl || !evolutionApiKey) {
      throw new Error('Evolution API credentials not configured');
    }

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