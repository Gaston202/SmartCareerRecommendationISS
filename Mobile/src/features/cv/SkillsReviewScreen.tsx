/**
 * Skills Review Screen (US009)
 * Displays extracted/confirmed skills from CV
 * Allows editing, confirming, removing, and adding skills
 */

import React, { useState, useCallback } from "react";
import { StyleSheet, FlatList, ActivityIndicator, Alert } from "react-native";
// WARNING: Expo Go does not support Android push notifications as of SDK 53.
// Use a development build for full notification support.
import * as Notifications from "expo-notifications";
import {
  Box,
  ScrollView,
  VStack,
  HStack,
  Text,
  Button,
  ButtonText,
  Pressable,
  Heading,
  Icon,
  EditIcon,
  TrashIcon,
  CheckIcon,
  useToast,
  Toast,
  ToastTitle,
  ToastDescription,
} from "@gluestack-ui/themed";
import { useUserSkills, useUpdateSkills } from "./hooks";
import { SkillEditModal } from "./SkillEditModal";
import { SkillAddModal } from "./SkillAddModal";
import type { DraftSkill, UserSkill, SkillsUpdatePayload } from "./types";

export function SkillsReviewScreen() {
  const { data: skills = [], isLoading, error } = useUserSkills();
  const { mutate: updateSkills, isPending: isSaving } = useUpdateSkills();
  const toast = useToast();

  // Local draft state
  const [draftSkills, setDraftSkills] = useState<DraftSkill[]>([]);
  const [editingSkill, setEditingSkill] = useState<UserSkill | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize draft from server skills on first load
  React.useEffect(() => {
    if (skills.length > 0 && draftSkills.length === 0) {
      setDraftSkills(skills as DraftSkill[]);
    }
  }, [skills, draftSkills.length]);

  const handleEditSkill = (skill: UserSkill) => {
    setEditingSkill(skill);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = (updated: UserSkill) => {
    setDraftSkills((prev) =>
      prev.map((s) => (s.id === updated.id ? updated : s))
    );
    setHasChanges(true);
    setIsEditModalOpen(false);
    setEditingSkill(null);
  };

  const handleRemoveSkill = (skillId: string) => {
    Alert.alert("Remove Skill", "Are you sure you want to remove this skill?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          setDraftSkills((prev) =>
            prev.map((s) =>
              s.id === skillId ? { ...s, status: "removed" as const } : s
            )
          );
          setHasChanges(true);
        },
      },
    ]);
  };

  const handleConfirmSkill = (skillId: string) => {
    setDraftSkills((prev) =>
      prev.map((s) =>
        s.id === skillId ? { ...s, status: "confirmed" as const } : s
      )
    );
    setHasChanges(true);
  };

  const handleAddSkill = (newSkill: DraftSkill) => {
    setDraftSkills((prev) => [...prev, newSkill]);
    setHasChanges(true);
    toast.show({
      placement: "top",
      duration: 2000,
      render: ({ id }) => (
        <Toast nativeID={String(id)} action="success">
          <ToastTitle>Skill added</ToastTitle>
        </Toast>
      ),
    });
  };

  const handleSaveAll = async () => {
    try {
      const toInsert = draftSkills
        .filter((s) => s.isNew)
        .map(({ id, user_id, created_at, updated_at, isNew, ...rest }) => rest);

      const toUpdate = draftSkills
        .filter((s) => !s.isNew && s.status !== "removed")
        .map(({ id, name, category, status }) => ({ id, name, category, status }));

      const payload: SkillsUpdatePayload = {
        toInsert,
        toUpdate,
      };

      updateSkills(payload, {
        onSuccess: async () => {
          setHasChanges(false);

          // Send success notification
          try {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: "Success",
                body: "Your skills have been updated ✅",
                sound: "default",
              },
              trigger: null, // immediate
            });
          } catch (err) {
            console.warn("Notification error:", err);
          }

          toast.show({
            placement: "top",
            duration: 3000,
            render: ({ id }) => (
              <Toast nativeID={String(id)} action="success">
                <ToastTitle>Skills saved successfully</ToastTitle>
              </Toast>
            ),
          });
        },
        onError: (err) => {
          console.error("Save error:", err);
          toast.show({
            placement: "top",
            duration: 3000,
            render: ({ id }) => (
              <Toast nativeID={String(id)} action="error">
                <ToastTitle>Failed to save skills</ToastTitle>
                <ToastDescription>{String(err)}</ToastDescription>
              </Toast>
            ),
          });
        },
      });
    } catch (err) {
      console.error("Save error:", err);
    }
  };

  const activeSkills = draftSkills.filter((s) => s.status !== "removed");
  const confirmedCount = activeSkills.filter((s) => s.status === "confirmed").length;

  if (isLoading) {
    return (
      <Box flex={1} justifyContent="center" alignItems="center" bg="$white">
        <ActivityIndicator size="large" />
      </Box>
    );
  }

  return (
    <Box flex={1} bg="$white">
      <ScrollView>
        <VStack p="$4" space="lg">
          {/* Header */}
          <VStack space="xs">
            <Heading size="xl">My Skills</Heading>
            <Text size="sm" color="$gray600">
              {confirmedCount} of {activeSkills.length} confirmed
            </Text>
          </VStack>

          {/* Error state */}
          {error && (
            <Box bg="$red50" p="$3" rounded="$lg" borderLeftWidth={4} borderLeftColor="$red600">
              <Text color="$red700" fontWeight="$semibold">
                Error loading skills
              </Text>
            </Box>
          )}

          {/* Empty state */}
          {activeSkills.length === 0 ? (
            <Box bg="$gray50" p="$6" rounded="$lg" alignItems="center">
              <Text color="$gray600" mb="$2">
                No skills yet
              </Text>
              <Text size="sm" color="$gray500">
                Upload a CV or add skills manually to get started
              </Text>
            </Box>
          ) : (
            /* Skills list */
            <VStack space="md">
              {activeSkills.map((skill) => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  onEdit={() => handleEditSkill(skill as UserSkill)}
                  onRemove={() => handleRemoveSkill(skill.id)}
                  onConfirm={() => handleConfirmSkill(skill.id)}
                />
              ))}
            </VStack>
          )}

          {/* Actions */}
          <VStack space="sm">
            <Button
              action="primary"
              onPress={() => setIsAddModalOpen(true)}
              variant="outline"
            >
              <ButtonText>+ Add Skill Manually</ButtonText>
            </Button>

            {hasChanges && (
              <Button
                action="positive"
                onPress={handleSaveAll}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <ButtonText>Save Changes</ButtonText>
                )}
              </Button>
            )}
          </VStack>
        </VStack>
      </ScrollView>

      {/* Modals */}
      <SkillEditModal
        isOpen={isEditModalOpen}
        skill={editingSkill}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleSaveEdit}
        isLoading={isSaving}
      />

      <SkillAddModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddSkill}
        isLoading={isSaving}
      />
    </Box>
  );
}

