import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TextInput,
  Image,
  Pressable,
  ActivityIndicator,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useMentors } from "../features/mentors/hooks";
import { MentorWithSpecialties } from "../types/mentor";
import { homeColors } from "./homeTheme";
import { MainTopBar } from "../ui/MainTopBar";

const RATING_OPTIONS: { label: string; value: number | null }[] = [
  { label: "Any Rating", value: null },
  { label: "3.0+ ⭐", value: 3.0 },
  { label: "3.5+ ⭐", value: 3.5 },
  { label: "4.0+ ⭐", value: 4.0 },
  { label: "4.5+ ⭐", value: 4.5 },
];

export default function MentorsScreen(): React.ReactElement {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);
  const [minRating, setMinRating] = useState<number | null>(null);
  const [specialtyMenuVisible, setSpecialtyMenuVisible] = useState(false);
  const [ratingMenuVisible, setRatingMenuVisible] = useState(false);

  const getMentorSpecialties = (mentor: MentorWithSpecialties): string[] => {
    const fromMentorSpecialties = mentor.mentor_specialties?.map((s) => s.specialty) ?? [];
    const fromSpecialties = mentor.specialties?.map((s) => s.specialty) ?? [];
    return [...fromMentorSpecialties, ...fromSpecialties];
  };

  // Fetch mentors with filters
  const { mentors, loading, error } = useMentors({
    // Specialty is filtered client-side because mentor payload shape can vary.
    minRating: minRating || undefined,
  });

  // Filter mentors by search query (name, role, company, specialties)
  const filteredMentors = useMemo(() => {
    return mentors.filter((mentor) => {
      const specialties = getMentorSpecialties(mentor);
      const specialtyFilterMatch =
        !selectedSpecialty ||
        specialties.some((specialty) => specialty.toLowerCase() === selectedSpecialty.toLowerCase());

      if (!specialtyFilterMatch) return false;

      if (!searchQuery.trim()) return true;

      const query = searchQuery.toLowerCase();
      const nameMatch = mentor.name.toLowerCase().includes(query);
      const roleMatch = mentor.role?.toLowerCase().includes(query) ?? false;
      const companyMatch = mentor.company?.toLowerCase().includes(query) ?? false;
      const specialtyMatch = specialties.some((specialty) =>
        specialty.toLowerCase().includes(query)
      );

      return nameMatch || roleMatch || companyMatch || specialtyMatch;
    });
  }, [mentors, searchQuery, selectedSpecialty]);

  // Get unique specialties for filter dropdown
  const specialtiesSet = useMemo(() => {
    const set = new Set<string>();
    mentors.forEach((mentor) => {
      getMentorSpecialties(mentor).forEach((specialty) => set.add(specialty));
    });
    return Array.from(set).sort();
  }, [mentors]);

  const renderMentorCard = ({
    item,
  }: {
    item: MentorWithSpecialties;
  }) => (
    <MentorCard
      mentor={item}
      onViewProfile={() =>
        (navigation as any).navigate("MentorDetail", {
          mentorId: item.id,
        })
      }
      onBookSession={() =>
        (navigation as any).navigate("SessionBooking", {
          mentorId: item.id,
          mentorName: item.name,
        })
      }
    />
  );

  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container}>
      <MainTopBar topPadding={insets.top} onProfilePress={() => (navigation as any).navigate("Profile")} />

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>Find your guide.</Text>
          <Text style={styles.heroSubtitle}>
            Connect with industry experts who have navigated the paths you're
            exploring today.
          </Text>
        </View>

        {/* Search & Filter Section */}
        <View style={styles.filterSection}>
          {/* Search Bar */}
          <View style={styles.searchBar}>
            <Ionicons
              name="search"
              size={18}
              color={homeColors.textMuted}
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, role, or skill..."
              placeholderTextColor={homeColors.textLight}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Filter Dropdowns */}
          <View style={styles.filtersRow}>
            {/* Specialty Filter */}
            <Pressable
              style={[styles.filterButton, selectedSpecialty ? styles.filterButtonActive : null]}
              onPress={() => setSpecialtyMenuVisible(true)}
            >
              <Ionicons
                name="filter-circle-outline"
                size={16}
                color={selectedSpecialty ? homeColors.onPrimary : homeColors.primary}
              />
              <Text style={[styles.filterButtonText, selectedSpecialty ? styles.filterButtonTextActive : null]}>
                {selectedSpecialty || "Specialty"}
              </Text>
              <Ionicons
                name="chevron-down"
                size={14}
                color={selectedSpecialty ? homeColors.onPrimary : homeColors.textMuted}
              />
            </Pressable>

            {/* Rating Filter */}
            <Pressable
              style={[styles.filterButton, minRating !== null ? styles.filterButtonActive : null]}
              onPress={() => setRatingMenuVisible(true)}
            >
              <Ionicons
                name="star"
                size={16}
                color={minRating !== null ? homeColors.onPrimary : homeColors.primary}
              />
              <Text style={[styles.filterButtonText, minRating !== null ? styles.filterButtonTextActive : null]}>
                {minRating !== null ? `${minRating}+ Stars` : "Rating"}
              </Text>
              <Ionicons
                name="chevron-down"
                size={14}
                color={minRating !== null ? homeColors.onPrimary : homeColors.textMuted}
              />
            </Pressable>
          </View>

          <Pressable
            style={({ pressed }) => [styles.sessionsButton, pressed && styles.buttonPressed]}
            onPress={() => (navigation as any).navigate("MySessions")}
          >
            <Ionicons name="calendar-outline" size={16} color={homeColors.onPrimary} />
            <Text style={styles.sessionsButtonText}>View My Sessions</Text>
          </Pressable>
        </View>

        {/* Results Section */}
        <View style={styles.resultsSection}>
          {loading ? (
            <View style={styles.centerContent}>
              <ActivityIndicator size="large" color={homeColors.primary} />
              <Text style={styles.loadingText}>Loading mentors...</Text>
            </View>
          ) : error ? (
            <View style={styles.centerContent}>
              <Ionicons
                name="alert-circle-outline"
                size={48}
                color={homeColors.error}
              />
              <Text style={styles.errorText}>Failed to load mentors</Text>
              <Text style={styles.errorSubtext}>Please try again later</Text>
            </View>
          ) : filteredMentors.length === 0 ? (
            <View style={styles.centerContent}>
              <Ionicons
                name="search-outline"
                size={48}
                color={homeColors.textMuted}
              />
              <Text style={styles.emptyText}>
                No mentors found matching your criteria.
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredMentors}
              renderItem={renderMentorCard}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={styles.spacer} />}
            />
          )}
        </View>
      </ScrollView>
      {/* Specialty Dropdown Modal */}
      <Modal
        visible={specialtyMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSpecialtyMenuVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setSpecialtyMenuVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalSheet}>
                <Text style={styles.modalTitle}>Filter by Specialty</Text>
                <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                  {/* All option */}
                  <TouchableOpacity
                    style={[styles.modalOption, !selectedSpecialty && styles.modalOptionSelected]}
                    onPress={() => { setSelectedSpecialty(null); setSpecialtyMenuVisible(false); }}
                  >
                    <Text style={[styles.modalOptionText, !selectedSpecialty && styles.modalOptionTextSelected]}>
                      All Specialties
                    </Text>
                    {!selectedSpecialty && <Ionicons name="checkmark" size={16} color={homeColors.onPrimary} />}
                  </TouchableOpacity>
                  {specialtiesSet.map((specialty) => (
                    <TouchableOpacity
                      key={specialty}
                      style={[styles.modalOption, selectedSpecialty === specialty && styles.modalOptionSelected]}
                      onPress={() => { setSelectedSpecialty(specialty); setSpecialtyMenuVisible(false); }}
                    >
                      <Text style={[styles.modalOptionText, selectedSpecialty === specialty && styles.modalOptionTextSelected]}>
                        {specialty}
                      </Text>
                      {selectedSpecialty === specialty && <Ionicons name="checkmark" size={16} color={homeColors.onPrimary} />}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Rating Dropdown Modal */}
      <Modal
        visible={ratingMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRatingMenuVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setRatingMenuVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalSheet}>
                <Text style={styles.modalTitle}>Filter by Rating</Text>
                {RATING_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={String(option.value)}
                    style={[styles.modalOption, minRating === option.value && styles.modalOptionSelected]}
                    onPress={() => { setMinRating(option.value); setRatingMenuVisible(false); }}
                  >
                    <Text style={[styles.modalOptionText, minRating === option.value && styles.modalOptionTextSelected]}>
                      {option.label}
                    </Text>
                    {minRating === option.value && <Ionicons name="checkmark" size={16} color={homeColors.onPrimary} />}
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

function MentorCard({
  mentor,
  onViewProfile,
  onBookSession,
}: {
  mentor: MentorWithSpecialties;
  onViewProfile: () => void;
  onBookSession: () => void;
}) {
  return (
    <View style={styles.mentorCard}>
      {/* Card Header: Avatar & Rating */}
      <View style={styles.cardHeader}>
        <View style={styles.avatarContainer}>
          {mentor.avatar ? (
            <Image
              source={{ uri: mentor.avatar }}
              style={styles.avatar}
            />
          ) : (
            <View
              style={[styles.avatar, styles.avatarPlaceholder]}
            >
              <Ionicons
                name="person"
                size={32}
                color={homeColors.primary}
              />
            </View>
          )}
          {mentor.is_verified && (
            <View style={styles.verificationBadge}>
              <Ionicons
                name="checkmark"
                size={12}
                color={homeColors.onPrimary}
              />
            </View>
          )}
        </View>

        <View style={styles.ratingContainer}>
          <View style={styles.ratingBox}>
            <Ionicons
              name="star"
              size={14}
              color={homeColors.primary}
            />
            <Text style={styles.ratingText}>
              {mentor.rating.toFixed(1)}
            </Text>
          </View>
          <Text style={styles.reviewsText}>
            {mentor.total_reviews} Reviews
          </Text>
        </View>
      </View>

      {/* Card Body: Info */}
      <View style={styles.cardBody}>
        <Text style={styles.mentorName}>{mentor.name}</Text>
        <Text style={styles.mentorRole}>
          {mentor.role}
          {mentor.company ? ` @ ${mentor.company}` : ""}
        </Text>
        {mentor.bio && (
          <Text style={styles.mentorBio} numberOfLines={3}>
            {mentor.bio}
          </Text>
        )}
      </View>

      {/* Tags/Specialties */}
      {mentor.mentor_specialties && mentor.mentor_specialties.length > 0 && (
        <View style={styles.tagsContainer}>
          {mentor.mentor_specialties.map((specialty) => (
            <View key={specialty.id} style={styles.tag}>
              <Text style={styles.tagText}>{specialty.specialty}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.buttonsContainer}>
        <Pressable
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={onViewProfile}
        >
          <Text style={styles.secondaryButtonText}>View Profile</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={onBookSession}
        >
          <Text style={styles.primaryButtonText}>Book Session</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scroll: {
    flex: 1,
  },
  // Hero Section
  heroSection: {
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: homeColors.textDark,
    marginBottom: 8,
    lineHeight: 40,
  },
  heroSubtitle: {
    fontSize: 16,
    color: homeColors.textMuted,
    lineHeight: 24,
    fontWeight: "500",
  },

  // Filter Section
  filterSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: homeColors.cardBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
    paddingHorizontal: 16,
    height: 52,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: homeColors.textDark,
    fontWeight: "500",
  },
  filtersRow: {
    flexDirection: "row",
    gap: 8,
  },
  filterButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: homeColors.cardBg,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: homeColors.textMuted,
  },
  sessionsButton: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: homeColors.primary,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  sessionsButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: homeColors.onPrimary,
    letterSpacing: 0.2,
  },

  // Results Section
  resultsSection: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  centerContent: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: homeColors.textMuted,
    marginTop: 8,
  },
  errorText: {
    fontSize: 18,
    fontWeight: "600",
    color: homeColors.error,
  },
  errorSubtext: {
    fontSize: 14,
    color: homeColors.textMuted,
  },
  emptyText: {
    fontSize: 16,
    color: homeColors.textMuted,
    textAlign: "center",
    lineHeight: 22,
  },
  spacer: {
    height: 16,
  },

  // Mentor Card
  mentorCard: {
    backgroundColor: homeColors.cardBg,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
    padding: 20,
    gap: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  avatarContainer: {
    position: "relative",
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: homeColors.primary + "10",
  },
  avatarPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  verificationBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: homeColors.primary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: homeColors.cardBg,
  },
  ratingContainer: {
    alignItems: "flex-end",
    gap: 4,
  },
  ratingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingText: {
    fontSize: 18,
    fontWeight: "800",
    color: homeColors.primary,
  },
  reviewsText: {
    fontSize: 10,
    fontWeight: "700",
    color: homeColors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Card Body
  cardBody: {
    gap: 6,
  },
  mentorName: {
    fontSize: 20,
    fontWeight: "800",
    color: homeColors.textDark,
  },
  mentorRole: {
    fontSize: 14,
    fontWeight: "600",
    color: homeColors.primary,
  },
  mentorBio: {
    fontSize: 13,
    color: homeColors.textMuted,
    lineHeight: 18,
    marginTop: 2,
  },

  // Tags
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tag: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: homeColors.primary + "08",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: homeColors.primary + "20",
  },
  tagText: {
    fontSize: 10,
    fontWeight: "600",
    color: homeColors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },

  // Buttons
  buttonsContainer: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  primaryButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: homeColors.primary,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  secondaryButton: {
    flex: 0.8,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: homeColors.cardBg,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
    justifyContent: "center",
    alignItems: "center",
  },
  primaryButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: homeColors.onPrimary,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: homeColors.primary,
  },
  buttonPressed: {
    opacity: 0.8,
  },

  // Active filter button
  filterButtonActive: {
    backgroundColor: homeColors.primary,
    borderColor: homeColors.primary,
  },
  filterButtonTextActive: {
    color: homeColors.onPrimary,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalSheet: {
    width: '100%',
    backgroundColor: homeColors.cardBg,
    borderRadius: 24,
    padding: 20,
    maxHeight: 420,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: homeColors.textDark,
    marginBottom: 14,
  },
  modalScroll: {
    maxHeight: 320,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: homeColors.cardBg,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
  },
  modalOptionSelected: {
    backgroundColor: homeColors.primary,
    borderColor: homeColors.primary,
  },
  modalOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: homeColors.textDark,
  },
  modalOptionTextSelected: {
    color: homeColors.onPrimary,
  },
});
