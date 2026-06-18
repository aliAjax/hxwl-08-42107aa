import { useState, useCallback, useEffect } from "react";
import { WineRecord, WineRecordInput } from "../data/wineRecordTypes";
import { triggerPathRefreshAfterRecordsChange } from "../data/learningPathStore";

interface FormState {
  open: boolean;
  mode: "add" | "edit";
  record?: WineRecord;
}

interface UseRecordFormParams {
  addRecord: (input: WineRecordInput) => Promise<void>;
  updateRecord: (id: string, input: WineRecordInput) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;
  showToast: (message: string, tone?: "warn" | "info") => void;
  triggerLearningPathRefresh: () => void;
}

interface UseRecordFormReturn {
  formState: FormState;
  deleteConfirm: string | null;
  openMenuId: string | null;
  handleOpenAddForm: () => void;
  handleOpenEditForm: (record: WineRecord) => void;
  handleFormCancel: () => void;
  handleFormSubmit: (data: WineRecordInput) => Promise<void>;
  handleDeleteClick: (id: string) => void;
  handleDeleteConfirm: () => Promise<void>;
  handleDeleteCancel: () => void;
  handleToggleMenu: (id: string) => void;
}

export function useRecordForm({
  addRecord,
  updateRecord,
  deleteRecord,
  showToast,
  triggerLearningPathRefresh,
}: UseRecordFormParams): UseRecordFormReturn {
  const [formState, setFormState] = useState<FormState>({
    open: false,
    mode: "add",
  });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const handleOpenAddForm = useCallback(() => {
    setFormState({ open: true, mode: "add" });
  }, []);

  const handleOpenEditForm = useCallback((record: WineRecord) => {
    setFormState({ open: true, mode: "edit", record });
    setOpenMenuId(null);
  }, []);

  const handleFormCancel = useCallback(() => {
    setFormState({ open: false, mode: "add" });
  }, []);

  const handleFormSubmit = useCallback(
    async (data: WineRecordInput) => {
      try {
        if (formState.mode === "edit" && formState.record) {
          await updateRecord(formState.record.id, data);
          showToast("记录已更新", "info");
        } else {
          await addRecord(data);
          showToast("记录已添加", "info");
        }
        setFormState({ open: false, mode: "add" });
        await triggerPathRefreshAfterRecordsChange();
        triggerLearningPathRefresh();
      } catch {
        showToast(formState.mode === "edit" ? "更新失败" : "添加失败", "warn");
      }
    },
    [formState.mode, formState.record, addRecord, updateRecord, showToast, triggerLearningPathRefresh]
  );

  const handleDeleteClick = useCallback((id: string) => {
    setDeleteConfirm(id);
    setOpenMenuId(null);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteConfirm) return;
    try {
      await deleteRecord(deleteConfirm);
      showToast("记录已删除", "info");
      await triggerPathRefreshAfterRecordsChange();
      triggerLearningPathRefresh();
    } catch {
      showToast("删除失败", "warn");
    }
    setDeleteConfirm(null);
  }, [deleteConfirm, deleteRecord, showToast, triggerLearningPathRefresh]);

  const handleDeleteCancel = useCallback(() => {
    setDeleteConfirm(null);
  }, []);

  const handleToggleMenu = useCallback((id: string) => {
    setOpenMenuId((prev: string | null) => (prev === id ? null : id));
  }, []);

  useEffect(() => {
    if (!openMenuId) return;
    const close = () => setOpenMenuId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [openMenuId]);

  return {
    formState,
    deleteConfirm,
    openMenuId,
    handleOpenAddForm,
    handleOpenEditForm,
    handleFormCancel,
    handleFormSubmit,
    handleDeleteClick,
    handleDeleteConfirm,
    handleDeleteCancel,
    handleToggleMenu,
  };
}
