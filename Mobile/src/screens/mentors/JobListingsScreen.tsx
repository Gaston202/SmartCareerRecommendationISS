import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  Switch,
  TouchableWithoutFeedback,
  Keyboard,
  Linking,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../auth/AuthProvider';
import { homeColors } from '../homeTheme';
import { useJobListings } from '../../features/jobs/hooks';
import { JobFilters, JobListing } from '../../types/job';

const ALL_SITES = ['indeed', 'linkedin', 'zip_recruiter', 'glassdoor', 'google', 'bayt', 'naukri'];
// Default to only reliable sites
const DEFAULT_SITES = ['indeed', 'linkedin'];
const SITE_LABELS: Record<string, string> = {
  indeed: 'Indeed',
  linkedin: 'LinkedIn',
  zip_recruiter: 'ZipRecruiter',
  glassdoor: 'Glassdoor',
  google: 'Google Jobs',
  bayt: 'Bayt',
  naukri: 'Naukri',
};

export function JobListingsScreen() {
  const { state } = useAuth();
  const insets = useSafeAreaInsets();
  const specialty = state.user?.mentorSpecialty || 'General';

  // Filter state - default to Indeed and LinkedIn only (most reliable)
  const [filters, setFilters] = useState<JobFilters>({
    search: '',
    location: '',
    siteNames: ['indeed', 'linkedin'], // DEFAULT_SITES
    jobType: undefined,
    isRemoteOnly: false,
    resultsWanted: 20,
    hoursOld: 168,
  });

  // UI state
  const [showFilters, setShowFilters] = useState(false);
  const [jobTypeError, setJobTypeError] = useState<string | null>(null);
  const [filtersApplied, setFiltersApplied] = useState(false);

  // Fetch jobs with useJobListings hook
  const { jobs, loading, error, refetch } = useJobListings(filters);

  // Handler: Update filter (for non-search filters that require Apply button)
  // Search filter uses debounced auto-fetch (via hook), so we mark others as needing Apply
  const updateFilter = useCallback(<K extends keyof JobFilters>(
    key: K,
    value: JobFilters[K]
  ) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    // For non-search filters, we'll require Apply button
    if (key !== 'search') {
      setFiltersApplied(false);
    }
  }, []);

  // Handler: Toggle site selection
  const toggleSite = useCallback((site: string) => {
    setFilters(prev => {
      const current = prev.siteNames || [];
      if (current.includes(site)) {
        const updated = current.filter(s => s !== site);
        // Prevent empty selection
        if (updated.length === 0) {
          return prev; // keep at least one
        }
        return { ...prev, siteNames: updated };
      } else {
        return { ...prev, siteNames: [...current, site] };
      }
    });
  }, []);

  // Handler: Clear all filters
  const clearFilters = useCallback(() => {
    setFilters({
      search: '',
      location: '',
      siteNames: ['indeed', 'linkedin'],
      jobType: undefined,
      isRemoteOnly: false,
      resultsWanted: 20,
      hoursOld: 168,
    });
    setFiltersApplied(false);
  }, []);

  // Handler: Open job URL
  const handleApply = useCallback((jobUrl: string) => {
    Linking.openURL(jobUrl).catch(err => {
      console.error('Failed to open URL:', err);
      alert('Unable to open job link.');
    });
  }, []);

  // Handler: Apply filters from modal
  const handleApplyFilters = useCallback(() => {
    setFiltersApplied(true);
    setShowFilters(false);
    // The useJobListings hook will automatically refetch when filters change
  }, []);

  // Format salary display
  const formatSalary = (job: JobListing): string => {
    if (job.salary_range) return job.salary_range;
    if (job.salary) {
      const { min_amount, max_amount, currency, interval } = job.salary;
      if (min_amount && max_amount) {
        const cur = currency || '$';
        const minK = min_amount >= 1000 ? `${(min_amount/1000).toFixed(0)}k` : min_amount.toString();
        const maxK = max_amount >= 1000 ? `${(max_amount/1000).toFixed(0)}k` : max_amount.toString();
        return `${cur}${minK} - ${cur}${maxK}${interval ? `/${interval}` : ''}`;
      } else if (min_amount) {
        return `${currency || '$'}${min_amount}+`;
      }
    }
    return 'Not specified';
  };

  // Render job card
  const renderJobCard = useCallback(({ item, index }: { item: JobListing; index: number }) => (
    <View style={styles.jobCard}>
      <View style={styles.jobHeader}>
        <Text style={styles.jobTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.jobPosted}>
          {item.date_posted ? new Date(item.date_posted).toLocaleDateString() : 'Recent'}
        </Text>
      </View>
      <Text style={styles.jobCompany}>{item.company}</Text>

      <View style={styles.tagsRow}>
        {/* Location */}
        <View style={styles.tag}>
          <Ionicons name="location-outline" size={14} color={homeColors.textMuted} />
          <Text style={styles.tagText} numberOfLines={1}>
            {item.is_remote ? 'Remote' : item.location || 'Unknown location'}
          </Text>
        </View>

        {/* Job type */}
        <View style={styles.tag}>
          <Ionicons name="time-outline" size={14} color={homeColors.textMuted} />
          <Text style={styles.tagText}>
            {item.job_type ? item.job_type.charAt(0).toUpperCase() + item.job_type.slice(1) : 'N/A'}
          </Text>
        </View>

        {/* Salary */}
        <View style={styles.tag}>
          <Ionicons name="cash-outline" size={14} color={homeColors.primary} />
          <Text style={[styles.tagText, { color: homeColors.primary, fontWeight: '600' }]} numberOfLines={1}>
            {formatSalary(item)}
          </Text>
        </View>
      </View>

      {/* Optional: job board source */}
      {item.site && (
        <Text style={styles.sourceText}>Source: {SITE_LABELS[item.site] || item.site}</Text>
      )}

      <Pressable
        style={({ pressed }) => [styles.applyBtn, pressed && styles.pressed]}
        onPress={() => handleApply(item.job_url)}
      >
        <Text style={styles.applyBtnText}>Apply Now</Text>
      </Pressable>
    </View>
  ), [handleApply]);

  // Memoize filtered jobs (though the hook already filters)
  const displayedJobs = useMemo(() => jobs, [jobs]);

  return (
    <View style={[styles.container, { backgroundColor: homeColors.backgroundStart }]}>
      {/* Header with Search */}
      <View style={[styles.headerRow, { paddingTop: Math.max(insets.top, 20), backgroundColor: '#fff' }]}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Job Listings</Text>
          <Text style={styles.headerSubtitle}>
            Opportunities for <Text style={{ fontWeight: '700', color: homeColors.primary }}>{specialty}</Text>
          </Text>

          {/* Search bar */}
          <View style={styles.searchContainer}>
            <Ionicons name="search-outline" size={20} color={homeColors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search jobs, companies, keywords..."
              value={filters.search}
              onChangeText={text => updateFilter('search', text)}
              placeholderTextColor={homeColors.textMuted}
              returnKeyType="search"
            />
            {filters.search ? (
              <Pressable onPress={() => updateFilter('search', '')}>
                <Ionicons name="close-circle" size={20} color={homeColors.textMuted} />
              </Pressable>
            ) : null}
          </View>

          {/* Results count or filter indicator */}
          <View style={styles.headerFooter}>
            {jobs.length > 0 && (
              <Text style={styles.resultsText}>{jobs.length} jobs found</Text>
            )}
            {filtersApplied && (
              <View style={styles.filtersAppliedBadge}>
                <Text style={styles.filtersAppliedText}>Filters applied</Text>
              </View>
            )}
          </View>
        </View>

        {/* Filter button */}
        <Pressable
          style={[styles.filterBtn, filtersApplied && styles.filterBtnActive]}
          onPress={() => setShowFilters(true)}
        >
          <Ionicons name="options" size={24} color={homeColors.primary} />
        </Pressable>
      </View>

      {/* Job List */}
      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refetch} colors={[homeColors.primary]} />
        }
      >
        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={48} color={homeColors.textMuted} />
            <Text style={styles.errorText}>Failed to load jobs. Please try again.</Text>
            <Pressable style={styles.retryBtn} onPress={refetch}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </Pressable>
          </View>
        )}

        {!error && loading && jobs.length === 0 && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={homeColors.primary} />
            <Text style={styles.loadingText}>Searching jobs...</Text>
            <Text style={styles.loadingSubtext}>This may take 10-30 seconds</Text>
          </View>
        )}

        {!error && !loading && jobs.length === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons name="briefcase-outline" size={64} color={homeColors.textMuted} />
            <Text style={styles.emptyText}>No jobs found</Text>
            <Text style={styles.emptySubtext}>Try adjusting your filters or search terms</Text>
          </View>
        )}

        {!error && jobs.length > 0 && (
          <View style={styles.jobsList}>
            {jobs.map((job, index) => (
              <View key={job.id || index}>{renderJobCard({ item: job, index })}</View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Filter Modal */}
      <Modal
        visible={showFilters}
        animationType="slide"
        transparent
        onRequestClose={() => setShowFilters(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={[styles.modalContent, { paddingBottom: insets.bottom || 20, backgroundColor: '#fff' }]}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Filter Jobs</Text>
                  <Pressable onPress={() => setShowFilters(false)}>
                    <Ionicons name="close" size={28} color={homeColors.textMuted} />
                  </Pressable>
                </View>

                <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
                  {/* Location */}
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Location</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. San Francisco, CA or Remote"
                      value={filters.location}
                      onChangeText={text => updateFilter('location', text)}
                    />
                  </View>

                  {/* Job type */}
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Job Type</Text>
                    <View style={styles.chipRow}>
                      {['all', 'fulltime', 'parttime', 'internship', 'contract'].map(type => (
                        <Pressable
                          key={type}
                          style={[
                            styles.chip,
                            (type === 'all' ? !filters.jobType : filters.jobType === type) && styles.chipActive,
                          ]}
                          onPress={() => {
                            if (type === 'all') {
                              updateFilter('jobType', undefined);
                            } else {
                              updateFilter('jobType', type as typeof filters.jobType);
                            }
                          }}
                        >
                          <Text style={[
                            styles.chipText,
                            (type === 'all' ? !filters.jobType : filters.jobType === type) && styles.chipTextActive,
                          ]}>
                            {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  {/* Remote only */}
                  <View style={styles.fieldGroup}>
                    <View style={styles.switchRow}>
                      <Text style={styles.fieldLabel}>Remote Only</Text>
                      <Switch
                        value={filters.isRemoteOnly}
                        onValueChange={value => updateFilter('isRemoteOnly', value)}
                        trackColor={{ false: homeColors.backgroundMuted, true: homeColors.primaryLight + '80' }}
                        thumbColor={filters.isRemoteOnly ? homeColors.primary : '#f4f3f4'}
                      />
                    </View>
                  </View>

                  {/* Job boards */}
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Job Boards</Text>
                    <View style={styles.checkboxGrid}>
                      {ALL_SITES.map(site => (
                        <Pressable
                          key={site}
                          style={styles.checkboxItem}
                          onPress={() => toggleSite(site)}
                        >
                          <View style={[styles.checkbox, filters.siteNames?.includes(site) && styles.checkboxChecked]}>
                            {filters.siteNames?.includes(site) && (
                              <Ionicons name="checkmark" size={16} color="#fff" />
                            )}
                          </View>
                          <Text style={styles.checkboxLabel}>{SITE_LABELS[site]}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  {/* Results per page */}
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Results per page</Text>
                    <View style={styles.chipRow}>
                      {[10, 20, 50].map(num => (
                        <Pressable
                          key={num}
                          style={[styles.chipSmall, filters.resultsWanted === num && styles.chipActive]}
                          onPress={() => updateFilter('resultsWanted', num)}
                        >
                          <Text style={[styles.chipTextSmall, filters.resultsWanted === num && styles.chipTextActive]}>
                            {num}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                </ScrollView>

                {/* Modal Actions */}
                <View style={[styles.modalActions, { borderTopColor: homeColors.cardBorder }]}>
                  <Pressable style={styles.clearBtn} onPress={clearFilters}>
                    <Text style={styles.clearBtnText}>Clear All</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.applyFiltersBtn, { backgroundColor: homeColors.primary }]}
                    onPress={handleApplyFilters}
                  >
                    <Text style={styles.applyFiltersBtnText}>Apply Filters</Text>
                  </Pressable>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: homeColors.cardBorder,
    backgroundColor: '#fff',
  },
  headerContent: {
    flex: 1,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: homeColors.textDark,
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    color: homeColors.textMuted,
    marginBottom: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: homeColors.backgroundStart,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: homeColors.textDark,
    padding: 0,
  },
  headerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultsText: {
    fontSize: 13,
    color: homeColors.textMuted,
    fontWeight: '500',
  },
  filtersAppliedBadge: {
    backgroundColor: homeColors.accentGreen + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  filtersAppliedText: {
    fontSize: 11,
    color: homeColors.accentGreen,
    fontWeight: '600',
  },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: homeColors.backgroundStart,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
    marginTop: 4,
  },
  filterBtnActive: {
    backgroundColor: homeColors.primary + '15',
    borderColor: homeColors.primary,
  },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: homeColors.backgroundStart,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
  },
  filterBtnActive: {
    backgroundColor: homeColors.primary + '15',
    borderColor: homeColors.primary,
  },
  listContent: {
    padding: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: homeColors.textDark,
  },
  loadingSubtext: {
    marginTop: 4,
    fontSize: 13,
    color: homeColors.textMuted,
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: homeColors.textDark,
    textAlign: 'center',
    marginHorizontal: 40,
  },
  retryBtn: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: homeColors.primary + '15',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: homeColors.primary + '30',
  },
  retryBtnText: {
    color: homeColors.primary,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '700',
    color: homeColors.textDark,
  },
  emptySubtext: {
    marginTop: 4,
    fontSize: 14,
    color: homeColors.textMuted,
    textAlign: 'center',
    marginHorizontal: 40,
  },
  jobsList: {
    gap: 16,
  },
  jobCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  jobTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: homeColors.textDark,
    marginRight: 8,
    lineHeight: 24,
  },
  jobPosted: {
    fontSize: 12,
    color: homeColors.textMuted,
  },
  jobCompany: {
    fontSize: 15,
    color: homeColors.textDark,
    marginBottom: 12,
    fontWeight: '500',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: homeColors.backgroundStart,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  tagText: {
    fontSize: 12,
    color: homeColors.textMuted,
  },
  sourceText: {
    fontSize: 11,
    color: homeColors.textLight,
    marginBottom: 12,
  },
  applyBtn: {
    backgroundColor: homeColors.primary + '15',
    borderWidth: 1,
    borderColor: homeColors.primary + '30',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  applyBtnText: {
    color: homeColors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  pressed: {
    opacity: 0.8,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: homeColors.cardBorder,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: homeColors.textDark,
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  fieldGroup: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: homeColors.textDark,
    marginBottom: 8,
  },
  input: {
    backgroundColor: homeColors.backgroundStart,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: homeColors.textDark,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: homeColors.backgroundStart,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
  },
  chipActive: {
    backgroundColor: homeColors.primary,
    borderColor: homeColors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: homeColors.textMuted,
  },
  chipTextActive: {
    color: '#fff',
  },
  chipSmall: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: homeColors.backgroundStart,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
    minWidth: 44,
    alignItems: 'center',
  },
  chipTextSmall: {
    fontSize: 12,
    fontWeight: '500',
    color: homeColors.textMuted,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  checkboxGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
    marginBottom: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: homeColors.cardBorder,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  checkboxChecked: {
    backgroundColor: homeColors.primary,
    borderColor: homeColors.primary,
  },
  checkboxLabel: {
    fontSize: 14,
    color: homeColors.textDark,
    flex: 1,
  },
  modalActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  clearBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: homeColors.backgroundStart,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
  },
  clearBtnText: {
    color: homeColors.textMuted,
    fontWeight: '600',
    fontSize: 14,
  },
  applyFiltersBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  applyFiltersBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});
