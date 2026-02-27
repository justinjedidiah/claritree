import FinanceGraph from "../components/FinanceGraph";
import ChatPanel from "../components/ChatPanel";
import TopContainer from "../components/TopContainer";
import { useFocusStore } from "../stores/useFocusStore";

export default function Dashboard() {
  const focusStack = useFocusStore((s) => s.focusStack);
  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-50">
      {/* Left Column: Top Container + Graph */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Container: Sits at the top of the left side */}
        <TopContainer>
          <p>getFocusStack: {JSON.stringify(focusStack)}</p>
        </TopContainer>

        {/* Finance Graph: Takes up remaining space under TopContainer */}
        <div className="flex-1 relative overflow-auto">
          <FinanceGraph />
        </div>
      </div>

      {/* Right Column: Chat Panel from top to bottom */}
      <div className="w-80 h-full border-l border-gray-200 bg-white">
        <ChatPanel />
      </div>
    </div>
  );
}

