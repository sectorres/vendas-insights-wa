import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const MonthlySentCard = () => {
  const [sentCount, setSentCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMonthlySent();
  }, []);

  const fetchMonthlySent = async () => {
    try {
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const { count, error } = await supabase
        .from("notification_history")
        .select("*", { count: "exact", head: true })
        .eq("status", "sent")
        .gte("sent_at", firstDayOfMonth.toISOString())
        .lte("sent_at", lastDayOfMonth.toISOString());

      if (error) throw error;
      setSentCount(count || 0);
    } catch (error) {
      console.error("Error fetching monthly sent notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center">
          <Calendar className="h-6 w-6 text-accent" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Enviadas Este Mês</p>
          <p className="text-2xl font-bold text-foreground">
            {loading ? "..." : sentCount}
          </p>
        </div>
      </div>
    </Card>
  );
};
