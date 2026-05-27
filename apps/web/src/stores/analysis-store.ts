import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { AgentStep, Analysis, AnalysisDetail } from "@/types/dataset";

interface AnalysisStore {
  activeAnalysisId: string | null;
  liveSteps: AgentStep[];
  isAnalysisRunning: boolean;
  wsConnected: boolean;
  analyses: Record<string, AnalysisDetail>;

  setActiveAnalysis: (id: string | null) => void;
  addLiveStep: (step: AgentStep) => void;
  clearLiveSteps: () => void;
  setIsRunning: (running: boolean) => void;
  setWsConnected: (connected: boolean) => void;
  cacheAnalysis: (analysis: AnalysisDetail) => void;
}

export const useAnalysisStore = create<AnalysisStore>()(
  devtools(
    (set) => ({
      activeAnalysisId: null,
      liveSteps: [],
      isAnalysisRunning: false,
      wsConnected: false,
      analyses: {},

      setActiveAnalysis: (id) => set({ activeAnalysisId: id }),
      addLiveStep: (step) =>
        set((state) => ({ liveSteps: [...state.liveSteps, step] })),
      clearLiveSteps: () => set({ liveSteps: [] }),
      setIsRunning: (isAnalysisRunning) => set({ isAnalysisRunning }),
      setWsConnected: (wsConnected) => set({ wsConnected }),
      cacheAnalysis: (analysis) =>
        set((state) => ({
          analyses: { ...state.analyses, [analysis.id]: analysis },
        })),
    }),
    { name: "analysis-store" }
  )
);
