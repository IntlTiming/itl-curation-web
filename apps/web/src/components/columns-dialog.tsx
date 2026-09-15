import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from 'cn';
import { Columns3, GripVertical, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

// Generic column-visibility/reorder dialog, shared by every table with an "Edit columns"
// button (Reviews, Submitters, ...) - the only per-table pieces are the column key set,
// its labels, and which keys are forced-visible, all passed in as props rather than
// hardcoded here.

// One draggable row. Only its position is draggable - visibility is still a plain checkbox,
// forced-checked and disabled for forced-visible columns, unaffected by drag order.
function SortableColumnRow<K extends string>({
  columnKey,
  label,
  forced,
  visibility,
  onVisibilityChange,
}: {
  columnKey: K;
  label: string;
  forced: boolean;
  visibility: Record<K, boolean>;
  onVisibilityChange: (next: Record<K, boolean>) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: columnKey,
  });
  const id = `column-${columnKey}`;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'bg-background flex items-center gap-2 rounded-md py-1',
        isDragging && 'relative z-10 opacity-70',
      )}
    >
      <button
        type="button"
        className="text-muted-foreground touch-none active:cursor-grabbing"
        aria-label={`Reorder ${label}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <Checkbox
        id={id}
        checked={forced || visibility[columnKey]}
        disabled={forced}
        onCheckedChange={(checked) =>
          onVisibilityChange({ ...visibility, [columnKey]: checked === true })
        }
      />
      <Label htmlFor={id}>{label}</Label>
    </div>
  );
}

export function ColumnsDialog<K extends string>({
  order,
  onOrderChange,
  visibility,
  onVisibilityChange,
  onReset,
  labels,
  forcedVisible,
  description,
}: {
  order: K[];
  onOrderChange: (next: K[]) => void;
  visibility: Record<K, boolean>;
  onVisibilityChange: (next: Record<K, boolean>) => void;
  onReset: () => void;
  labels: Record<K, string>;
  forcedVisible: K[];
  description: string;
}) {
  // A small pointer-move threshold before a drag starts, so a plain click on the checkbox or
  // label doesn't get eaten as an accidental drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = order.indexOf(active.id as K);
    const newIndex = order.indexOf(over.id as K);
    onOrderChange(arrayMove(order, oldIndex, newIndex));
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Columns3 />
          Edit columns
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit columns</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={order} strategy={verticalListSortingStrategy}>
            <div className="grid gap-1 py-2">
              {order.map((key) => (
                <SortableColumnRow
                  key={key}
                  columnKey={key}
                  label={labels[key]}
                  forced={forcedVisible.includes(key)}
                  visibility={visibility}
                  onVisibilityChange={onVisibilityChange}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <DialogFooter>
          <Button variant="ghost" onClick={onReset}>
            <RotateCcw />
            Reset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
