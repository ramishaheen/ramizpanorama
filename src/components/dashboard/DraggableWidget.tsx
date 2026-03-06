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
    opacity: isDragging ? 0.5 : 1,
    position: "relative" as const,
  };

  return (
    <div ref={setNodeRef} style={style} className="group relative">
      <div
        {...attributes}
        {...listeners}
        className="absolute -left-1 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-0.5 px-1 py-2 rounded-md cursor-grab active:cursor-grabbing bg-primary/15 border border-primary/30 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-primary/25 hover:scale-110 shadow-sm"
        title="Drag to reorder"
      >
        <GripVertical className="h-4 w-4 text-primary" />
      </div>
      <div className="group-hover:ring-1 group-hover:ring-primary/20 rounded-lg transition-all duration-200">
        {children}
      </div>
    </div>
  );
};
