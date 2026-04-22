import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useMentor,
  useMentorByUserId,
  useMentorReviews,
  useUserProfile,
} from '../../features/mentors/hooks';
import { useAuth } from '../../auth/AuthProvider';
import { homeColors } from '../homeTheme';

export function MentorDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const params = route.params as { mentorId?: string; userId?: string };
  const { state } = useAuth();
  const currentUser = state.user;

  const { mentor: mentorById, loading: loadingById } = useMentor(params.mentorId || '');
  const { mentor: mentorByUserId, loading: loadingByUserId } = useMentorByUserId(params.userId || '');
  const { user: userProfile, loading: userLoading } = useUserProfile(params.userId || '');

  const mentor = params.mentorId ? mentorById : mentorByUserId;
  const mentorLoading = params.mentorId ? loadingById : loadingByUserId;

  const isMentor = !!mentor;
  const isLoading = isMentor ? mentorLoading : userLoading;
  const profileData = isMentor ? mentor : userProfile;

  const { reviews, submitReview } = useMentorReviews(mentor?.id || '');

  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const ratingText = useMemo(() => {
    if (!mentor) return 'N/A';
    return mentor.rating.toFixed(1);
  }, [mentor]);

  const specialties = useMemo(() => {
    if (!mentor) return [];
    return mentor.specialties || mentor.mentor_specialties || [];
  }, [mentor]);

  const handleSubmitReview = async () => {
    if (!currentUser || !mentor) {
      Alert.alert('Error', 'You must be logged in to submit a review');
      return;
    }

    try {
      setSubmittingReview(true);
      await submitReview(currentUser.id, reviewRating, reviewComment);
      Alert.alert('Success', 'Review submitted successfully');
      setShowReviewModal(false);
      setReviewRating(5);
      setReviewComment('');
    } catch (error) {
      Alert.alert('Error', 'Failed to submit review. Please try again.');
      console.error(error);
    } finally {
      setSubmittingReview(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={homeColors.primary} />
      </View>
    );
  }

  if (!profileData) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>User not found</Text>
      </View>
    );
  }

  if (!isMentor && userProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={[styles.topHeader, { paddingTop: Math.max(insets.top, 8) }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.circleHeaderButton}>
            <Ionicons name="arrow-back" size={20} color="#1f1930" />
          </TouchableOpacity>
          <Text style={styles.topHeaderTitle}>Mentor Profile</Text>
          <View style={styles.circleHeaderButtonGhost} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.profileFallbackCard}>
            <View style={styles.fallbackAvatarWrap}>
              {userProfile.avatar ? (
                <Image source={{ uri: userProfile.avatar }} style={styles.fallbackAvatar} />
              ) : (
                <View style={[styles.fallbackAvatar, styles.fallbackAvatarPlaceholder]}>
                  <Text style={styles.fallbackAvatarText}>
                    {(userProfile.name || userProfile.email || 'U').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.fallbackName}>{userProfile.name || userProfile.email || 'User'}</Text>
            <Text style={styles.fallbackRole}>Community Member</Text>
            {userProfile.bio ? <Text style={styles.fallbackBio}>{userProfile.bio}</Text> : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const mentorProfile = mentor;
  const contentHorizontalPadding = 32;
  const statsGap = 10;
  const availableWidth = Math.max(width - contentHorizontalPadding, 0);
  const isVerySmallScreen = width < 340;
  const statCardWidth = isVerySmallScreen
    ? availableWidth
    : Math.max((availableWidth - statsGap) / 2, 130);

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.topHeader, { paddingTop: Math.max(insets.top, 8) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.circleHeaderButton}>
          <Ionicons name="arrow-back" size={20} color="#1f1930" />
        </TouchableOpacity>
        <Text style={styles.topHeaderTitle}>Mentor Profile</Text>
        <TouchableOpacity
          disabled={!mentorProfile}
          onPress={() =>
            mentorProfile &&
            navigation.navigate('SessionBooking', {
              mentorId: mentorProfile.id,
              mentorName: mentorProfile.name,
            })
          }
          style={styles.headerBookButton}
        >
          <Text style={styles.headerBookButtonText}>Book Now</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(28, insets.bottom + 20) }]}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={['#f2e7ff', '#f7f4ff']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroImageWrap}>
            {mentorProfile?.avatar ? (
              <Image source={{ uri: mentorProfile.avatar }} style={styles.heroImage} resizeMode="cover" />
            ) : (
              <View style={[styles.heroImage, styles.heroImagePlaceholder]}>
                <Text style={styles.heroImageInitial}>{mentorProfile?.name.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            {mentorProfile?.is_verified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={18} color={homeColors.primary} />
                <Text style={styles.verifiedBadgeText}>Verified</Text>
              </View>
            )}
          </View>

          <Text style={styles.heroName}>{mentorProfile?.name}</Text>
          <Text style={styles.heroRole}>
            {mentorProfile?.role || 'Expert Mentor'}
            {mentorProfile?.company ? ` @ ${mentorProfile.company}` : ''}
          </Text>

          <View style={styles.heroMetaRow}>
            <View style={styles.ratingPill}>
              <Ionicons name="star" size={14} color="#f59e0b" />
              <Text style={styles.ratingPillText}>{ratingText}</Text>
            </View>
            <Text style={styles.heroMetaText}>({mentorProfile?.total_reviews || 0} reviews)</Text>
            <Text style={styles.heroMetaDot}>•</Text>
            <Text style={styles.heroMetaText}>{mentorProfile?.years_of_experience || 0}+ years exp</Text>
          </View>
        </LinearGradient>

        <View style={styles.actionCluster}>
          <Pressable
            onPress={() =>
              mentorProfile &&
              navigation.navigate('SessionBooking', {
                mentorId: mentorProfile.id,
                mentorName: mentorProfile.name,
              })
            }
            style={({ pressed }) => [styles.primaryAction, pressed && styles.actionPressed]}
          >
            <LinearGradient
              colors={[homeColors.primary, homeColors.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryActionGradient}
            >
              <Ionicons name="calendar-outline" size={18} color="#fff" />
              <Text style={styles.primaryActionText}>Book a Session</Text>
            </LinearGradient>
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate('GroupChats')}
            style={({ pressed }) => [styles.secondaryAction, pressed && styles.actionPressed]}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={homeColors.primary} />
            <Text style={styles.secondaryActionText}>Send Message</Text>
          </Pressable>
        </View>

        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { width: statCardWidth }]}>
            <Text style={styles.statLabel}>RATING</Text>
            <Text style={styles.statValue}>{ratingText}</Text>
            <Text style={styles.statSubLabel}>Average score</Text>
          </View>
          <View style={[styles.statCard, { width: statCardWidth }]}>
            <Text style={styles.statLabel}>REVIEWS</Text>
            <Text style={styles.statValue}>{mentorProfile?.total_reviews || 0}+</Text>
            <Text style={styles.statSubLabel}>Student feedback</Text>
          </View>
          <View style={[styles.statCard, { width: statCardWidth }]}>
            <Text style={styles.statLabel}>EXPERIENCE</Text>
            <Text style={styles.statValue}>{mentorProfile?.years_of_experience || 0}+Y</Text>
            <Text style={styles.statSubLabel}>Professional track</Text>
          </View>
          <View style={[styles.statCard, { width: statCardWidth }]}>
            <Text style={styles.statLabel}>RESPONSE</Text>
            <Text style={styles.statValue}>Fast</Text>
            <Text style={styles.statSubLabel}>Usually same day</Text>
          </View>
        </View>

        {mentorProfile?.bio ? (
          <View style={styles.section}>
            <Text style={styles.sectionKicker}>PROFESSIONAL NARRATIVE</Text>
            <Text style={styles.narrativeQuote}>
              "My passion is helping learners bridge theory with practical engineering excellence."
            </Text>
            <Text style={styles.sectionBody}>{mentorProfile.bio}</Text>
          </View>
        ) : null}

        {specialties.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionKicker}>SPECIALTIES</Text>
            <View style={styles.specialtiesWrap}>
              {specialties.map((specialty) => (
                <View key={specialty.id} style={styles.specialtyChip}>
                  <Text style={styles.specialtyChipText}>{specialty.specialty}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.reviewsHeadRow}>
            <Text style={styles.sectionKicker}>RECENT TESTIMONIALS</Text>
            <TouchableOpacity onPress={() => setShowReviewModal(true)}>
              <Text style={styles.leaveReviewText}>Leave Review</Text>
            </TouchableOpacity>
          </View>

          {reviews.length === 0 ? (
            <View style={styles.emptyReviewCard}>
              <Text style={styles.emptyReviewText}>No reviews yet. Be the first to review.</Text>
            </View>
          ) : (
            reviews.map((review) => (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewTopRow}>
                  <View style={styles.reviewerAvatar}>
                    <Text style={styles.reviewerAvatarText}>U</Text>
                  </View>
                  <View style={styles.reviewMetaBlock}>
                    <Text style={styles.reviewAuthor}>Student Feedback</Text>
                    <Text style={styles.reviewDate}>
                      {review.created_at
                        ? new Date(review.created_at).toLocaleDateString()
                        : 'Recent'}
                    </Text>
                  </View>
                  <View style={styles.reviewStarsRow}>
                    {Array.from({ length: review.rating }).map((_, i) => (
                      <Ionicons key={i} name="star" size={14} color="#f59e0b" />
                    ))}
                  </View>
                </View>
                {review.comment ? <Text style={styles.reviewText}>"{review.comment}"</Text> : null}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Modal visible={showReviewModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Leave a Review</Text>
              <TouchableOpacity onPress={() => setShowReviewModal(false)}>
                <Ionicons name="close" size={22} color="#475569" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalCaption}>How would you rate this mentor?</Text>
            <View style={styles.modalStarsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setReviewRating(star)} style={styles.modalStarButton}>
                  <Ionicons
                    name={star <= reviewRating ? 'star' : 'star-outline'}
                    size={34}
                    color="#f59e0b"
                  />
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              placeholder="Share your experience (optional)"
              placeholderTextColor="#94a3b8"
              value={reviewComment}
              onChangeText={setReviewComment}
              style={styles.modalInput}
              textAlignVertical="top"
              multiline
              numberOfLines={4}
              maxLength={500}
            />
            <Text style={styles.modalCounter}>{reviewComment.length}/500</Text>

            <Pressable
              disabled={submittingReview}
              onPress={handleSubmitReview}
              style={({ pressed }) => [styles.modalSubmitButton, pressed && styles.actionPressed]}
            >
              <LinearGradient
                colors={[homeColors.primary, homeColors.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.modalSubmitGradient}
              >
                {submittingReview ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalSubmitText}>Submit Review</Text>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f4fb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f6f4fb',
  },
  errorText: {
    marginTop: 12,
    color: '#64748b',
    fontSize: 15,
  },
  topHeader: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f6f4fb',
  },
  topHeaderTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#1f1930',
    letterSpacing: 0.2,
  },
  circleHeaderButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#efe9fb',
  },
  circleHeaderButtonGhost: {
    width: 40,
    height: 40,
  },
  headerBookButton: {
    backgroundColor: homeColors.primary,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  headerBookButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 14,
  },
  heroCard: {
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9defb',
  },
  heroImageWrap: {
    alignItems: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  heroImage: {
    width: 160,
    height: 180,
    borderRadius: 18,
  },
  heroImagePlaceholder: {
    backgroundColor: '#d9cdf8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroImageInitial: {
    color: '#fff',
    fontSize: 46,
    fontWeight: '800',
  },
  verifiedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  verifiedBadgeText: {
    color: '#1f1930',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  heroName: {
    textAlign: 'center',
    fontSize: 28,
    fontWeight: '900',
    color: '#1f1930',
    letterSpacing: 0.2,
  },
  heroRole: {
    marginTop: 4,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: homeColors.primary,
  },
  heroMetaRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  ratingPillText: {
    color: '#1f1930',
    fontWeight: '800',
    fontSize: 13,
  },
  heroMetaText: {
    color: '#5b6475',
    fontSize: 12,
    fontWeight: '600',
  },
  heroMetaDot: {
    color: '#94a3b8',
    fontSize: 12,
  },
  actionCluster: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryAction: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  primaryActionGradient: {
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryActionText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  secondaryAction: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d9cee9',
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  secondaryActionText: {
    color: '#1f1930',
    fontWeight: '800',
    fontSize: 14,
  },
  actionPressed: {
    opacity: 0.85,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ece6f7',
    padding: 14,
  },
  statLabel: {
    color: '#7f8796',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  statValue: {
    marginTop: 4,
    color: '#1f1930',
    fontSize: 25,
    fontWeight: '900',
  },
  statSubLabel: {
    color: '#7f8796',
    fontSize: 12,
    marginTop: 2,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ece6f7',
    padding: 16,
  },
  sectionKicker: {
    color: '#7f8796',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.7,
    marginBottom: 10,
  },
  narrativeQuote: {
    color: '#1f1930',
    fontSize: 19,
    fontWeight: '800',
    lineHeight: 26,
    marginBottom: 10,
  },
  sectionBody: {
    color: '#556070',
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '500',
  },
  specialtiesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  specialtyChip: {
    backgroundColor: '#f0e9fd',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  specialtyChipText: {
    color: homeColors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  reviewsHeadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  leaveReviewText: {
    color: homeColors.primary,
    fontWeight: '800',
    fontSize: 12,
  },
  emptyReviewCard: {
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#f8f5ff',
  },
  emptyReviewText: {
    color: '#6b7280',
    fontSize: 13,
  },
  reviewCard: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ece6f7',
    padding: 14,
    backgroundColor: '#fff',
  },
  reviewTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#ece6f7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewerAvatarText: {
    color: '#3c2b63',
    fontWeight: '800',
  },
  reviewMetaBlock: {
    marginLeft: 10,
  },
  reviewAuthor: {
    color: '#1f1930',
    fontWeight: '700',
    fontSize: 13,
  },
  reviewDate: {
    color: '#8a94a4',
    fontSize: 11,
    marginTop: 2,
  },
  reviewStarsRow: {
    marginLeft: 'auto',
    flexDirection: 'row',
    gap: 2,
  },
  reviewText: {
    marginTop: 10,
    color: '#5b6475',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(20, 15, 34, 0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    color: '#1f1930',
    fontWeight: '800',
    fontSize: 20,
  },
  modalCaption: {
    marginTop: 16,
    color: '#64748b',
    fontWeight: '600',
    fontSize: 13,
  },
  modalStarsRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  modalStarButton: {
    padding: 4,
  },
  modalInput: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    minHeight: 100,
    padding: 12,
    color: '#1f2937',
    fontSize: 14,
    backgroundColor: '#f8fafc',
  },
  modalCounter: {
    marginTop: 6,
    color: '#8a94a4',
    fontSize: 11,
  },
  modalSubmitButton: {
    marginTop: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalSubmitGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
  profileFallbackCard: {
    marginTop: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#ece6f7',
    backgroundColor: '#fff',
    padding: 18,
    alignItems: 'center',
  },
  fallbackAvatarWrap: {
    marginBottom: 12,
  },
  fallbackAvatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
  },
  fallbackAvatarPlaceholder: {
    backgroundColor: '#e6dcfb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackAvatarText: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '800',
  },
  fallbackName: {
    color: '#1f1930',
    fontWeight: '900',
    fontSize: 24,
  },
  fallbackRole: {
    marginTop: 4,
    color: '#6b7280',
    fontWeight: '600',
  },
  fallbackBio: {
    marginTop: 12,
    color: '#5b6475',
    textAlign: 'center',
    lineHeight: 21,
  },
});
