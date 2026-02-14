import FinanceGraph from "../components/FinanceGraph";
import ChatPanel from "../components/ChatPanel";

export default function Dashboard() {
  return (
    <div style={{ display: "flex" }}>
      <div style={{ flex: 3 }}>
        <FinanceGraph />
      </div>
      <div style={{ flex: 1 }}>
        <ChatPanel />
      </div>
    </div>
  );
}
