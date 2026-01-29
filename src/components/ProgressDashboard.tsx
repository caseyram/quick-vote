import { useMemo, useState, useEffect, useRef } from 'react';
import { CountdownTimer } from './CountdownTimer';

interface ProgressDashboardProps {
  questionIds: string[];
  participantCount: number;
  voteCounts: Record<string, number>; // questionId -> vote count
  countdownRemaining?: number;
  countdownRunning?: boolean;
}

export function ProgressDashboard({
  questionIds,
  participantCount,
  voteCounts,
  countdownRemaining = 0,
  countdownRunning = false,
}: ProgressDashboardProps) {
  // Calculate totals
  const totalVotes = useMemo(
    () => Object.values(voteCounts).reduce((sum, c) => sum + c, 0),
    [voteCounts]
  );

  // Approximate completed participants: floor of totalVotes / questionIds.length
  const completedParticipants = useMemo(() => {
    if (questionIds.length === 0) return 0;
    return Math.floor(totalVotes / questionIds.length);
  }, [totalVotes, questionIds.length]);

  const inProgress = Math.max(0, participantCount - completedParticipants);

  // Progress percentage for overall bar
  const progressPercent = useMemo(() => {
    if (participantCount === 0) return 0;
    return Math.min(100, (completedParticipants / participantCount) * 100);
  }, [completedParticipants, participantCount]);

  // Pulse animation state - track previous total to detect increases
  const prevTotalRef = useRef(totalVotes);
  const [pulsing, setPulsing] = useState(false);

  useEffect(() => {
    if (totalVotes > prevTotalRef.current) {
      setPulsing(true);
      const timer = setTimeout(() => setPulsing(false), 600);
      prevTotalRef.current = totalVotes;
      return () => clearTimeout(timer);
    }
    prevTotalRef.current = totalVotes;
  }, [totalVotes]);

  return (
    <div
      className={`bg-white border-b border-gray-200 px-6 py-4 ${
        pulsing ? 'animate-[pulse-update_0.6s_ease-out]' : ''
      }`}
    >
      <div className="max-w-6xl mx-auto">
        {/* Top row: Timer (prominent) + Progress stats */}
        <div className="flex items-center justify-between gap-6 mb-3">
          {/* Timer - large and prominent */}
          <div className="shrink-0">
            {countdownRunning && (
              <CountdownTimer
                remainingSeconds={Math.ceil(countdownRemaining / 1000)}
                isRunning={countdownRunning}
                size="hero"
                theme="light"
              />
            )}
          </div>

          {/* Progress stats */}
          <div className="flex items-center gap-6 text-sm text-gray-600">
            <span className="font-medium text-lg text-gray-800">
              {completedParticipants}/{participantCount} complete
            </span>
            <span>In progress: {inProgress}</span>
          </div>
        </div>

        {/* Overall progress bar */}
        <div className="mb-3">
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Per-question mini bars */}
        <div className="flex gap-2">
          {questionIds.map((qId, idx) => {
            const count = voteCounts[qId] || 0;
            const percent = participantCount > 0 ? (count / participantCount) * 100 : 0;
            return (
              <div key={qId} className="flex-1 min-w-0">
                <div className="text-xs text-gray-500 mb-1">Q{idx + 1}</div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 transition-all duration-300"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <div className="text-xs text-gray-600 mt-1">{count}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
