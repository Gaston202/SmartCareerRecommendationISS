/**
 * Skill Add Modal
 * Allows adding a new skill manually
 */

import React from "react";
import { StyleSheet, ActivityIndicator } from "react-native";
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
import type { DraftSkill } from "./types";

interface SkillAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (skill: DraftSkill) => void;
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

export function SkillAddModal({ isOpen, onClose, onAdd, isLoading = false }: SkillAddModalProps) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SkillFormValues>({
    resolver: zodResolver(skillFormSchema),
    defaultValues: {
      name: "",
      category: undefined,
    },
  });

  const onSubmit = (values: SkillFormValues) => {
    const newSkill: DraftSkill = {
      id: `temp_${Date.now()}`,
      user_id: "",
      name: values.name,
      category: values.category || null,
      source: "user_added",
      confidence: null,
      status: "confirmed",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      isNew: true,
    };

    onAdd(newSkill);
    reset();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalBackdrop />
      <ModalContent>
        <ModalHeader>
          <Heading size="lg">Add New Skill</Heading>
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
                  <InputField value={value} onChangeText={onChange} placeholder="e.g., Next.js, Kubernetes" />
                </Input>
              )}
            />
            {errors.name && <FormControlLabelText style={styles.errorText}>{errors.name.message}</FormControlLabelText>}
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
            {isLoading ? <ActivityIndicator /> : <ButtonText>Add Skill</ButtonText>}
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
