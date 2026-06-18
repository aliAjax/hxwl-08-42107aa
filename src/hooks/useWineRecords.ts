import { useState, useEffect, useCallback } from "react";
import { WineRecord, WineRecordInput } from "../data/wineRecordTypes";
import {
  getAllRecords,
  addRecord,
  updateRecord,
  deleteRecord,
  seedDatabaseIfEmpty,
} from "../data/wineRecordDB";
import { initUnifiedStore } from "../data/unifiedStore";

interface UseWineRecordsReturn {
  records: WineRecord[];
  loading: boolean;
  error: string | null;
  addRecord: (input: WineRecordInput) => Promise<void>;
  updateRecord: (id: string, input: WineRecordInput) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;
  refreshRecords: () => Promise<void>;
}

export function useWineRecords(): UseWineRecordsReturn {
  const [records, setRecords] = useState<WineRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refreshRecords = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await initUnifiedStore();
      const data = await seedDatabaseIfEmpty();
      setRecords(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载记录失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshRecords();
  }, [refreshRecords]);

  const handleAddRecord = useCallback(async (input: WineRecordInput) => {
    try {
      setError(null);
      await addRecord(input);
      await refreshRecords();
    } catch (err) {
      setError(err instanceof Error ? err.message : "添加记录失败");
      throw err;
    }
  }, [refreshRecords]);

  const handleUpdateRecord = useCallback(async (id: string, input: WineRecordInput) => {
    try {
      setError(null);
      await updateRecord(id, input);
      await refreshRecords();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新记录失败");
      throw err;
    }
  }, [refreshRecords]);

  const handleDeleteRecord = useCallback(async (id: string) => {
    try {
      setError(null);
      await deleteRecord(id);
      await refreshRecords();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除记录失败");
      throw err;
    }
  }, [refreshRecords]);

  return {
    records,
    loading,
    error,
    addRecord: handleAddRecord,
    updateRecord: handleUpdateRecord,
    deleteRecord: handleDeleteRecord,
    refreshRecords,
  };
}
