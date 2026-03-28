import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  Modal,
  Switch,
  TouchableWithoutFeedback,
  Keyboard,
  Linking,
  ActivityIndicator,
  RefreshControl,
  Platform,
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../auth/AuthProvider';
import { homeColors } from '../homeTheme';
import { useJobListings } from '../../features/jobs/hooks';
import { JobFilters, JobListing, JobEnrichedDetails } from '../../types/job';
import { fetchJobDetails, extractJobInfo } from '../../api/jobDetails';

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

// Design tokens for consistent spacing and layout
const TOKENS = {
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
  },
  radius: {
    sm: 6,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },
  touchTarget: {
    min: 44, // Minimum 44×44pt for touch targets (iOS Human Interface Guidelines)
  },
} as const;

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

  // Saved jobs state
  const [savedJobs, setSavedJobs] = useState<Set<string>>(new Set());

  // Expandable card state
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());
  const [jobDetailsCache, setJobDetailsCache] = useState<Record<string, JobEnrichedDetails>>({});
  const [loadingDetails, setLoadingDetails] = useState<Set<string>>(new Set());

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); // Ignore haptic errors
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

  // Handler: Toggle job save/favorite
  const toggleSaveJob = useCallback((jobId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSavedJobs(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
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
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setFiltersApplied(true);
    setShowFilters(false);
    // The useJobListings hook will automatically refetch when filters change
  }, []);

  // Handler: Toggle job card expansion
  const toggleJobExpansion = useCallback(async (job: JobListing) => {
    const jobId = job.id;
    const isExpanded = expandedJobs.has(jobId);

    if (isExpanded) {
      // Collapse
      setExpandedJobs(prev => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
    } else {
      // Expand
      setExpandedJobs(prev => {
        const next = new Set(prev);
        next.add(jobId);
        return next;
      });

      // If already cached, nothing to do
      if (jobDetailsCache[jobId]) {
        return;
      }

      // Check if the job listing already has sufficient data
      // JobSpy provides description and sometimes salary - use them!
      const hasDescription = job.description && job.description.length > 100;
      const hasSkills = job.skills && job.skills.length > 0;

      if (hasDescription) {
        // If we already have skills, use directly. Otherwise, use LLM to extract skills.
        if (hasSkills) {
          setJobDetailsCache(prev => ({
            ...prev,
            [jobId]: {
              description: job.description,
              skills: job.skills || [],
              salary: job.salary,
            },
          }));
          return;
        } else {
          // Use LLM to extract skills from the description
          setLoadingDetails(prev => {
            const next = new Set(prev);
            next.add(jobId);
            return next;
          });

          try {
            const extracted = await extractJobInfo(job.description, job.salary_range);
            setJobDetailsCache(prev => ({
              ...prev,
              [jobId]: {
                description: job.description,
                skills: extracted.skills || [],
                salary: extracted.salary || job.salary,
              },
            }));
          } catch (error) {
            console.error('Failed to extract job info with LLM:', error);
            // Fall back to just description, no skills
            setJobDetailsCache(prev => ({
              ...prev,
              [jobId]: {
                description: job.description,
                skills: [],
                salary: job.salary,
              },
            }));
          } finally {
            setLoadingDetails(prev => {
              const next = new Set(prev);
              next.delete(jobId);
              return next;
            });
          }
          return;
        }
      }

      // Only fetch detailed scraped info if the listing lacks description entirely
      setLoadingDetails(prev => {
        const next = new Set(prev);
        next.add(jobId);
        return next;
      });

      try {
        const details = await fetchJobDetails(job.job_url);
        setJobDetailsCache(prev => ({
          ...prev,
          [jobId]: details,
        }));
      } catch (error) {
        console.error('Failed to fetch job details:', error);
        setJobDetailsCache(prev => ({
          ...prev,
          [jobId]: {},
        }));
      } finally {
        setLoadingDetails(prev => {
          const next = new Set(prev);
          next.delete(jobId);
          return next;
        });
      }
    }
  }, [expandedJobs, jobDetailsCache]);

  // Handler: Long press to quickly save job
  const handleJobCardLongPress = useCallback((job: JobListing) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    toggleSaveJob(job.id);
  }, [toggleSaveJob]);

  // Format salary display
  const formatSalary = (job: JobListing): string => {
    if (job.salary_range) return job.salary_range;
    if (job.salary) {
      const { min_amount, max_amount, currency, interval } = job.salary;
      if (min_amount && max_amount) {
        const cur = currency || '$';
        const minK = min_amount >= 1000 ? `${Math.round(min_amount/1000)}k` : min_amount.toLocaleString();
        const maxK = max_amount >= 1000 ? `${Math.round(max_amount/1000)}k` : max_amount.toLocaleString();
        return `${cur}${minK} - ${cur}${maxK}${interval ? `/${interval}` : ''}`;
      } else if (min_amount) {
        return `${currency || '$'}${min_amount.toLocaleString()}+`;
      }
    }
    return 'Not specified';
  };

  // Format salary from enriched details (JobSalary only)
  const formatEnrichedSalary = (salary?: JobListing['salary']): string => {
    if (!salary) return 'Not specified';
    const { min_amount, max_amount, currency, interval } = salary;
    if (min_amount && max_amount) {
      const cur = currency || '$';
      const fmt = (n: number) => n >= 1000 ? `${Math.round(n/1000)}k` : n.toLocaleString();
      return `${cur}${fmt(min_amount)} - ${cur}${fmt(max_amount)}${interval ? `/${interval}` : ''}`;
    } else if (min_amount) {
      return `${currency || '$'}${min_amount.toLocaleString()}+`;
    }
    return 'Not specified';
  };

  // Memoize filtered jobs (though the hook already filters)
  const displayedJobs = useMemo(() => jobs, [jobs]);

  // Render individual job card
  const renderJobCard = useCallback(({ item, index }: { item: JobListing; index: number }) => {
    const jobId = item.id;
    const isExpanded = expandedJobs.has(jobId);
    const details = jobDetailsCache[jobId];
    const isLoading = loadingDetails.has(jobId);
    const isSaved = savedJobs.has(jobId);

    return (
      <Pressable
        style={({ pressed }) => [
          styles.jobCard,
          pressed && styles.cardPressed
        ]}
        onLongPress={() => handleJobCardLongPress(item)}
        delayLongPress={500}
        accessibilityLabel={`Job: ${item.title} at ${item.company}. Long press to save for later.`}
      >
        {/* Header with title and save button */}
        <View style={styles.jobHeader}>
          <Text
            style={[styles.jobTitle, { marginRight: 0 }]}
            numberOfLines={isExpanded ? 0 : 2}
          >
            {item.title}
          </Text>
          <Pressable
            style={styles.saveBtn}
            onPress={() => toggleSaveJob(jobId)}
            accessibilityRole="button"
            accessibilityLabel={isSaved ? 'Remove from saved jobs' : 'Save job for later'}
            accessibilityState={{ checked: isSaved }}
          >
            <Ionicons
              name={isSaved ? 'bookmark' : 'bookmark-outline'}
              size={22}
              color={isSaved ? homeColors.primary : homeColors.textMuted}
            />
          </Pressable>
        </View>

        <Text style={styles.jobCompany} accessibilityRole="text">{item.company}</Text>

        {/* Simplified tag row - priority: Location, Job Type, then Salary if space */}
        <View style={styles.tagsRow}>
          <View style={styles.tag}>
            <Ionicons name="location-outline" size={14} color={homeColors.textMuted} />
            <Text style={styles.tagText} numberOfLines={1}>
              {item.is_remote ? 'Remote' : item.location || 'Unknown location'}
            </Text>
          </View>

          <View style={styles.tag}>
            <Ionicons name="time-outline" size={14} color={homeColors.textMuted} />
            <Text style={styles.tagText}>
              {item.job_type ? item.job_type.charAt(0).toUpperCase() + item.job_type.slice(1) : 'N/A'}
            </Text>
          </View>

          {/* Show salary only if meaningful */}
          {(details?.salary || item.salary) && (
            <View style={styles.tag}>
              <Ionicons name="cash-outline" size={14} color={homeColors.primary} />
              <Text style={[styles.tagText, { color: homeColors.primary, fontWeight: '600' }]} numberOfLines={1}>
                {details?.salary ? formatEnrichedSalary(details.salary) : formatSalary(item)}
              </Text>
            </View>
          )}
        </View>

        {/* Optional: job board source */}
        {item.site && (
          <Text style={styles.sourceText}>Source: {SITE_LABELS[item.site] || item.site}</Text>
        )}

        {/* Description preview (always shown, expands when isExpanded) */}
        {(details?.description || item.description) && (
          <View style={styles.descriptionPreview}>
            <Text style={styles.descriptionText} numberOfLines={isExpanded ? 0 : 3}>
              {details?.description || item.description}
            </Text>
            {(details?.description || item.description).length > 200 && (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  toggleJobExpansion(item);
                }}
                style={styles.showMoreBtn}
                accessibilityRole="button"
                accessibilityLabel={isExpanded ? 'Show less job description' : 'Show full job description'}
                accessibilityState={{ expanded: isExpanded }}
              >
                <Text style={styles.showMoreBtnText}>
                  {isExpanded ? 'Show Less' : 'Show More'}
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Expanded content: Skills only */}
        {isExpanded && (
          <View style={styles.expandedContent}>
            {isLoading ? (
              <View style={styles.loadingDetails}>
                <ActivityIndicator size="small" color={homeColors.primary} />
                <Text style={styles.loadingDetailsText}>Loading skills...</Text>
              </View>
            ) : (
              <>
                {(details?.skills?.length || item.skills?.length) > 0 && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Required Skills</Text>
                    <View style={styles.skillsContainer}>
                      {(details?.skills || item.skills || []).map((skill, idx) => (
                        <View key={idx} style={styles.skillTag}>
                          <Text style={styles.skillTagText}>{skill}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
                {!details?.skills?.length && !item.skills?.length && !isLoading && (
                  <Text style={styles.noDetailsText}>No skills listed.</Text>
                )}
              </>
            )}
          </View>
        )}

        <Pressable
          style={({ pressed }) => [styles.applyBtn, pressed && styles.pressed]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            handleApply(item.job_url);
          }}
          accessibilityRole="link"
          accessibilityLabel={`Apply for ${item.title} at ${item.company}`}
          accessibilityHint="Opens job application in browser"
        >
          <Text style={styles.applyBtnText}>Apply Now</Text>
        </Pressable>
      </Pressable>
    );
  }, [expandedJobs, jobDetailsCache, loadingDetails, toggleJobExpansion, toggleSaveJob, handleApply, handleJobCardLongPress]);

  return (
    <View style={[styles.container, { backgroundColor: homeColors.backgroundStart }]}>
      {/* Header with Search */}
      <View style={[styles.headerRow, { paddingTop: Math.max(insets.top, 20), backgroundColor: homeColors.cardBg }]}>
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
              accessibilityLabel="Job search"
              accessibilityHint="Enter keywords to search jobs"
              autoCorrect={false}
              autoCapitalize="none"
            />
            {filters.search ? (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  updateFilter('search', '');
                }}
                style={styles.clearSearchBtn}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={20} color={homeColors.textMuted} />
              </Pressable>
            ) : null}
          </View>

          {/* Results count or filter indicator */}
          <View style={styles.headerFooter}>
            {jobs.length > 0 && (
              <Text style={styles.resultsText} accessibilityLiveRegion="polite">
                {jobs.length} jobs found
              </Text>
            )}
            {filtersApplied && (
              <View style={styles.filtersAppliedBadge}>
                <Text style={styles.filtersAppliedText}>Filters active</Text>
              </View>
            )}
          </View>
        </View>

        {/* Filter button */}
        <Pressable
          style={[styles.filterBtn, filtersApplied && styles.filterBtnActive]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            setShowFilters(true);
          }}
          accessibilityRole="button"
          accessibilityLabel="Filter options"
          accessibilityHint="Opens filter modal to refine job search"
          accessibilityState={{ selected: filtersApplied }}
        >
          <Ionicons name="options" size={24} color={homeColors.primary} />
        </Pressable>
      </View>

      {/* Job List */}
      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id}
        renderItem={renderJobCard}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refetch} colors={[homeColors.primary]} />
        }
        // Performance optimizations
        initialNumToRender={5}
        maxToRenderPerBatch={10}
        windowSize={10}
        removeClippedSubviews={true}
        ListEmptyComponent={
          !error && loading && jobs.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={homeColors.primary} />
              <Text style={styles.loadingText}>Searching jobs...</Text>
              <Text style={styles.loadingSubtext}>This may take 10-30 seconds</Text>
            </View>
          ) : !error && !loading && jobs.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="briefcase-outline" size={64} color={homeColors.textMuted} />
              <Text style={styles.emptyText}>No jobs found</Text>
              <Text style={styles.emptySubtext}>Try adjusting your filters or search terms</Text>
              <Pressable
                style={styles.emptyActionBtn}
                onPress={clearFilters}
                accessibilityRole="button"
                accessibilityLabel="Clear all filters"
              >
                <Text style={styles.emptyActionBtnText}>Clear All Filters</Text>
              </Pressable>
            </View>
          ) : null
        }
        ListHeaderComponent={error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={48} color={homeColors.textMuted} />
            <Text style={styles.errorText}>Failed to load jobs. Please try again.</Text>
            <Pressable style={styles.retryBtn} onPress={refetch} accessibilityRole="button">
              <Text style={styles.retryBtnText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}
      />

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
              <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 20), backgroundColor: homeColors.cardBg }]}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Filter Jobs</Text>
                  <View style={styles.headerRightButtons}>
                    <Pressable
                      style={styles.cancelBtn}
                      onPress={() => setShowFilters(false)}
                      accessibilityRole="button"
                      accessibilityLabel="Cancel and close filters"
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setShowFilters(false)}
                      accessibilityRole="button"
                      accessibilityLabel="Close filter modal"
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close" size={28} color={homeColors.textMuted} />
                    </Pressable>
                  </View>
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
                      accessibilityLabel="Job location"
                      accessibilityHint="Enter city, state, or type Remote"
                      autoCorrect={false}
                      autoCapitalize="none"
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
                          accessibilityRole="button"
                          accessibilityLabel={`${type === 'all' ? 'All job types' : type} employment type`}
                          accessibilityState={{ selected: type === 'all' ? !filters.jobType : filters.jobType === type }}
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
                        accessibilityLabel="Remote only filter"
                        accessibilityHint="Show only remote jobs"
                        accessibilityRole="switch"
                      />
                    </View>
                  </View>

                  {/* Job boards */}
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Job Boards</Text>
                    <Text style={styles.fieldHelper}>Select at least one job board to search</Text>
                    <View style={styles.checkboxGrid}>
                      {ALL_SITES.map(site => (
                        <Pressable
                          key={site}
                          style={styles.checkboxItem}
                          onPress={() => toggleSite(site)}
                        >
                          <Pressable
                            style={styles.checkboxTouchArea}
                            onPress={() => toggleSite(site)}
                          >
                            <View style={[styles.checkbox, filters.siteNames?.includes(site) && styles.checkboxChecked]}>
                              {filters.siteNames?.includes(site) && (
                                <Ionicons name="checkmark" size={16} color="#fff" />
                              )}
                            </View>
                          </Pressable>
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
                          accessibilityRole="button"
                          accessibilityLabel={`Show ${num} results per page`}
                          accessibilityState={{ selected: filters.resultsWanted === num }}
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
                  <Pressable
                    style={styles.clearBtn}
                    onPress={clearFilters}
                    accessibilityRole="button"
                    accessibilityLabel="Clear all filters"
                  >
                    <Text style={styles.clearBtnText}>Clear All</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.applyFiltersBtn, { backgroundColor: homeColors.primary }]}
                    onPress={handleApplyFilters}
                    accessibilityRole="button"
                    accessibilityLabel="Apply current filter settings"
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
    paddingHorizontal: TOKENS.spacing.lg,
    paddingBottom: TOKENS.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: homeColors.cardBorder,
    backgroundColor: homeColors.surface,
  },
  headerContent: {
    flex: 1,
    marginRight: TOKENS.spacing.md,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: homeColors.textDark,
    marginBottom: TOKENS.spacing.xs,
  },
  headerSubtitle: {
    fontSize: 14,
    color: homeColors.textMuted,
    marginBottom: TOKENS.spacing.md,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: homeColors.backgroundStart,
    borderRadius: TOKENS.radius.lg,
    paddingHorizontal: TOKENS.spacing.md,
    paddingVertical: TOKENS.spacing.sm,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
    marginBottom: TOKENS.spacing.sm,
    minHeight: TOKENS.touchTarget.min,
  },
  searchInput: {
    flex: 1,
    marginLeft: TOKENS.spacing.sm,
    fontSize: 16,
    color: homeColors.textDark,
    padding: 0,
    includeFontPadding: false,
  },
  clearSearchBtn: {
    padding: TOKENS.spacing.xs,
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
    paddingHorizontal: TOKENS.spacing.sm,
    paddingVertical: TOKENS.spacing.xs,
    borderRadius: TOKENS.radius.full,
  },
  filtersAppliedText: {
    fontSize: 11,
    color: homeColors.accentGreen,
    fontWeight: '600',
  },
  filterBtn: {
    width: TOKENS.touchTarget.min,
    height: TOKENS.touchTarget.min,
    borderRadius: TOKENS.touchTarget.min / 2,
    backgroundColor: homeColors.backgroundStart,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
    marginTop: 4,
  },
  filterBtnActive: {
    backgroundColor: homeColors.primary + '20',
    borderColor: homeColors.primary,
  },
  listContent: {
    padding: TOKENS.spacing.lg,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: TOKENS.spacing.lg,
    fontSize: 16,
    fontWeight: '600',
    color: homeColors.textDark,
  },
  loadingSubtext: {
    marginTop: TOKENS.spacing.sm,
    fontSize: 13,
    color: homeColors.textMuted,
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  errorText: {
    marginTop: TOKENS.spacing.md,
    fontSize: 16,
    color: homeColors.textDark,
    textAlign: 'center',
    marginHorizontal: 40,
  },
  retryBtn: {
    marginTop: TOKENS.spacing.md,
    paddingVertical: TOKENS.spacing.sm,
    paddingHorizontal: TOKENS.spacing.lg,
    backgroundColor: homeColors.primary + '20',
    borderRadius: TOKENS.radius.lg,
    borderWidth: 1,
    borderColor: homeColors.primary + '30',
    minHeight: TOKENS.touchTarget.min,
  },
  retryBtnText: {
    color: homeColors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: TOKENS.spacing.lg,
    fontSize: 18,
    fontWeight: '700',
    color: homeColors.textDark,
  },
  emptySubtext: {
    marginTop: TOKENS.spacing.sm,
    fontSize: 14,
    color: homeColors.textMuted,
    textAlign: 'center',
    marginHorizontal: 40,
  },
  emptyActionBtn: {
    marginTop: TOKENS.spacing.lg,
    paddingVertical: TOKENS.spacing.sm,
    paddingHorizontal: TOKENS.spacing.lg,
    backgroundColor: homeColors.primary + '20',
    borderRadius: TOKENS.radius.lg,
    borderWidth: 1,
    borderColor: homeColors.primary + '30',
    minHeight: TOKENS.touchTarget.min,
  },
  emptyActionBtnText: {
    color: homeColors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  jobCard: {
    backgroundColor: homeColors.cardBg,
    borderRadius: TOKENS.radius.xl,
    padding: TOKENS.spacing.lg,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: TOKENS.spacing.sm,
  },
  jobTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: homeColors.textDark,
    marginRight: TOKENS.spacing.sm,
    lineHeight: 24,
  },
  saveBtn: {
    padding: TOKENS.spacing.xs,
    marginLeft: TOKENS.spacing.xs,
  },
  jobCompany: {
    fontSize: 15,
    color: homeColors.textDark,
    marginBottom: TOKENS.spacing.md,
    fontWeight: '500',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: TOKENS.spacing.sm,
    marginBottom: TOKENS.spacing.md,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: homeColors.backgroundStart,
    paddingHorizontal: TOKENS.spacing.sm,
    paddingVertical: TOKENS.spacing.xs,
    borderRadius: TOKENS.radius.md,
    gap: TOKENS.spacing.xs,
  },
  tagText: {
    fontSize: 12,
    color: homeColors.textMuted,
  },
  sourceText: {
    fontSize: 11,
    color: homeColors.textLight,
    marginBottom: TOKENS.spacing.sm,
  },
  descriptionPreview: {
    marginBottom: TOKENS.spacing.sm,
  },
  descriptionText: {
    fontSize: 14,
    color: homeColors.textDark,
    lineHeight: 20,
  },
  showMoreBtn: {
    alignSelf: 'flex-start',
    paddingVertical: TOKENS.spacing.xs,
    paddingHorizontal: TOKENS.spacing.sm,
    marginTop: TOKENS.spacing.xs,
    minHeight: TOKENS.touchTarget.min - 12,
  },
  showMoreBtnText: {
    color: homeColors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  expandedContent: {
    marginTop: TOKENS.spacing.md,
    paddingTop: TOKENS.spacing.md,
    borderTopWidth: 1,
    borderTopColor: homeColors.cardBorder,
    backgroundColor: homeColors.backgroundStart,
    borderRadius: TOKENS.radius.md,
    padding: TOKENS.spacing.md,
    marginBottom: TOKENS.spacing.md,
  },
  loadingDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: TOKENS.spacing.lg,
    gap: TOKENS.spacing.md,
  },
  loadingDetailsText: {
    fontSize: 14,
    color: homeColors.textMuted,
  },
  detailSection: {
    marginBottom: TOKENS.spacing.md,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: homeColors.textDark,
    marginBottom: TOKENS.spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: TOKENS.spacing.sm,
  },
  skillTag: {
    backgroundColor: homeColors.primary + '15',
    borderWidth: 1,
    borderColor: homeColors.primary + '30',
    paddingHorizontal: TOKENS.spacing.sm,
    paddingVertical: TOKENS.spacing.xs,
    borderRadius: TOKENS.radius.sm,
  },
  skillTagText: {
    fontSize: 12,
    color: homeColors.primary,
    fontWeight: '500',
  },
  noDetailsText: {
    fontSize: 14,
    color: homeColors.textMuted,
    fontStyle: 'italic',
  },
  applyBtn: {
    backgroundColor: homeColors.primary + '20',
    borderWidth: 1,
    borderColor: homeColors.primary + '30',
    paddingVertical: TOKENS.spacing.sm,
    paddingHorizontal: TOKENS.spacing.md,
    borderRadius: TOKENS.radius.md,
    alignItems: 'center',
    minHeight: TOKENS.touchTarget.min,
  },
  applyBtnText: {
    color: homeColors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  pressed: {
    opacity: 0.7,
  },
  cardPressed: {
    opacity: 0.9,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: TOKENS.radius.xl,
    borderTopRightRadius: TOKENS.radius.xl,
    maxHeight: '90%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: TOKENS.spacing.lg,
    paddingVertical: TOKENS.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: homeColors.cardBorder,
  },
  headerRightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cancelBtn: {
    paddingVertical: TOKENS.spacing.xs,
    paddingHorizontal: TOKENS.spacing.sm,
    marginRight: TOKENS.spacing.xs,
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: homeColors.textMuted,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: homeColors.textDark,
  },
  modalBody: {
    paddingHorizontal: TOKENS.spacing.lg,
    paddingTop: TOKENS.spacing.md,
    paddingBottom: TOKENS.spacing.sm,
  },
  fieldGroup: {
    marginBottom: TOKENS.spacing.xl,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: homeColors.textDark,
    marginBottom: TOKENS.spacing.sm,
  },
  fieldHelper: {
    fontSize: 12,
    color: homeColors.textMuted,
    marginTop: TOKENS.spacing.xs,
    marginBottom: TOKENS.spacing.sm,
  },
  input: {
    backgroundColor: homeColors.backgroundStart,
    borderRadius: TOKENS.radius.lg,
    paddingHorizontal: TOKENS.spacing.md,
    paddingVertical: TOKENS.spacing.sm,
    fontSize: 16,
    color: homeColors.textDark,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
    minHeight: TOKENS.touchTarget.min,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: TOKENS.spacing.sm,
  },
  chip: {
    paddingHorizontal: TOKENS.spacing.md,
    paddingVertical: TOKENS.spacing.sm,
    borderRadius: TOKENS.radius.full,
    backgroundColor: homeColors.backgroundStart,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
  },
  chipActive: {
    backgroundColor: homeColors.primary + '20',
    borderColor: homeColors.primary,
  },
  chipText: {
    fontSize: 14,
    color: homeColors.textDark,
  },
  chipTextActive: {
    color: homeColors.primary,
    fontWeight: '600',
  },
  chipSmall: {
    paddingHorizontal: TOKENS.spacing.sm,
    paddingVertical: TOKENS.spacing.sm,
    borderRadius: TOKENS.radius.full,
    backgroundColor: homeColors.backgroundStart,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
    minWidth: TOKENS.touchTarget.min,
    alignItems: 'center',
    minHeight: 36,
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
    gap: TOKENS.spacing.md,
  },
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
    marginBottom: TOKENS.spacing.sm,
  },
  checkboxTouchArea: {
    padding: TOKENS.spacing.sm,
  },
  checkbox: {
    width: TOKENS.touchTarget.min,
    height: TOKENS.touchTarget.min,
    borderRadius: TOKENS.radius.md,
    borderWidth: 2,
    borderColor: homeColors.cardBorder,
    backgroundColor: homeColors.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingHorizontal: TOKENS.spacing.lg,
    paddingVertical: TOKENS.spacing.md,
    borderTopWidth: 1,
    gap: TOKENS.spacing.md,
  },
  clearBtn: {
    flex: 1,
    paddingVertical: TOKENS.spacing.sm,
    borderRadius: TOKENS.radius.lg,
    alignItems: 'center',
    backgroundColor: homeColors.backgroundStart,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
    minHeight: TOKENS.touchTarget.min,
  },
  clearBtnText: {
    color: homeColors.textMuted,
    fontWeight: '600',
    fontSize: 14,
  },
  applyFiltersBtn: {
    flex: 1,
    paddingVertical: TOKENS.spacing.sm,
    borderRadius: TOKENS.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: TOKENS.touchTarget.min,
  },
  applyFiltersBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});
