"use client";

import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Target, TrendingUp, Send, Eye, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function RecommendationsPage() {
  const recommendations = [
    {
      user: "John Doe",
      career: "Software Engineer",
      score: 92,
      status: "Viewed",
      date: "2026-02-04",
    },
    {
      user: "Jane Smith",
      career: "Data Scientist",
      score: 88,
      status: "Sent",
      date: "2026-02-04",
    },
    {
      user: "Mike Johnson",
      career: "Product Manager",
      score: 85,
      status: "Pending",
      date: "2026-02-05",
    },
    {
      user: "Sarah Williams",
      career: "UX Designer",
      score: 90,
      status: "Viewed",
      date: "2026-02-05",
    },
  ];

  const columns = [
    {
      header: "User",
      accessorKey: "user",
      cell: (row: { user?: string }) => (
        <span className="font-medium text-foreground">{row.user}</span>
      ),
    },
    {
      header: "Career Recommended",
      accessorKey: "career",
    },
    {
      header: "Match Score",
      accessorKey: "score",
      cell: (row: { score?: number }) => (
        <div className="flex items-center gap-2">
          <div className="w-full max-w-[120px] bg-muted rounded-full h-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-primary to-primary/70 h-2 rounded-full transition-all"
              style={{ width: `${row.score}%` }}
            />
          </div>
          <span className="text-sm font-medium">{row.score}%</span>
        </div>
      ),
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (row: { status?: string }) => {
        const variant =
          row.status === "Viewed"
            ? "default"
            : row.status === "Sent"
            ? "secondary"
            : "outline";
        return (
          <Badge
            variant={variant}
            className={
              row.status === "Viewed"
                ? "bg-emerald-100 text-emerald-700 border-emerald-200 capitalize"
                : row.status === "Sent"
                ? "bg-blue-100 text-blue-700 border-blue-200 capitalize"
                : "bg-amber-100 text-amber-700 border-amber-200 capitalize"
            }
          >
            {row.status}
          </Badge>
        );
      },
    },
    {
      header: "Date",
      accessorKey: "date",
      cell: (row: { date?: string }) => (
        <span className="text-muted-foreground">
          {row.date ? new Date(row.date).toLocaleDateString() : 'N/A'}
        </span>
      ),
    },
    {
      header: "Actions",
      accessorKey: "id",
      cell: () => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="hover:bg-muted">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>View Details</DropdownMenuItem>
            <DropdownMenuItem>Resend</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Recommendations"
          description="View and manage career recommendations sent to users"
        />
        <Select defaultValue="all">
          <SelectTrigger className="w-[200px] bg-background/90 shadow-sm hover:shadow transition-shadow border-primary/10">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="viewed">Viewed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Recommendations"
          value="1,650"
          icon={Target}
          trend={{ value: 18, isPositive: true }}
          description="from last month"
        />
        <StatCard title="Pending" value="234" icon={TrendingUp} />
        <StatCard title="Sent" value="1,198" icon={Send} />
        <StatCard title="Avg Match Score" value="87%" icon={Eye} />
      </div>

      <DataTable columns={columns} data={recommendations} />
    </div>
  );
}
