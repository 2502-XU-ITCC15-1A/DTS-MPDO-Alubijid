import { Employee, Document, RoutingAction, RoutingSlip } from "@shared/api";

// Mock employee database
export const mockEmployees: Employee[] = [
  {
    id: "1",
    email: "demo@alubijid.gov.ph",
    name: "demo",
    role: "admin",
    department: "Planning",
  },
  {
    id: "2",
    email: "staff@alubijid.gov.ph",
    name: "staff",
    role: "staff",
    department: "Planning",
  },
  {
    id: "3",
    email: "sandy@alubijid.gov.ph",
    name: "Sandy Lumacad",
    role: "staff",
    department: "Planning Staff",
  },
  {
    id: "4",
    email: "gis@alubijid.gov.ph",
    name: "GIS Team",
    role: "staff",
    department: "GIS Staff",
  },
  {
    id: "5",
    email: "tech@alubijid.gov.ph",
    name: "Technical Team",
    role: "staff",
    department: "Technical Staff",
  },
];

// Mock document database
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
      remarks: "Please review and provide recommendations on the proposed infrastructure layout.",
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
      remarks: "Review the proposal and prepare a reply for the public applicant.",
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
      remarks: "Ensure compliance with environmental regulations and standards.",
    },
    createdAt: "2026-02-01 11:00:00",
    updatedAt: "2026-02-01 11:30:00",
  },
];

// Location data for SOURCE and DESTINATION dropdowns
export const locations = [
  "Mayor's Office",
  "National Agency",
  "Public Applicant",
  "LGU Office",
  "Planning Department",
  "Engineering Department",
  "Finance Department",
];

// Routing slip action options
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

export function getEmployeeById(email: string): Employee | undefined {
  return mockEmployees.find((e) => e.email === email);
}

export function getEmployeeNameWithDepartment(email: string): string {
  const employee = getEmployeeById(email);
  return employee ? `${employee.name} | ${employee.department}` : email;
}

export function getDocumentById(id: string): Document | undefined {
  return mockDocuments.find((d) => d.id === id);
}
