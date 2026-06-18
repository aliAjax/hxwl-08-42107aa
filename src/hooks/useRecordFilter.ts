import { useState, useCallback, useMemo } from "react";
import { WineRecord } from "../data/wineRecordTypes";

interface FilterOptions {
  countries: string[];
  regions: string[];
  grapes: string[];
  aromas: string[];
}

interface UseRecordFilterReturn {
  searchQuery: string;
  filterCountry: string;
  filterRegion: string;
  filterGrape: string;
  filterAroma: string;
  setSearchQuery: (q: string) => void;
  setFilterCountry: (v: string) => void;
  setFilterRegion: (v: string) => void;
  setFilterGrape: (v: string) => void;
  setFilterAroma: (v: string) => void;
  filterOptions: FilterOptions;
  hasActiveFilters: boolean;
  filteredRecords: WineRecord[];
  clearAllFilters: () => void;
}

export function useRecordFilter(records: WineRecord[]): UseRecordFilterReturn {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterCountry, setFilterCountry] = useState<string>("");
  const [filterRegion, setFilterRegion] = useState<string>("");
  const [filterGrape, setFilterGrape] = useState<string>("");
  const [filterAroma, setFilterAroma] = useState<string>("");

  const filterOptions = useMemo<FilterOptions>(() => {
    const countries = new Set<string>();
    const regions = new Set<string>();
    const grapes = new Set<string>();
    const aromas = new Set<string>();
    records.forEach((r) => {
      if (r.country) countries.add(r.country);
      if (r.region) regions.add(r.region);
      if (r.grape) grapes.add(r.grape);
      r.aromas.forEach((a) => aromas.add(a));
    });
    return {
      countries: Array.from(countries).sort(),
      regions: Array.from(regions).sort(),
      grapes: Array.from(grapes).sort(),
      aromas: Array.from(aromas).sort(),
    };
  }, [records]);

  const hasActiveFilters = useMemo(() => {
    return (
      searchQuery.trim() !== "" ||
      filterCountry !== "" ||
      filterRegion !== "" ||
      filterGrape !== "" ||
      filterAroma !== ""
    );
  }, [searchQuery, filterCountry, filterRegion, filterGrape, filterAroma]);

  const filteredRecords = useMemo(() => {
    let result = records;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((r) =>
        [
          r.name,
          r.region,
          r.country,
          r.grape,
          r.year ?? "",
          r.characteristic,
          r.notes ?? "",
          ...r.aromas,
        ]
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }
    if (filterCountry) {
      result = result.filter((r) => r.country === filterCountry);
    }
    if (filterRegion) {
      result = result.filter((r) => r.region === filterRegion);
    }
    if (filterGrape) {
      result = result.filter((r) => r.grape === filterGrape);
    }
    if (filterAroma) {
      result = result.filter((r) => r.aromas.includes(filterAroma));
    }
    return result;
  }, [records, searchQuery, filterCountry, filterRegion, filterGrape, filterAroma]);

  const clearAllFilters = useCallback(() => {
    setSearchQuery("");
    setFilterCountry("");
    setFilterRegion("");
    setFilterGrape("");
    setFilterAroma("");
  }, []);

  return {
    searchQuery,
    filterCountry,
    filterRegion,
    filterGrape,
    filterAroma,
    setSearchQuery,
    setFilterCountry,
    setFilterRegion,
    setFilterGrape,
    setFilterAroma,
    filterOptions,
    hasActiveFilters,
    filteredRecords,
    clearAllFilters,
  };
}
