"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useDashboardStats } from "@/hooks/use-api";
import { StatCard } from "@/components/ui/stat-card";
import { LoadingState } from "@/components/ui/loading-state";
import { Users, UserCheck, Target, TrendingUp, Briefcase, BookOpen, Award } from "lucide-react";

const CHART_COLORS = ["#8B5CF6", "#A78BFA", "#2DD4BF", "#38BDF8", "#FBBF24"];

export default function DashboardPage() {
  const { data: stats, isLoading, error } = useDashboardStats();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-20 w-64 rounded-2xl bg-[#F8F8FA]/80 animate-pulse" />
        <div className="rounded-2xl bg-[#F8F8FA]/90 p-16 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.08)]">
          <LoadingState message="Loading..." />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-[#1F2937]">Dashboard</h1>
        <div className="rounded-2xl bg-[#F8F8FA]/95 p-8 text-center shadow-[0_2px_12px_-2px_rgba(0,0,0,0.08)]">
          <p className="text-[#DC2626] font-medium">Failed to load dashboard data.</p>
        </div>
      </div>
    );
  }

  const userGrowthData = stats?.userGrowth || [];
  const careerByCategoryData = stats?.careerRecommendationsByCategory || [];
  const recommendationStatus = stats?.recommendationStatus || [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#1F2937] sm:text-3xl">Dashboard</h1>
        <p className="mt-1 text-sm text-[#6B7280]">Overview of your Smart Career platform</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Users" value={stats?.totalUsers ?? 0} description="Registered" icon={Users} accentColor="violet" />
        <StatCard title="Active Users" value={stats?.activeUsers ?? 0} description="Active" icon={UserCheck} accentColor="teal" />
        <StatCard title="Recommendations" value={stats?.totalRecommendations ?? 0} description="Generated" icon={Target} accentColor="blue" />
        <StatCard title="Conversion" value={`${stats?.conversionRate ?? 0}%`} description="Viewed" icon={TrendingUp} accentColor="orange" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Careers" value={stats?.totalCareers ?? 0} description="Paths" icon={Briefcase} accentColor="violet" />
        <StatCard title="Courses" value={stats?.totalCourses ?? 0} description="Resources" icon={BookOpen} accentColor="blue" />
        <StatCard title="Skills" value={stats?.totalSkills ?? 0} description="In catalog" icon={Award} accentColor="teal" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-[#F8F8FA]/95 p-6 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.08)]">
          <h2 className="text-base font-semibold text-[#1F2937]">User growth</h2>
          <div className="mt-4 h-[260px]">
            {userGrowthData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={userGrowthData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                  <XAxis dataKey="month" stroke="#6B7280" fontSize={11} tickLine={false} />
                  <YAxis stroke="#6B7280" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#F8F8FA",
                      border: "none",
                      borderRadius: "12px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    }}
                    labelStyle={{ color: "#1F2937" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="users"
                    stroke="#8B5CF6"
                    strokeWidth={2}
                    dot={{ fill: "#A78BFA" }}
                    activeDot={{ r: 5, fill: "#8B5CF6" }}
                    name="Users"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-[#6B7280]">No data yet</div>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-[#F8F8FA]/95 p-6 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.08)]">
          <h2 className="text-base font-semibold text-[#1F2937]">Careers by category</h2>
          <div className="mt-4 h-[260px]">
            {careerByCategoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={careerByCategoryData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                  <XAxis dataKey="category" stroke="#6B7280" fontSize={11} tickLine={false} />
                  <YAxis stroke="#6B7280" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#F8F8FA",
                      border: "none",
                      borderRadius: "12px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    }}
                  />
                  <Bar dataKey="count" radius={[8, 8, 0, 0]} name="Careers">
                    {careerByCategoryData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-[#6B7280]">No data yet</div>
            )}
          </div>
        </div>
      </div>

      {recommendationStatus.length > 0 && (
        <div className="rounded-2xl bg-[#F8F8FA]/95 p-6 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.08)]">
          <h2 className="text-base font-semibold text-[#1F2937]">Recommendation status</h2>
          <div className="mt-4 flex justify-center">
            <ResponsiveContainer width="100%" height={220} className="max-w-[260px]">
              <PieChart>
                <Pie
                  data={recommendationStatus}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  innerRadius={56}
                  outerRadius={84}
                  paddingAngle={2}
                  label={({ status, count }) => `${status}: ${count}`}
                >
                  {recommendationStatus.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#F8F8FA",
                    border: "none",
                    borderRadius: "12px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
