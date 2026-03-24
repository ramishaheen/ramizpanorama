import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

interface DraggableWidgetProps {
  id: string;
  children: React.ReactNode;
  disabled?: boolean;
}

export const DraggableWidget = ({ id, children, disabled = false }: DraggableWidgetProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 50 : "auto",
    position: "relative" as const,
  };

  return (
    <div ref={setNodeRef} style={style} className="group relative">
      {!disabled && (
        <div
          {...attributes}
          {...listeners}
          className="absolute -left-0.5 top-1 z-20 flex flex-col items-center gap-px px-0.5 py-1 cursor-grab active:cursor-grabbing bg-primary/8 border border-primary/15 opacity-0 group-hover:opacity-80 transition-all duration-200 hover:bg-primary/15"
          title="Drag to reorder"
        >
          <GripVertical className="h-3 w-3 text-primary/60" />
        </div>
      )}
      <div className={`transition-all duration-200 ${isDragging ? "ring-1 ring-primary/30 shadow-[0_8px_32px_hsl(216_28%_2%/0.5)]" : "group-hover:shadow-[0_2px_12px_hsl(192_95%_48%/0.06)]"}`}>
        {children}
      </div>
    </div>
  );
};
