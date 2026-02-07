import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/services/api";
import { Career } from "@/types/career";

export function useCareers() {
  return useQuery({
    queryKey: ["careers"],
    queryFn: async () => {
      const { data } = await apiClient.get<Career[]>("/careers");
      return data;
    },
    retry: 2,
    staleTime: 2 * 60 * 1000,
  });
}

export function useCareer(id: string) {
  return useQuery({
    queryKey: ["careers", id],
    queryFn: async () => {
      const { data } = await apiClient.get<Career>(`/careers/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateCareer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (careerData: Omit<Career, "id" | "createdAt" | "updatedAt">) => {
      const { data } = await apiClient.post<Career>("/careers", careerData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["careers"] });
    },
  });
}

export function useUpdateCareer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Career> & { id: string }) => {
      const { data } = await apiClient.put<Career>(`/careers/${id}`, updates);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["careers", data.id] });
      queryClient.invalidateQueries({ queryKey: ["careers"] });
    },
  });
}

export function useDeleteCareer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/careers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["careers"] });
    },
  });
}
