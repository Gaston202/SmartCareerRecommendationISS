"use client";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useDashboardStats } from "@/hooks/use-api";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { Activity, TrendingUp, Users, Target } from "lucide-react";

export default function AnalyticsPage() {
  const { data: stats, isLoading, error } = useDashboardStats();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold text-[#1F2937]">Analytics</h1><p className="mt-1 text-sm text-[#6B7280]">Detailed insights and metrics</p></div>
        <LoadingState message="Loading analytics..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold text-[#1F2937]">Analytics</h1><p className="mt-1 text-sm text-[#6B7280]">Detailed insights and metrics</p></div>
        <div className="rounded-2xl bg-[#F8F8FA]/95 p-8 text-center shadow-[0_2px_12px_-2px_rgba(0,0,0,0.08)]">
          <p className="font-medium text-[#DC2626]">Error loading analytics. Please try again.</p>
        </div>
      </div>
    );
  }

  const userActivityData = stats?.userGrowth?.map((item: { month: string; users: number }) => ({
    month: item.month,
    active: item.users,
    new: Math.floor(item.users * 0.3),
  })) || [];

  const skillDistribution = [
    { name: "Programming", value: 450 },
    { name: "Design", value: 280 },
    { name: "Business", value: 320 },
    { name: "Analytics", value: 240 },
    { name: "Marketing", value: 180 },
  ];

  const careerRecommendationsData = stats?.careerRecommendationsByCategory || [];

  const CHART_COLORS = ["#8B5CF6", "#A78BFA", "#2DD4BF", "#38BDF8", "#FBBF24"];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#1F2937]">Analytics</h1>
        <p className="mt-1 text-sm text-[#6B7280]">Detailed insights and metrics</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Interactions" value="48,652" icon={Activity} trend={{ value: 24, isPositive: true }} description="last month" accentColor="violet" />
        <StatCard title="Engagement Rate" value="68%" icon={TrendingUp} trend={{ value: 5, isPositive: true }} description="avg 12m" accentColor="teal" />
        <StatCard title="Active Users" value={stats?.activeUsers || 0} icon={Users} description="last 30 days" accentColor="blue" />
        <StatCard title="Success Rate" value="82%" icon={Target} trend={{ value: 3, isPositive: true }} description="match accuracy" accentColor="orange" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl bg-[#F8F8FA]/95 p-6 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.08)]">
          <h2 className="text-base font-semibold text-[#1F2937]">User activity</h2>
          <div className="mt-4 h-[280px]">
            {userActivityData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={userActivityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                  <XAxis dataKey="month" stroke="#6B7280" fontSize={11} tickLine={false} />
                  <YAxis stroke="#6B7280" fontSize={11} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: "#F8F8FA", border: "none", borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} />
                  <Legend />
                  <Line type="monotone" dataKey="active" stroke="#8B5CF6" strokeWidth={2} dot={{ fill: "#A78BFA" }} name="Active" />
                  <Line type="monotone" dataKey="new" stroke="#2DD4BF" strokeWidth={2} dot={{ fill: "#5EEAD4" }} name="New" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-[#6B7280]">No data</div>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-[#F8F8FA]/95 p-6 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.08)]">
          <h2 className="text-base font-semibold text-[#1F2937]">Skill distribution</h2>
          <div className="mt-4 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={skillDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => entry.name}
                  outerRadius={90}
                  dataKey="value"
                >
                  {skillDistribution.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: "#F8F8FA", border: "none", borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="md:col-span-2 rounded-2xl bg-[#F8F8FA]/95 p-6 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.08)]">
          <h2 className="text-base font-semibold text-[#1F2937]">Careers by category</h2>
          <div className="mt-4 h-[280px]">
            {careerRecommendationsData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={careerRecommendationsData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                  <XAxis dataKey="category" stroke="#6B7280" fontSize={11} tickLine={false} />
                  <YAxis stroke="#6B7280" fontSize={11} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: "#F8F8FA", border: "none", borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} />
                  <Bar dataKey="count" radius={[8, 8, 0, 0]} name="Recommendations">
                    {careerRecommendationsData.map((_: unknown, i: number) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-[#6B7280]">No data</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
