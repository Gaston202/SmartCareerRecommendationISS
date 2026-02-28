import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Image,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMentors } from '../../features/mentors/hooks';
import { MentorWithSpecialties, MentorFilters } from '../../types/mentor';
import { homeColors } from '../homeTheme';

type MentorsStackParamList = {
  MentorsList: undefined;
  MentorDetail: { mentorId: string };
  GroupChats: undefined;
  GroupChat: { chatId: string };
};

type MentorsListScreenNavigationProp = NativeStackNavigationProp<MentorsStackParamList, 'MentorsList'>;

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

export function MentorsListScreen() {
  const navigation = useNavigation<MentorsListScreenNavigationProp>();
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | undefined>();
  const [minRating, setMinRating] = useState<number | undefined>();
  const [filters, setFilters] = useState<MentorFilters>({});

  const { mentors, loading, error, refetch } = useMentors(filters);

  const handleFilterChange = (specialty?: string, rating?: number) => {
    setSelectedSpecialty(specialty);
    setMinRating(rating);
    setFilters({
      specialty: specialty || undefined,
      minRating: rating || undefined,
      isVerified: true,
    });
  };

  const renderMentorCard = (mentor: MentorWithSpecialties) => {
    const specialtiesText = mentor.specialties?.map((s) => s.specialty).join(', ') || 'N/A';

    return (
      <TouchableOpacity
        key={mentor.id}
        onPress={() => navigation.navigate('MentorDetail', { mentorId: mentor.id })}
        style={styles.mentorCard}
        activeOpacity={0.7}
      >
        <View style={styles.mentorHeader}>
          {mentor.avatar ? (
            <Image
              source={{ uri: mentor.avatar }}
              style={styles.mentorAvatar}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.mentorAvatar, styles.mentorAvatarPlaceholder]}>
              <Text style={styles.mentorAvatarText}>
                {mentor.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.mentorHeaderInfo}>
            <Text style={styles.mentorName}>{mentor.name}</Text>
            <Text style={styles.mentorRole}>{mentor.role || 'Expert'}</Text>
          </View>
          <View style={styles.ratingContainer}>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={16} color={homeColors.starYellow} />
              <Text style={styles.ratingText}>{mentor.rating.toFixed(1)}</Text>
            </View>
            <Text style={styles.reviewsText}>{mentor.total_reviews} reviews</Text>
          </View>
        </View>

        {mentor.company && (
          <Text style={styles.mentorCompany}>
            {mentor.company} • {mentor.years_of_experience}+ years
          </Text>
        )}

        <Text style={styles.mentorBio} numberOfLines={2}>{mentor.bio}</Text>

        <View style={styles.specialtiesContainer}>
          {mentor.specialties?.slice(0, 3).map((specialty) => (
            <View key={specialty.id} style={styles.specialtyBadge}>
              <Text style={styles.specialtyText}>{specialty.specialty}</Text>
            </View>
          ))}
          {mentor.specialties && mentor.specialties.length > 3 && (
            <View style={[styles.specialtyBadge, styles.specialtyBadgeMore]}>
              <Text style={styles.specialtyTextMore}>
                +{mentor.specialties.length - 3}
              </Text>
            </View>
          )}
        </View>

        {mentor.is_verified && (
          <View style={styles.verifiedContainer}>
            <Ionicons name="checkmark-circle" size={16} color={homeColors.accentGreen} />
            <Text style={styles.verifiedText}>Verified Mentor</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading && !mentors.length) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={homeColors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[homeColors.backgroundStart, homeColors.backgroundEnd]}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="people" size={32} color={homeColors.primary} />
          <Text style={styles.headerTitle}>Find a Mentor</Text>
          <Text style={styles.headerSubtitle}>Learn from experts in your field</Text>
        </View>

        {/* Specialty Filter */}
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>Specialties</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            <TouchableOpacity
              onPress={() => handleFilterChange(undefined)}
              style={[styles.filterChip, !selectedSpecialty && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, !selectedSpecialty && styles.filterChipTextActive]}>
                All
              </Text>
            </TouchableOpacity>
            {specialties.map((specialty) => (
              <TouchableOpacity
                key={specialty}
                onPress={() => handleFilterChange(specialty)}
                style={[styles.filterChip, selectedSpecialty === specialty && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, selectedSpecialty === specialty && styles.filterChipTextActive]}>
                  {specialty}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Rating Filter */}
        <View style={styles.ratingFilterSection}>
          <Text style={styles.filterLabel}>Minimum Rating</Text>
          <View style={styles.ratingFilterRow}>
            {[3, 4, 4.5, 5].map((rating) => (
              <TouchableOpacity
                key={rating}
                onPress={() => handleFilterChange(selectedSpecialty, rating)}
                style={[
                  styles.ratingFilterChip,
                  minRating === rating && styles.ratingFilterChipActive,
                ]}
              >
                <Ionicons 
                  name="star" 
                  size={14} 
                  color={minRating === rating ? '#fff' : homeColors.starYellow} 
                />
                <Text
                  style={[
                    styles.ratingFilterText,
                    minRating === rating && styles.ratingFilterTextActive,
                  ]}
                >
                  {rating}+
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Mentors List */}
        <View style={styles.mentorsList}>
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>Error loading mentors. Please try again.</Text>
            </View>
          )}

          {mentors.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                No mentors found matching your filters.
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.mentorsCount}>
                {mentors.length} Mentor{mentors.length !== 1 ? 's' : ''} Available
              </Text>
              {mentors.map(renderMentorCard)}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: homeColors.textDark,
    marginTop: 8,
    marginBottom: 4,
  },
  headerSubtitle: {
    color: homeColors.textMuted,
    fontSize: 15,
  },
  filterSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: homeColors.textDark,
    marginBottom: 12,
  },
  filterScroll: {
    flexDirection: 'row',
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    marginRight: 8,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
  },
  filterChipActive: {
    backgroundColor: homeColors.primary,
    borderColor: homeColors.primary,
  },
  filterChipText: {
    color: homeColors.textDark,
    fontSize: 13,
  },
  filterChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  ratingFilterSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    marginTop: 1,
  },
  ratingFilterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  ratingFilterChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
    gap: 4,
  },
  ratingFilterChipActive: {
    backgroundColor: homeColors.primary,
    borderColor: homeColors.primary,
  },
  ratingFilterText: {
    fontWeight: '600',
    color: homeColors.textDark,
  },
  ratingFilterTextActive: {
    color: '#fff',
  },
  mentorsList: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  errorContainer: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#991b1b',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    color: homeColors.textMuted,
    textAlign: 'center',
    fontSize: 16,
  },
  mentorsCount: {
    fontSize: 16,
    fontWeight: '600',
    color: homeColors.textDark,
    marginBottom: 16,
  },
  mentorCard: {
    backgroundColor: homeColors.cardBg,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
  },
  mentorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  mentorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  mentorAvatarPlaceholder: {
    backgroundColor: homeColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mentorAvatarText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 20,
  },
  mentorHeaderInfo: {
    flex: 1,
  },
  mentorName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: homeColors.textDark,
  },
  mentorRole: {
    fontSize: 14,
    color: homeColors.textMuted,
    marginTop: 2,
  },
  ratingContainer: {
    alignItems: 'center',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontWeight: 'bold',
    color: homeColors.textDark,
  },
  reviewsText: {
    fontSize: 12,
    color: homeColors.textLight,
    marginTop: 2,
  },
  mentorCompany: {
    fontSize: 13,
    color: homeColors.textMuted,
    marginBottom: 8,
  },
  mentorBio: {
    fontSize: 14,
    color: homeColors.textDark,
    marginBottom: 12,
    lineHeight: 20,
  },
  specialtiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  specialtyBadge: {
    backgroundColor: 'rgba(124, 77, 255, 0.12)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  specialtyText: {
    fontSize: 12,
    fontWeight: '600',
    color: homeColors.primary,
  },
  specialtyBadgeMore: {
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
  },
  specialtyTextMore: {
    fontSize: 12,
    fontWeight: '600',
    color: homeColors.textMuted,
  },
  verifiedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  verifiedText: {
    color: homeColors.accentGreen,
    fontSize: 13,
    fontWeight: '600',
  },
});
