"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import { useDashboardStats } from "@/hooks/use-api";

export default function DashboardPage() {
  const { data: stats, isLoading, error } = useDashboardStats();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-red-500">Error loading dashboard data. Please try again.</p>
        </div>
      </div>
    );
  }

  const userGrowthData = stats?.userGrowth || [];
  const careerRecommendationsData = stats?.careerRecommendationsByCategory || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Overview of the Smart Career Recommendation system
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-white p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Total Users</p>
          </div>
          <div className="mt-2">
            <p className="text-3xl font-bold text-primary">{stats?.totalUsers || 0}</p>
            <p className="text-xs text-muted-foreground mt-1">Registered users</p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-white p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Active Users</p>
          </div>
          <div className="mt-2">
            <p className="text-3xl font-bold text-primary">{stats?.activeUsers || 0}</p>
            <p className="text-xs text-muted-foreground mt-1">Currently active</p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-white p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Recommendations</p>
          </div>
          <div className="mt-2">
            <p className="text-3xl font-bold text-primary">{stats?.totalRecommendations || 0}</p>
            <p className="text-xs text-muted-foreground mt-1">Total generated</p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-white p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Conversion Rate</p>
          </div>
          <div className="mt-2">
            <p className="text-3xl font-bold text-primary">{stats?.conversionRate || 0}%</p>
            <p className="text-xs text-muted-foreground mt-1">Viewed recommendations</p>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {userGrowthData.length > 0 && (
          <div className="rounded-lg border border-border bg-white p-6">
            <h3 className="text-lg font-semibold mb-4">User Growth</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={userGrowthData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="users" 
                  stroke="#7D10B9" 
                  strokeWidth={2}
                  activeDot={{ r: 8 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {careerRecommendationsData.length > 0 && (
          <div className="rounded-lg border border-border bg-white p-6">
            <h3 className="text-lg font-semibold mb-4">Career Recommendations by Category</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={careerRecommendationsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#7D10B9" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="rounded-lg border border-border bg-white p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
        <div className="space-y-4">
          {[
            { user: "John Doe", action: "Received career recommendation", time: "2 minutes ago" },
            { user: "Jane Smith", action: "Completed assessment", time: "15 minutes ago" },
            { user: "Mike Johnson", action: "Updated profile", time: "1 hour ago" },
            { user: "Sarah Williams", action: "Received career recommendation", time: "2 hours ago" },
          ].map((activity, index) => (
            <div key={index} className="flex items-center justify-between border-b border-border pb-3 last:border-0">
              <div>
                <p className="font-medium">{activity.user}</p>
                <p className="text-sm text-muted-foreground">{activity.action}</p>
              </div>
              <p className="text-sm text-muted-foreground">{activity.time}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
