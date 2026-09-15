import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { applyBotFilter } from "@/lib/admin-analytics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Facebook, Instagram, Music, Youtube, Users, TrendingUp, ShoppingCart, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PlatformMetrics {
  platform: string;
  visits: number;
  signups: number;
  subscriptions: number;
  purchases: number;
  totalRevenue: number;
  conversionRate: number;
  workoutViews: number;
  programViews: number;
}

interface TimeSeriesData {
  date: string;
  visits: number;
  conversions: number;
}

export const SocialMediaAnalytics = () => {
  const [platformMetrics, setPlatformMetrics] = useState<PlatformMetrics[]>([]);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const { toast } = useToast();

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);

      // Calculate date range
      const daysAgo = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);

      // Fetch all analytics data — exclude preview/bot traffic so the totals
      // match the Website tab and the dashboard overview card.
      // IMPORTANT: the API caps a single response at 1000 rows, so we page
      // through the whole window. Without this the totals were silently
      // truncated to the first 1000 records.
      const PAGE_SIZE = 1000;
      const data: any[] = [];
      for (let page = 0; ; page++) {
        let query = supabase
          .from('social_media_analytics')
          .select('*')
          .gte('created_at', startDate.toISOString())
          .order('created_at', { ascending: true })
          .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
        query = applyBotFilter(query as any) as typeof query;
        const { data: rows, error } = await query;
        if (error) throw error;
        if (!rows?.length) break;
        data.push(...rows);
        if (rows.length < PAGE_SIZE) break;
        if (page > 200) break; // hard safety stop
      }

      // Process platform metrics
      const platformStats: { [key: string]: PlatformMetrics } = {};
      
      data?.forEach((record) => {
        const platform = record.referral_source;
        
        if (!platformStats[platform]) {
          platformStats[platform] = {
            platform,
            visits: 0,
            signups: 0,
            subscriptions: 0,
            purchases: 0,
            totalRevenue: 0,
            conversionRate: 0,
            workoutViews: 0,
            programViews: 0,
          };
        }

        switch (record.event_type) {
          case 'visit':
            platformStats[platform].visits++;
            break;
          case 'signup':
            platformStats[platform].signups++;
            break;
          case 'subscription_purchase':
            platformStats[platform].subscriptions++;
            platformStats[platform].totalRevenue += Number(record.event_value || 0);
            break;
          case 'standalone_purchase':
            platformStats[platform].purchases++;
            platformStats[platform].totalRevenue += Number(record.event_value || 0);
            break;
          case 'workout_view':
            platformStats[platform].workoutViews++;
            break;
          case 'program_view':
            platformStats[platform].programViews++;
            break;
        }
      });

      // Calculate conversion rates
      Object.values(platformStats).forEach((stats) => {
        const totalConversions = stats.signups + stats.subscriptions + stats.purchases;
        stats.conversionRate = stats.visits > 0 
          ? (totalConversions / stats.visits) * 100 
          : 0;
      });

      setPlatformMetrics(Object.values(platformStats).sort((a, b) => b.visits - a.visits));

      // Process time series data
      const dailyStats: { [key: string]: TimeSeriesData } = {};
      data?.forEach((record) => {
        const date = new Date(record.created_at).toLocaleDateString();
        
        if (!dailyStats[date]) {
          dailyStats[date] = { date, visits: 0, conversions: 0 };
        }

        if (record.event_type === 'visit') {
          dailyStats[date].visits++;
        } else if (['signup', 'subscription_purchase', 'standalone_purchase'].includes(record.event_type)) {
          dailyStats[date].conversions++;
        }
      });

      setTimeSeriesData(Object.values(dailyStats));

    } catch (error: any) {
      console.error('Error fetching social media analytics:', error);
      toast({
        title: "Error",
        description: "Failed to load social media analytics",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'facebook':
        return <Facebook className="h-5 w-5 text-blue-600" />;
      case 'instagram':
        return <Instagram className="h-5 w-5 text-pink-600" />;
      case 'tiktok':
        return <Music className="h-5 w-5 text-black dark:text-white" />;
      case 'youtube':
        return <Youtube className="h-5 w-5 text-red-600" />;
      default:
        return <Users className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const totalMetrics = platformMetrics.reduce(
    (acc, curr) => ({
      visits: acc.visits + curr.visits,
      signups: acc.signups + curr.signups,
      revenue: acc.revenue + curr.totalRevenue,
      conversions: acc.conversions + curr.signups + curr.subscriptions + curr.purchases,
    }),
    { visits: 0, signups: 0, revenue: 0, conversions: 0 }
  );

  const overallConversionRate = totalMetrics.visits > 0 
    ? ((totalMetrics.conversions / totalMetrics.visits) * 100).toFixed(2)
    : '0.00';

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Social Media Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Social Media Analytics Overview
          </CardTitle>
          <CardDescription>
            Track referral traffic, engagement, and conversions from social media platforms
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as any)}>
            <TabsList>
              <TabsTrigger value="7d">Last 7 Days</TabsTrigger>
              <TabsTrigger value="30d">Last 30 Days</TabsTrigger>
              <TabsTrigger value="90d">Last 90 Days</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Overall Stats */}
          <div className="grid gap-4 md:grid-cols-4 mt-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Visits
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalMetrics.visits.toLocaleString()}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Signups
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalMetrics.signups.toLocaleString()}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Revenue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${totalMetrics.revenue.toFixed(2)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Conversion Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overallConversionRate}%</div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Platform Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Platform Performance</CardTitle>
          <CardDescription>Detailed metrics by social media platform</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {platformMetrics.map((platform) => (
              <Card key={platform.platform}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getPlatformIcon(platform.platform)}
                      <div>
                        <CardTitle className="text-base capitalize">{platform.platform}</CardTitle>
                        <CardDescription className="text-sm">
                          {platform.visits} visits • {platform.conversionRate.toFixed(2)}% conversion
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant={platform.platform === 'direct' ? 'secondary' : 'default'}>
                      ${platform.totalRevenue.toFixed(2)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Signups</div>
                      <div className="font-semibold text-lg">{platform.signups}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Subscriptions</div>
                      <div className="font-semibold text-lg">{platform.subscriptions}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Purchases</div>
                      <div className="font-semibold text-lg flex items-center gap-1">
                        <ShoppingCart className="h-4 w-4" />
                        {platform.purchases}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Workout Views</div>
                      <div className="font-semibold text-lg flex items-center gap-1">
                        <Eye className="h-4 w-4" />
                        {platform.workoutViews}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Program Views</div>
                      <div className="font-semibold text-lg flex items-center gap-1">
                        <Eye className="h-4 w-4" />
                        {platform.programViews}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Revenue</div>
                      <div className="font-semibold text-lg text-green-600 dark:text-green-400">
                        ${platform.totalRevenue.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {platformMetrics.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No social media analytics data available for this time period.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Daily Trend */}
      {timeSeriesData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Daily Trend</CardTitle>
            <CardDescription>Visits and conversions over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {timeSeriesData.slice(-14).map((day) => (
                <div key={day.date} className="flex items-center gap-4">
                  <div className="w-24 text-sm text-muted-foreground">{day.date}</div>
                  <div className="flex-1">
                    <div className="flex gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        <div className="text-sm">Visits: {day.visits}</div>
                        <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                          <div 
                            className="bg-blue-500 h-full"
                            style={{ width: `${Math.min((day.visits / Math.max(...timeSeriesData.map(d => d.visits))) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-1">
                        <div className="text-sm">Conversions: {day.conversions}</div>
                        <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                          <div 
                            className="bg-green-500 h-full"
                            style={{ width: `${Math.min((day.conversions / Math.max(...timeSeriesData.map(d => d.conversions))) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
