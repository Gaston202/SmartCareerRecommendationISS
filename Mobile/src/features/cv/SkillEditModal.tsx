/**
 * Skill Edit Modal
 * Allows editing an existing skill's name, category, or status
 */

import React from "react";
import { StyleSheet, View, Alert, ActivityIndicator } from "react-native";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Modal,
  ModalBackdrop,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Heading,
  Button,
  ButtonText,
  Input,
  InputField,
  Icon,
  CloseIcon,
  Select,
  SelectTrigger,
  SelectInput,
  SelectPortal,
  SelectBackdrop,
  SelectContent,
  SelectDragIndicatorWrapper,
  SelectDragIndicator,
  SelectItem,
  FormControl,
  FormControlLabel,
  FormControlLabelText,
} from "@gluestack-ui/themed";
import { skillFormSchema, type SkillFormValues } from "./schemas";
import type { UserSkill } from "./types";

interface SkillEditModalProps {
  isOpen: boolean;
  skill: UserSkill | null;
  onClose: () => void;
  onSave: (updated: UserSkill) => void;
  isLoading?: boolean;
}

const SKILL_CATEGORIES = [
  "Technical",
  "Languages",
  "Tools & Platforms",
  "Soft Skills",
  "Domain Knowledge",
  "Other",
];

export function SkillEditModal({ isOpen, skill, onClose, onSave, isLoading = false }: SkillEditModalProps) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SkillFormValues>({
    resolver: zodResolver(skillFormSchema),
    defaultValues: {
      name: skill?.name || "",
      category: skill?.category || undefined,
    },
  });

  React.useEffect(() => {
    if (skill) {
      reset({
        name: skill.name,
        category: skill.category || undefined,
      });
    }
  }, [skill, reset]);

  const onSubmit = (values: SkillFormValues) => {
    if (!skill) return;

    onSave({
      ...skill,
      name: values.name,
      category: values.category || null,
      status: "edited",
      updated_at: new Date().toISOString(),
    });

    reset();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalBackdrop />
      <ModalContent>
        <ModalHeader>
          <Heading size="lg">Edit Skill</Heading>
          <ModalCloseButton>
            <Icon as={CloseIcon} />
          </ModalCloseButton>
        </ModalHeader>

        <ModalBody>
          <FormControl>
            <FormControlLabel>
              <FormControlLabelText>Skill Name *</FormControlLabelText>
            </FormControlLabel>
            <Controller
              control={control}
              name="name"
              render={({ field: { value, onChange } }) => (
                <Input>
                  <InputField value={value} onChangeText={onChange} placeholder="e.g., React, Python" />
                </Input>
              )}
            />
            {errors.name && <FormControlLabelText style={{ color: "#DC2626" }}>{errors.name.message}</FormControlLabelText>}
          </FormControl>

          <FormControl style={{ marginTop: 16 }}>
            <FormControlLabel>
              <FormControlLabelText>Category</FormControlLabelText>
            </FormControlLabel>
            <Controller
              control={control}
              name="category"
              render={({ field: { value, onChange } }) => (
                <Select selectedValue={value || ""} onValueChange={onChange}>
                  <SelectTrigger>
                    <SelectInput placeholder="Select category (optional)" />
                  </SelectTrigger>
                  <SelectPortal>
                    <SelectBackdrop />
                    <SelectContent>
                      <SelectDragIndicatorWrapper>
                        <SelectDragIndicator />
                      </SelectDragIndicatorWrapper>
                      {SKILL_CATEGORIES.map((cat) => (
                        <SelectItem key={cat} label={cat} value={cat} />
                      ))}
                    </SelectContent>
                  </SelectPortal>
                </Select>
              )}
            />
          </FormControl>
        </ModalBody>

        <ModalFooter>
          <Button variant="outline" action="secondary" onPress={onClose}>
            <ButtonText>Cancel</ButtonText>
          </Button>
          <Button onPress={handleSubmit(onSubmit)} disabled={isLoading} ml={8}>
            {isLoading ? <ActivityIndicator /> : <ButtonText>Save</ButtonText>}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

const styles = StyleSheet.create({
  errorText: {
    color: "#DC2626",
    fontSize: 12,
    marginTop: 4,
  },
});
