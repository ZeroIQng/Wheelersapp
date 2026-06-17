import { useAuth } from "@/lib/auth";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
} from "react";

import { getAccessTokenWithRetry } from "@/lib/access-token";
import {
  isBackendConfigured,
  listNotifications,
  markNotificationsRead,
  registerPushToken,
  type AppNotification,
} from "@/lib/api";

type NotificationsContextValue = {
  notifications: AppNotification[];
  unreadCount: number;
  permissionGranted: boolean;
  requestNotificationAccess: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  markAllRead: () => Promise<void>;
};

const defaultValue: NotificationsContextValue = {
  notifications: [],
  unreadCount: 0,
  permissionGranted: false,
  requestNotificationAccess: async () => undefined,
  refreshNotifications: async () => undefined,
  markAllRead: async () => undefined,
};

const NotificationsContext = createContext<NotificationsContextValue>(defaultValue);

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function AppNotificationsProvider({ children }: { children: ReactNode }) {
  const { getAccessToken, isReady, user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [permissionGranted, setPermissionGranted] = useState(false);

  const registerDeviceToken = useCallback(
    async (accessToken: string): Promise<void> => {
      try {
        const projectId =
          Constants.expoConfig?.extra?.eas?.projectId ??
          Constants.easConfig?.projectId;
        const expoPushToken = (
          await Notifications.getExpoPushTokenAsync(
            projectId ? { projectId } : undefined,
          )
        ).data;

        await registerPushToken({
          accessToken,
          expoPushToken,
          platform: Platform.OS,
          deviceName: `${Platform.OS}-${String(Platform.Version)}`,
          appOwnership: Constants.appOwnership ?? undefined,
          enabled: true,
        });
      } catch {
        // Push token registration can fail on simulators or incomplete Expo setup.
      }
    },
    [],
  );

  const refreshNotifications = useCallback(async (): Promise<void> => {
    if (!isReady || !user || !isBackendConfigured()) {
      return;
    }

    const accessToken = await getAccessTokenWithRetry(getAccessToken);
    if (!accessToken) {
      return;
    }

    const response = await listNotifications({ accessToken, limit: 100 });
    setNotifications(response.items);
  }, [getAccessToken, isReady, user]);

  const markAllRead = useCallback(async (): Promise<void> => {
    if (!isReady || !user || !isBackendConfigured()) {
      return;
    }

    const accessToken = await getAccessTokenWithRetry(getAccessToken);
    if (!accessToken) {
      return;
    }

    await markNotificationsRead({ accessToken });
    setNotifications((previous) =>
      previous.map((item) => ({
        ...item,
        read: true,
      })),
    );
  }, [getAccessToken, isReady, user]);

  const requestNotificationAccess = useCallback(async (): Promise<void> => {
    if (!isReady || !user || !isBackendConfigured()) {
      return;
    }

    try {
      const existingPermissions = await Notifications.getPermissionsAsync();
      const finalPermissions = existingPermissions.granted
        ? existingPermissions
        : await Notifications.requestPermissionsAsync();

      setPermissionGranted(finalPermissions.granted);

      const accessToken = await getAccessTokenWithRetry(getAccessToken);
      if (!accessToken) {
        return;
      }

      await refreshNotifications();

      if (!finalPermissions.granted) {
        return;
      }

      await registerDeviceToken(accessToken);
    } catch {
      setPermissionGranted(false);
    }
  }, [
    getAccessToken,
    isReady,
    refreshNotifications,
    registerDeviceToken,
    user,
  ]);

  useEffect(() => {
    if (!isReady || !user || !isBackendConfigured()) {
      setNotifications([]);
      setPermissionGranted(false);
      return;
    }

    let cancelled = false;
    const subscription = Notifications.addNotificationReceivedListener(() => {
      void refreshNotifications();
    });

    void (async () => {
      try {
        const existingPermissions = await Notifications.getPermissionsAsync();
        if (!cancelled) {
          setPermissionGranted(existingPermissions.granted);
        }

        const accessToken = await getAccessTokenWithRetry(getAccessToken);
        if (!accessToken) {
          return;
        }

        await refreshNotifications();

        if (!existingPermissions.granted) {
          return;
        }

        await registerDeviceToken(accessToken);
      } catch {
        if (!cancelled) {
          setPermissionGranted(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [getAccessToken, isReady, refreshNotifications, registerDeviceToken, user]);

  const value = useMemo<NotificationsContextValue>(
    () => ({
      notifications,
      unreadCount: notifications.filter((item) => !item.read).length,
      permissionGranted,
      requestNotificationAccess,
      refreshNotifications,
      markAllRead,
    }),
    [
      markAllRead,
      notifications,
      permissionGranted,
      refreshNotifications,
      requestNotificationAccess,
    ],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useAppNotifications(): NotificationsContextValue {
  return useContext(NotificationsContext);
}
