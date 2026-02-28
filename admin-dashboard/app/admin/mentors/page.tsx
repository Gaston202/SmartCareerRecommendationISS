'use client';

import { useEffect, useState } from 'react';
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
import { Dialog } from '@/components/ui/dialog';
import Link from 'next/link';

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
      if (!response.ok) throw new Error('Failed to delete mentor');
      setMentors(mentors.filter((m) => m.id !== id));
      setDeleteId(null);
    } catch (error) {
      console.error('Error deleting mentor:', error);
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
      if (!response.ok) throw new Error('Failed to update mentor');
      const updated = await response.json();
      setMentors(mentors.map((m) => (m.id === id ? updated : m)));
    } catch (error) {
      console.error('Error updating mentor:', error);
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
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      case 'suspended':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mentors"
        description="Manage mentors and their profiles"
        action={
          <Link href="/admin/mentors/new">
            <Button>Add Mentor</Button>
          </Link>
        }
      />

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-lg border">
        <Input
          placeholder="Search by name, email, or company..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full"
        />
      </div>

      {/* Mentors Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading mentors...</div>
        ) : filteredMentors.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No mentors found</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Experience</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Verified</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMentors.map((mentor) => (
                <TableRow key={mentor.id}>
                  <TableCell className="font-medium">{mentor.name}</TableCell>
                  <TableCell>{mentor.email}</TableCell>
                  <TableCell>{mentor.company || '-'}</TableCell>
                  <TableCell>{mentor.years_of_experience}+ years</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <span>⭐</span>
                      <span>{mentor.rating.toFixed(1)}</span>
                      <span className="text-xs text-gray-500">({mentor.total_reviews})</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <select
                      value={mentor.status}
                      onChange={(e) => handleStatusChange(mentor.id, e.target.value)}
                      className={`px-3 py-1 rounded-full text-sm font-medium border-0 cursor-pointer ${getStatusColor(
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
                      <Badge className="bg-green-100 text-green-800">✓ Verified</Badge>
                    ) : (
                      <Badge className="bg-gray-100 text-gray-800">Not Verified</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Link href={`/admin/mentors/${mentor.id}`}>
                        <Button variant="outline" size="sm">
                          Edit
                        </Button>
                      </Link>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeleteId(mentor.id)}
                      >
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
      {deleteId && (
        <Dialog>
          <div className="p-6">
            <h2 className="text-lg font-bold mb-4">Delete Mentor</h2>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this mentor? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setDeleteId(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleDelete(deleteId)}
                disabled={deleteLoading}
              >
                {deleteLoading ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
