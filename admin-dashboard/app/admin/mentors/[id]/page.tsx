'use client';

import { useEffect, useState } from 'react';
import { useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { LoadingState } from '@/components/ui/loading-state';
import { toast } from 'sonner';

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

interface MentorForm {
  name: string;
  email: string;
  role?: string;
  company?: string;
  bio?: string;
  years_of_experience: number;
  avatar?: string;
  is_verified: boolean;
  status: 'active' | 'inactive' | 'suspended';
}

interface MentorSpecialty {
  specialty: string;
  is_primary: boolean;
}

export default function EditMentorPage() {
  const router = useRouter();
  const params = useParams();
  const mentorId = params?.id as string;

  const [form, setForm] = useState<MentorForm>({
    name: '',
    email: '',
    years_of_experience: 0,
    is_verified: false,
    status: 'active',
  });

  const [selectedSpecialties, setSelectedSpecialties] = useState<MentorSpecialty[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchMentor = useCallback(async () => {
    if (!mentorId) {
      setError('Mentor ID not found');
      return;
    }
    try {
      setLoading(true);
      const response = await fetch(`/api/mentors/${mentorId}`);
      if (!response.ok) {
        if (response.status === 404) {
          setError('Mentor not found');
        } else {
          setError('Failed to fetch mentor');
        }
        return;
      }
      const data = await response.json();
      setForm({
        name: data.name,
        email: data.email,
        role: data.role,
        company: data.company,
        bio: data.bio,
        years_of_experience: data.years_of_experience,
        avatar: data.avatar,
        is_verified: data.is_verified,
        status: data.status,
      });
      setSelectedSpecialties(
        (data.mentor_specialties || []).map((s: { specialty: string; is_primary: boolean }) => ({
          specialty: s.specialty,
          is_primary: s.is_primary,
        }))
      );
    } catch (err) {
      setError('Failed to load mentor data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [mentorId]);

  useEffect(() => {
    fetchMentor();
  }, [mentorId, fetchMentor]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const fieldValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setForm((prev) => ({
      ...prev,
      [name]: name === 'years_of_experience' ? parseInt(value) : fieldValue,
    }));
  };

  const toggleSpecialty = (specialty: string) => {
    setSelectedSpecialties((prev) => {
      const exists = prev.find((s) => s.specialty === specialty);
      if (exists) {
        return prev.filter((s) => s.specialty !== specialty);
      }
      return [...prev, { specialty, is_primary: false }];
    });
  };

  const setPrimarySpecialty = (specialty: string) => {
    setSelectedSpecialties((prev) =>
      prev.map((s) => ({
        ...s,
        is_primary: s.specialty === specialty,
      }))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.name.trim() || !form.email.trim()) {
      setError('Name and email are required');
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`/api/mentors/${mentorId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save mentor');
      }

      // Save specialties
      if (selectedSpecialties.length > 0) {
        await fetch(`/api/mentors/${mentorId}/specialties`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(selectedSpecialties),
        });
      }

      toast.success('Mentor updated successfully');
      router.push('/admin/mentors');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save mentor';
      setError(message);
      toast.error(message);
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState message="Loading mentor..." />;
  }

  if (error && !form.name) {
    return (
      <div className="space-y-6">
        <PageHeader title="Edit Mentor" description="Update mentor information" />
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          {error}
        </div>
        <Button variant="outline" onClick={() => router.back()}>
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Edit Mentor" description="Update mentor information and specialties" />

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg border space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Basic Information</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
              <Input
                name="name"
                value={form.name}
                onChange={handleInputChange}
                placeholder="Full name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
              <Input
                name="email"
                type="email"
                value={form.email}
                onChange={handleInputChange}
                placeholder="Email address"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
              <Input
                name="role"
                value={form.role || ''}
                onChange={handleInputChange}
                placeholder="Job title (e.g., Senior Engineer)"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Company</label>
              <Input
                name="company"
                value={form.company || ''}
                onChange={handleInputChange}
                placeholder="Company name"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Years of Experience
              </label>
              <Input
                name="years_of_experience"
                type="number"
                value={form.years_of_experience}
                onChange={handleInputChange}
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Avatar URL</label>
              <Input
                name="avatar"
                value={form.avatar || ''}
                onChange={handleInputChange}
                placeholder="https://example.com/avatar.jpg"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
            <textarea
              name="bio"
              value={form.bio || ''}
              onChange={handleInputChange}
              placeholder="Tell us about your expertise and background"
              rows={4}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Settings */}
        <div className="space-y-4 border-t pt-6">
          <h3 className="text-lg font-semibold">Settings</h3>

          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="is_verified"
                checked={form.is_verified}
                onChange={handleInputChange}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium text-gray-700">Verified Mentor</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              name="status"
              value={form.status}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>

        {/* Specialties */}
        <div className="space-y-4 border-t pt-6">
          <h3 className="text-lg font-semibold">Specialties</h3>
          <p className="text-sm text-gray-600">Select the areas of expertise for this mentor.</p>

          <div className="grid grid-cols-2 gap-3">
            {specialties.map((specialty) => {
              const isSelected = selectedSpecialties.some((s) => s.specialty === specialty);
              const isPrimary = selectedSpecialties.some(
                (s) => s.specialty === specialty && s.is_primary
              );

              return (
                <div key={specialty} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSpecialty(specialty)}
                    className="w-4 h-4"
                  />
                  <label
                    className="flex-1 text-sm cursor-pointer"
                    onClick={() => toggleSpecialty(specialty)}
                  >
                    {specialty}
                  </label>
                  {isSelected && (
                    <button
                      type="button"
                      onClick={() => setPrimarySpecialty(specialty)}
                      className={`text-xs px-2 py-1 rounded ${
                        isPrimary ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      {isPrimary ? '★ Primary' : 'Set Primary'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3 border-t pt-6">
          <Button variant="outline" type="button" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Update Mentor'}
          </Button>
        </div>
      </form>
    </div>
  );
}
