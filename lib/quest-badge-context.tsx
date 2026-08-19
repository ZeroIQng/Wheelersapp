import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

interface QuestBadgeContextValue {
  showBadge: boolean;
  /** Call when quest data is fetched — pass the current completed count. */
  reportCompletedCount: (count: number) => void;
  /** Call when user views the quests tab — clears the badge. */
  markSeen: () => void;
}

const QuestBadgeContext = createContext<QuestBadgeContextValue>({
  showBadge: false,
  reportCompletedCount: () => {},
  markSeen: () => {},
});

const STORAGE_KEY = 'wheelers.quests.lastSeenCompleted';

export function QuestBadgeProvider({ children }: PropsWithChildren) {
  const [showBadge, setShowBadge] = useState(false);
  const [lastSeen, setLastSeen] = useState<number | null>(null);
  const [currentCompleted, setCurrentCompleted] = useState<number | null>(null);

  // Load last seen count from storage on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      setLastSeen(val !== null ? Number(val) : null);
    });
  }, []);

  // Show badge when completed count exceeds what was last seen
  useEffect(() => {
    if (lastSeen === null || currentCompleted === null) return;
    setShowBadge(currentCompleted > lastSeen);
  }, [lastSeen, currentCompleted]);

  // Read the latest values through refs so the callbacks below can have empty
  // dependency arrays. These are called from inside effects in consumer
  // screens; if their identity changed on every state update, adding them to
  // a dependency array — which react-hooks/exhaustive-deps actively tells you
  // to do — would spin that effect forever. The driver home screen fetches
  // stats and earnings in exactly such an effect.
  const lastSeenRef = useRef<number | null>(null);
  const currentCompletedRef = useRef<number | null>(null);

  useEffect(() => {
    lastSeenRef.current = lastSeen;
  }, [lastSeen]);

  useEffect(() => {
    currentCompletedRef.current = currentCompleted;
  }, [currentCompleted]);

  const reportCompletedCount = useCallback((count: number) => {
    currentCompletedRef.current = count;
    setCurrentCompleted(count);
    // First time ever — no badge, just store it
    if (lastSeenRef.current === null) {
      lastSeenRef.current = count;
      setLastSeen(count);
      AsyncStorage.setItem(STORAGE_KEY, String(count));
    }
  }, []);

  const markSeen = useCallback(() => {
    const seen = currentCompletedRef.current;
    if (seen === null) return;
    lastSeenRef.current = seen;
    setLastSeen(seen);
    setShowBadge(false);
    AsyncStorage.setItem(STORAGE_KEY, String(seen));
  }, []);

  // A fresh object literal here re-renders every consumer of this context on
  // every provider render, whether or not anything they use actually changed.
  const value = useMemo(
    () => ({ showBadge, reportCompletedCount, markSeen }),
    [showBadge, reportCompletedCount, markSeen],
  );

  return (
    <QuestBadgeContext.Provider value={value}>
      {children}
    </QuestBadgeContext.Provider>
  );
}

export function useQuestBadge() {
  return useContext(QuestBadgeContext);
}
