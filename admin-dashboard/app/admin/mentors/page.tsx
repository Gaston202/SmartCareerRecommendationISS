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
import { Pencil, Trash2, Plus, Star, Users2 } from 'lucide-react';
import { toast } from 'sonner';

interface Mentor {
  id: string;
  name: string;
  email: string;
  role?: string;
  company?: string;
  rating: number;
  total_reviews: number;
  is_verified: boolean;
  status: 'active' | 'inactive' | 'suspended';
  years_of_experience: number;
  created_at: string;
}

export default function MentorsPage() {
  const router = useRouter();
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    fetchMentors();
  }, []);

  const fetchMentors = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/mentors');
      if (!response.ok) throw new Error('Failed to fetch mentors');
      const data = await response.json();
      setMentors(data || []);
    } catch (error) {
      console.error('Error fetching mentors:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setDeleteLoading(true);
      const response = await fetch(`/api/mentors/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete mentor');
      }
      const mentorName = mentors.find((m) => m.id === id)?.name || 'Mentor';
      setMentors(mentors.filter((m) => m.id !== id));
      setDeleteId(null);
      toast.success(`${mentorName} has been deleted successfully`);
    } catch (error) {
      console.error('Error deleting mentor:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete mentor');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/mentors/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update mentor');
      }
      const updated = await response.json();
      setMentors(mentors.map((m) => (m.id === id ? updated : m)));
      toast.success('Status updated successfully');
    } catch (error) {
      console.error('Error updating mentor:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update status');
    }
  };

  const filteredMentors = mentors.filter(
    (mentor) =>
      mentor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mentor.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (mentor.company && mentor.company.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-100/80 text-emerald-700 border border-emerald-200';
      case 'inactive':
        return 'bg-slate-100/80 text-slate-700 border border-slate-200';
      case 'suspended':
        return 'bg-rose-100/80 text-rose-700 border border-rose-200';
      default:
        return 'bg-slate-100/80 text-slate-700 border border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mentors"
        description="Manage mentors and their profiles"
        action={
          <Button
            onClick={() => router.push('/admin/mentors/new')}
            className="rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white shadow-sm hover:opacity-90 gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Mentor
          </Button>
        }
      />

      {/* Search Bar */}
      <div className="rounded-2xl bg-[#F8F8FA]/95 p-4 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.08)]">
        <Input
          placeholder="Search by name, email, or company..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-xl bg-white border-[#DDD6FE] focus:ring-[#7C3AED]"
        />
      </div>

      {/* Mentors Table */}
      <div className="rounded-2xl bg-[#F8F8FA]/95 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.08)] overflow-hidden">
        {loading ? (
          <LoadingState message="Loading mentors..." />
        ) : filteredMentors.length === 0 ? (
          <EmptyState
            icon={Users2}
            title="No mentors found"
            description={searchQuery ? 'Try adjusting your search terms' : 'Get started by adding a new mentor'}
            action={
              !searchQuery
                ? {
                    label: 'Add Mentor',
                    onClick: () => {
                      window.location.href = '/admin/mentors/new';
                    },
                  }
                : undefined
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-b border-[#E5E7EB]/50">
                <TableHead className="text-[#1F2937] font-semibold">Name</TableHead>
                <TableHead className="text-[#1F2937] font-semibold">Email</TableHead>
                <TableHead className="text-[#1F2937] font-semibold">Company</TableHead>
                <TableHead className="text-[#1F2937] font-semibold">Experience</TableHead>
                <TableHead className="text-[#1F2937] font-semibold">Rating</TableHead>
                <TableHead className="text-[#1F2937] font-semibold">Status</TableHead>
                <TableHead className="text-[#1F2937] font-semibold">Verified</TableHead>
                <TableHead className="text-[#1F2937] font-semibold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMentors.map((mentor) => (
                <TableRow key={mentor.id} className="border-b border-[#E5E7EB]/30 hover:bg-white/40 transition-colors">
                  <TableCell className="font-medium text-[#1F2937]">{mentor.name}</TableCell>
                  <TableCell className="text-[#6B7280] text-sm">{mentor.email}</TableCell>
                  <TableCell className="text-[#6B7280] text-sm">{mentor.company || '-'}</TableCell>
                  <TableCell className="text-[#6B7280] text-sm">{mentor.years_of_experience}+ years</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                      <span className="font-medium text-[#1F2937]">{mentor.rating.toFixed(1)}</span>
                      <span className="text-xs text-[#9CA3AF]">({mentor.total_reviews})</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <select
                      value={mentor.status}
                      onChange={(e) => handleStatusChange(mentor.id, e.target.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${getStatusColor(
                        mentor.status
                      )}`}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </TableCell>
                  <TableCell>
                    {mentor.is_verified ? (
                      <Badge className="bg-emerald-100/80 text-emerald-700 border border-emerald-200 rounded-lg">✓ Verified</Badge>
                    ) : (
                      <Badge className="bg-slate-100/80 text-slate-700 border border-slate-200 rounded-lg">Not Verified</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/admin/mentors/${mentor.id}`)}
                        className="border-[#DDD6FE] hover:bg-[#F8F8FA] text-[#7C3AED] rounded-lg gap-1"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeleteId(mentor.id)}
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
            <DialogTitle className="text-[#1F2937]">Delete Mentor</DialogTitle>
            <DialogDescription className="text-[#6B7280]">
              Are you sure you want to delete this mentor? This action cannot be undone.
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
