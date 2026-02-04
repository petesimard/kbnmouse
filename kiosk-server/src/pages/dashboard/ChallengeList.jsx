import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import ChallengeCard from './ChallengeCard';

function ChallengeList({ challenges, onReorder, onEdit, onDelete, onToggle }) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = challenges.findIndex((c) => c.id === active.id);
      const newIndex = challenges.findIndex((c) => c.id === over.id);
      const newOrder = arrayMove(challenges, oldIndex, newIndex);
      onReorder(newOrder);
    }
  };

  if (challenges.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <p>No challenges configured yet.</p>
        <p className="text-sm mt-2">Click "Add Challenge" to get started.</p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={challenges.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {challenges.map((challenge) => (
            <ChallengeCard
              key={challenge.id}
              challenge={challenge}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggle={onToggle}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

export default ChallengeList;
