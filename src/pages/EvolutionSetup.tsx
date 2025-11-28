import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { QrCode, RefreshCw, CheckCircle, XCircle, ArrowLeft, Save, Settings } from "lucide-react";
import { Link } from "react-router-dom";

interface EvolutionSettings {
  api_url: string;
  api_key: string;
  instance_name: string;
}

const EvolutionSetup = () => {
  const { toast } = useToast();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("disconnected");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  
  const [settings, setSettings] = useState<EvolutionSettings>({
    api_url: "",
    api_key: "",
    instance_name: "notifyhub",
  });

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (qrCode) {
      const interval = setInterval(() => {
        checkStatus();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [qrCode]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("evolution_settings")
        .select("*")
        .single();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        setSettings({
          api_url: data.api_url,
          api_key: data.api_key,
          instance_name: data.instance_name,
        });
        setShowSettings(false);
      } else {
        setShowSettings(true);
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    } finally {
      setLoadingSettings(false);
    }
  };

  const saveSettings = async () => {
    if (!settings.api_url || !settings.api_key || !settings.instance_name) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos",
        variant: "destructive",
      });
      return;
    }

    setSavingSettings(true);
    try {
      const { data: existing } = await supabase
        .from("evolution_settings")
        .select("*")
        .single();

      if (existing) {
        const { error } = await supabase
          .from("evolution_settings")
          .update(settings)
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("evolution_settings")
          .insert(settings);

        if (error) throw error;
      }

      toast({
        title: "Configurações Salvas",
        description: "As configurações da Evolution API foram salvas com sucesso",
      });
      setShowSettings(false);
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Erro",
        description: "Falha ao salvar configurações",
        variant: "destructive",
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const getQRCode = async () => {
    if (!settings.api_url || !settings.api_key) {
      toast({
        title: "Erro",
        description: "Configure a Evolution API primeiro",
        variant: "destructive",
      });
      setShowSettings(true);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("evolution-get-qrcode", {
        body: { instanceName: settings.instance_name }
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
        description: "Falha ao gerar QR code. Verifique as configurações da Evolution API.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const checkStatus = async () => {
    if (!settings.instance_name || !settings.api_url) return;
    
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("evolution-check-status", {
        body: { instanceName: settings.instance_name }
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

  if (loadingSettings) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

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
        {showSettings ? (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-foreground">Configurações da Evolution API</h2>
              <Settings className="h-5 w-5 text-muted-foreground" />
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="apiUrl">URL da API Evolution</Label>
                <Input
                  id="apiUrl"
                  value={settings.api_url}
                  onChange={(e) => setSettings({ ...settings, api_url: e.target.value })}
                  placeholder="https://sua-api.evolution.com"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  URL completa da sua Evolution API (sem barra no final)
                </p>
              </div>

              <div>
                <Label htmlFor="apiKey">API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  value={settings.api_key}
                  onChange={(e) => setSettings({ ...settings, api_key: e.target.value })}
                  placeholder="sua-api-key"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Chave de API da Evolution
                </p>
              </div>

              <div>
                <Label htmlFor="instanceName">Nome da Instância</Label>
                <Input
                  id="instanceName"
                  value={settings.instance_name}
                  onChange={(e) => setSettings({ ...settings, instance_name: e.target.value })}
                  placeholder="notifyhub"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use o mesmo nome sempre para manter a conexão
                </p>
              </div>

              <Button onClick={saveSettings} disabled={savingSettings} className="w-full">
                <Save className="h-4 w-4 mr-2" />
                {savingSettings ? "Salvando..." : "Salvar Configurações"}
              </Button>
            </div>
          </Card>
        ) : (
          <>
            <Card className="p-6 mb-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-foreground">Status da Conexão</h2>
                <div className="flex items-center gap-2">
                  <Badge variant={status === "connected" ? "default" : "secondary"}>
                    {status === "connected" ? (
                      <><CheckCircle className="h-4 w-4 mr-1" /> Conectado</>
                    ) : (
                      <><XCircle className="h-4 w-4 mr-1" /> Desconectado</>
                    )}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowSettings(true)}
                    title="Editar configurações"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Instância</p>
                  <p className="font-medium text-foreground">{settings.instance_name}</p>
                </div>

                {status !== "connected" && (
                  <Button 
                    onClick={getQRCode} 
                    disabled={loading}
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
              </div>
            </Card>

            {qrCode && (
              <Card className="p-6">
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
              </Card>
            )}

            {status === "connected" && (
              <Card className="p-6 mt-6">
                <div className="text-center">
                  <CheckCircle className="h-12 w-12 mx-auto mb-2 text-success" />
                  <p className="font-semibold text-foreground">WhatsApp Conectado!</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Você já pode enviar notificações
                  </p>
                </div>
              </Card>
            )}
          </>
        )}

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