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

const userActivityData = [
  { month: "Jan", active: 1200, new: 300 },
  { month: "Feb", active: 1400, new: 350 },
  { month: "Mar", active: 1600, new: 400 },
  { month: "Apr", active: 1900, new: 450 },
  { month: "May", active: 2200, new: 500 },
  { month: "Jun", active: 2547, new: 547 },
];

const careerDistribution = [
  { name: "Technology", value: 35 },
  { name: "Healthcare", value: 25 },
  { name: "Business", value: 20 },
  { name: "Education", value: 12 },
  { name: "Other", value: 8 },
];

const COLORS = ["#7D10B9", "#9333ea", "#a855f7", "#c084fc", "#d8b4fe"];

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Analytics</h2>
        <p className="text-muted-foreground">
          Comprehensive insights and performance metrics
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-white p-6">
          <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
          <p className="mt-2 text-3xl font-bold text-primary">$45,231</p>
          <p className="mt-1 text-xs text-green-600">+20.1% from last month</p>
        </div>
        <div className="rounded-lg border border-border bg-white p-6">
          <p className="text-sm font-medium text-muted-foreground">Active Users</p>
          <p className="mt-2 text-3xl font-bold text-primary">2,547</p>
          <p className="mt-1 text-xs text-green-600">+12% from last month</p>
        </div>
        <div className="rounded-lg border border-border bg-white p-6">
          <p className="text-sm font-medium text-muted-foreground">Recommendations</p>
          <p className="mt-2 text-3xl font-bold text-primary">1,650</p>
          <p className="mt-1 text-xs text-green-600">+18% from last month</p>
        </div>
        <div className="rounded-lg border border-border bg-white p-6">
          <p className="text-sm font-medium text-muted-foreground">Satisfaction Rate</p>
          <p className="mt-2 text-3xl font-bold text-primary">94%</p>
          <p className="mt-1 text-xs text-green-600">+2% from last month</p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* User Activity Chart */}
        <div className="rounded-lg border border-border bg-white p-6">
          <h3 className="text-lg font-semibold mb-4">User Activity Trends</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={userActivityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="active"
                stroke="#7D10B9"
                strokeWidth={2}
                name="Active Users"
              />
              <Line
                type="monotone"
                dataKey="new"
                stroke="#9333ea"
                strokeWidth={2}
                name="New Users"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Career Distribution Pie Chart */}
        <div className="rounded-lg border border-border bg-white p-6">
          <h3 className="text-lg font-semibold mb-4">Career Interest Distribution</h3>
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
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Recommendations by Month */}
        <div className="rounded-lg border border-border bg-white p-6">
          <h3 className="text-lg font-semibold mb-4">Monthly Recommendations</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={userActivityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="new" fill="#7D10B9" name="Recommendations Sent" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Metrics */}
        <div className="rounded-lg border border-border bg-white p-6">
          <h3 className="text-lg font-semibold mb-4">Key Metrics</h3>
          <div className="space-y-4">
            {[
              { label: "Average Session Duration", value: "8m 32s", change: "+12%" },
              { label: "Recommendation Accuracy", value: "89%", change: "+3%" },
              { label: "User Retention Rate", value: "76%", change: "+5%" },
              { label: "Course Completion Rate", value: "64%", change: "+8%" },
            ].map((metric, index) => (
              <div key={index} className="flex items-center justify-between border-b border-border pb-3 last:border-0">
                <div>
                  <p className="text-sm font-medium">{metric.label}</p>
                  <p className="text-2xl font-bold text-primary mt-1">{metric.value}</p>
                </div>
                <span className="text-sm font-medium text-green-600">{metric.change}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
