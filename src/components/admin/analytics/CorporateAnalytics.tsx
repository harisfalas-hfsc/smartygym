import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Building2, Users, DollarSign, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { ChartFilterBar } from "./ChartFilterBar";
import html2canvas from "html2canvas";

interface PlanTierData {
  plan: string;
  count: number;
  revenue: number;
  paidRevenue: number;
  members: number;
  maxMembers: number;
  utilization: number;
}

interface CorporateSubscription {
  id: string;
  organization_name: string;
  plan_type: string;
  status: string;
  max_users: number;
  current_users_count: number;
  current_period_end: string;
  created_at: string;
  stripe_subscription_id: string | null;
}

export function CorporateAnalytics() {
  const [timeFilter, setTimeFilter] = useState("all");
  const [customStartDate, setCustomStartDate] = useState<Date>();
  const [customEndDate, setCustomEndDate] = useState<Date>();
  const [revenueFilter, setRevenueFilter] = useState<string>("paid");
  const [loading, setLoading] = useState(true);
  const [totalCorporateSubs, setTotalCorporateSubs] = useState(0);
  const [activeCorporateSubs, setActiveCorporateSubs] = useState(0);
  const [totalCorporateRevenue, setTotalCorporateRevenue] = useState(0);
  const [paidCorporateRevenue, setPaidCorporateRevenue] = useState(0);
  const [totalCorporateMembers, setTotalCorporateMembers] = useState(0);
  const [avgUtilization, setAvgUtilization] = useState(0);
  const [planTierData, setPlanTierData] = useState<PlanTierData[]>([]);
  const [recentSubscriptions, setRecentSubscriptions] = useState<CorporateSubscription[]>([]);
  const [monthlyTrends, setMonthlyTrends] = useState<any[]>([]);
  const chartRef = useRef<HTMLDivElement>(null);

  const PLAN_PRICES: { [key: string]: number } = {
    dynamic: 699,
    power: 799,
    elite: 899,
    enterprise: 999
  };

  const PLAN_MAX_USERS: { [key: string]: number } = {
    dynamic: 10,
    power: 20,
    elite: 30,
    enterprise: 100
  };

  useEffect(() => {
    fetchCorporateAnalytics();
  }, [timeFilter, customStartDate, customEndDate, revenueFilter]);

  const getDateRange = () => {
    const endDate = new Date();
    let startDate: Date | null = null;

    if (timeFilter === "custom" && customStartDate && customEndDate) {
      return { startDate: customStartDate, endDate: customEndDate };
    }

    if (timeFilter !== "all") {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(timeFilter));
    }

    return { startDate, endDate };
  };

  const fetchCorporateAnalytics = async () => {
    try {
      setLoading(true);
      const { startDate, endDate } = getDateRange();

      // Fetch corporate subscriptions.
      // Use ACTIVE-OVERLAP semantics for date filtering: include any sub that
      // was created on/before endDate AND is still active inside the window
      // (current_period_end is null or >= startDate). Filtering only by
      // created_at undercounts active recurring revenue.
      let query = supabase.from("corporate_subscriptions").select("*");

      if (startDate) {
        query = query
          .lte("created_at", endDate.toISOString())
          .or(`current_period_end.is.null,current_period_end.gte.${startDate.toISOString()}`);
      }

      const { data: subscriptions, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;

      setTotalCorporateSubs(subscriptions?.length || 0);
      
      const activeCount = subscriptions?.filter(s => s.status === "active").length || 0;
      setActiveCorporateSubs(activeCount);
      
      setRecentSubscriptions((subscriptions || []).slice(0, 10) as CorporateSubscription[]);

      // Calculate revenue and plan breakdown
      // Filter for PAID subscriptions only (has stripe_subscription_id)
      const planStats: { [key: string]: PlanTierData } = {};
      let totalRevenue = 0;
      let paidRevenue = 0;
      let totalMembers = 0;
      let totalMaxMembers = 0;

      subscriptions?.forEach(sub => {
        const plan = sub.plan_type;
        const isPaid = !!sub.stripe_subscription_id;
        
        if (!planStats[plan]) {
          planStats[plan] = {
            plan: plan.charAt(0).toUpperCase() + plan.slice(1),
            count: 0,
            revenue: 0,
            paidRevenue: 0,
            members: 0,
            maxMembers: 0,
            utilization: 0
          };
        }
        
        planStats[plan].count++;
        
        if (sub.status === "active") {
          const planPrice = PLAN_PRICES[plan] || 0;
          planStats[plan].revenue += planPrice;
          totalRevenue += planPrice;
          
          // Only count as paid revenue if has Stripe subscription
          if (isPaid) {
            planStats[plan].paidRevenue += planPrice;
            paidRevenue += planPrice;
          }
        }
        
        planStats[plan].members += sub.current_users_count || 0;
        planStats[plan].maxMembers += sub.max_users || PLAN_MAX_USERS[plan] || 10;
        
        totalMembers += sub.current_users_count || 0;
        totalMaxMembers += sub.max_users || PLAN_MAX_USERS[plan] || 10;
      });

      // Calculate utilization per plan
      Object.values(planStats).forEach(stats => {
        stats.utilization = stats.maxMembers > 0 
          ? Math.round((stats.members / stats.maxMembers) * 100) 
          : 0;
      });

      setTotalCorporateRevenue(totalRevenue);
      setPaidCorporateRevenue(paidRevenue);
      setTotalCorporateMembers(totalMembers);
      setAvgUtilization(totalMaxMembers > 0 ? Math.round((totalMembers / totalMaxMembers) * 100) : 0);
      setPlanTierData(Object.values(planStats).sort((a, b) => b.count - a.count));

      // Calculate monthly trends for line chart
      const monthlyStats: { [key: string]: { [plan: string]: number } } = {};
      subscriptions?.forEach(sub => {
        const month = new Date(sub.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short" });
        const plan = sub.plan_type;
        const isPaid = !!sub.stripe_subscription_id;
        
        if (!monthlyStats[month]) {
          monthlyStats[month] = {};
        }
        
        if (sub.status === "active") {
          // Based on filter, show paid or all revenue
          if (revenueFilter === "all" || isPaid) {
            monthlyStats[month][plan] = (monthlyStats[month][plan] || 0) + (PLAN_PRICES[plan] || 0);
          }
        }
      });

      const trendsData = Object.entries(monthlyStats)
        .map(([month, plans]) => ({
          month,
          Dynamic: plans.dynamic || 0,
          Power: plans.power || 0,
          Elite: plans.elite || 0,
          Enterprise: plans.enterprise || 0,
        }))
        .slice(-6);

      setMonthlyTrends(trendsData);

    } catch (error) {
      console.error("Error fetching corporate analytics:", error);
      toast.error("Failed to load corporate analytics");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!chartRef.current) return;
    try {
      const canvas = await html2canvas(chartRef.current, { backgroundColor: "#ffffff", scale: 2 });
      const link = document.createElement("a");
      link.download = `corporate-analytics-${new Date().toISOString().split("T")[0]}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("Chart exported!");
    } catch (error) {
      toast.error("Failed to export chart");
    }
  };

  const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active": return <Badge className="bg-green-500 text-white">Active</Badge>;
      case "expired": return <Badge variant="destructive">Expired</Badge>;
      case "cancelled": return <Badge variant="secondary">Cancelled</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-lg">Loading corporate analytics...</div>
      </div>
    );
  }

  const displayRevenue = revenueFilter === "paid" ? paidCorporateRevenue : totalCorporateRevenue;
  const displayRevenueData = planTierData.map(d => ({
    ...d,
    displayRevenue: revenueFilter === "paid" ? d.paidRevenue : d.revenue
  }));

  return (
    <div className="space-y-6" ref={chartRef}>
      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Corporate Subs</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCorporateSubs}</div>
            <p className="text-xs text-muted-foreground">All organizations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Corporate</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeCorporateSubs}</div>
            <p className="text-xs text-muted-foreground">Currently active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {revenueFilter === "paid" ? "Paid Revenue" : "Total Revenue"}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{displayRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {revenueFilter === "paid" ? "Stripe verified" : "Including complimentary"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Corporate Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCorporateMembers}</div>
            <p className="text-xs text-muted-foreground">Users under corporate</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Utilization</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgUtilization}%</div>
            <p className="text-xs text-muted-foreground">Seats filled</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Trends Line Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Corporate Revenue Trends</CardTitle>
          <CardDescription>Monthly revenue by plan tier</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartFilterBar
            timeFilter={timeFilter}
            onTimeFilterChange={setTimeFilter}
            customStartDate={customStartDate}
            onStartDateChange={setCustomStartDate}
            customEndDate={customEndDate}
            onEndDateChange={setCustomEndDate}
            onExport={handleExport}
            additionalFilters={
              <Select value={revenueFilter} onValueChange={setRevenueFilter}>
                <SelectTrigger className="w-[130px] h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">Paid Only</SelectItem>
                  <SelectItem value="all">All Revenue</SelectItem>
                </SelectContent>
              </Select>
            }
          />
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthlyTrends}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `€${v}`} />
              <Tooltip 
                formatter={(value) => `€${value}`}
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
              />
              <Legend />
              <Line type="monotone" dataKey="Dynamic" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Power" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Elite" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Enterprise" stroke="hsl(var(--chart-4))" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>

          {/* Detailed breakdown */}
          <div className="mt-3 space-y-1 border-t pt-3">
            {displayRevenueData.map((tier, idx) => (
              <div key={idx} className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">{tier.plan}</span>
                <div className="flex items-center gap-4">
                  <span>{tier.count} subs</span>
                  <span className="font-medium">€{tier.displayRevenue.toLocaleString()}</span>
                </div>
              </div>
            ))}
            <div className="flex justify-between items-center text-xs font-bold border-t pt-2">
              <span>Total</span>
              <span>€{displayRevenue.toLocaleString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Plan Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Plan Distribution</CardTitle>
            <CardDescription>Subscriptions by plan type</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={planTierData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="hsl(var(--primary))"
                  dataKey="count"
                  label={({ plan, count }) => `${plan}: ${count}`}
                  labelLine={{ strokeWidth: 1 }}
                >
                  {planTierData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              </PieChart>
            </ResponsiveContainer>

            <div className="mt-3 space-y-1 border-t pt-3">
              {planTierData.map((tier, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">{tier.plan}</span>
                  <div className="flex items-center gap-3">
                    <span>{tier.members}/{tier.maxMembers} members</span>
                    <span className={`font-medium ${tier.utilization > 75 ? "text-green-600" : ""}`}>
                      {tier.utilization}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Utilization Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Seat Utilization by Plan</CardTitle>
            <CardDescription>How many seats are filled per plan</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={planTierData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="plan" width={80} tick={{ fontSize: 11 }} />
                <Tooltip 
                  formatter={(value) => `${value}%`}
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                />
                <Line type="monotone" dataKey="utilization" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Corporate Subscriptions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Recent Corporate Subscriptions</CardTitle>
          <CardDescription>Latest organizations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 font-medium">Organization</th>
                  <th className="text-left py-2 px-2 font-medium">Plan</th>
                  <th className="text-center py-2 px-2 font-medium">Members</th>
                  <th className="text-center py-2 px-2 font-medium">Status</th>
                  <th className="text-center py-2 px-2 font-medium">Payment</th>
                  <th className="text-right py-2 px-2 font-medium">Expires</th>
                </tr>
              </thead>
              <tbody>
                {recentSubscriptions.map((sub) => (
                  <tr key={sub.id} className="border-b last:border-0">
                    <td className="py-2 px-2 font-medium">{sub.organization_name}</td>
                    <td className="py-2 px-2 capitalize">{sub.plan_type}</td>
                    <td className="text-center py-2 px-2">
                      {sub.current_users_count}/{sub.max_users}
                    </td>
                    <td className="text-center py-2 px-2">{getStatusBadge(sub.status)}</td>
                    <td className="text-center py-2 px-2">
                      {sub.stripe_subscription_id ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Paid</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Free</Badge>
                      )}
                    </td>
                    <td className="text-right py-2 px-2 text-xs text-muted-foreground">
                      {new Date(sub.current_period_end).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {recentSubscriptions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      No corporate subscriptions yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
