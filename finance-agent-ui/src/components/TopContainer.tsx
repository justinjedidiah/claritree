export default function TopContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-40 bg-white border-b border-gray-700 p-4">
      {children}
    </div>
  );
}