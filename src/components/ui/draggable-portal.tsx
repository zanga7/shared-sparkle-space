import * as React from 'react';
import { createPortal } from 'react-dom';
import { Draggable, DraggableProvided, DraggableStateSnapshot } from '@hello-pangea/dnd';
import { cn } from '@/lib/utils';

interface DraggableWithPortalProps {
  draggableId: string;
  index: number;
  isDragDisabled?: boolean;
  children: (provided: DraggableProvided, snapshot: DraggableStateSnapshot) => React.ReactNode;
  className?: string;
  draggingClassName?: string;
}

/**
 * A wrapper around Draggable that portals the dragged item to document.body
 * This fixes issues on mobile where dragged items appear squashed or clipped
 * when inside containers with overflow: hidden or transform styles
 */
export const DraggableWithPortal: React.FC<DraggableWithPortalProps> = ({
  draggableId,
  index,
  isDragDisabled = false,
  children,
  className,
  draggingClassName = "shadow-xl scale-105 z-[9999]"
}) => {
  return (
    <Draggable 
      draggableId={draggableId} 
      index={index}
      isDragDisabled={isDragDisabled}
    >
      {(provided, snapshot) => {
        const child = (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            className={cn(
              "touch-none",
              className,
              snapshot.isDragging && draggingClassName
            )}
            style={{
              ...provided.draggableProps.style,
              // Ensure the dragged element maintains its size
              ...(snapshot.isDragging && {
                // Prevent any transforms from parent containers affecting the dragged item
                transform: provided.draggableProps.style?.transform,
              })
            }}
          >
            {children(provided, snapshot)}
          </div>
        );

        // Portal the dragged element to body to escape any overflow containers
        if (snapshot.isDragging) {
          return createPortal(child, document.body);
        }

        return child;
      }}
    </Draggable>
  );
};

/**
 * Simple portal wrapper for custom draggable implementations
 * Use this when you need more control over the draggable render
 */
interface PortalAwareDraggableProps {
  provided: DraggableProvided;
  snapshot: DraggableStateSnapshot;
  children: React.ReactNode;
  className?: string;
  draggingClassName?: string;
}

export const PortalAwareDraggable: React.FC<PortalAwareDraggableProps> = ({
  provided,
  snapshot,
  children,
  className,
  draggingClassName = "shadow-xl scale-105 z-[9999]"
}) => {
  const element = (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      className={cn(
        "touch-none",
        className,
        snapshot.isDragging && draggingClassName
      )}
      style={{
        ...provided.draggableProps.style,
      }}
    >
      {children}
    </div>
  );

  if (snapshot.isDragging) {
    return createPortal(element, document.body);
  }

  return element;
};
