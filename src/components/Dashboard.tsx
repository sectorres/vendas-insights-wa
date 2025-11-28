import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, Calendar, Activity, Smartphone } from "lucide-react";
import { NotificationScheduleForm } from "./NotificationScheduleForm";
import { NotificationScheduleList } from "./NotificationScheduleList";
import { InsightsPreview } from "./InsightsPreview";
import { DailySalesCard } from "./DailySalesCard";
import { Link } from "react-router-dom";

export const Dashboard = () => {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
                <Bell className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">NotifyHub</h1>
                <p className="text-sm text-muted-foreground">Sistema de Notificações WhatsApp</p>
              </div>
            </div>
            <Link to="/evolution-setup">
              <Button variant="outline" size="sm">
                <Smartphone className="h-4 w-4 mr-2" />
                Conectar WhatsApp
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="grid gap-6 md:grid-cols-3 mb-8">
          <DailySalesCard />

          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-success/10 flex items-center justify-center">
                <Activity className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Notificações Ativas</p>
                <p className="text-2xl font-bold text-foreground">0</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Enviadas Este Mês</p>
                <p className="text-2xl font-bold text-foreground">0</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-6">
            <NotificationScheduleForm onSuccess={() => setRefreshKey(prev => prev + 1)} />
            <InsightsPreview />
          </div>
          
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-4">Notificações Agendadas</h2>
            <NotificationScheduleList refresh={refreshKey} />
          </div>
        </div>
      </main>
    </div>
  );
};