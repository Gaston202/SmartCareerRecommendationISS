"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
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
import { Award, Plus, Pencil, Trash2 } from "lucide-react";
import { useSkills, useCreateSkill, useUpdateSkill, useDeleteSkill } from "@/hooks/useSkills";
import { Skill } from "@/types/career";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "sonner";

const skillFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  description: z.string().optional(),
  relatedCareers: z.string(), // comma-separated
});

type SkillFormData = z.infer<typeof skillFormSchema>;

const categoryStyles: Record<string, { badge: string; icon: string }> = {
  Programming: { badge: "bg-indigo-100 text-indigo-700 border-indigo-200", icon: "from-indigo-200/70 to-indigo-50 text-indigo-600 ring-indigo-200/60" },
  Analytics: { badge: "bg-sky-100 text-sky-700 border-sky-200", icon: "from-sky-200/70 to-sky-50 text-sky-600 ring-sky-200/60" },
  Business: { badge: "bg-amber-100 text-amber-700 border-amber-200", icon: "from-amber-200/70 to-amber-50 text-amber-600 ring-amber-200/60" },
  Design: { badge: "bg-pink-100 text-pink-700 border-pink-200", icon: "from-pink-200/70 to-pink-50 text-pink-600 ring-pink-200/60" },
  Technology: { badge: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: "from-emerald-200/70 to-emerald-50 text-emerald-600 ring-emerald-200/60" },
};

function getCategoryStyle(category: string) {
  return categoryStyles[category] ?? {
    badge: "bg-primary/10 text-primary border-primary/20",
    icon: "from-primary/15 to-primary/5 text-primary ring-primary/20",
  };
}

export default function SkillsPage() {
  const { data: skills, isLoading, error } = useSkills();
  const createSkill = useCreateSkill();
  const updateSkill = useUpdateSkill();
  const deleteSkill = useDeleteSkill();

  const [createOpen, setCreateOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Skill | null>(null);

  const form = useForm<SkillFormData>({
    resolver: zodResolver(skillFormSchema),
    defaultValues: { name: "", category: "", description: "", relatedCareers: "" },
  });

  const openCreate = () => {
    form.reset({ name: "", category: "", description: "", relatedCareers: "" });
    setCreateOpen(true);
  };

  const openEdit = (skill: Skill) => {
    setEditingSkill(skill);
    form.reset({
      name: skill.name,
      category: skill.category,
      description: skill.description || "",
      relatedCareers: skill.relatedCareers?.join(", ") || "",
    });
  };

  const closeEdit = () => setEditingSkill(null);

  const onSubmitCreate = async (data: SkillFormData) => {
    try {
      await createSkill.mutateAsync({
        name: data.name,
        category: data.category,
        description: data.description || "",
        relatedCareers: data.relatedCareers
          ? data.relatedCareers.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
      });
      toast.success("Skill created successfully");
      setCreateOpen(false);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { error?: string } } }).response?.data?.error
          : "Failed to create skill";
      toast.error(msg as string);
    }
  };

  const onSubmitEdit = async (data: SkillFormData) => {
    if (!editingSkill) return;
    try {
      await updateSkill.mutateAsync({
        id: editingSkill.id,
        name: data.name,
        category: data.category,
        description: data.description || "",
        relatedCareers: data.relatedCareers
          ? data.relatedCareers.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
      });
      toast.success("Skill updated successfully");
      closeEdit();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { error?: string } } }).response?.data?.error
          : "Failed to update skill";
      toast.error(msg as string);
    }
  };

  const onConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteSkill.mutateAsync(deleteTarget.id);
      toast.success("Skill deleted");
      setDeleteTarget(null);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { error?: string } } }).response?.data?.error
          : "Failed to delete skill";
      toast.error(msg as string);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold text-[#1F2937]">Skills</h1><p className="mt-1 text-sm text-[#6B7280]">Manage skills and competencies</p></div>
        <LoadingState message="Loading skills..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold text-[#1F2937]">Skills</h1><p className="mt-1 text-sm text-[#6B7280]">Manage skills and competencies</p></div>
        <div className="rounded-2xl bg-[#F8F8FA]/95 p-8 text-center shadow-[0_2px_12px_-2px_rgba(0,0,0,0.08)]">
          <p className="font-medium text-[#DC2626]">{error instanceof Error ? error.message : "Failed to load skills."}</p>
          <Button variant="outline" className="mt-4 rounded-xl border-[#E5E7EB]" onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }

  const list = skills ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2937]">Skills</h1>
          <p className="mt-1 text-sm text-[#6B7280]">Manage skills and competencies in the system</p>
        </div>
        <Button onClick={openCreate} className="rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white shadow-sm hover:opacity-90 gap-2">
          <Plus className="h-4 w-4" /> Add Skill
        </Button>
      </div>

      {list.length === 0 ? (
        <EmptyState icon={Award} title="No skills yet" description="Add your first skill to get started." action={{ label: "Add Skill", onClick: openCreate }} />
      ) : (
        <div className="rounded-2xl bg-[#F8F8FA]/95 p-4 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.08)] space-y-3">
          {list.map((skill) => (
            <div
              key={skill.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white/70 p-4 transition-colors hover:bg-white/90"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#6D28D9] to-[#8B5CF6] text-white">
                  <Award className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-[#1F2937]">{skill.name}</h3>
                  <p className="text-xs text-[#6B7280]">{skill.category}</p>
                </div>
              </div>
              {skill.description && <p className="text-sm text-[#6B7280] line-clamp-1 max-w-md">{skill.description}</p>}
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="rounded-xl text-[#6B7280] hover:bg-white/80 hover:text-[#1F2937]" onClick={() => openEdit(skill)}>
                  <Pencil className="h-4 w-4 mr-1" /> Edit
                </Button>
                <Button variant="ghost" size="sm" className="rounded-xl text-[#DC2626] hover:bg-red-50" onClick={() => setDeleteTarget(skill)}>
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
            <DialogTitle>Add Skill</DialogTitle>
            <DialogDescription>Create a new skill. Fill in name and category.</DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmitCreate)} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input {...form.register("name")} className="mt-1" placeholder="e.g. JavaScript" />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive mt-1">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Category</label>
              <Input {...form.register("category")} className="mt-1" placeholder="e.g. Programming, Design" />
              {form.formState.errors.category && (
                <p className="text-sm text-destructive mt-1">{form.formState.errors.category.message}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Description (optional)</label>
              <textarea
                {...form.register("description")}
                className="mt-1 w-full min-h-[60px] rounded-md border border-input px-3 py-2 text-sm"
                placeholder="Brief description"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Related careers (comma-separated, optional)</label>
              <Input {...form.register("relatedCareers")} className="mt-1" placeholder="Software Engineer, Frontend Dev" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createSkill.isPending}>
                {createSkill.isPending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingSkill} onOpenChange={(open) => !open && closeEdit()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Skill</DialogTitle>
            <DialogDescription>Update this skill.</DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmitEdit)} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input {...form.register("name")} className="mt-1" />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive mt-1">{form.formState.errors.name.message}</p>
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
              <label className="text-sm font-medium">Description (optional)</label>
              <textarea
                {...form.register("description")}
                className="mt-1 w-full min-h-[60px] rounded-md border border-input px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Related careers (comma-separated)</label>
              <Input {...form.register("relatedCareers")} className="mt-1" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeEdit}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateSkill.isPending}>
                {updateSkill.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete skill?</DialogTitle>
            <DialogDescription>
              This will permanently delete &quot;{deleteTarget?.name}&quot;. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onConfirmDelete} disabled={deleteSkill.isPending}>
              {deleteSkill.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
