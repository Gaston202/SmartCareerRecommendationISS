"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser } from "@/hooks/useUsers";
import { DataTable } from "@/components/ui/data-table";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus, Users, MoreVertical, Mail, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { User } from "@/types/user";
import { toast } from "sonner";

const createUserSchema = z.object({
  email: z.string().email("Invalid email"),
  name: z.string().min(1, "Name is required"),
  password: z.string().min(6, "Password must be at least 6 characters").optional().or(z.literal("")),
  role: z.enum(["admin", "manager", "user"]),
});

const editUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  role: z.enum(["admin", "manager", "user"]),
  status: z.enum(["active", "inactive", "suspended"]),
});

type CreateUserFormData = z.infer<typeof createUserSchema>;
type EditUserFormData = z.infer<typeof editUserSchema>;

export default function UsersPage() {
  const { data: users, isLoading, error } = useUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  const [createOpen, setCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  const createForm = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { email: "", name: "", password: "", role: "user" },
  });

  const editForm = useForm<EditUserFormData>({
    resolver: zodResolver(editUserSchema),
    defaultValues: { name: "", role: "user", status: "active" },
  });

  const openCreate = () => {
    createForm.reset({ email: "", name: "", password: "", role: "user" });
    setCreateOpen(true);
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    editForm.reset({
      name: user.name,
      role: user.role,
      status: user.status || "active",
    });
  };

  const closeEdit = () => setEditingUser(null);

  const onSubmitCreate = async (data: CreateUserFormData) => {
    try {
      await createUser.mutateAsync({
        email: data.email,
        name: data.name,
        ...(data.password && data.password.length >= 6 ? { password: data.password } : {}),
        role: data.role,
      });
      toast.success("User created successfully");
      setCreateOpen(false);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { error?: string } } }).response?.data?.error
          : "Failed to create user";
      toast.error(msg as string);
    }
  };

  const onSubmitEdit = async (data: EditUserFormData) => {
    if (!editingUser) return;
    try {
      await updateUser.mutateAsync({
        id: editingUser.id,
        name: data.name,
        role: data.role,
        status: data.status,
      });
      toast.success("User updated successfully");
      closeEdit();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { error?: string } } }).response?.data?.error
          : "Failed to update user";
      toast.error(msg as string);
    }
  };

  const onConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteUser.mutateAsync(deleteTarget.id);
      toast.success("User deleted");
      setDeleteTarget(null);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { error?: string } } }).response?.data?.error
          : "Failed to delete user";
      toast.error(msg as string);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2937]">Users</h1>
          <p className="mt-1 text-sm text-[#6B7280]">Manage user accounts</p>
        </div>
        <LoadingState message="Loading users..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2937]">Users</h1>
          <p className="mt-1 text-sm text-[#6B7280]">Manage user accounts</p>
        </div>
        <div className="rounded-2xl bg-[#F8F8FA]/95 p-8 text-center shadow-[0_2px_12px_-2px_rgba(0,0,0,0.08)]">
          <p className="font-medium text-[#DC2626]">{error instanceof Error ? error.message : "Unable to connect."}</p>
          <Button variant="outline" className="mt-4 rounded-xl border-[#E5E7EB]" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const columns = [
    {
      header: "Name",
      accessorKey: "name",
      cell: (user: User) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#6D28D9] to-[#8B5CF6] text-sm font-semibold text-white">
            {user.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-[#1F2937]">{user.name}</p>
            <p className="text-xs text-[#6B7280] flex items-center gap-1">
              <Mail className="h-3 w-3" />
              {user.email}
            </p>
          </div>
        </div>
      ),
    },
    {
      header: "Role",
      accessorKey: "role",
      cell: (user: User) => (
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-medium",
            user.role === "admin"
              ? "bg-[#8B5CF6]/15 text-[#6D28D9]"
              : user.role === "manager"
              ? "bg-[#38BDF8]/15 text-[#0EA5E9]"
              : "bg-[#2DD4BF]/15 text-[#0D9488]"
          )}
        >
          <Shield className="h-3 w-3" />
          {user.role}
        </span>
      ),
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (user: User) => {
        const status = user.status || "active";
        return (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-xs font-medium",
              status === "active" ? "bg-emerald-500/15 text-emerald-700" : "bg-[#9CA3AF]/15 text-[#6B7280]"
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", status === "active" ? "bg-emerald-500" : "bg-[#9CA3AF]")} />
            {status}
          </span>
        );
      },
    },
    {
      header: "Actions",
      accessorKey: "id",
      cell: (user: User) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-xl text-[#6B7280] hover:bg-white/80 hover:text-[#1F2937]">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-xl border-0 bg-[#F8F8FA] shadow-lg">
            <DropdownMenuItem onClick={() => openEdit(user)} className="rounded-lg focus:bg-white/80">Edit</DropdownMenuItem>
            <DropdownMenuItem className="text-[#DC2626] focus:bg-red-50" onClick={() => setDeleteTarget(user)}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const list = users ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2937]">Users</h1>
          <p className="mt-1 text-sm text-[#6B7280]">Manage user accounts and permissions</p>
        </div>
        <Button
          onClick={openCreate}
          className="rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white shadow-sm hover:opacity-90 gap-2"
        >
          <UserPlus className="h-4 w-4" />
          Add User
        </Button>
      </div>

      {list.length > 0 ? (
        <DataTable columns={columns} data={list} />
      ) : (
        <EmptyState
          icon={Users}
          title="No users yet"
          description="Add your first user to get started."
          action={{ label: "Add User", onClick: openCreate }}
        />
      )}

      {/* Create User Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
            <DialogDescription>Create a new user account. Email and name are required.</DialogDescription>
          </DialogHeader>
          <form onSubmit={createForm.handleSubmit(onSubmitCreate)} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                {...createForm.register("email")}
                className="mt-1"
                placeholder="user@example.com"
              />
              {createForm.formState.errors.email && (
                <p className="text-sm text-destructive mt-1">{createForm.formState.errors.email.message}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input {...createForm.register("name")} className="mt-1" placeholder="Full name" />
              {createForm.formState.errors.name && (
                <p className="text-sm text-destructive mt-1">{createForm.formState.errors.name.message}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Password (optional, min 6 characters)</label>
              <Input
                type="password"
                {...createForm.register("password")}
                className="mt-1"
                placeholder="••••••••"
              />
              {createForm.formState.errors.password && (
                <p className="text-sm text-destructive mt-1">{createForm.formState.errors.password.message}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Role</label>
              <Select
                value={createForm.watch("role")}
                onValueChange={(v) => createForm.setValue("role", v as CreateUserFormData["role"])}
              >
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createUser.isPending}>
                {createUser.isPending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && closeEdit()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user details. Email cannot be changed here.</DialogDescription>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(onSubmitEdit)} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input {...editForm.register("name")} className="mt-1" />
              {editForm.formState.errors.name && (
                <p className="text-sm text-destructive mt-1">{editForm.formState.errors.name.message}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Role</label>
              <Select
                value={editForm.watch("role")}
                onValueChange={(v) => editForm.setValue("role", v as EditUserFormData["role"])}
              >
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Status</label>
              <Select
                value={editForm.watch("status")}
                onValueChange={(v) => editForm.setValue("status", v as EditUserFormData["status"])}
              >
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeEdit}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateUser.isPending}>
                {updateUser.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete user?</DialogTitle>
            <DialogDescription>
              This will permanently delete &quot;{deleteTarget?.name}&quot; ({deleteTarget?.email}). This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onConfirmDelete} disabled={deleteUser.isPending}>
              {deleteUser.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
