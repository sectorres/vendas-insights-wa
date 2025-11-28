import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar configurações do banco
    const { data: settings, error: settingsError } = await supabase
      .from('evolution_settings')
      .select('*')
      .single();

    if (settingsError || !settings) {
      throw new Error('Configurações da Evolution API não encontradas. Configure em /evolution-setup');
    }

    // Normalizar URL - remover trailing slash
    const evolutionApiUrl = settings.api_url.replace(/\/$/, '');
    const evolutionApiKey = settings.api_key;

    console.log('Using API URL:', evolutionApiUrl);

    // Verificar se a instância já existe
    const fetchResponse = await fetch(`${evolutionApiUrl}/instance/fetchInstances`, {
      method: 'GET',
      headers: {
        'apikey': evolutionApiKey
      }
    });

    let instanceExists = false;
    if (fetchResponse.ok) {
      const instances = await fetchResponse.json();
      instanceExists = instances.some((inst: any) => inst.instance?.instanceName === instanceName);
      console.log('Instance exists:', instanceExists);
    }

    // Criar instância apenas se não existir
    if (!instanceExists) {
      console.log('Creating new instance:', instanceName);
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
      console.log('Instance created:', createData);

      // Aguardar um pouco para a instância inicializar
      await new Promise(resolve => setTimeout(resolve, 2000));
    } else {
      console.log('Using existing instance:', instanceName);
    }

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
    console.log('QR code obtained');

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