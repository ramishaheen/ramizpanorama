import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

interface DraggableWidgetProps {
  id: string;
  children: React.ReactNode;
}

export const DraggableWidget = ({ id, children }: DraggableWidgetProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 50 : "auto",
    position: "relative" as const,
  };

  return (
    <div ref={setNodeRef} style={style} className="group relative">
      <div
        {...attributes}
        {...listeners}
        className="absolute -left-0.5 top-1 z-20 flex flex-col items-center gap-px px-0.5 py-1 rounded cursor-grab active:cursor-grabbing bg-primary/10 border border-primary/20 opacity-40 group-hover:opacity-100 transition-all duration-150 hover:bg-primary/25 shadow-sm"
        title="Drag to reorder"
      >
        <GripVertical className="h-3 w-3 text-primary/70" />
      </div>
      <div className={`rounded-lg transition-all duration-150 ${isDragging ? "ring-1 ring-primary/40 shadow-lg" : "group-hover:ring-1 group-hover:ring-primary/15"}`}>
        {children}
      </div>
    </div>
  );
};
