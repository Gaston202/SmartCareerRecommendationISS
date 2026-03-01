'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { Eye, Trash2, Plus, MessageSquare, Shield } from 'lucide-react';
import { toast } from 'sonner';

interface GroupChat {
  id: string;
  title: string;
  specialty: string;
  description?: string;
  mentor_id?: string;
  mentor?: {
    name: string;
  };
  is_moderated: boolean;
  created_at: string;
}

export default function GroupChatsPage() {
  const router = useRouter();
  const [chats, setChats] = useState<GroupChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    fetchGroupChats();
  }, []);

  const fetchGroupChats = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/group-chats');
      if (!response.ok) throw new Error('Failed to fetch group chats');
      const data = await response.json();
      setChats(data || []);
    } catch (error) {
      console.error('Error fetching group chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setDeleteLoading(true);
      const response = await fetch(`/api/group-chats/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete group chat');
      }
      const chatTitle = chats.find((c) => c.id === id)?.title || 'Group Chat';
      setChats(chats.filter((c) => c.id !== id));
      setDeleteId(null);
      toast.success(`${chatTitle} has been deleted successfully`);
    } catch (error) {
      console.error('Error deleting group chat:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete group chat');
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredChats = chats.filter(
    (chat) =>
      chat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      chat.specialty.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Group Chats"
        description="Manage group chats organized by specialty"
        action={
          <Button
            onClick={() => router.push('/admin/group-chats/new')}
            className="rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white shadow-sm hover:opacity-90 gap-2"
          >
            <Plus className="h-4 w-4" />
            Create Group Chat
          </Button>
        }
      />

      {/* Search Bar */}
      <div className="rounded-2xl bg-[#F8F8FA]/95 p-4 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.08)]">
        <Input
          placeholder="Search by title or specialty..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-xl bg-white border-[#DDD6FE] focus:ring-[#7C3AED]"
        />
      </div>

      {/* Group Chats Table */}
      <div className="rounded-2xl bg-[#F8F8FA]/95 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.08)] overflow-hidden">
        {loading ? (
          <LoadingState message="Loading group chats..." />
        ) : filteredChats.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No group chats found"
            description={searchQuery ? 'Try adjusting your search terms' : 'Get started by creating a new group chat'}
            action={
              !searchQuery
                ? {
                    label: 'Create Group Chat',
                    onClick: () => {
                      window.location.href = '/admin/group-chats/new';
                    },
                  }
                : undefined
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-b border-[#E5E7EB]/50">
                <TableHead className="text-[#1F2937] font-semibold">Title</TableHead>
                <TableHead className="text-[#1F2937] font-semibold">Specialty</TableHead>
                <TableHead className="text-[#1F2937] font-semibold">Mentor</TableHead>
                <TableHead className="text-[#1F2937] font-semibold">Moderated</TableHead>
                <TableHead className="text-[#1F2937] font-semibold">Created</TableHead>
                <TableHead className="text-[#1F2937] font-semibold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredChats.map((chat) => (
                <TableRow key={chat.id} className="border-b border-[#E5E7EB]/30 hover:bg-white/40 transition-colors">
                  <TableCell className="font-medium text-[#1F2937]">{chat.title}</TableCell>
                  <TableCell>
                    <Badge className="bg-[#EDE9FE]/80 text-[#7C3AED] border border-[#DDD6FE] rounded-lg">{chat.specialty}</Badge>
                  </TableCell>
                  <TableCell className="text-[#6B7280] text-sm">{chat.mentor?.name || 'None'}</TableCell>
                  <TableCell>
                    {chat.is_moderated ? (
                      <Badge className="bg-emerald-100/80 text-emerald-700 border border-emerald-200 rounded-lg gap-1 flex items-center w-fit">
                        <Shield className="h-3 w-3" />
                        Yes
                      </Badge>
                    ) : (
                      <Badge className="bg-slate-100/80 text-slate-700 border border-slate-200 rounded-lg">No</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-[#6B7280] text-sm">{new Date(chat.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/admin/group-chats/${chat.id}`)}
                        className="border-[#DDD6FE] hover:bg-[#F8F8FA] text-[#7C3AED] rounded-lg gap-1"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeleteId(chat.id)}
                        className="rounded-lg gap-1 bg-rose-100/80 text-rose-700 border border-rose-200 hover:bg-rose-200/80"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-[#1F2937]">Delete Group Chat</DialogTitle>
            <DialogDescription className="text-[#6B7280]">
              Are you sure you want to delete this group chat? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3 sm:gap-3">
            <Button
              variant="outline"
              onClick={() => setDeleteId(null)}
              className="border-[#DDD6FE] hover:bg-[#F8F8FA] text-[#6B7280] rounded-lg"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleDelete(deleteId!)}
              disabled={deleteLoading}
              className="rounded-lg bg-rose-600 hover:bg-rose-700 text-white"
            >
              {deleteLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
