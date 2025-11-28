import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QRCodeRequest {
  instanceName: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { instanceName } = await req.json() as QRCodeRequest;

    console.log('Getting QR code for instance:', instanceName);

    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');

    if (!evolutionApiUrl || !evolutionApiKey) {
      throw new Error('Evolution API credentials not configured');
    }

    // Criar/conectar instância
    const createResponse = await fetch(`${evolutionApiUrl}/instance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey
      },
      body: JSON.stringify({
        instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS'
      })
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('Evolution API Error (create):', createResponse.status, errorText);
      throw new Error(`Evolution API returned ${createResponse.status}: ${errorText}`);
    }

    const createData = await createResponse.json();
    console.log('Instance created/connected');

    // Obter QR code
    const qrResponse = await fetch(`${evolutionApiUrl}/instance/connect/${instanceName}`, {
      method: 'GET',
      headers: {
        'apikey': evolutionApiKey
      }
    });

    if (!qrResponse.ok) {
      const errorText = await qrResponse.text();
      console.error('Evolution API Error (qr):', qrResponse.status, errorText);
      throw new Error(`Failed to get QR code: ${qrResponse.status}`);
    }

    const qrData = await qrResponse.json();

    return new Response(JSON.stringify({
      qrcode: qrData.qrcode?.code || qrData.code,
      status: qrData.status || 'pending',
      instanceName
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in evolution-get-qrcode:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});