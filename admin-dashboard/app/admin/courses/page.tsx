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
import { BookOpen, Plus, Clock, Star, Pencil, Trash2 } from "lucide-react";
import { useCourses, useCreateCourse, useUpdateCourse, useDeleteCourse } from "@/hooks/useCourses";
import { Course } from "@/types/career";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "sonner";

const courseFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  provider: z.string().min(1, "Provider is required"),
  description: z.string(),
  skillsTargeted: z.string(),
  duration: z.string(),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  url: z.string().optional(),
  price: z.union([z.string(), z.number()]).optional().transform((v) => (v === "" || v === undefined ? undefined : typeof v === "string" ? Number(v) : v)),
  rating: z.union([z.string(), z.number()]).optional().transform((v) => (v === "" || v === undefined ? undefined : typeof v === "string" ? Number(v) : v)),
});

type CourseFormData = z.infer<typeof courseFormSchema>;

const levelLabels: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export default function CoursesPage() {
  const { data: courses, isLoading, error } = useCourses();
  const createCourse = useCreateCourse();
  const updateCourse = useUpdateCourse();
  const deleteCourse = useDeleteCourse();

  const [createOpen, setCreateOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Course | null>(null);

  const form = useForm<CourseFormData>({
    resolver: zodResolver(courseFormSchema) as Resolver<CourseFormData>,
    defaultValues: {
      title: "",
      provider: "",
      description: "",
      skillsTargeted: "",
      duration: "",
      level: "beginner",
      url: "",
      price: undefined,
      rating: undefined,
    },
  });

  const openCreate = () => {
    form.reset({
      title: "",
      provider: "",
      description: "",
      skillsTargeted: "",
      duration: "",
      level: "beginner",
      url: "",
      price: undefined,
      rating: undefined,
    });
    setCreateOpen(true);
  };

  const openEdit = (course: Course) => {
    setEditingCourse(course);
    form.reset({
      title: course.title,
      provider: course.provider,
      description: course.description || "",
      skillsTargeted: course.skillsTargeted?.join(", ") || "",
      duration: course.duration || "",
      level: course.level || "beginner",
      url: course.url || "",
      price: course.price,
      rating: course.rating,
    });
  };

  const closeEdit = () => setEditingCourse(null);

  const onSubmitCreate = async (data: CourseFormData) => {
    try {
      await createCourse.mutateAsync({
        title: data.title,
        provider: data.provider,
        description: data.description || "",
        skillsTargeted: data.skillsTargeted
          ? data.skillsTargeted.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        duration: data.duration || "Unknown",
        level: data.level,
        url: data.url || "",
        price: data.price,
        rating: data.rating,
      });
      toast.success("Course created successfully");
      setCreateOpen(false);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { error?: string } } }).response?.data?.error
          : "Failed to create course";
      toast.error(msg as string);
    }
  };

  const onSubmitEdit = async (data: CourseFormData) => {
    if (!editingCourse) return;
    try {
      await updateCourse.mutateAsync({
        id: editingCourse.id,
        title: data.title,
        provider: data.provider,
        description: data.description || "",
        skillsTargeted: data.skillsTargeted
          ? data.skillsTargeted.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        duration: data.duration || "Unknown",
        level: data.level,
        url: data.url || "",
        price: data.price,
        rating: data.rating,
      });
      toast.success("Course updated successfully");
      closeEdit();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { error?: string } } }).response?.data?.error
          : "Failed to update course";
      toast.error(msg as string);
    }
  };

  const onConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteCourse.mutateAsync(deleteTarget.id);
      toast.success("Course deleted");
      setDeleteTarget(null);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { error?: string } } }).response?.data?.error
          : "Failed to delete course";
      toast.error(msg as string);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold text-[#1F2937]">Courses</h1><p className="mt-1 text-sm text-[#6B7280]">Manage learning resources</p></div>
        <LoadingState message="Loading courses..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold text-[#1F2937]">Courses</h1><p className="mt-1 text-sm text-[#6B7280]">Manage learning resources</p></div>
        <div className="rounded-2xl bg-[#F8F8FA]/95 p-8 text-center shadow-[0_2px_12px_-2px_rgba(0,0,0,0.08)]">
          <p className="font-medium text-[#DC2626]">{error instanceof Error ? error.message : "Failed to load courses."}</p>
          <Button variant="outline" className="mt-4 rounded-xl border-[#E5E7EB]" onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }

  const list = courses ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2937]">Courses</h1>
          <p className="mt-1 text-sm text-[#6B7280]">Manage learning resources and training courses</p>
        </div>
        <Button onClick={openCreate} className="rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white shadow-sm hover:opacity-90 gap-2">
          <Plus className="h-4 w-4" /> Add Course
        </Button>
      </div>

      {list.length === 0 ? (
        <EmptyState icon={BookOpen} title="No courses yet" description="Add your first course to get started." action={{ label: "Add Course", onClick: openCreate }} />
      ) : (
        <div className="rounded-2xl bg-[#F8F8FA]/95 p-4 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.08)] space-y-3">
          {list.map((course) => (
            <div
              key={course.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white/70 p-4 transition-colors hover:bg-white/90"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#6D28D9] to-[#8B5CF6] text-white">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-[#1F2937]">{course.title}</h3>
                  <p className="text-xs text-[#6B7280]">{course.provider}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-[#6B7280]">
                {course.rating != null && (
                  <span className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    {course.rating}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {course.duration || "—"}
                </span>
                <span className="rounded-lg bg-white/80 px-2 py-0.5 text-xs font-medium">{levelLabels[course.level] ?? course.level}</span>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="rounded-xl text-[#6B7280] hover:bg-white/80 hover:text-[#1F2937]" onClick={() => openEdit(course)}>
                  <Pencil className="h-4 w-4 mr-1" /> Edit
                </Button>
                <Button variant="ghost" size="sm" className="rounded-xl text-[#DC2626] hover:bg-red-50" onClick={() => setDeleteTarget(course)}>
                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Course</DialogTitle>
            <DialogDescription>Create a new course. Fill in the required fields.</DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit((data) => onSubmitCreate(data as CourseFormData))} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Title</label>
              <Input {...form.register("title")} className="mt-1" placeholder="e.g. Complete JavaScript Course" />
              {form.formState.errors.title && (
                <p className="text-sm text-destructive mt-1">{form.formState.errors.title.message}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Provider</label>
              <Input {...form.register("provider")} className="mt-1" placeholder="e.g. Udemy, Coursera" />
              {form.formState.errors.provider && (
                <p className="text-sm text-destructive mt-1">{form.formState.errors.provider.message}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <textarea
                {...form.register("description")}
                className="mt-1 w-full min-h-[60px] rounded-md border border-input px-3 py-2 text-sm"
                placeholder="Brief description"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Skills targeted (comma-separated)</label>
              <Input {...form.register("skillsTargeted")} className="mt-1" placeholder="JavaScript, React" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Duration</label>
                <Input {...form.register("duration")} className="mt-1" placeholder="e.g. 40 hours" />
              </div>
              <div>
                <label className="text-sm font-medium">Level</label>
                <Select
                  value={form.watch("level")}
                  onValueChange={(v) => form.setValue("level", v as CourseFormData["level"])}
                >
                  <SelectTrigger className="mt-1 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["beginner", "intermediate", "advanced"] as const).map((l) => (
                      <SelectItem key={l} value={l}>
                        {levelLabels[l]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">URL</label>
              <Input {...form.register("url")} className="mt-1" placeholder="https://..." />
              {form.formState.errors.url && (
                <p className="text-sm text-destructive mt-1">{form.formState.errors.url.message}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Price</label>
                <Input type="number" {...form.register("price")} className="mt-1" placeholder="0" />
              </div>
              <div>
                <label className="text-sm font-medium">Rating (0-5)</label>
                <Input type="number" step="0.1" {...form.register("rating")} className="mt-1" placeholder="4.5" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createCourse.isPending}>
                {createCourse.isPending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingCourse} onOpenChange={(open) => !open && closeEdit()}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Course</DialogTitle>
            <DialogDescription>Update this course.</DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit((data) => onSubmitEdit(data as CourseFormData))} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Title</label>
              <Input {...form.register("title")} className="mt-1" />
              {form.formState.errors.title && (
                <p className="text-sm text-destructive mt-1">{form.formState.errors.title.message}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Provider</label>
              <Input {...form.register("provider")} className="mt-1" />
              {form.formState.errors.provider && (
                <p className="text-sm text-destructive mt-1">{form.formState.errors.provider.message}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <textarea
                {...form.register("description")}
                className="mt-1 w-full min-h-[60px] rounded-md border border-input px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Skills targeted (comma-separated)</label>
              <Input {...form.register("skillsTargeted")} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Duration</label>
                <Input {...form.register("duration")} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Level</label>
                <Select
                  value={form.watch("level")}
                  onValueChange={(v) => form.setValue("level", v as CourseFormData["level"])}
                >
                  <SelectTrigger className="mt-1 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["beginner", "intermediate", "advanced"] as const).map((l) => (
                      <SelectItem key={l} value={l}>
                        {levelLabels[l]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">URL</label>
              <Input {...form.register("url")} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Price</label>
                <Input type="number" {...form.register("price")} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Rating (0-5)</label>
                <Input type="number" step="0.1" {...form.register("rating")} className="mt-1" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeEdit}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateCourse.isPending}>
                {updateCourse.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete course?</DialogTitle>
            <DialogDescription>
              This will permanently delete &quot;{deleteTarget?.title}&quot;. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onConfirmDelete} disabled={deleteCourse.isPending}>
              {deleteCourse.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
