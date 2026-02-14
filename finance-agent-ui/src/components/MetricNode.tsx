import { Handle, Position } from "reactflow";
import type { NodeProps } from "reactflow";

interface MetricNodeData {
  label: string;
  change?: number;
  value?: string;
}

export default function MetricNode({ data }: NodeProps<MetricNodeData>) {
  const isPositive = data.change && data.change > 0;
  const isNegative = data.change && data.change < 0;

  return (
    <div 
      style={{
        background: 'rgba(59, 130, 246, 0.08)',
        backdropFilter: 'blur(8px)',
        color: '#1f2937',
        padding: '6px 6px',
        borderRadius: '9px',
        border: '1px solid rgba(59, 130, 246, 0.15)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
        width: '170px',
        transition: 'all 0.2s ease',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.06)';
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ opacity: 0, pointerEvents: 'none' }}
        isConnectable={false}
      />

      {/* Title and change */}
      <div style={{ 
        fontSize: '13px',
        fontWeight: '500',
        color: '#374151',
        marginBottom: '5px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        overflow: 'hidden',
        gap: '6px'
      }}>
        <span style={{
          whiteSpace: 'nowrap',   // Keep name on one line
          overflow: 'hidden',    // Hide the extra text
          textOverflow: 'ellipsis', // Add the "..."
          flexShrink: 1          // Let the name shrink if space is tight
        }}>{data.label}</span>
        {data.change !== undefined && (
          <span style={{
            fontSize: '12px',
            fontWeight: '600',
            marginRight: '4px',
            color: isPositive ? '#059669' : isNegative ? '#dc2626' : '#6b7280',
            flexShrink: 0         // Prevent the percentage from ever shrinking
          }}>
            {isPositive ? "↑" : isNegative ? "↓" : ""}{Math.abs(data.change)}%
          </span>
        )}
      </div>

      {/* Value with grey background */}
      {data.value && (
        <div style={{
          fontSize: '15px',
          fontWeight: '600',
          color: '#111827',
          letterSpacing: '-0.3px',
          padding: '6px 6px',
          borderRadius: '9px',
          background: '#e5e7eb',
          display: 'block',
          textAlign: 'right',
        }}>
          {data.value}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        style={{ opacity: 0, pointerEvents: 'none' }}
        isConnectable={false}
      />
    </div>
  );
}