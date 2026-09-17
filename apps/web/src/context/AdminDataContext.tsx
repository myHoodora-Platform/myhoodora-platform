"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { useAuth } from "@/context/AuthContext";
import {
  fetchNeighborhoods,
  type NeighborhoodSummary,
} from "@/lib/firebase/auth";
import {
  MOCK_USERS,
  MOCK_QUERIES,
  MOCK_NOTIFICATIONS,
  MOCK_ACTIVITY,
  type MockUser,
  type MockQuery,
  type MockNotification,
  type MockActivity,
} from "@/lib/admin/mock-data";

interface AdminDataContextType {
  users: MockUser[];
  queries: MockQuery[];
  notifications: MockNotification[];
  activity: MockActivity[];
  neighborhoods: NeighborhoodSummary[];
  neighborhoodsLoading: boolean;
  verifyUser: (uid: string, neighborhoodId: string) => void;
  restrictUser: (uid: string) => void;
  unrestrictUser: (uid: string) => void;
  bulkVerify: (uids: string[], neighborhoodId: string) => void;
  bulkRestrict: (uids: string[]) => void;
  moveQuery: (id: string, status: MockQuery["status"]) => void;
  respondToQuery: (id: string, response: string) => void;
  sendNotification: (
    n: Omit<MockNotification, "id" | "sentAt">,
  ) => void;
}

const AdminDataContext = createContext<AdminDataContextType | undefined>(
  undefined,
);

export function AdminDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [users, setUsers] = useState<MockUser[]>(MOCK_USERS);
  const [queries, setQueries] = useState<MockQuery[]>(MOCK_QUERIES);
  const [notifications, setNotifications] =
    useState<MockNotification[]>(MOCK_NOTIFICATIONS);
  const [activity, setActivity] = useState<MockActivity[]>(MOCK_ACTIVITY);
  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodSummary[]>(
    [],
  );
  const [neighborhoodsLoading, setNeighborhoodsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchNeighborhoods(user)
      .then(setNeighborhoods)
      .catch((err) => console.error("Failed to fetch neighborhoods:", err))
      .finally(() => setNeighborhoodsLoading(false));
  }, [user]);

  const logActivity = (text: string) => {
    setActivity((prev) =>
      [
        { id: crypto.randomUUID(), text, timestamp: new Date().toISOString() },
        ...prev,
      ].slice(0, 20),
    );
  };

  const verifyUser = (uid: string, neighborhoodId: string) => {
    const neighborhoodName = neighborhoods.find(
      (n) => n._id === neighborhoodId,
    )?.name;
    setUsers((prev) =>
      prev.map((u) =>
        u.uid === uid
          ? { ...u, verificationStatus: "verified", neighborhoodName }
          : u,
      ),
    );
    const target = users.find((u) => u.uid === uid);
    if (target) logActivity(`You verified ${target.displayName}`);
  };

  const restrictUser = (uid: string) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.uid === uid ? { ...u, verificationStatus: "banned" } : u,
      ),
    );
    const target = users.find((u) => u.uid === uid);
    if (target) logActivity(`You restricted ${target.displayName}`);
  };

  const unrestrictUser = (uid: string) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.uid === uid ? { ...u, verificationStatus: "unverified" } : u,
      ),
    );
    const target = users.find((u) => u.uid === uid);
    if (target) logActivity(`You lifted the restriction on ${target.displayName}`);
  };

  const bulkVerify = (uids: string[], neighborhoodId: string) => {
    const neighborhoodName = neighborhoods.find(
      (n) => n._id === neighborhoodId,
    )?.name;
    setUsers((prev) =>
      prev.map((u) =>
        uids.includes(u.uid)
          ? { ...u, verificationStatus: "verified", neighborhoodName }
          : u,
      ),
    );
    logActivity(`You verified ${uids.length} users`);
  };

  const bulkRestrict = (uids: string[]) => {
    setUsers((prev) =>
      prev.map((u) =>
        uids.includes(u.uid) ? { ...u, verificationStatus: "banned" } : u,
      ),
    );
    logActivity(`You restricted ${uids.length} users`);
  };

  const moveQuery = (id: string, status: MockQuery["status"]) => {
    setQueries((prev) =>
      prev.map((q) => (q.id === id ? { ...q, status } : q)),
    );
  };

  const respondToQuery = (id: string, response: string) => {
    setQueries((prev) =>
      prev.map((q) =>
        q.id === id
          ? { ...q, adminResponse: response, status: "resolved" }
          : q,
      ),
    );
    logActivity("You responded to a support query");
  };

  const sendNotification = (n: Omit<MockNotification, "id" | "sentAt">) => {
    setNotifications((prev) => [
      { ...n, id: crypto.randomUUID(), sentAt: new Date().toISOString() },
      ...prev,
    ]);
    logActivity(`You sent a notification: "${n.title}"`);
  };

  return (
    <AdminDataContext.Provider
      value={{
        users,
        queries,
        notifications,
        activity,
        neighborhoods,
        neighborhoodsLoading,
        verifyUser,
        restrictUser,
        unrestrictUser,
        bulkVerify,
        bulkRestrict,
        moveQuery,
        respondToQuery,
        sendNotification,
      }}
    >
      {children}
    </AdminDataContext.Provider>
  );
}

export function useAdminData() {
  const context = useContext(AdminDataContext);
  if (context === undefined) {
    throw new Error("useAdminData must be used within an AdminDataProvider");
  }
  return context;
}
