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

const COLORS = ["#9333ea", "#3b82f6", "#14b8a6", "#10b981", "#f59e0b"];

export default function AnalyticsPage() {
  const { data: stats, isLoading, error } = useDashboardStats();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Analytics</h2>
          <p className="text-muted-foreground">Loading analytics data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Analytics</h2>
          <p className="text-red-500">Error loading analytics data. Please try again.</p>
        </div>
      </div>
    );
  }

  // Transform user growth data for the chart
  const userActivityData = stats?.userGrowth?.map((item: any) => ({
    month: item.month,
    active: item.users,
    new: item.users, // For now, using same value
  })) || [];

  // Transform career distribution for pie chart
  const careerDistribution = stats?.careerRecommendationsByCategory?.map((item: any) => ({
    name: item.category,
    value: item.count,
  })) || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-500 bg-clip-text text-transparent">
          Analytics
        </h2>
        <p className="mt-2 text-muted-foreground">
          Comprehensive insights and performance metrics
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br from-white to-purple-50/50 p-6 shadow-lg transition-all hover:shadow-xl hover:scale-[1.02]">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100"></div>
          <div className="relative">
            <p className="text-sm font-semibold text-muted-foreground">Total Users</p>
            <p className="mt-3 text-4xl font-bold bg-gradient-to-r from-purple-600 via-purple-500 to-pink-500 bg-clip-text text-transparent">
              {stats?.totalUsers || 0}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">Registered users</p>
          </div>
        </div>
        <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br from-white to-blue-50/50 p-6 shadow-lg transition-all hover:shadow-xl hover:scale-[1.02]">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100"></div>
          <div className="relative">
            <p className="text-sm font-semibold text-muted-foreground">Active Users</p>
            <p className="mt-3 text-4xl font-bold bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-500 bg-clip-text text-transparent">
              {stats?.activeUsers || 0}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">Currently active</p>
          </div>
        </div>
        <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br from-white to-teal-50/50 p-6 shadow-lg transition-all hover:shadow-xl hover:scale-[1.02]">
          <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100"></div>
          <div className="relative">
            <p className="text-sm font-semibold text-muted-foreground">Recommendations</p>
            <p className="mt-3 text-4xl font-bold bg-gradient-to-r from-teal-600 via-emerald-500 to-green-500 bg-clip-text text-transparent">
              {stats?.totalRecommendations || 0}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">Total generated</p>
          </div>
        </div>
        <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br from-white to-green-50/50 p-6 shadow-lg transition-all hover:shadow-xl hover:scale-[1.02]">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100"></div>
          <div className="relative">
            <p className="text-sm font-semibold text-muted-foreground">Conversion Rate</p>
            <p className="mt-3 text-4xl font-bold bg-gradient-to-r from-green-600 via-lime-500 to-yellow-500 bg-clip-text text-transparent">
              {stats?.conversionRate || 0}%
            </p>
            <p className="mt-2 text-xs text-muted-foreground">Viewed recommendations</p>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* User Activity Chart */}
        {userActivityData.length > 0 && (
          <div className="rounded-xl border border-border/50 bg-gradient-to-br from-white to-purple-50/30 p-6 shadow-lg">
            <h3 className="text-lg font-bold mb-4 bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent">
              User Growth Trends
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={userActivityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }} 
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="active"
                  stroke="#9333ea"
                  strokeWidth={3}
                  dot={{ fill: '#9333ea', r: 4 }}
                  activeDot={{ r: 8, fill: '#a855f7' }}
                  name="Users"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Career Distribution Pie Chart */}
        {careerDistribution.length > 0 && (
          <div className="rounded-xl border border-border/50 bg-gradient-to-br from-white to-blue-50/30 p-6 shadow-lg">
            <h3 className="text-lg font-bold mb-4 bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
              Career Distribution
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={careerDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {careerDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }} 
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Recommendations by Status */}
        {stats?.recommendationStatus && stats.recommendationStatus.length > 0 && (
          <div className="rounded-xl border border-border/50 bg-gradient-to-br from-white to-teal-50/30 p-6 shadow-lg">
            <h3 className="text-lg font-bold mb-4 bg-gradient-to-r from-teal-600 to-emerald-500 bg-clip-text text-transparent">
              Recommendations by Status
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.recommendationStatus}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="status" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }} 
                />
                <Legend />
                <Bar 
                  dataKey="count" 
                  fill="#9333ea" 
                  name="Count"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Key Metrics */}
        <div className="rounded-xl border border-border/50 bg-gradient-to-br from-white to-green-50/30 p-6 shadow-lg">
          <h3 className="text-lg font-bold mb-4 bg-gradient-to-r from-green-600 to-emerald-500 bg-clip-text text-transparent">
            Key Metrics
          </h3>
          <div className="space-y-4">
            {[
              { label: "Total Careers", value: stats?.totalCareers || 0 },
              { label: "Total Courses", value: stats?.totalCourses || 0 },
              { label: "Total Skills", value: stats?.totalSkills || 0 },
              { label: "Conversion Rate", value: `${stats?.conversionRate || 0}%` },
            ].map((metric, index) => (
              <div key={index} className="flex items-center justify-between border-b border-border pb-3 last:border-0">
                <div>
                  <p className="text-sm font-medium">{metric.label}</p>
                  <p className="text-2xl font-bold text-primary mt-1">{metric.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
