import { supabase } from "@/lib/supabase";
import { Employee, Document, RoutingAction } from "@shared/api";

// ── Employees ─────────────────────────────────────────────────────────────────

export async function getEmployees(): Promise<Employee[]> {
  const { data, error } = await supabase.from("employees").select("*");
  if (error) throw error;
  return data ?? [];
}

export async function addEmployee(
  employee: Omit<Employee, "id">,
): Promise<Employee> {
  const { data, error } = await supabase
    .from("employees")
    .insert(employee)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateEmployeeRole(id: string, role: "admin" | "staff") {
  const { error } = await supabase
    .from("employees")
    .update({ role })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteEmployee(id: string) {
  const response = await fetch(
    `/api/delete-employee/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || "Failed to delete employee.");
  }

  return response.json();
}

export async function updateEmployeeProfile(
  id: string,
  name: string,
  department: string | null,
  personal_email?: string | null,
) {
  const response = await fetch("/api/user/update-profile", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id, name, department, personal_email }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || "Failed to update profile.");
  }

  return response.json();
}

export async function changeUserPassword(email: string, newPassword: string) {
  const response = await fetch("/api/user/change-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, newPassword }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || "Failed to change password.");
  }

  return response.json();
}

// ── Documents ─────────────────────────────────────────────────────────────────

export async function getDocuments(): Promise<Document[]> {
  const { data: docs, error } = await supabase
    .from("documents")
    .select("*")
    .order("created_at", { ascending: false });
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
        revisionComments: doc.revision_comments ?? "",
        archived: doc.archived ?? false,
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
    }),
  );

  return documents.sort((a, b) => {
    const aTime = new Date(a.createdAt || a.submittedDate || a.timestamp).getTime();
    const bTime = new Date(b.createdAt || b.submittedDate || b.timestamp).getTime();
    return bTime - aTime;
  });
}

export async function createDocument(
  doc: Omit<Document, "files" | "history">,
  routingActions: RoutingAction[],
  routingRemarks: string,
  createdBy: string,
  assignedToName?: string,
): Promise<string> {
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

  // Create initial audit logs
  await addAuditLog(dtn, "Document Created", createdBy);
  if (doc.assignedTo && assignedToName) {
    await addAuditLog(dtn, `Assigned to ${assignedToName}`, createdBy);
  }
  return dtn;
}

export async function updateDocument(
  id: string,
  fields: Partial<{
    title: string;
    status: string;
    assignedTo: string;
    source: string;
    destination: string;
    deadline: string;
    documentType: string;
    archived: boolean;
    routingActions?: string[];
  }>,
) {
  const mapped: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (fields.title) mapped.title = fields.title;
  if (fields.status) mapped.status = fields.status;
  if (fields.assignedTo) mapped.assigned_to = fields.assignedTo;
  if (fields.source) mapped.source = fields.source;
  if (fields.destination !== undefined) mapped.destination = fields.destination;
  if (fields.deadline) mapped.deadline = fields.deadline;
  if (fields.archived !== undefined) mapped.archived = fields.archived;
  if (fields.routingActions) {
    // Store routing actions as JSON array in the database
    mapped.routing_slip = JSON.stringify({
      actions: fields.routingActions,
    });
  }

  const { error } = await supabase
    .from("documents")
    .update(mapped)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteDocument(id: string) {
  // Delete the Google Drive folder and all files inside it
  const driveRes = await fetch(`/api/delete-folder/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!driveRes.ok) {
    const err = await driveRes.json().catch(() => ({}));
    throw new Error(err.error || "Failed to delete files from Google Drive");
  }

  // Delete related Supabase records
  await supabase.from("document_files").delete().eq("document_id", id);
  await supabase.from("audit_logs").delete().eq("document_id", id);

  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) throw error;
}

export async function archiveDocument(documentId: string, archivedDate?: Date) {
  const res = await fetch("/api/archive-document", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documentId, archivedDate: (archivedDate ?? new Date()).toISOString() }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || "Failed to archive document.");
  }
  return res.json();
}

export async function deleteDocumentFile(fileId: string) {
  const { error } = await supabase
    .from("document_files")
    .delete()
    .eq("id", fileId);
  if (error) throw error;
}

export async function addDocumentFile(
  documentId: string,
  fileName: string,
  uploadedBy: string,
  url = "#",
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
  uploadedBy: string,
): Promise<string> {
  // Encode file as base64 so it works reliably on both local backend and Netlify Functions
  const fileBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const res = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      documentId,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      fileBase64,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Upload failed" }));
    throw new Error(err.error || "Upload failed");
  }

  const { url } = await res.json();

  await addDocumentFile(documentId, file.name, uploadedBy, url);
  await addAuditLog(documentId, "File Uploaded", uploadedBy, file.name);

  return url;
}

