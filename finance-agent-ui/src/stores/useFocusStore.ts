import { create } from "zustand";

export interface FocusItem {
  type: "node" | "edge";
  id: string;
  mode: "default" | "with_descendants" | "with_ancestors" | "with_ancestors_and_descendants"
};

interface FocusState {
  focusStack: FocusItem[];
  currentFocus: FocusItem[];

  pushFocus: (item: FocusItem, add?: boolean, allowsDeselect?: boolean) => void;
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

  pushFocus: (item, add = false, allowsDeselect = true) =>
    set((state) => {
      let newFocusStack: FocusItem[];
      let newCurrentFocus: FocusItem[];

      const isInCurrentFocused = state.currentFocus.some((f) => f.id === item.id);
      // Move or add the item to the top of the focus stack
      const filteredStack = state.focusStack.filter((f) => f.id !== item.id);
      const filteredCurrentFocus = state.currentFocus.filter((f) => f.id !== item.id)
      const updatedStack = [
        ...filteredStack,
        item
      ].slice(-10);
      const updatedCurrentFocus = [
        ...filteredCurrentFocus,
        item
      ]

      if (add) {
        if (isInCurrentFocused && allowsDeselect) {
          // Remove from both
          newCurrentFocus = filteredCurrentFocus;
          newFocusStack = filteredStack;
        } else if (isInCurrentFocused && !allowsDeselect) {
          // Update node (could have different mode)
          if (['with_ancestors', 'with_descendants'].includes(item.mode)) {
            const prevItemInStack = state.focusStack.find(f => f.id === item.id);
            const newItemInStack = updatedCurrentFocus.at(-1)
            const prevItemInCurrentFocus = state.currentFocus.find(f => f.id === item.id);
            const newItemInCurrentFocus = updatedStack.at(-1);

            if (prevItemInStack?.mode != newItemInStack?.mode) {
              newItemInStack!.mode = 'with_ancestors_and_descendants';
            }
            if (prevItemInCurrentFocus?.mode != newItemInCurrentFocus?.mode) {
              newItemInCurrentFocus!.mode = 'with_ancestors_and_descendants';
            }
          }
          newCurrentFocus = updatedCurrentFocus;
          newFocusStack = updatedStack;
        } else {
          // Add to current focus, move to top of focus stack
          newCurrentFocus = updatedCurrentFocus;
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