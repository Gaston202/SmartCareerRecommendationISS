"use client";

import { useUsers } from "@/hooks/useUsers";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserPlus, Users, MoreVertical, Mail, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

export default function UsersPage() {
  const { data: users, isLoading, error } = useUsers();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Users" description="Manage user accounts and permissions" />
        <LoadingState message="Loading users..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Users" description="Manage user accounts and permissions" />
        <Card className="border-destructive">
          <div className="p-6 space-y-4">
            <div className="space-y-2">
              <p className="font-semibold text-destructive">Error loading users</p>
              <p className="text-sm text-muted-foreground">
                {error instanceof Error
                  ? error.message
                  : "Unable to connect to the server. Please check your internet connection and try again."}
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const columns = [
    {
      header: "Name",
      accessorKey: "name",
      cell: (user: { name?: string; email?: string }) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-semibold ring-2 ring-primary/10 transition-all hover:ring-primary/30">
            {user.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-medium">{user.name}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
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
      cell: (user: { role?: string }) => (
        <Badge
          variant="secondary"
          className={cn(
            "gap-1",
            user.role === "admin"
              ? "bg-purple-100 text-purple-700 border-purple-200"
              : user.role === "manager"
              ? "bg-blue-100 text-blue-700 border-blue-200"
              : "bg-emerald-100 text-emerald-700 border-emerald-200"
          )}
        >
          <Shield className="h-3 w-3" />
          {user.role}
        </Badge>
      ),
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (user: { status?: string }) => {
        const status = user.status || "active";
        return (
          <Badge
            variant={status === "active" ? "default" : "secondary"}
            className={cn(
              "transition-all",
              status === "active"
                ? "bg-green-100 text-green-700 hover:bg-green-100 border-green-200"
                : "border-gray-200"
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full mr-1.5", status === "active" ? "bg-green-500" : "bg-gray-400")} />
            {status}
          </Badge>
        );
      },
    },
    {
      header: "Actions",
      accessorKey: "id",
      cell: () => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="hover:bg-accent">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>View Details</DropdownMenuItem>
            <DropdownMenuItem>Edit User</DropdownMenuItem>
            <DropdownMenuItem>Reset Password</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">
              Delete User
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Manage user accounts and permissions"
        action={{
          label: "Add User",
          icon: UserPlus,
          onClick: () => console.log("Add user"),
        }}
      />

      {users && users.length > 0 ? (
        <div className="rounded-xl border bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-1">
          <div className="rounded-lg bg-background">
            <DataTable columns={columns} data={users} />
          </div>
        </div>
      ) : (
        <EmptyState
          icon={Users}
          title="No users found"
          description="Add your first user to get started with the platform."
          action={{
            label: "Add User",
            onClick: () => console.log("Add user"),
          }}
        />
      )}
    </div>
  );
}
