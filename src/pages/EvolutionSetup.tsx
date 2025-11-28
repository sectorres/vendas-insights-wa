import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { QrCode, RefreshCw, CheckCircle, XCircle, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const EvolutionSetup = () => {
  const { toast } = useToast();
  const [instanceName, setInstanceName] = useState("notifyhub");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("disconnected");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(() => {
      if (qrCode) {
        checkStatus();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [qrCode]);

  const getQRCode = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("evolution-get-qrcode", {
        body: { instanceName }
      });

      if (error) throw error;

      if (data.qrcode) {
        setQrCode(data.qrcode);
        setStatus(data.status);
        toast({
          title: "QR Code Gerado",
          description: "Escaneie o código com seu WhatsApp",
        });
      } else {
        toast({
          title: "Instância já conectada",
          description: "Seu WhatsApp já está conectado!",
        });
        setStatus("connected");
      }
    } catch (error) {
      console.error("Error getting QR code:", error);
      toast({
        title: "Erro",
        description: "Falha ao gerar QR code. Verifique as credenciais da Evolution API.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const checkStatus = async () => {
    if (!instanceName) return;
    
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("evolution-check-status", {
        body: { instanceName }
      });

      if (error) throw error;

      setStatus(data.connected ? "connected" : "disconnected");
      
      if (data.connected && qrCode) {
        setQrCode(null);
        toast({
          title: "Conectado!",
          description: "WhatsApp conectado com sucesso",
        });
      }
    } catch (error) {
      console.error("Error checking status:", error);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Configurar WhatsApp</h1>
              <p className="text-sm text-muted-foreground">Evolution API</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 max-w-2xl">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-foreground">Status da Conexão</h2>
            <Badge variant={status === "connected" ? "default" : "secondary"}>
              {status === "connected" ? (
                <><CheckCircle className="h-4 w-4 mr-1" /> Conectado</>
              ) : (
                <><XCircle className="h-4 w-4 mr-1" /> Desconectado</>
              )}
            </Badge>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="instanceName">Nome da Instância</Label>
              <Input
                id="instanceName"
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
                placeholder="notifyhub"
                disabled={status === "connected"}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use o mesmo nome sempre para manter a conexão
              </p>
            </div>

            {status !== "connected" && (
              <Button 
                onClick={getQRCode} 
                disabled={loading || !instanceName}
                className="w-full"
              >
                <QrCode className="h-4 w-4 mr-2" />
                {loading ? "Gerando..." : "Gerar QR Code"}
              </Button>
            )}

            {status === "connected" && (
              <Button 
                onClick={checkStatus} 
                disabled={checking}
                variant="outline"
                className="w-full"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${checking ? "animate-spin" : ""}`} />
                Verificar Status
              </Button>
            )}

            {qrCode && (
              <div className="mt-6 p-6 bg-muted rounded-lg">
                <h3 className="text-center font-semibold mb-4">
                  Escaneie com WhatsApp
                </h3>
                <div className="flex justify-center mb-4">
                  <img 
                    src={qrCode} 
                    alt="QR Code WhatsApp" 
                    className="max-w-[300px] w-full border border-border rounded-lg"
                  />
                </div>
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>1. Abra o WhatsApp no seu celular</p>
                  <p>2. Toque em Menu (⋮) → Aparelhos conectados</p>
                  <p>3. Toque em Conectar um aparelho</p>
                  <p>4. Aponte a câmera para este código</p>
                </div>
              </div>
            )}

            {status === "connected" && (
              <div className="mt-6 p-4 bg-success/10 rounded-lg text-center">
                <CheckCircle className="h-12 w-12 mx-auto mb-2 text-success" />
                <p className="font-semibold text-foreground">WhatsApp Conectado!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Você já pode enviar notificações
                </p>
              </div>
            )}
          </div>
        </Card>

        <div className="mt-6 text-center">
          <Link to="/">
            <Button variant="ghost">
              Voltar para o Dashboard
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
};

export default EvolutionSetup;