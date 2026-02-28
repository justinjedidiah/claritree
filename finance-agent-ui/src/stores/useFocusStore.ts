import { create } from "zustand";

type FocusItem = {
  type: "node" | "edge";
  id: string;
};

type FocusState = {
  focusStack: FocusItem[];
  currentFocus: FocusItem[];

  pushFocus: (item: FocusItem, add?: boolean) => void;
  popFocus: () => void;
  replaceFocus: (item: FocusItem) => void;
  clearFocus: () => void;
  clearCurrentFocus: () => void;
};

export const useFocusStore = create<FocusState>((set) => ({
  // history of focused items
  // keeps up to 10 (no duplicates)
  focusStack: [],
  // currently focused items (can be multiple if add=true in pushFocus)
  // no limit on length (no duplicates)
  currentFocus: [],

    pushFocus: (item, add = false) =>
    set((state) => {
      let newFocusStack: FocusItem[];
      let newCurrentFocus: FocusItem[];

      const isInCurrentFocused = state.currentFocus.some((f) => f.id === item.id);
      // Move or add the item to the top of the focus stack
      const filteredStack = state.focusStack.filter((f) => f.id !== item.id);
      const updatedStack = [
        ...filteredStack,
        item
      ].slice(-10);

      if (add) {
        if (isInCurrentFocused) {
          // TOGGLE OFF: Remove from both
          newCurrentFocus = state.currentFocus.filter((f) => f.id !== item.id);
          newFocusStack = filteredStack;
        } else {
          // TOGGLE ON: Add to current, move to top of stack
          newCurrentFocus = [...state.currentFocus, item];
          newFocusStack = updatedStack;
        }
      } else {
        // SINGLE SELECT: Replace current focus, and move to top of focus stack
        newCurrentFocus = [item];
        newFocusStack = updatedStack;
      }

      return {
        focusStack: newFocusStack,
        currentFocus: newCurrentFocus,
      };
    }),

  popFocus: () =>
    set((state) => {
      const newFocusStack = state.focusStack.slice(0, -1);
      const newCurrentFocus = state.currentFocus.slice(0, -1);
      return {
        focusStack: newFocusStack,
        currentFocus: newCurrentFocus,
      };
    }),

  replaceFocus: (item) =>
    set({
      focusStack: [item],
      currentFocus: [item],
    }),

  clearFocus: () =>
    set({
      focusStack: [],
      currentFocus: [],
    }),

  clearCurrentFocus: () =>
    set({
      currentFocus: [],
    }),
}));