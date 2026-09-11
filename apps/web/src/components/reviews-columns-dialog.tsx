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
import {
  FORCED_VISIBLE_REVIEWS_COLUMNS,
  REVIEWS_COLUMN_LABELS,
  type ReviewsColumnKey,
  type ReviewsColumnVisibility,
} from '@/components/reviews-columns';
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

// One draggable row. Only its position is draggable - visibility is still a plain checkbox,
// forced-checked and disabled for Meter/Title, unaffected by drag order.
function SortableColumnRow({
  columnKey,
  visibility,
  onVisibilityChange,
}: {
  columnKey: ReviewsColumnKey;
  visibility: ReviewsColumnVisibility;
  onVisibilityChange: (next: ReviewsColumnVisibility) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: columnKey,
  });
  const forced = FORCED_VISIBLE_REVIEWS_COLUMNS.includes(columnKey);
  const id = `reviews-column-${columnKey}`;

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
        aria-label={`Reorder ${REVIEWS_COLUMN_LABELS[columnKey]}`}
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
      <Label htmlFor={id}>{REVIEWS_COLUMN_LABELS[columnKey]}</Label>
    </div>
  );
}

export function ReviewsColumnsDialog({
  order,
  onOrderChange,
  visibility,
  onVisibilityChange,
  onReset,
}: {
  order: ReviewsColumnKey[];
  onOrderChange: (next: ReviewsColumnKey[]) => void;
  visibility: ReviewsColumnVisibility;
  onVisibilityChange: (next: ReviewsColumnVisibility) => void;
  onReset: () => void;
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
    const oldIndex = order.indexOf(active.id as ReviewsColumnKey);
    const newIndex = order.indexOf(over.id as ReviewsColumnKey);
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
          <DialogDescription>
            Drag to reorder, or check a column to show or hide it in the Reviews table.
          </DialogDescription>
        </DialogHeader>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={order} strategy={verticalListSortingStrategy}>
            <div className="grid gap-1 py-2">
              {order.map((key) => (
                <SortableColumnRow
                  key={key}
                  columnKey={key}
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
