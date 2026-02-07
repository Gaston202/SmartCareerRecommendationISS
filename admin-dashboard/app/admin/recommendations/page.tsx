"use client";

import { useState } from "react";
import { useRecommendations } from "@/hooks/useRecommendations";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Target } from "lucide-react";
import { Recommendation } from "@/types/career";

export default function RecommendationsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { data: recommendations, isLoading, error } = useRecommendations();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2937]">Recommendations</h1>
          <p className="mt-1 text-sm text-[#6B7280]">View and manage career recommendations</p>
        </div>
        <LoadingState message="Loading recommendations..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2937]">Recommendations</h1>
          <p className="mt-1 text-sm text-[#6B7280]">View and manage career recommendations</p>
        </div>
        <div className="rounded-2xl bg-[#F8F8FA]/95 p-8 text-center shadow-[0_2px_12px_-2px_rgba(0,0,0,0.08)]">
          <p className="font-medium text-[#DC2626]">
            {error instanceof Error ? error.message : "Failed to load recommendations."}
          </p>
          <Button variant="outline" className="mt-4 rounded-xl border-[#E5E7EB]" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const list = recommendations ?? [];
  const filtered =
    statusFilter === "all"
      ? list
      : list.filter((r) => r.status === statusFilter);

  const total = list.length;
  const pending = list.filter((r) => r.status === "pending").length;
  const sent = list.filter((r) => r.status === "sent").length;
  const viewed = list.filter((r) => r.status === "viewed").length;
  const avgScore =
    list.length > 0
      ? Math.round(
          list.reduce((acc, r) => acc + (r.matchScore ?? 0), 0) / list.length
        )
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2937]">Recommendations</h1>
          <p className="mt-1 text-sm text-[#6B7280]">View and manage career recommendations sent to users</p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] rounded-xl border-0 bg-[#F8F8FA]/95 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.08)]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-0 bg-[#F8F8FA] shadow-lg">
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="viewed">Viewed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl bg-[#F8F8FA]/95 p-4 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.08)]">
          <p className="text-sm font-medium text-[#6B7280]">Total</p>
          <p className="mt-1 text-xl font-bold text-[#1F2937]">{total}</p>
        </div>
        <div className="rounded-2xl bg-[#F8F8FA]/95 p-4 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.08)]">
          <p className="text-sm font-medium text-[#6B7280]">Pending</p>
          <p className="mt-1 text-xl font-bold text-[#1F2937]">{pending}</p>
        </div>
        <div className="rounded-2xl bg-[#F8F8FA]/95 p-4 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.08)]">
          <p className="text-sm font-medium text-[#6B7280]">Sent</p>
          <p className="mt-1 text-xl font-bold text-[#1F2937]">{sent}</p>
        </div>
        <div className="rounded-2xl bg-[#F8F8FA]/95 p-4 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.08)]">
          <p className="text-sm font-medium text-[#6B7280]">Avg match</p>
          <p className="mt-1 text-xl font-bold text-[#1F2937]">{avgScore}%</p>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Target}
          title={list.length === 0 ? "No recommendations yet" : "No recommendations match this filter"}
          description={list.length === 0 ? "Recommendations will appear here when generated for users." : "Try another status filter."}
        />
      ) : (
        <div className="rounded-2xl bg-[#F8F8FA]/95 p-4 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.08)] space-y-3">
          {filtered.map((rec) => (
            <RecommendationRow key={rec.id} recommendation={rec} />
          ))}
        </div>
      )}
    </div>
  );
}

function RecommendationRow({ recommendation }: { recommendation: Recommendation }) {
  const careerTitles = recommendation.careers?.map((c) => c.title).join(", ") || "—";
  const date = recommendation.generatedAt
    ? new Date(recommendation.generatedAt).toLocaleDateString()
    : "—";

  const statusStyle =
    recommendation.status === "viewed"
      ? "bg-emerald-500/15 text-emerald-700"
      : recommendation.status === "sent"
      ? "bg-[#38BDF8]/15 text-[#0EA5E9]"
      : "bg-amber-500/15 text-amber-700";

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white/70 p-4 transition-colors hover:bg-white/90">
      <div className="min-w-0">
        <p className="font-medium text-[#1F2937]">User {recommendation.userId.slice(0, 8)}…</p>
        <p className="text-sm text-[#6B7280]">{careerTitles}</p>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <div className="h-2 w-24 overflow-hidden rounded-full bg-white/80">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6]"
              style={{ width: `${Math.min(100, recommendation.matchScore ?? 0)}%` }}
            />
          </div>
          <span className="text-sm font-medium text-[#1F2937]">{recommendation.matchScore ?? 0}%</span>
        </div>
        <span className={`rounded-lg px-2 py-0.5 text-xs font-medium capitalize ${statusStyle}`}>
          {recommendation.status}
        </span>
        <span className="text-sm text-[#6B7280]">{date}</span>
      </div>
    </div>
  );
}
