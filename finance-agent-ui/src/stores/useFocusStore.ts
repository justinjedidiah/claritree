import { create } from "zustand";

type FocusItem = {
  type: "node" | "edge";
  id: string;
};

type FocusState = {
  focusStack: FocusItem[];
  currentFocus?: FocusItem;

  pushFocus: (item: FocusItem) => void;
  popFocus: () => void;
  replaceFocus: (item: FocusItem) => void;
  clearFocus: () => void;
  clearCurrentFocus: () => void;
};

export const useFocusStore = create<FocusState>((set) => ({
  focusStack: [],
  currentFocus: undefined,

  pushFocus: (item) =>
    set((state) => {
      const isAlreadyFocused = state.focusStack.at(-1)?.id === item.id;
      
      const newStack = isAlreadyFocused
        ? state.focusStack
        : [...state.focusStack, item].slice(-5); 

      return {
        focusStack: newStack,
        currentFocus: newStack[newStack.length - 1],
      };
    }),

  popFocus: () =>
    set((state) => {
      const newStack = state.focusStack.slice(0, -1);
      return {
        focusStack: newStack,
        currentFocus: newStack[newStack.length - 1],
      };
    }),

  replaceFocus: (item) =>
    set({
      focusStack: [item],
      currentFocus: item,
    }),

  clearFocus: () =>
    set({
      focusStack: [],
      currentFocus: undefined,
    }),

  clearCurrentFocus: () =>
    set({
      currentFocus: undefined,
    }),
}));