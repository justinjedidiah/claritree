import { useState, useEffect } from "react";
import FinanceGraph from "../components/FinanceGraph";
import ChatPanel from "../components/ChatPanel";
import TopContainer from "../components/TopContainer";
import { useFocusStore } from "../stores/useFocusStore";
import { fetchFilterOptions } from "../engine/graph";

export interface DashboardProps {
  period: string;
  report: string | null;
}

export default function Dashboard() {
  const clearFocus = useFocusStore((s) => s.clearCurrentFocus);

  const [pendingFilters, setPendingFilters] = useState<DashboardProps>({
    period: "latest",
    report: null,
  });
  const [appliedFilters, setAppliedFilters] = useState<DashboardProps>(pendingFilters);
  const [filterOptions, setFilterOptions] = useState<Record<string, any>>({period: null})

  useEffect(() => {
    const loadFilterOptions = async () => {
      const filterOptions = await fetchFilterOptions();
      setFilterOptions(filterOptions)
    };
    loadFilterOptions();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: { key: string; }) => {
      if (e.key === "Escape") {
        clearFocus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clearFocus]);
  
  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-50">
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopContainer 
          filters={pendingFilters}
          setFilters={setPendingFilters}
          onApply={() => setAppliedFilters(pendingFilters)}
          filterOptions={filterOptions}
        />
        <div className="flex-1 relative overflow-auto">
          <FinanceGraph filters={appliedFilters} />
        </div>
      </div>
      <div className="w-80 h-full border-l border-gray-200 bg-white">
        <ChatPanel />
      </div>
    </div>
  );
}

