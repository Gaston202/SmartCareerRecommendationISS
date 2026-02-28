'use client';

import { useEffect, useState } from 'react';
import { useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';

const specialties = [
  'AI/Machine Learning',
  'Cybersecurity',
  'Web Development',
  'Mobile Development',
  'Cloud Architecture',
  'DevOps',
  'Data Science',
  'Full Stack',
];

interface GroupChatForm {
  title: string;
  specialty: string;
  description?: string;
  mentor_id?: string;
  is_moderated: boolean;
}

interface Mentor {
  id: string;
  name: string;
}

export default function GroupChatFormPage() {
  const router = useRouter();
  const params = useParams();
  const chatId = params?.id as string | undefined;

  const [form, setForm] = useState<GroupChatForm>({
    title: '',
    specialty: specialties[0],
    is_moderated: true,
  });

  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const fetchMentors = useCallback(async () => {
    try {
      const response = await fetch('/api/mentors');
      if (!response.ok) throw new Error('Failed to fetch mentors');
      const data = await response.json();
      setMentors(data || []);
    } catch (err) {
      console.error('Error fetching mentors:', err);
    }
  }, []);

  const fetchGroupChat = useCallback(async () => {
    if (!chatId) return;
    try {
      setLoading(true);
      const response = await fetch(`/api/group-chats/${chatId}`);
      if (!response.ok) throw new Error('Failed to fetch group chat');
      const data = await response.json();
      setForm({
        title: data.chat.title,
        specialty: data.chat.specialty,
        description: data.chat.description,
        mentor_id: data.chat.mentor_id,
        is_moderated: data.chat.is_moderated,
      });
      setIsEditing(true);
    } catch (err) {
      setError('Failed to load group chat data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [chatId]);


  useEffect(() => {
    fetchMentors();
    if (chatId) {
      fetchGroupChat();
    }
  }, [chatId, fetchMentors, fetchGroupChat]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const fieldValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setForm((prev) => ({
      ...prev,
      [name]: fieldValue,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.title.trim() || !form.specialty) {
      setError('Title and specialty are required');
      return;
    }

    try {
      setLoading(true);
      const endpoint = isEditing ? `/api/group-chats/${chatId}` : '/api/group-chats';
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!response.ok) throw new Error('Failed to save group chat');

      router.push('/admin/group-chats');
    } catch (err) {
      setError('Failed to save group chat. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEditing ? 'Edit Group Chat' : 'Create Group Chat'}
        description={
          isEditing ? 'Update group chat information' : 'Create a new group chat by specialty'
        }
      />

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg border space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Group Chat Details</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
            <Input
              name="title"
              value={form.title}
              onChange={handleInputChange}
              placeholder="e.g., AI Engineers General Discussion"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Specialty *</label>
            <select
              name="specialty"
              value={form.specialty}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              {specialties.map((specialty) => (
                <option key={specialty} value={specialty}>
                  {specialty}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description (Optional)
            </label>
            <textarea
              name="description"
              value={form.description || ''}
              onChange={handleInputChange}
              placeholder="Describe the purpose and guidelines of this group chat"
              rows={4}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Lead Mentor (Optional)
            </label>
            <select
              name="mentor_id"
              value={form.mentor_id || ''}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">None</option>
              {mentors.map((mentor) => (
                <option key={mentor.id} value={mentor.id}>
                  {mentor.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Settings */}
        <div className="space-y-4 border-t pt-6">
          <h3 className="text-lg font-semibold">Settings</h3>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="is_moderated"
              checked={form.is_moderated}
              onChange={handleInputChange}
              className="w-4 h-4"
            />
            <span className="text-sm font-medium text-gray-700">Moderate Messages</span>
          </label>
          <p className="text-xs text-gray-600 ml-7">
            When enabled, messages will be reviewed before posting. Useful for maintaining
            community standards.
          </p>
        </div>

        {/* Submit */}
        <div className="flex gap-3 border-t pt-6">
          <Button variant="outline" type="button" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : isEditing ? 'Update Group Chat' : 'Create Group Chat'}
          </Button>
        </div>
      </form>
    </div>
  );
}
