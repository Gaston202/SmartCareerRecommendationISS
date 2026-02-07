"use client";

import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Briefcase, Plus, TrendingUp, DollarSign, Pencil, Trash2 } from "lucide-react";
import { useCareers, useCreateCareer, useUpdateCareer, useDeleteCareer } from "@/hooks/useCareers";
import { Career } from "@/types/career";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "sonner";

const careerFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  category: z.string().min(1, "Category is required"),
  requiredSkills: z.string(),
  averageSalary: z.union([z.string(), z.number()]).transform((v) => (typeof v === "string" ? Number(v) : v)),
  growthRate: z.union([z.string(), z.number()]).transform((v) => (typeof v === "string" ? Number(v) : v)),
  demandLevel: z.enum(["low", "medium", "high", "very-high"]),
});

type CareerFormData = z.infer<typeof careerFormSchema>;

const demandLabels: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  "very-high": "Very High",
};

export default function CareersPage() {
  const { data: careers, isLoading, error } = useCareers();
  const createCareer = useCreateCareer();
  const updateCareer = useUpdateCareer();
  const deleteCareer = useDeleteCareer();

  const [createOpen, setCreateOpen] = useState(false);
  const [editingCareer, setEditingCareer] = useState<Career | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Career | null>(null);

  const form = useForm<CareerFormData>({
    resolver: zodResolver(careerFormSchema) as Resolver<CareerFormData>,
    defaultValues: {
      title: "",
      description: "",
      category: "",
      requiredSkills: "",
      averageSalary: 0,
      growthRate: 0,
      demandLevel: "medium",
    },
  });

  const openCreate = () => {
    form.reset({
      title: "",
      description: "",
      category: "",
      requiredSkills: "",
      averageSalary: 0,
      growthRate: 0,
      demandLevel: "medium",
    });
    setCreateOpen(true);
  };

  const openEdit = (career: Career) => {
    setEditingCareer(career);
    form.reset({
      title: career.title,
      description: career.description,
      category: career.category,
      requiredSkills: career.requiredSkills?.join(", ") || "",
      averageSalary: career.averageSalary ?? 0,
      growthRate: career.growthRate ?? 0,
      demandLevel: career.demandLevel || "medium",
    });
  };

  const closeEdit = () => {
    setEditingCareer(null);
  };

  const onSubmitCreate = async (data: CareerFormData) => {
    try {
      await createCareer.mutateAsync({
        title: data.title,
        description: data.description,
        category: data.category,
        requiredSkills: data.requiredSkills
          ? data.requiredSkills.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        averageSalary: data.averageSalary,
        growthRate: data.growthRate,
        demandLevel: data.demandLevel,
      });
      toast.success("Career created successfully");
      setCreateOpen(false);
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "response" in e
        ? (e as { response?: { data?: { error?: string } } }).response?.data?.error
        : "Failed to create career";
      toast.error(msg as string);
    }
  };

  const onSubmitEdit = async (data: CareerFormData) => {
    if (!editingCareer) return;
    try {
      await updateCareer.mutateAsync({
        id: editingCareer.id,
        title: data.title,
        description: data.description,
        category: data.category,
        requiredSkills: data.requiredSkills
          ? data.requiredSkills.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        averageSalary: data.averageSalary,
        growthRate: data.growthRate,
        demandLevel: data.demandLevel,
      });
      toast.success("Career updated successfully");
      closeEdit();
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "response" in e
        ? (e as { response?: { data?: { error?: string } } }).response?.data?.error
        : "Failed to update career";
      toast.error(msg as string);
    }
  };

  const onConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteCareer.mutateAsync(deleteTarget.id);
      toast.success("Career deleted");
      setDeleteTarget(null);
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "response" in e
        ? (e as { response?: { data?: { error?: string } } }).response?.data?.error
        : "Failed to delete career";
      toast.error(msg as string);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold text-[#1F2937]">Careers</h1><p className="mt-1 text-sm text-[#6B7280]">Manage career paths</p></div>
        <LoadingState message="Loading careers..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold text-[#1F2937]">Careers</h1><p className="mt-1 text-sm text-[#6B7280]">Manage career paths</p></div>
        <div className="rounded-2xl bg-[#F8F8FA]/95 p-8 text-center shadow-[0_2px_12px_-2px_rgba(0,0,0,0.08)]">
          <p className="font-medium text-[#DC2626]">{error instanceof Error ? error.message : "Failed to load careers."}</p>
          <Button variant="outline" className="mt-4 rounded-xl border-[#E5E7EB]" onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }

  const list = careers ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2937]">Careers</h1>
          <p className="mt-1 text-sm text-[#6B7280]">Manage career paths and job categories</p>
        </div>
        <Button onClick={openCreate} className="rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white shadow-sm hover:opacity-90 gap-2">
          <Plus className="h-4 w-4" /> Add Career
        </Button>
      </div>

      {list.length === 0 ? (
        <EmptyState icon={Briefcase} title="No careers yet" description="Add your first career to get started." action={{ label: "Add Career", onClick: openCreate }} />
      ) : (
        <div className="rounded-2xl bg-[#F8F8FA]/95 p-4 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.08)] space-y-3">
          {list.map((career) => (
            <div
              key={career.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white/70 p-4 transition-colors hover:bg-white/90"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#6D28D9] to-[#8B5CF6] text-white">
                  <Briefcase className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-[#1F2937]">{career.title}</h3>
                  <p className="text-xs text-[#6B7280]">{career.category}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-[#6B7280]">${(career.averageSalary ?? 0).toLocaleString()}</span>
                <span className="rounded-lg bg-white/80 px-2 py-0.5 text-xs font-medium text-[#6B7280]">{demandLabels[career.demandLevel] ?? career.demandLevel}</span>
                <span className="text-emerald-600 font-medium">+{career.growthRate ?? 0}%</span>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="rounded-xl text-[#6B7280] hover:bg-white/80 hover:text-[#1F2937]" onClick={() => openEdit(career)}>
                  <Pencil className="h-4 w-4 mr-1" /> Edit
                </Button>
                <Button variant="ghost" size="sm" className="rounded-xl text-[#DC2626] hover:bg-red-50" onClick={() => setDeleteTarget(career)}>
                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Career</DialogTitle>
            <DialogDescription>Create a new career path. Fill in the required fields.</DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit((data) => onSubmitCreate(data as CareerFormData))} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Title</label>
              <Input {...form.register("title")} className="mt-1" placeholder="e.g. Software Engineer" />
              {form.formState.errors.title && (
                <p className="text-sm text-destructive mt-1">{form.formState.errors.title.message}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <textarea
                {...form.register("description")}
                className="mt-1 w-full min-h-[80px] rounded-md border border-input px-3 py-2 text-sm"
                placeholder="Brief description"
              />
              {form.formState.errors.description && (
                <p className="text-sm text-destructive mt-1">{form.formState.errors.description.message}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Category</label>
              <Input {...form.register("category")} className="mt-1" placeholder="e.g. Technology" />
              {form.formState.errors.category && (
                <p className="text-sm text-destructive mt-1">{form.formState.errors.category.message}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Required skills (comma-separated)</label>
              <Input {...form.register("requiredSkills")} className="mt-1" placeholder="JavaScript, React, Node" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Average salary</label>
                <Input type="number" {...form.register("averageSalary")} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Growth rate (%)</label>
                <Input type="number" {...form.register("growthRate")} className="mt-1" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Demand level</label>
              <Select
                value={form.watch("demandLevel")}
                onValueChange={(v) => form.setValue("demandLevel", v as CareerFormData["demandLevel"])}
              >
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["low", "medium", "high", "very-high"] as const).map((level) => (
                    <SelectItem key={level} value={level}>
                      {demandLabels[level]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createCareer.isPending}>
                {createCareer.isPending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingCareer} onOpenChange={(open) => !open && closeEdit()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Career</DialogTitle>
            <DialogDescription>Update this career path.</DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit((data) => onSubmitEdit(data as CareerFormData))} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Title</label>
              <Input {...form.register("title")} className="mt-1" />
              {form.formState.errors.title && (
                <p className="text-sm text-destructive mt-1">{form.formState.errors.title.message}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <textarea
                {...form.register("description")}
                className="mt-1 w-full min-h-[80px] rounded-md border border-input px-3 py-2 text-sm"
              />
              {form.formState.errors.description && (
                <p className="text-sm text-destructive mt-1">{form.formState.errors.description.message}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Category</label>
              <Input {...form.register("category")} className="mt-1" />
              {form.formState.errors.category && (
                <p className="text-sm text-destructive mt-1">{form.formState.errors.category.message}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Required skills (comma-separated)</label>
              <Input {...form.register("requiredSkills")} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Average salary</label>
                <Input type="number" {...form.register("averageSalary")} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Growth rate (%)</label>
                <Input type="number" {...form.register("growthRate")} className="mt-1" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Demand level</label>
              <Select
                value={form.watch("demandLevel")}
                onValueChange={(v) => form.setValue("demandLevel", v as CareerFormData["demandLevel"])}
              >
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["low", "medium", "high", "very-high"] as const).map((level) => (
                    <SelectItem key={level} value={level}>
                      {demandLabels[level]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeEdit}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateCareer.isPending}>
                {updateCareer.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete career?</DialogTitle>
            <DialogDescription>
              This will permanently delete &quot;{deleteTarget?.title}&quot;. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onConfirmDelete} disabled={deleteCareer.isPending}>
              {deleteCareer.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
