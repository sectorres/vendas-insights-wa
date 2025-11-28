import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Pegar data e hora atuais
    const now = new Date();
    const currentTime = now.toTimeString().split(' ')[0].substring(0, 5); // HH:MM
    const currentDay = now.getDay(); // 0 = domingo, 1 = segunda, ..., 6 = sábado
    
    console.log(`Checking scheduled notifications at ${currentTime} on day ${currentDay}`);

    // Buscar agendamentos ativos que devem ser executados neste horário e dia
    const { data: schedules, error: schedulesError } = await supabase
      .from('notification_schedules')
      .select('*')
      .eq('active', true);

    if (schedulesError) {
      console.error('Error fetching schedules:', schedulesError);
      throw schedulesError;
    }

    console.log(`Found ${schedules?.length || 0} active schedules`);

    let processedCount = 0;
    let errorCount = 0;

    // Processar cada agendamento
    for (const schedule of schedules || []) {
      const scheduleTime = schedule.schedule_time.substring(0, 5); // HH:MM
      const scheduleDays = schedule.schedule_days || [];

      console.log(`Schedule ${schedule.name}: time=${scheduleTime}, days=${scheduleDays}, current=${currentTime}`);

      // Verificar se é o horário e dia corretos
      if (scheduleTime === currentTime && scheduleDays.includes(currentDay)) {
        console.log(`Processing schedule: ${schedule.name}`);

        try {
          // Buscar dados de vendas
          const today = now.toISOString().split('T')[0].replace(/-/g, '');
          
          const { data: salesData, error: salesError } = await supabase.functions.invoke('fetch-sales-data', {
            body: {
              dataInicial: today,
              dataFinal: today,
              empresasOrigem: schedule.empresas_origem
            }
          });

          if (salesError) {
            console.error(`Error fetching sales data for ${schedule.name}:`, salesError);
            throw salesError;
          }

          console.log(`Fetched sales data for ${schedule.name}, processing insights...`);

          // Processar insights
          const { data: insights, error: insightsError } = await supabase.functions.invoke('process-insights', {
            body: {
              dataInicial: today,
              dataFinal: today,
              empresasOrigem: schedule.empresas_origem,
              reportType: schedule.report_type
            }
          });

          if (insightsError) {
            console.error(`Error processing insights for ${schedule.name}:`, insightsError);
            throw insightsError;
          }

          console.log(`Insights processed for ${schedule.name}, formatting message...`);

          // Formatar mensagem
          let message = `📊 *Relatório: ${schedule.name}*\n\n`;
          
          if (schedule.report_type === 'daily_sales') {
            message += `📅 *Vendas Diárias* (${new Date().toLocaleDateString('pt-BR')})\n\n`;
            for (const store of insights || []) {
              message += `🏪 *${store.empresaOrigem}*\n`;
              message += `💰 Total: R$ ${store.totalSales.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n`;
            }
          } else if (schedule.report_type === 'monthly_sales') {
            message += `📅 *Vendas Mensais*\n\n`;
            for (const store of insights || []) {
              message += `🏪 *${store.empresaOrigem}*\n`;
              message += `💰 Total: R$ ${store.totalSales.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n`;
            }
          } else if (schedule.report_type === 'sales_by_type') {
            message += `📅 *Vendas por Tipo de Produto*\n\n`;
            for (const store of insights || []) {
              message += `🏪 *${store.empresaOrigem}*\n`;
              for (const tipo of store.tipos || []) {
                message += `  📦 ${tipo.tipo}: R$ ${tipo.totalLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
              }
              message += '\n';
            }
          }

          console.log(`Message formatted for ${schedule.name}, sending to ${schedule.phone_numbers.length} recipients...`);

          // Enviar para WhatsApp
          const { data: whatsappResult, error: whatsappError } = await supabase.functions.invoke('send-whatsapp-notification', {
            body: {
              phoneNumbers: schedule.phone_numbers,
              message: message
            }
          });

          if (whatsappError) {
            console.error(`Error sending WhatsApp for ${schedule.name}:`, whatsappError);
            
            // Registrar erro no histórico
            for (const phoneNumber of schedule.phone_numbers) {
              await supabase.from('notification_history').insert({
                schedule_id: schedule.id,
                phone_number: phoneNumber,
                report_type: schedule.report_type,
                report_data: insights,
                status: 'failed',
                error_message: whatsappError.message || 'Unknown error'
              });
            }
            
            errorCount++;
            continue;
          }

          console.log(`WhatsApp sent successfully for ${schedule.name}:`, whatsappResult);

          // Registrar sucesso no histórico
          for (const phoneNumber of schedule.phone_numbers) {
            await supabase.from('notification_history').insert({
              schedule_id: schedule.id,
              phone_number: phoneNumber,
              report_type: schedule.report_type,
              report_data: insights,
              status: 'sent'
            });
          }

          processedCount++;
        } catch (error) {
          console.error(`Error processing schedule ${schedule.name}:`, error);
          
          // Registrar erro no histórico
          for (const phoneNumber of schedule.phone_numbers) {
            await supabase.from('notification_history').insert({
              schedule_id: schedule.id,
              phone_number: phoneNumber,
              report_type: schedule.report_type,
              status: 'failed',
              error_message: (error as Error).message
            });
          }
          
          errorCount++;
        }
      }
    }

    console.log(`Processed ${processedCount} schedules, ${errorCount} errors`);

    return new Response(
      JSON.stringify({ 
        processed: processedCount,
        errors: errorCount,
        currentTime,
        currentDay
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in process-scheduled-notifications:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
