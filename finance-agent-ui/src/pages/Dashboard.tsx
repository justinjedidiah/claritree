import FinanceGraph from "../components/FinanceGraph";
import ChatPanel from "../components/ChatPanel";

export default function Dashboard() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-50">
      <div className="flex-3 relative">
        <FinanceGraph />
      </div>
      <div className="flex-1 h-full">
        <ChatPanel />
      </div>
    </div>
  );
}
