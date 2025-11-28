import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WhatsAppRequest {
  phoneNumbers: string[];
  message: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phoneNumbers, message } = await req.json() as WhatsAppRequest;

    console.log('Sending WhatsApp notification to:', phoneNumbers);

    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');

    if (!evolutionApiUrl || !evolutionApiKey) {
      throw new Error('Evolution API credentials not configured');
    }

    // Enviar para todos os números
    const results = await Promise.allSettled(
      phoneNumbers.map(async (phoneNumber) => {
        const response = await fetch(`${evolutionApiUrl}/message/sendText`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evolutionApiKey
          },
          body: JSON.stringify({
            number: phoneNumber,
            text: message
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Evolution API Error for ${phoneNumber}:`, response.status, errorText);
          throw new Error(`Failed for ${phoneNumber}: ${response.status}`);
        }

        return await response.json();
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`WhatsApp notifications: ${successful} sent, ${failed} failed`);

    return new Response(JSON.stringify({ 
      successful, 
      failed,
      total: phoneNumbers.length 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in send-whatsapp-notification:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});