import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  Image,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMentor, useMentorByUserId, useMentorReviews, useMentorSessions, useUserProfile } from '../../features/mentors/hooks';
import { useAuth } from '../../auth/AuthProvider';
import { homeColors } from '../homeTheme';

export function MentorDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const params = route.params as { mentorId?: string; userId?: string };
  const { state } = useAuth();
  const user = state.user;

  // Fetch mentor by mentorId or userId depending on what's provided
  const { mentor: mentorById, loading: loadingById } = useMentor(params.mentorId || '');
  const { mentor: mentorByUserId, loading: loadingByUserId } = useMentorByUserId(params.userId || '');
  
  // Fetch user profile if userId is provided (for non-mentor users)
  const { user: userProfile, loading: userLoading } = useUserProfile(params.userId || '');
  
  const mentor = params.mentorId ? mentorById : mentorByUserId;
  const mentorLoading = params.mentorId ? loadingById : loadingByUserId;

  // Determine if we're loading and if we found a mentor
  const isMentor = !!mentor;
  const isLoading = isMentor ? mentorLoading : userLoading;
  const profileData = isMentor ? mentor : userProfile;

  const { reviews, submitReview } = useMentorReviews(mentor?.id || '');

  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

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

  // If it's a regular user (not a mentor), show simplified user profile
  if (!isMentor && userProfile) {
    return (
      <ScrollView style={styles.container}>
        <LinearGradient
          colors={[homeColors.primary, homeColors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}
        >
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.avatarContainer}>
            {userProfile.avatar ? (
              <Image
                source={{ uri: userProfile.avatar }}
                style={styles.avatar}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {userProfile.name?.charAt(0).toUpperCase() || userProfile.email?.charAt(0).toUpperCase() || 'U'}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.mentorName}>{userProfile.name || userProfile.email || 'User'}</Text>
          <Text style={styles.mentorRole}>Community Member</Text>
        </LinearGradient>

        <View style={styles.content}>
          {userProfile.email && (
            <View style={styles.infoCard}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{userProfile.email}</Text>
              </View>
            </View>
          )}

          {userProfile.bio && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.bioText}>{userProfile.bio}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    );
  }

  // If it's a mentor, show full mentor profile
  const mentorProfile = mentor;

  const handleSubmitReview = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to submit a review');
      return;
    }

    try {
      setSubmittingReview(true);
      await submitReview(user.id, reviewRating, reviewComment);
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

  const averageRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : 'N/A';

  return (
    <ScrollView style={styles.container}>
      {/* Mentor Header with Gradient */}
      <LinearGradient
        colors={[homeColors.primary, homeColors.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}
      >
        <TouchableOpacity style={[styles.backButton, { top: Math.max(insets.top, 20) + 10 }]} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={[styles.headerActions, { top: Math.max(insets.top, 20) + 10 }]}>
          <TouchableOpacity style={styles.headerActionBtn} onPress={() => navigation.navigate('MySessions')}>
            <Ionicons name="calendar-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={styles.avatarContainer}>
          {mentorProfile.avatar ? (
            <Image
              source={{ uri: mentorProfile.avatar }}
              style={styles.avatar}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {mentorProfile.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.mentorName}>{mentorProfile.name}</Text>
        <Text style={styles.mentorRole}>
          {mentorProfile.role || 'Expert Mentor'}
        </Text>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <View style={styles.statRow}>
              <Ionicons name="star" size={20} color={homeColors.starYellow} />
              <Text style={styles.statValue}>{mentorProfile.rating.toFixed(1)}</Text>
            </View>
            <Text style={styles.statLabel}>{mentorProfile.total_reviews} reviews</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{mentorProfile.years_of_experience}+</Text>
            <Text style={styles.statLabel}>Years Experience</Text>
          </View>
          {mentorProfile.is_verified && (
            <View style={styles.statItem}>
              <Ionicons name="checkmark-circle" size={24} color="#fff" />
              <Text style={styles.statLabel}>Verified</Text>
            </View>
          )}
        </View>
      </LinearGradient>

      <View style={styles.content}>
        {/* INFO SECTION */}
        {(mentorProfile.company || mentorProfile.email) && (
          <View style={styles.infoCard}>
            {mentorProfile.company && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Company</Text>
                <Text style={styles.infoValue}>{mentorProfile.company}</Text>
              </View>
            )}
            {mentorProfile.email && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{mentorProfile.email}</Text>
              </View>
            )}
          </View>
        )}

        {/* BIO SECTION */}
        {mentorProfile.bio && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.bioText}>{mentorProfile.bio}</Text>
          </View>
        )}

        {/* SPECIALTIES SECTION */}
        {mentorProfile.specialties && mentorProfile.specialties.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Specialties</Text>
            <View style={styles.specialtiesContainer}>
              {mentorProfile.specialties.map((specialty) => (
                <View key={specialty.id} style={styles.specialtyBadge}>
                  <Text style={styles.specialtyText}>{specialty.specialty}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

         {/* ACTION BUTTONS */}
         <View style={styles.actionButtons}>
           <TouchableOpacity
             onPress={() => navigation.navigate('SessionBooking', { mentorId: mentor.id, mentorName: mentor.name })}
             style={styles.primaryButton}
             activeOpacity={0.8}
           >
             <LinearGradient
               colors={[homeColors.primary, homeColors.primaryDark]}
               start={{ x: 0, y: 0 }}
               end={{ x: 1, y: 0 }}
               style={styles.buttonGradient}
             >
               <Ionicons name="calendar-outline" size={18} color="#fff" />
               <Text style={styles.primaryButtonText}>Schedule Session</Text>
             </LinearGradient>
           </TouchableOpacity>
           <TouchableOpacity
             onPress={() => {
               navigation.navigate('GroupChats');
             }}
             style={styles.secondaryButton}
             activeOpacity={0.8}
           >
             <Ionicons name="chatbubbles-outline" size={18} color={homeColors.primary} />
             <Text style={styles.secondaryButtonText}>Group Chat</Text>
           </TouchableOpacity>
         </View>

         {/* REVIEWS SECTION */}
         <View style={styles.section}>
           <View style={styles.reviewsHeader}>
             <Text style={styles.sectionTitle}>Reviews</Text>
             <TouchableOpacity onPress={() => setShowReviewModal(true)}>
               <Text style={styles.leaveReviewText}>Leave Review</Text>
             </TouchableOpacity>
           </View>

           {reviews.length === 0 ? (
             <View style={styles.noReviewsCard}>
               <Text style={styles.noReviewsText}>No reviews yet. Be the first to review!</Text>
             </View>
           ) : (
             reviews.map((review) => (
               <View key={review.id} style={styles.reviewCard}>
                 <View style={styles.reviewHeader}>
                   <View style={styles.reviewStars}>
                     {[...Array(review.rating)].map((_, i) => (
                       <Ionicons key={i} name="star" size={16} color={homeColors.starYellow} />
                     ))}
                   </View>
                   <Text style={styles.reviewDate}>
                     {new Date(review.created_at).toLocaleDateString()}
                   </Text>
                 </View>
                 {review.comment && <Text style={styles.reviewComment}>{review.comment}</Text>}
               </View>
             ))
           )}
         </View>
       </View>

       {/* REVIEW MODAL */}
       <Modal visible={showReviewModal} animationType="slide" transparent>
         <View style={styles.modalOverlay}>
           <View style={styles.modalContent}>
             <View style={styles.modalHeader}>
               <Text style={styles.modalTitle}>Leave a Review</Text>
               <TouchableOpacity onPress={() => setShowReviewModal(false)}>
                 <Ionicons name="close" size={24} color="#666" />
               </TouchableOpacity>
             </View>

             {/* RATING SELECTOR */}
             <View style={styles.ratingSelector}>
               <Text style={styles.ratingLabel}>How would you rate this mentor?</Text>
               <View style={styles.starsRow}>
                 {[1, 2, 3, 4, 5].map((star) => (
                   <TouchableOpacity
                     key={star}
                     onPress={() => setReviewRating(star)}
                     style={styles.starButton}
                   >
                     <Ionicons 
                       name={star <= reviewRating ? "star" : "star-outline"} 
                       size={36} 
                       color={homeColors.starYellow} 
                     />
                   </TouchableOpacity>
                 ))}
               </View>
             </View>

             {/* COMMENT INPUT */}
             <TextInput
               placeholder="Share your experience (optional)"
               placeholderTextColor="#999"
               value={reviewComment}
               onChangeText={setReviewComment}
               multiline
               numberOfLines={4}
               maxLength={500}
               style={styles.textInput}
               textAlignVertical="top"
             />

             <Text style={styles.characterCount}>
               {reviewComment.length}/500 characters
             </Text>

             <TouchableOpacity
               onPress={handleSubmitReview}
               disabled={submittingReview}
               style={styles.primaryButton}
               activeOpacity={0.8}
             >
               <LinearGradient
                 colors={[homeColors.primary, homeColors.primaryDark]}
                 start={{ x: 0, y: 0 }}
                 end={{ x: 1, y: 0 }}
                 style={styles.buttonGradient}
               >
                 {submittingReview ? (
                   <ActivityIndicator color="white" />
                 ) : (
                   <Text style={styles.primaryButtonText}>Submit Review</Text>
                 )}
               </LinearGradient>
             </TouchableOpacity>
           </View>
         </View>
       </Modal>
     </ScrollView>
   );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  errorText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 12,
  },
    header: {
      paddingBottom: 30,
      paddingHorizontal: 20,
      position: 'relative',
    },
    headerActions: {
      position: 'absolute',
      right: 20,
    },
    headerActionBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.18)',
    },
    backButton: {
      position: 'absolute',
      left: 20,
      width: 36,
      height: 36,
     borderRadius: 18,
     alignItems: 'center',
     justifyContent: 'center',
     backgroundColor: 'rgba(255,255,255,0.18)',
   },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E0E0E0',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: homeColors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
  },
  mentorName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 4,
  },
  mentorTitle: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
    textAlign: 'center',
  },
  mentorRole: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
    textAlign: 'center',
  },
  statsContainer: {
    marginTop: 20,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.8,
    marginTop: 2,
  },
  content: {
    padding: 20,
  },
  infoCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoItem: {
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  bioText: {
    fontSize: 15,
    color: '#4B5563',
    lineHeight: 22,
  },
  specialtiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  specialtyBadge: {
    backgroundColor: '#EDE7F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  specialtyText: {
    color: homeColors.primary,
    fontWeight: '600',
    fontSize: 13,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  primaryButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryButtonText: {
    color: homeColors.primary,
    fontWeight: '700',
    fontSize: 15,
  },
  reviewsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  leaveReviewText: {
    color: homeColors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  noReviewsCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  noReviewsText: {
    color: '#6B7280',
    fontSize: 14,
  },
  reviewCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  reviewStars: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  reviewComment: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  ratingSelector: {
    alignItems: 'center',
    marginBottom: 24,
  },
  ratingLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  starButton: {
    padding: 8,
  },
  textInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    fontSize: 15,
    color: '#1F2937',
  },
  characterCount: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 24,
  },
});
