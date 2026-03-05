import { useState, useEffect, useRef, useCallback } from "react";
import FinanceGraph from "../components/FinanceGraph";
import ChatPanel from "../components/ChatPanel";
import TopContainer from "../components/TopContainer";
import { useFocusStore } from "../stores/useFocusStore";
import { fetchFilterOptions } from "../engine/graph";

export interface DashboardProps {
  period: string;
  report: string | null;
}

const MIN_WIDTH = 240;
const MAX_WIDTH = 600;
const DEFAULT_WIDTH = 320;

export default function Dashboard() {
  const clearFocus = useFocusStore((s) => s.clearCurrentFocus);
  const [pendingFilters, setPendingFilters] = useState<DashboardProps>({ period: "latest", report: null });
  const [appliedFilters, setAppliedFilters] = useState<DashboardProps>(pendingFilters);
  const [filterOptions, setFilterOptions] = useState<Record<string, any>>({ period: null });
  const [applyStatus, setApplyStatus] = useState<'idle' | 'applied'>('idle');

  const [chatWidth, setChatWidth] = useState(DEFAULT_WIDTH);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(DEFAULT_WIDTH);

  useEffect(() => {
    const load = async () => setFilterOptions(await fetchFilterOptions());
    load();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: { key: string }) => { if (e.key === "Escape") clearFocus(); };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clearFocus]);

  const handleApply = () => {
    setAppliedFilters(pendingFilters);
    setApplyStatus('applied');
    setTimeout(() => setApplyStatus('idle'), 1500);
  };

  // --- drag handlers ---
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    startX.current = e.clientX;
    startWidth.current = chatWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [chatWidth]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      // dragging left = wider chat (chat is on the right, so invert delta)
      const delta = startX.current - e.clientX;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta));
      setChatWidth(newWidth);
    };

    const onMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-50">
      {/* graph takes full width — chat overlays on top */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopContainer
          filters={pendingFilters}
          setFilters={setPendingFilters}
          onApply={handleApply}
          filterOptions={filterOptions}
          applyStatus={applyStatus}
        />
        <div className="flex-1 relative overflow-auto">
          <FinanceGraph filters={appliedFilters} />
        </div>
      </div>

      {/* overlay chat panel — sits on top of graph, doesn't affect layout */}
      <div
        style={{ width: chatWidth }}
        className="absolute top-0 right-0 h-full flex z-20 pointer-events-none overflow-hidden"
      >
        {/* drag handle */}
        <div
          onMouseDown={onMouseDown}
          className="w-1 h-full cursor-col-resize pointer-events-auto group flex items-center justify-center"
        >
          {/* visual handle indicator */}
          <div className="w-1 h-16 rounded-full bg-gray-200 group-hover:bg-indigo-400 group-active:bg-indigo-500 transition-colors duration-150" />
        </div>

        {/* chat panel itself */}
        <div className="flex-1 h-full pointer-events-auto shadow-2xl">
          <ChatPanel />
        </div>
      </div>
    </div>
  );
}
