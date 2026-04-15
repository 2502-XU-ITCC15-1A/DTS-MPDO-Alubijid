import { supabase } from "@/lib/supabase";
import { Employee, Document, RoutingAction } from "@shared/api";

// ── Employees ─────────────────────────────────────────────────────────────────

export async function getEmployees(): Promise<Employee[]> {
  const { data, error } = await supabase.from("employees").select("*");
  if (error) throw error;
  return data ?? [];
}

export async function addEmployee(employee: Omit<Employee, "id">): Promise<Employee> {
  const { data, error } = await supabase.from("employees").insert(employee).select().single();
  if (error) throw error;
  return data;
}

export async function updateEmployeeRole(id: string, role: "admin" | "staff") {
  const { error } = await supabase.from("employees").update({ role }).eq("id", id);
  if (error) throw error;
}

// ── Documents ─────────────────────────────────────────────────────────────────

export async function getDocuments(): Promise<Document[]> {
  const { data: docs, error } = await supabase.from("documents").select("*");
  if (error) throw error;

  const documents: Document[] = await Promise.all(
    (docs ?? []).map(async (doc) => {
      const { data: files } = await supabase
        .from("document_files")
        .select("*")
        .eq("document_id", doc.id);

      const { data: logs } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("document_id", doc.id)
        .order("created_at");

      return {
        id: doc.id,
        title: doc.title,
        type: doc.type,
        documentType: doc.document_type,
        status: doc.status,
        submittedDate: doc.submitted_date,
        timestamp: doc.timestamp,
        assignedTo: doc.assigned_to,
        deadline: doc.deadline,
        source: doc.source,
        destination: doc.destination,
        routingSlip: doc.routing_slip,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
        files: (files ?? []).map((f) => ({
          id: f.id,
          name: f.name,
          uploadedAt: f.uploaded_at,
          uploadedBy: f.uploaded_by,
          url: f.url,
        })),
        history: (logs ?? []).map((l) => ({
          action: l.action,
          date: l.date,
          by: l.by_user,
          details: l.details,
        })),
      };
    })
  );

  return documents;
}

export async function createDocument(
  doc: Omit<Document, "files" | "history">,
  routingActions: RoutingAction[],
  routingRemarks: string,
  createdBy: string
): Promise<void> {
  const now = new Date().toISOString();
  const dtn = `DTN-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;

  const { error } = await supabase.from("documents").insert({
    id: dtn,
    title: doc.title,
    type: doc.type,
    document_type: "Received",
    status: "Pending",
    submitted_date: now.split("T")[0],
    timestamp: new Date().toLocaleString(),
    assigned_to: doc.assignedTo,
    deadline: doc.deadline,
    source: doc.source,
    destination: doc.destination ?? null,
    routing_slip: { actions: routingActions, remarks: routingRemarks },
    created_at: now,
    updated_at: now,
  });
  if (error) throw error;

  await addAuditLog(dtn, "Received", createdBy);
}

export async function updateDocument(id: string, fields: Partial<{
  status: string;
  assignedTo: string;
  source: string;
  destination: string;
}>) {
  const mapped: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.status) mapped.status = fields.status;
  if (fields.assignedTo) mapped.assigned_to = fields.assignedTo;
  if (fields.source) mapped.source = fields.source;
  if (fields.destination !== undefined) mapped.destination = fields.destination;

  const { error } = await supabase.from("documents").update(mapped).eq("id", id);
  if (error) throw error;
}

export async function deleteDocument(id: string) {
  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) throw error;
}

export async function addDocumentFile(
  documentId: string,
  fileName: string,
  uploadedBy: string,
  url = "#"
) {
  const { error } = await supabase.from("document_files").insert({
    document_id: documentId,
    name: fileName,
    uploaded_by: uploadedBy,
    url,
  });
  if (error) throw error;
}

export async function uploadFile(
  documentId: string,
  file: File,
  uploadedBy: string
): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("documentId", documentId);

  let response: Response;
  try {
    response = await fetch("http://localhost:5000/api/upload", {
      method: "POST",
      body: formData,
    });
  } catch {
    throw new Error("Cannot connect to backend. Make sure the backend server is running on port 5000.");
  }

  if (!response.ok) {
    let errMsg = `Upload failed (HTTP ${response.status})`;
    try {
      const err = await response.json();
      errMsg = err.error || errMsg;
    } catch {
      // response was not JSON
    }
    throw new Error(errMsg);
  }

  let data: any;
  try {
    data = await response.json();
  } catch {
    throw new Error("Backend returned an invalid response. Check if the backend is running correctly on port 5000.");
  }

  const { url } = data;

  await addDocumentFile(documentId, file.name, uploadedBy, url);
  await addAuditLog(documentId, "File Uploaded", uploadedBy, file.name);

  return url;
}

export async function addAuditLog(
  documentId: string,
  action: string,
  byUser: string,
  details?: string
) {
  const { error } = await supabase.from("audit_logs").insert({
    document_id: documentId,
    action,
    date: new Date().toLocaleString(),
    by_user: byUser,
    details: details ?? null,
  });
  if (error) throw error;
}

// ── Static data ────────────────────────────────────────────────────────────────

export const locations = [
  "Mayor's Office",
  "National Agency",
  "Public Applicant",
  "LGU Office",
  "Planning Department",
  "Engineering Department",
  "Finance Department",
];

export const routingActionOptions: RoutingAction[] = [
  "For approval/signature",
  "For compliance",
  "For review/comments/recom",
  "For attendance",
  "Please draft reply",
  "For your file",
  "Please read and return",
  "For information/reference",
];
