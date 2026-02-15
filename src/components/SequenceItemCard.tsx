import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { SessionItem, Batch, Vote } from '../types/database';
import { getSlideImageUrl } from '../lib/slide-api';
import { VoteProgressBar } from './VoteProgressBar';

interface SequenceItemCardProps {
  item: SessionItem;
  index: number;
  batch?: Batch;
  questionCount?: number;
  onDelete: (item: SessionItem) => void;
  onExpandBatch?: (batchId: string) => void;
  isActive?: boolean;
  onClick?: () => void;
  hideActions?: boolean;
  batchQuestionIds?: string[];
  sessionVotes?: Record<string, Vote[]>;
  participantCount?: number;
}

export function SequenceItemCard({
  item,
  index,
  batch,
  questionCount,
  onDelete,
  onExpandBatch,
  isActive = false,
  onClick,
  hideActions = false,
  batchQuestionIds,
  sessionVotes,
  participantCount,
}: SequenceItemCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isBatch = item.item_type === 'batch';
  const isSlide = item.item_type === 'slide';

  const colorClasses = isActive
    ? 'bg-blue-100 border-blue-500'
    : isBatch
    ? 'bg-blue-50 border-blue-200 hover:border-blue-300'
    : 'bg-purple-50 border-purple-200 hover:border-purple-300';

  const iconColor = isBatch ? 'text-blue-600' : 'text-purple-600';

  const handleCardClick = onClick;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 border-2 rounded-lg transition-colors ${colorClasses} ${handleCardClick ? 'cursor-pointer' : ''}`}
      onClick={handleCardClick}
    >
      {/* Drag handle */}
      {!hideActions && (
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
          onClick={(e) => e.stopPropagation()}
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm8-12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" />
          </svg>
        </div>
      )}

      {/* Position number */}
      <div className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 text-xs font-medium flex items-center justify-center shrink-0">
        {index + 1}
      </div>

      {/* Type icon */}
      <div className={`shrink-0 ${iconColor}`}>
        {isBatch ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={2} />
            <circle cx="8.5" cy="8.5" r="1.5" strokeWidth={2} />
            <path d="M21 15l-5-5L5 21" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      {/* Content area */}
      <div className="flex-1 min-w-0">
        {isBatch && batch ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExpandBatch?.(item.batch_id!);
            }}
            className="text-left w-full group"
          >
            <div className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
              {batch.name}
            </div>
            <div className="text-sm text-gray-500">
              {questionCount ?? 0} {questionCount === 1 ? 'question' : 'questions'}
            </div>
            {/* Progress bar for active batches with vote data */}
            {batchQuestionIds &&
              sessionVotes &&
              participantCount !== undefined &&
              batch.status === 'active' && (
                <VoteProgressBar
                  batchQuestionIds={batchQuestionIds}
                  sessionVotes={sessionVotes}
                  participantCount={participantCount}
                />
              )}
          </button>
        ) : isSlide ? (
          <div className="flex items-center gap-3">
            {item.slide_image_path && (
              <div className="w-16 h-12 bg-gray-100 rounded shrink-0 overflow-hidden">
                <img
                  src={getSlideImageUrl(item.slide_image_path)}
                  alt={item.slide_caption || 'Slide'}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23e5e7eb" width="100" height="100"/%3E%3Ctext x="50" y="50" text-anchor="middle" dy=".3em" fill="%239ca3af" font-size="10"%3ENot found%3C/text%3E%3C/svg%3E';
                  }}
                />
              </div>
            )}
            <div className="text-sm text-gray-900 truncate">
              {item.slide_caption || <span className="text-gray-400 italic">Untitled Slide</span>}
            </div>
          </div>
        ) : null}
      </div>

      {/* Delete button */}
      {!hideActions && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(item);
          }}
          className="p-2 text-gray-400 hover:text-red-500 transition-colors shrink-0"
          title="Delete"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}
    </div>
  );
}
