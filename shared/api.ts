/**
 * Shared code between client and server
 * Useful to share types between client and server
 * and/or small pure JS functions that can be used on both client and server
 */

export interface DemoResponse {
  message: string;
}

// Employee data
export interface Employee {
  id: string;
  email: string;
  name: string;
  role: "admin" | "staff";
  department: string;
}

// Document audit log entry
export interface AuditLogEntry {
  action: string;
  date: string;
  by: string;
  details?: string;
}

// Document file attachment
export interface DocumentFile {
  id: string;
  name: string;
  uploadedAt: string;
  uploadedBy: string;
  url: string;
}

// Document status type
export type DocumentStatus = "Pending" | "Processing" | "Approved" | "Released" | "Overdue" | "Sent for approval" | "Completed";

// Document type
export type DocumentType = "Received" | "Assigned" | "Opened" | "Processed" | "Approved" | "Released";

// Routing slip action types
export type RoutingAction =
  | "For approval/signature"
  | "For compliance"
  | "For review/comments/recom"
  | "For attendance"
  | "Please draft reply"
  | "For your file"
  | "Please read and return"
  | "For information/reference";

// Routing slip interface
export interface RoutingSlip {
  actions: RoutingAction[];
  remarks: string;
}

// Document interface
export interface Document {
  id: string; // DTN
  title: string;
  type: string;
  documentType: DocumentType; // Filter type
  status: DocumentStatus;
  submittedDate: string;
  timestamp: string;
  assignedTo: string; // Email of assigned staff
  deadline: string;
  source: string;
  destination?: string; // For outgoing documents
  files: DocumentFile[];
  history: AuditLogEntry[];
  routingSlip?: RoutingSlip; // Routing slip (digital routing sheet)
  revisionComments?: string; // Comments from admin when revising document
  createdAt: string;
  updatedAt: string;
}
