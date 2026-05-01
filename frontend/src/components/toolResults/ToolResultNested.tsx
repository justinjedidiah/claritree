import type { NestedSection, FlatRow } from './flattenToolResult';
import ToolResultTable from './ToolResultTable';

interface Props {
  sections: NestedSection[];
}

export default function ToolResultNested({ sections }: Props) {
  return (
    <div className="mt-2 flex flex-col gap-3">
      {sections.map((section, i) => (
        <div key={i}>
          <p className="text-[10px] text-gray-400 font-medium mb-1">{section.label}</p>
          {section.itemType === 'pills' ? (
            <div className="flex flex-wrap gap-1">
              {(section.items as string[]).map((item, j) => (
                <span
                  key={j}
                  className="text-[11px] bg-gray-100 text-gray-600 rounded px-2 py-0.5"
                >
                  {item}
                </span>
              ))}
            </div>
          ) : (
            <ToolResultTable rows={section.items as FlatRow[]} />
          )}
        </div>
      ))}
    </div>
  );
}