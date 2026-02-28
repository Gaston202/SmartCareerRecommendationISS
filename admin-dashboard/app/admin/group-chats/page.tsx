'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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
      if (!response.ok) throw new Error('Failed to delete group chat');
      setChats(chats.filter((c) => c.id !== id));
      setDeleteId(null);
    } catch (error) {
      console.error('Error deleting group chat:', error);
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
          <Link href="/admin/group-chats/new">
            <Button>Create Group Chat</Button>
          </Link>
        }
      />

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-lg border">
        <Input
          placeholder="Search by title or specialty..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full"
        />
      </div>

      {/* Group Chats Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading group chats...</div>
        ) : filteredChats.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No group chats found</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Specialty</TableHead>
                <TableHead>Mentor</TableHead>
                <TableHead>Moderated</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredChats.map((chat) => (
                <TableRow key={chat.id}>
                  <TableCell className="font-medium">{chat.title}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{chat.specialty}</Badge>
                  </TableCell>
                  <TableCell>{chat.mentor?.name || 'None'}</TableCell>
                  <TableCell>
                    {chat.is_moderated ? (
                      <Badge className="bg-green-100 text-green-800">Yes</Badge>
                    ) : (
                      <Badge className="bg-gray-100 text-gray-800">No</Badge>
                    )}
                  </TableCell>
                  <TableCell>{new Date(chat.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Link href={`/admin/group-chats/${chat.id}`}>
                        <Button variant="outline" size="sm">
                          View
                        </Button>
                      </Link>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeleteId(chat.id)}
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

      {/* Delete Confirmation */}
      {deleteId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg max-w-sm">
            <h2 className="text-lg font-bold mb-4">Delete Group Chat</h2>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this group chat? This action cannot be undone.
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
        </div>
      )}
    </div>
  );
}
