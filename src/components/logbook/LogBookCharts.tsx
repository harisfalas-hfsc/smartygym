import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useActivityLog } from "@/hooks/useActivityLog";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useIsMobile } from "@/hooks/use-mobile";

interface LogBookChartsProps {
  userId: string;
  filter: string;
}

export const LogBookCharts = ({ userId, filter }: LogBookChartsProps) => {
  const { activities, isLoading } = useActivityLog(userId, filter === 'all' ? undefined : filter);
  const isMobile = useIsMobile();

  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-6 bg-muted rounded w-32" />
          </CardHeader>
          <CardContent>
            <div className="h-64 bg-muted rounded" />
          </CardContent>
        </Card>
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-6 bg-muted rounded w-32" />
          </CardHeader>
          <CardContent>
            <div className="h-64 bg-muted rounded" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Prepare data for pie chart - activity distribution
  const activityCounts = activities.reduce((acc, activity) => {
    const type = activity.content_type;
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(activityCounts).map(([name, value]) => ({
    name: name.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
    value,
  }));

  const COLORS = {
    'Workout': '#10B981',
    'Program': '#3B82F6',
    'Tool': '#A855F7',
    'Measurement': '#F97316',
    'Checkin': '#14B8A6',
  };

  // Prepare data for bar chart - weekly activity count
  const getWeekNumber = (date: Date) => {
    const firstDay = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor((date.getTime() - firstDay.getTime()) / (24 * 60 * 60 * 1000));
    return Math.ceil((days + firstDay.getDay() + 1) / 7);
  };

  const weeklyData = activities.reduce((acc, activity) => {
    const date = new Date(activity.activity_date);
    const week = getWeekNumber(date);
    const key = `Week ${week}`;
    
    if (!acc[key]) {
      acc[key] = { name: key, count: 0 };
    }
    acc[key].count++;
    return acc;
  }, {} as Record<string, { name: string; count: number }>);

  const barData = Object.values(weeklyData).slice(-12); // Last 12 weeks

  // Calculate total for percentages
  const total = pieData.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Pie Chart - Activity Distribution */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Activity Distribution</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {pieData.length > 0 ? (
            <div className="flex flex-col">
              <ResponsiveContainer width="100%" height={isMobile ? 180 : 220}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={isMobile ? 60 : 80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[entry.name as keyof typeof COLORS] || '#9CA3AF'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--card-foreground))' }} />
                </PieChart>
              </ResponsiveContainer>
              
              {/* Legend - Scrollable list below chart */}
              <ScrollArea className="h-[100px] mt-3 border rounded-md p-2">
                <div className="space-y-1">
                  {pieData.map((entry, index) => {
                    const percent = total > 0 ? ((entry.value / total) * 100).toFixed(0) : 0;
                    return (
                      <div key={index} className="flex items-center gap-2 text-xs py-1">
                        <div 
                          className="w-3 h-3 rounded-sm flex-shrink-0" 
                          style={{ backgroundColor: COLORS[entry.name as keyof typeof COLORS] || '#9CA3AF' }}
                        />
                        <span className="truncate flex-1">{entry.name}</span>
                        <span className="text-muted-foreground flex-shrink-0">{percent}%</span>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No data to display
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bar Chart - Weekly Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly Activity</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={isMobile ? 280 : 300}>
              <BarChart data={barData} margin={{ top: 5, right: 10, left: -10, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 10 }}
                  angle={-45}
                  textAnchor="end"
                  height={50}
                />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--card-foreground))' }} />
                <Bar dataKey="count" fill="hsl(var(--primary))" name="Activities" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No data to display
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
