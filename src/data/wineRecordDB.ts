import { WineRecord, WineRecordInput, seedRecords } from "./wineRecordTypes";
import {
  getAllWineRecords as unifiedGetAll,
  getWineRecordById as unifiedGetById,
  addWineRecord as unifiedAdd,
  updateWineRecord as unifiedUpdate,
  deleteWineRecord as unifiedDelete,
  seedWineRecordsIfEmpty as unifiedSeed,
} from "./unifiedStore";

export async function getAllRecords(): Promise<WineRecord[]> {
  return unifiedGetAll();
}

export async function getRecordById(
  id: string
): Promise<WineRecord | undefined> {
  return unifiedGetById(id);
}

export async function addRecord(input: WineRecordInput): Promise<WineRecord> {
  return unifiedAdd(input);
}

export async function updateRecord(
  id: string,
  input: WineRecordInput
): Promise<WineRecord> {
  return unifiedUpdate(id, input);
}

export async function deleteRecord(id: string): Promise<void> {
  return unifiedDelete(id);
}

export async function seedDatabaseIfEmpty(): Promise<WineRecord[]> {
  return unifiedSeed();
}