/**
 * Individual skill card component
 */
interface SkillCardProps {
  skill: DraftSkill;
  onEdit: () => void;
  onRemove: () => void;
  onConfirm: () => void;
}

function SkillCard({ skill, onEdit, onRemove, onConfirm }: SkillCardProps) {
  const isConfirmed = skill.status === "confirmed";
  const isFromCv = skill.source === "cv_extraction";

  return (
    <Box
      bg="$gray50"
      p="$3"
      rounded="$lg"
      borderWidth={isConfirmed ? 1 : 0}
      borderColor="$success600"
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
    >
      <VStack flex={1} space="xs">
        <HStack space="sm" alignItems="center">
          {isConfirmed ? (
            <Icon as={CheckIcon} color="$success600" size="md" />
          ) : (
            <Pressable onPress={onConfirm}>
              <Text color="$gray400" fontSize="$lg">○</Text>
            </Pressable>
          )}
          <VStack flex={1}>
            <Text fontWeight="$semibold" size="sm">
              {skill.name}
            </Text>
            {skill.category && (
              <Text size="xs" color="$gray600">
                {skill.category}
              </Text>
            )}
            {isFromCv && skill.confidence !== null && (
              <Text size="xs" color="$blue600">
                {Math.round(skill.confidence * 100)}% confidence
              </Text>
            )}
          </VStack>
        </HStack>
      </VStack>

      <HStack space="sm">
        <Pressable onPress={onEdit} p="$2">
          <Icon as={EditIcon} color="$primary600" size="md" />
        </Pressable>
        <Pressable onPress={onRemove} p="$2">
          <Icon as={TrashIcon} color="$error600" size="md" />
        </Pressable>
      </HStack>
    </Box>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
