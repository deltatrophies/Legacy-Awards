import { AppError } from "../errors/AppError.js";

export const SALES_ROLES = ["sales", "sales_manager", "staff"];
export const SALES_ACCESS_ROLES = ["sales", "sales_manager", "staff", "admin"];
export const ASSIGNMENT_MANAGER_ROLES = ["sales_manager", "staff", "admin"];

export const isAssignmentManager = (role) => ASSIGNMENT_MANAGER_ROLES.includes(role);
export const isSalesExecutive = (role) => role === "sales";

const idOf = (value) => String(value?._id || value || "");

export function salesVisibilityFilter(auth, requestedView = "all") {
  if (isSalesExecutive(auth?.role)) return { assignedTo: auth.userId };
  if (requestedView === "mine") return { assignedTo: auth.userId };
  if (requestedView === "unassigned") return { assignedTo: null };
  return {};
}

export function assertSalesRecordAccess(record, auth) {
  if (!record) return;
  if (!isSalesExecutive(auth?.role)) return;
  const assigneeId = idOf(record.assignedTo);
  if (assigneeId === String(auth.userId)) return;
  throw new AppError(403, "LEAD_NOT_ASSIGNED", "This record is assigned to another sales executive");
}

export function actorSnapshot(auth) {
  const user = auth?.user || {};
  return {
    actor: auth?.userId,
    actorName: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "Team member",
    actorRole: auth?.role || "system",
  };
}

export function activityEntry(auth, type, message, metadata) {
  return {
    type,
    message,
    ...actorSnapshot(auth),
    ...(metadata ? { metadata } : {}),
    createdAt: new Date(),
  };
}

export function addDocumentActivity(document, auth, type, message, metadata) {
  const next = [...(document.activity || []), activityEntry(auth, type, message, metadata)];
  document.activity = next.slice(-200);
}
