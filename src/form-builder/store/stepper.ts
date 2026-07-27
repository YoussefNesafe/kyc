import { createStore } from "zustand/vanilla";

export type StepperState = {
  step: number;
  next: () => void;
  prev: () => void;
  goTo: (step: number) => void;
  reset: () => void;
};

export type StepperStore = ReturnType<typeof createStepperStore>;

export function createStepperStore(stepCount: number) {
  const clamp = (step: number) => Math.max(0, Math.min(step, stepCount - 1));

  return createStore<StepperState>((set) => ({
    step: 0,
    next: () => set((state) => ({ step: clamp(state.step + 1) })),
    prev: () => set((state) => ({ step: clamp(state.step - 1) })),
    goTo: (step) => set({ step: clamp(step) }),
    reset: () => set({ step: 0 }),
  }));
}
