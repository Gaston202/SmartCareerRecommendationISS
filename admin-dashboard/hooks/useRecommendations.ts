import { useQuery } from "@tanstack/react-query";
import apiClient from "@/services/api";
import { Recommendation } from "@/types/career";

export function useRecommendations(userId?: string) {
  return useQuery({
    queryKey: ["recommendations", userId ?? "all"],
    queryFn: async () => {
      const url = userId ? `/recommendations?userId=${encodeURIComponent(userId)}` : "/recommendations";
      const { data } = await apiClient.get<Recommendation[]>(url);
      return data;
    },
    retry: 2,
    staleTime: 2 * 60 * 1000,
  });
}
