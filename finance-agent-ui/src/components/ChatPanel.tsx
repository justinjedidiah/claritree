export default function ChatPanel() {
  return (
    <div style={{
      height: "600px",
      borderLeft: "1px solid #ddd",
      padding: "10px"
    }}>
      <h3>AI Analyst</h3>
      <div style={{flex:1}}>Chat here</div>
      <input placeholder="Ask a question..." />
    </div>
  );
}
