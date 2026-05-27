import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { Dataset, DatasetDetail } from "@/types/dataset";

interface DatasetStore {
  selectedDatasetId: string | null;
  datasets: Dataset[];
  activeDataset: DatasetDetail | null;
  isUploading: boolean;
  uploadProgress: number;

  setSelectedDataset: (id: string | null) => void;
  setDatasets: (datasets: Dataset[]) => void;
  setActiveDataset: (dataset: DatasetDetail | null) => void;
  setIsUploading: (uploading: boolean) => void;
  setUploadProgress: (progress: number) => void;
  addDataset: (dataset: Dataset) => void;
  removeDataset: (id: string) => void;
}

export const useDatasetStore = create<DatasetStore>()(
  devtools(
    (set) => ({
      selectedDatasetId: null,
      datasets: [],
      activeDataset: null,
      isUploading: false,
      uploadProgress: 0,

      setSelectedDataset: (id) => set({ selectedDatasetId: id }),
      setDatasets: (datasets) => set({ datasets }),
      setActiveDataset: (dataset) => set({ activeDataset: dataset }),
      setIsUploading: (isUploading) => set({ isUploading }),
      setUploadProgress: (uploadProgress) => set({ uploadProgress }),
      addDataset: (dataset) =>
        set((state) => ({ datasets: [dataset, ...state.datasets] })),
      removeDataset: (id) =>
        set((state) => ({ datasets: state.datasets.filter((d) => d.id !== id) })),
    }),
    { name: "dataset-store" }
  )
);
