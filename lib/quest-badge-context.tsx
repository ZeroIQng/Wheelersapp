import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useState } from 'react';

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

  const reportCompletedCount = useCallback((count: number) => {
    setCurrentCompleted(count);
    // First time ever — no badge, just store it
    if (lastSeen === null) {
      setLastSeen(count);
      AsyncStorage.setItem(STORAGE_KEY, String(count));
    }
  }, [lastSeen]);

  const markSeen = useCallback(() => {
    if (currentCompleted === null) return;
    setLastSeen(currentCompleted);
    setShowBadge(false);
    AsyncStorage.setItem(STORAGE_KEY, String(currentCompleted));
  }, [currentCompleted]);

  return (
    <QuestBadgeContext.Provider value={{ showBadge, reportCompletedCount, markSeen }}>
      {children}
    </QuestBadgeContext.Provider>
  );
}

export function useQuestBadge() {
  return useContext(QuestBadgeContext);
}
