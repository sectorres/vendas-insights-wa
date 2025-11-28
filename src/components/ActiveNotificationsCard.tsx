import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const ActiveNotificationsCard = () => {
  const [activeCount, setActiveCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActiveNotifications();
  }, []);

  const fetchActiveNotifications = async () => {
    try {
      const { count, error } = await supabase
        .from("notification_schedules")
        .select("*", { count: "exact", head: true })
        .eq("active", true);

      if (error) throw error;
      setActiveCount(count || 0);
    } catch (error) {
      console.error("Error fetching active notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-lg bg-success/10 flex items-center justify-center">
          <Activity className="h-6 w-6 text-success" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Notificações Ativas</p>
          <p className="text-2xl font-bold text-foreground">
            {loading ? "..." : activeCount}
          </p>
        </div>
      </div>
    </Card>
  );
};