export async function addAuditLog(
  documentId: string,
  action: string,
  byUser: string,
  details?: string,
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

export async function sendDocumentForApproval(
  documentId: string,
  approver: string,
  oldStatus?: string,
) {
  await updateDocument(documentId, { status: "Sent for approval" });
  await addAuditLog(
    documentId,
    "Sent for Admin Approval",
    approver,
    `Changed from ${oldStatus || "Unknown"} to Sent for approval. Document submitted for admin review`,
  );
}

export async function approveDocument(
  documentId: string,
  approver: string,
  oldStatus?: string,
) {
  await updateDocument(documentId, { status: "Completed" });
  await addAuditLog(
    documentId,
    "Document Approved",
    approver,
    `Changed from ${oldStatus || "Unknown"} to Completed. Document approved by admin`,
  );
}

export async function reviseDocument(
  documentId: string,
  comments: string,
  revisor: string,
  oldStatus?: string,
) {
  const { data: existingDoc, error: fetchError } = await supabase
    .from("documents")
    .select("assigned_to, routing_slip")
    .eq("id", documentId)
    .single();

  if (fetchError || !existingDoc) {
    throw fetchError || new Error("Document not found.");
  }

  const mapped: Record<string, unknown> = {
    status: "Needs revision",
    revision_comments: comments,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("documents")
    .update(mapped)
    .eq("id", documentId);

  if (error) {
    const unknownColumnError =
      error.message?.includes("revision_comments") ||
      error.message?.includes("schema cache");

    if (!unknownColumnError) {
      throw error;
    }

    const fallbackRoutingSlip = {
      ...(existingDoc.routing_slip || {}),
      revision_comments: comments,
    };

    const { error: fallbackError } = await supabase
      .from("documents")
      .update({
        status: "Needs revision",
        routing_slip: fallbackRoutingSlip,
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    if (fallbackError) throw fallbackError;
  }

  await addAuditLog(
    documentId,
    "Revision requested",
    revisor,
    `Sent revision comments to ${existingDoc.assigned_to}`,
  );
  await addAuditLog(
    documentId,
    "Document Revised",
    revisor,
    `Changed from ${oldStatus || "Unknown"} to Pending. Revision comments: ${comments}`,
  );
}

// ── Static data ────────────────────────────────────────────────────────────────

export const locations = [
  "Human Resource Management Office",
  "Local Civil Registrar",
  "Mayor's Office",
  "Municipal Accounting Office",
  "Municipal Assessor's Office",
  "Municipal Budget Office",
  "Municipal Economic Enterprise & Development Office – Market, Slaughterhouse, Cemetery",
  "Municipal Engineering Office",
  "Municipal Environment and Natural Resources Office",
  "Municipal Health Office",
  "Municipal Planning and Development Office",
  "Municipal Social Welfare and Development Office",
  "Municipal Treasury Office",
  "Office of the Agricultural Services",
  "Sangguniang Bayan Office",
  "DILG Office",
  "Alubijid Municipal Police Station",
  "Alubijid Fire Station",
  "Others",
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

// DUMMY DATA (FOR TESTING PURPOSES ONLY)
export const mockDocuments: Document[] = [
  {
    id: "DTN-2026-001",
    title: "Infrastructure Development Proposal",
    type: "Infrastructure",
    documentType: "Assigned",
    status: "Processing",
    submittedDate: "2026-02-15",
    timestamp: "2026-02-15 09:30:00",
    assignedTo: "sandy@alubijid.gov.ph",
    deadline: "2026-02-28",
    source: "Mayor's Office",
    files: [],
    history: [
      { action: "Received", date: "2026-02-15 09:30:00", by: "Admin" },
      { action: "Assigned", date: "2026-02-15 10:00:00", by: "Admin" },
      { action: "Opened", date: "2026-02-16 08:00:00", by: "Sandy Lumacad" },
    ],
    routingSlip: {
      actions: ["For approval/signature", "For review/comments/recom"],
      remarks:
        "Please review and provide recommendations on the proposed infrastructure layout.",
    },
    createdAt: "2026-02-15 09:30:00",
    updatedAt: "2026-02-16 08:00:00",
  },
  {
    id: "DTN-2026-002",
    title: "Land Use Classification Study",
    type: "Planning",
    documentType: "Processed",
    status: "Approved",
    submittedDate: "2026-02-10",
    timestamp: "2026-02-10 14:15:00",
    assignedTo: "gis@alubijid.gov.ph",
    deadline: "2026-02-25",
    source: "National Agency",
    files: [],
    history: [
      { action: "Received", date: "2026-02-10 14:15:00", by: "Admin" },
      { action: "Assigned", date: "2026-02-10 14:45:00", by: "Admin" },
      { action: "Processed", date: "2026-02-18 11:00:00", by: "GIS Team" },
      { action: "Approved", date: "2026-02-20 16:30:00", by: "Administrator" },
    ],
    routingSlip: {
      actions: ["For approval/signature", "For your file"],
      remarks: "Complete the land use study and submit final report.",
    },
    createdAt: "2026-02-10 14:15:00",
    updatedAt: "2026-02-20 16:30:00",
  },
  {
    id: "DTN-2026-003",
    title: "Community Development Request",
    type: "Development",
    documentType: "Received",
    status: "Pending",
    submittedDate: "2026-02-20",
    timestamp: "2026-02-20 10:45:00",
    assignedTo: "tech@alubijid.gov.ph",
    deadline: "2026-03-05",
    source: "Public Applicant",
    files: [],
    history: [{ action: "Received", date: "2026-02-20 10:45:00", by: "Admin" }],
    routingSlip: {
      actions: ["For review/comments/recom", "Please draft reply"],
      remarks:
        "Review the proposal and prepare a reply for the public applicant.",
    },
    createdAt: "2026-02-20 10:45:00",
    updatedAt: "2026-02-20 10:45:00",
  },
  {
    id: "DTN-2026-004",
    title: "Environmental Impact Assessment",
    type: "Environmental",
    documentType: "Opened",
    status: "Overdue",
    submittedDate: "2026-02-01",
    timestamp: "2026-02-01 11:00:00",
    assignedTo: "sandy@alubijid.gov.ph",
    deadline: "2026-02-18",
    source: "LGU Office",
    destination: "Mayor's Office",
    files: [],
    history: [
      { action: "Received", date: "2026-02-01 11:00:00", by: "Admin" },
      { action: "Assigned", date: "2026-02-01 11:30:00", by: "Admin" },
    ],
    routingSlip: {
      actions: ["For compliance", "For information/reference"],
      remarks:
        "Ensure compliance with environmental regulations and standards.",
    },
    createdAt: "2026-02-01 11:00:00",
    updatedAt: "2026-02-01 11:30:00",
  },
];
