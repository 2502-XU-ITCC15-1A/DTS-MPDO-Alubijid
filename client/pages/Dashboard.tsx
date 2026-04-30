import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { Html5Qrcode } from "html5-qrcode";
import { useAuth } from "@/context/AuthContext";
import DocumentWizard from "@/components/DocumentWizard";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getDocuments,
  getEmployees,
  addEmployee,
  updateEmployeeRole,
  updateDocument,
  createDocument,
  deleteDocument,
  addAuditLog,
  uploadFile,
  locations,
  routingActionOptions,
} from "@/lib/data";
import { Document, DocumentType, RoutingAction, Employee } from "@shared/api";
import {
  FileText,
  LogOut,
  Upload,
  Search,
  CheckCircle,
  AlertCircle,
  HourglassIcon,
  Download,
  Eye,
  QrCode,
  ScanLine,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  X,
  Camera,
} from "lucide-react";

const statusColors = {
  Pending: {
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    text: "text-yellow-700",
    icon: AlertCircle,
  },
  Processing: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-700",
    icon: HourglassIcon,
  },
  Approved: {
    bg: "bg-green-50",
    border: "border-green-200",
    text: "text-green-700",
    icon: CheckCircle,
  },
  Released: {
    bg: "bg-green-50",
    border: "border-green-200",
    text: "text-green-700",
    icon: CheckCircle,
  },
  Overdue: {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-700",
    icon: AlertCircle,
  },
};

const statusOptions = [
  {
    value: "Pending",
    label: "Pending",
    icon: AlertCircle,
    text: "text-yellow-700",
  },
  {
    value: "Processing",
    label: "Processing",
    icon: HourglassIcon,
    text: "text-blue-700",
  },
  {
    value: "Approved",
    label: "Completed",
    icon: CheckCircle,
    text: "text-green-700",
  },
  {
    value: "Overdue",
    label: "Overdue",
    icon: AlertCircle,
    text: "text-red-700",
  },
] as const;

const getStatusDetails = (status: string) => {
  if (status === "Approved" || status === "Released") {
    return statusOptions[2];
  }
  return (
    statusOptions.find((option) => option.value === status) ?? statusOptions[0]
  );
};

const getStatusValue = (status: Document["status"]) =>
  status === "Released" ? "Approved" : status;

const documentTypeFilters: DocumentType[] = [
  "Received",
  "Assigned",
  "Opened",
  "Processed",
  "Approved",
  "Released",
];

const designationOptionsByUnit: Record<string, string[]> = {
  MPDC: ["Municipal Planning and Development Coordinator"],
  ARIS: [
    "Administrative Head / Overall Supervisor",
    "Records / Monitoring Staff",
  ],
  PRDD: ["Statistician"],
  ZLURD: [
    "Division Head / Project Evaluator",
    "Draftsman / Senior Technical Staff",
    "GIS Specialist",
    "Drone Pilot / Inspector",
  ],
};

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "incoming" | "outgoing">(
    "all",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<DocumentType | "all">(
    "all",
  );
  const [showEmployeeMenu, setShowEmployeeMenu] = useState(false);
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [showDoneConfirm, setShowDoneConfirm] = useState(false);
  const [uploadFormData, setUploadFormData] = useState({
    title: "",
    documentType: "",
    source: "",
    assignedTo: "",
    deadline: "",
  });
  const [selectedRoutingActions, setSelectedRoutingActions] = useState<
    RoutingAction[]
  >([]);
  const [routingRemarks, setRoutingRemarks] = useState("");
  const [docViewMode, setDocViewMode] = useState<"view" | "edit">("view");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [showApprovalWorkflow, setShowApprovalWorkflow] = useState(false);
  const [approvalRemarks, setApprovalRemarks] = useState("");
  const [filterAssignedTo, setFilterAssignedTo] = useState<string>("all");
  const [filterDeadline, setFilterDeadline] = useState<string>("all");
  const [openMenuDocId, setOpenMenuDocId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadModalFile, setUploadModalFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isMarkingDone, setIsMarkingDone] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadModalFileInputRef = useRef<HTMLInputElement>(null);
  const [editForm, setEditForm] = useState<{
    documentType: string;
    source: string;
    assignedTo: string;
    status: Document["status"] | "";
    deadline: string;
    destination: string;
  }>({
    documentType: "",
    source: "",
    assignedTo: "",
    status: "",
    deadline: "",
    destination: "",
  });
  const [newEmployeeData, setNewEmployeeData] = useState({
    name: "",
    unit: "MPDC",
    designation: designationOptionsByUnit.MPDC[0],
  });
  const [customDocumentTypes, setCustomDocumentTypes] = useState<string[]>(() =>
    JSON.parse(localStorage.getItem("customDocumentTypes") || "[]"),
  );
  const [customSources, setCustomSources] = useState<string[]>(() =>
    JSON.parse(localStorage.getItem("customSources") || "[]"),
  );
  const [newDocumentTypeName, setNewDocumentTypeName] = useState("");
  const [newSourceName, setNewSourceName] = useState("");

  // Load employees and documents from Supabase on mount
  useEffect(() => {
    getEmployees().then(setEmployees).catch(console.error);
    getDocuments()
      .then(setDocuments)
      .catch(console.error)
      .finally(() => setLoading(false));

    // Load custom document types and sources from localStorage
    const savedCustomTypes = localStorage.getItem("customDocumentTypes");
    const savedCustomSources = localStorage.getItem("customSources");
    if (savedCustomTypes) {
      setCustomDocumentTypes(JSON.parse(savedCustomTypes));
    }
    if (savedCustomSources) {
      setCustomSources(JSON.parse(savedCustomSources));
    }
  }, []);

  // Sync editForm whenever a different document is selected
  useEffect(() => {
    if (selectedDoc) {
      setEditForm({
        source: selectedDoc.source || "",
        assignedTo: selectedDoc.assignedTo || "",
        status: selectedDoc.status || "",
        deadline: selectedDoc.deadline || "",
        destination: selectedDoc.destination || "",
        documentType: selectedDoc.type || "",
      });
    }
  }, [selectedDoc?.id]);

  // Auto-open document from ?doc= URL param (set when QR code is scanned)
  useEffect(() => {
    const docId = searchParams.get("doc");
    if (!docId || documents.length === 0) return;
    const found = documents.find((d) => d.id === docId);
    if (found) {
      setSelectedDoc(found);
      setDocViewMode("view");
      setSearchParams({}, { replace: true });
    }
  }, [documents, searchParams]);

  // Start camera scanner
  const startScanner = async () => {
    setScannerError(null);
    setScanResult(null);
    setShowScannerModal(true);
    await new Promise((r) => setTimeout(r, 100)); // wait for modal to mount

    try {
      const scanner = new Html5Qrcode("qr-scanner-container");
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          handleQrResult(decodedText);
        },
        () => {},
      );
    } catch (err: any) {
      setScannerError(
        err?.message || "Cannot access camera. Please allow camera permission.",
      );
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {}
      scannerRef.current = null;
    }
    setShowScannerModal(false);
    setScanResult(null);
    setScannerError(null);
  };

  // Handle scanned QR value — supports both URL and legacy DTN: format
  const handleQrResult = async (text: string) => {
    await stopScanner();

    // New URL format: https://.../?doc=DTN-XXXX
    try {
      const url = new URL(text);
      const docId = url.searchParams.get("doc");
      if (docId) {
        const found = documents.find((d) => d.id === docId);
        if (found) {
          setSelectedDoc(found);
          setDocViewMode("view");
        } else {
          setScanResult(`Document ${docId} not found in the system.`);
          setShowScannerModal(true);
        }
        return;
      }
    } catch {}

    // Legacy format: DTN:DTN-2026-001|TITLE:...|STATUS:...
    const dtnMatch = text.match(/DTN:([^|]+)/);
    if (dtnMatch) {
      const docId = dtnMatch[1];
      const found = documents.find((d) => d.id === docId);
      if (found) {
        setSelectedDoc(found);
        setDocViewMode("view");
      } else {
        setScanResult(`Document ${docId} not found in the system.`);
        setShowScannerModal(true);
      }
      return;
    }

    setScanResult(`Unknown QR code: ${text}`);
    setShowScannerModal(true);
  };

  const handleAddEmployee = async () => {
    if (!newEmployeeData.name.trim()) return;
    const email = `${newEmployeeData.name.toLowerCase().replace(/\s+/g, ".")}@alubijid.gov.ph`;
    try {
      const newEmployee = await addEmployee({
        email,
        name: newEmployeeData.name,
        role: "staff",
        department: newEmployeeData.designation,
      });
      setEmployees([...employees, newEmployee]);
    } catch (err) {
      console.error("Failed to add employee:", err);
    }
    setNewEmployeeData({
      name: "",
      unit: "MPDC",
      designation: designationOptionsByUnit.MPDC[0],
    });
    setShowAddEmployeeModal(false);
  };

  const handleLogout = () => {
    logout();
    window.location.href = "/login";
  };

  const handleSaveEdits = async () => {
    if (!selectedDoc || isSaving) return;
    setIsSaving(true);

    const newStatus =
      (editForm.status as Document["status"]) || selectedDoc.status;
    const actor = user?.name || "Admin";

    try {
      await updateDocument(selectedDoc.id, {
        status: newStatus,
        assignedTo: editForm.assignedTo,
        source: editForm.source,
        destination: editForm.destination,
        deadline: editForm.deadline,
      });

      // Log every field that actually changed
      if (newStatus !== selectedDoc.status) {
        await addAuditLog(
          selectedDoc.id,
          "Status Updated",
          actor,
          `"${selectedDoc.status}" → "${newStatus}"`,
        );
      }
      if (editForm.assignedTo !== selectedDoc.assignedTo) {
        const oldName =
          employees.find((e) => e.email === selectedDoc.assignedTo)?.name ||
          selectedDoc.assignedTo;
        const newName =
          employees.find((e) => e.email === editForm.assignedTo)?.name ||
          editForm.assignedTo;
        await addAuditLog(
          selectedDoc.id,
          `Reassigned from ${oldName} to ${newName}`,
          actor,
        );
      }
      if (editForm.source !== selectedDoc.source) {
        await addAuditLog(
          selectedDoc.id,
          "Source Updated",
          actor,
          `"${selectedDoc.source}" → "${editForm.source}"`,
        );
      }
      if (editForm.deadline !== selectedDoc.deadline) {
        await addAuditLog(
          selectedDoc.id,
          "Deadline Updated",
          actor,
          `"${selectedDoc.deadline}" → "${editForm.deadline}"`,
        );
      }
      if ((editForm.destination || "") !== (selectedDoc.destination || "")) {
        await addAuditLog(
          selectedDoc.id,
          "Destination Updated",
          actor,
          `"${selectedDoc.destination || "None"}" → "${editForm.destination || "None"}"`,
        );
      }

      // Refresh from DB so the audit log section shows the new entries immediately
      const updated = await getDocuments();
      setDocuments(updated);
      const refreshed = updated.find((d) => d.id === selectedDoc.id);
      if (refreshed) setSelectedDoc(refreshed);
      setDocViewMode("view");
      toast.success("Document updated successfully.");
    } catch (err: any) {
      console.error("Failed to save edits:", err);
      toast.error(err.message || "Failed to save changes.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDocStatusChange = async (
    docId: string,
    value: Document["status"],
  ) => {
    try {
      const doc = documents.find((d) => d.id === docId);
      const oldStatus = doc?.status || "";
      await updateDocument(docId, { status: value });
      await addAuditLog(
        docId,
        "Status Updated",
        user?.name || "Admin",
        `"${oldStatus}" → "${value}"`,
      );
      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === docId
            ? { ...doc, status: value, updatedAt: new Date().toISOString() }
            : doc,
        ),
      );
      if (selectedDoc?.id === docId) {
        setSelectedDoc({ ...selectedDoc, status: value });
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const handleAddCustomDocumentType = () => {
    if (
      newDocumentTypeName.trim() &&
      !customDocumentTypes.includes(newDocumentTypeName.trim())
    ) {
      const updated = [...customDocumentTypes, newDocumentTypeName.trim()];
      setCustomDocumentTypes(updated);
      localStorage.setItem("customDocumentTypes", JSON.stringify(updated));
      setEditForm({ ...editForm, documentType: newDocumentTypeName.trim() });
      setNewDocumentTypeName("");
    }
  };

  const handleAddCustomSource = () => {
    if (newSourceName.trim() && !customSources.includes(newSourceName.trim())) {
      const updated = [...customSources, newSourceName.trim()];
      setCustomSources(updated);
      localStorage.setItem("customSources", JSON.stringify(updated));
      setEditForm({ ...editForm, source: newSourceName.trim() });
      setNewSourceName("");
    }
  };

  // Filter documents based on tab and role
  const getVisibleDocuments = () => {
    let docs = [...documents];

    // Filter by staff role - only show assigned documents
    if (user?.role === "staff") {
      docs = docs.filter((d) => d.assignedTo === user.email);
    }

    // Filter by tab
    if (activeTab === "incoming") {
      docs = docs.filter((d) => !d.destination);
    } else if (activeTab === "outgoing") {
      docs = docs.filter((d) => d.destination);
    }

    return docs;
  };

  const visibleDocuments = getVisibleDocuments();

  // Calculate statistics from visible documents
  const stats = {
    pending: visibleDocuments.filter((d) => d.status === "Pending").length,
    processing: visibleDocuments.filter((d) => d.status === "Processing")
      .length,
    completed: visibleDocuments.filter(
      (d) => d.status === "Approved" || d.status === "Released",
    ).length,
    overdue: visibleDocuments.filter((d) => d.status === "Overdue").length,
  };

  const avgResponseTime = "3.2 days";

  // Filter by search (DTN or document name), document type, assignment, and deadline
  const filteredDocuments = visibleDocuments.filter((doc) => {
    const matchesSearch =
      doc.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDocType =
      selectedFilter === "all" || doc.documentType === selectedFilter;
    const matchesAssignment =
      filterAssignedTo === "all" || doc.assignedTo === filterAssignedTo;

    let matchesDeadline = true;
    if (filterDeadline !== "all") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const docDeadline = new Date(doc.deadline);
      docDeadline.setHours(0, 0, 0, 0);
      const daysUntilDeadline = Math.ceil(
        (docDeadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (filterDeadline === "overdue") matchesDeadline = daysUntilDeadline < 0;
      else if (filterDeadline === "today")
        matchesDeadline = daysUntilDeadline === 0;
      else if (filterDeadline === "this-week")
        matchesDeadline = daysUntilDeadline >= 0 && daysUntilDeadline <= 7;
      else if (filterDeadline === "upcoming")
        matchesDeadline = daysUntilDeadline > 7;
    }

    return (
      matchesSearch && matchesDocType && matchesAssignment && matchesDeadline
    );
  });

  const isProcessing =
    isSaving ||
    isSubmitting ||
    isApproving ||
    isMarkingDone ||
    isDeleting ||
    isUploading;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Global loading bar */}
      {isProcessing && (
        <div className="fixed top-0 left-0 right-0 z-[100] h-1 bg-primary/20">
          <div className="h-full bg-primary animate-[loading-bar_1.2s_ease-in-out_infinite]" />
        </div>
      )}
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-primary">MPDO Tracker</h1>
            </div>
            <div className="flex items-center gap-6">
              {/* Account Name - showing email prefix and role */}
              <div className="text-right">
                <p className="font-semibold text-gray-900">
                  {user?.email?.split("@")[0]}
                </p>
                <p className="text-sm text-gray-500 capitalize">{user?.role}</p>
              </div>

              {/* Admin-only employee menu */}
              {user?.role === "admin" && (
                <div className="relative">
                  <button
                    onClick={() => setShowEmployeeMenu(!showEmployeeMenu)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition"
                    title="Employee Management"
                  >
                    <MoreVertical className="w-5 h-5 text-gray-600" />
                  </button>

                  {showEmployeeMenu && (
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                      <div className="p-4">
                        <div className="flex justify-between items-center mb-3">
                          <h3 className="font-semibold text-gray-900 text-sm">
                            Employees
                          </h3>
                          <button
                            onClick={() => {
                              setShowAddEmployeeModal(true);
                              setShowEmployeeMenu(false);
                            }}
                            className="p-1 hover:bg-gray-100 rounded text-primary"
                            title="Add Employee"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {employees.map((employee) => (
                            <div
                              key={employee.id}
                              className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
                            >
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {employee.email}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {employee.name}
                                </p>
                              </div>
                              <select
                                value={employee.role}
                                onChange={async (e) => {
                                  const role = e.target.value as
                                    | "admin"
                                    | "staff";
                                  try {
                                    await updateEmployeeRole(employee.id, role);
                                    setEmployees((prev) =>
                                      prev.map((emp) =>
                                        emp.id === employee.id
                                          ? { ...emp, role }
                                          : emp,
                                      ),
                                    );
                                  } catch (err) {
                                    console.error(
                                      "Failed to update role:",
                                      err,
                                    );
                                  }
                                }}
                                className="text-xs px-2 py-1 border border-gray-300 rounded bg-white hover:bg-gray-50"
                              >
                                <option value="staff">Staff</option>
                                <option value="admin">Admin</option>
                              </select>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* QR Scanner Button */}
              <button
                onClick={startScanner}
                className="p-2 hover:bg-primary/10 rounded-lg transition"
                title="Scan QR Code"
              >
                <ScanLine className="w-5 h-5 text-primary" />
              </button>

              <button
                onClick={handleLogout}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
                title="Logout"
              >
                <LogOut className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Pending</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {stats.pending}
                </p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Processing</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {stats.processing}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <HourglassIcon className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Completed</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {stats.completed}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Overdue</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {stats.overdue}
                </p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Efficiency Metrics
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Efficiency Monitoring</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-gray-600 text-sm">Average Response Time</p>
              <p className="text-2xl font-bold text-primary mt-2">{avgResponseTime}</p>
            </div>
            <div>
              <p className="text-gray-600 text-sm">Processing Rate</p>
              <p className="text-2xl font-bold text-secondary mt-2">92.5%</p>
            </div>
            <div>
              <p className="text-gray-600 text-sm">On-time Completion</p>
              <p className="text-2xl font-bold text-green-600 mt-2">87.3%</p>
            </div>
          </div>
        </div> */}

        {/* Document Management */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          {/* Tabs and Controls */}
          <div className="border-b border-gray-200 p-6">
            <div className="flex justify-between items-center mb-6">
              <div className="flex gap-4">
                <button
                  onClick={() => setActiveTab("all")}
                  className={`pb-2 font-medium border-b-2 transition ${
                    activeTab === "all"
                      ? "border-primary text-primary"
                      : "border-transparent text-gray-600 hover:text-gray-900"
                  }`}
                >
                  All Documents
                </button>
                <button
                  onClick={() => setActiveTab("incoming")}
                  className={`pb-2 font-medium border-b-2 transition ${
                    activeTab === "incoming"
                      ? "border-primary text-primary"
                      : "border-transparent text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Incoming Documents
                </button>
                <button
                  onClick={() => setActiveTab("outgoing")}
                  className={`pb-2 font-medium border-b-2 transition ${
                    activeTab === "outgoing"
                      ? "border-primary text-primary"
                      : "border-transparent text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Outgoing Documents
                </button>
              </div>
              {/* Upload button - admin only */}
              {user?.role === "admin" && (
                <Button
                  onClick={() => setShowUploadModal(true)}
                  className="bg-primary hover:bg-primary/90 text-white flex gap-2"
                  title="Upload Document"
                >
                  <Upload className="w-4 h-4" />
                  <span className="hidden sm:inline">Upload Document</span>
                </Button>
              )}
            </div>

            {/* Search and Filter */}
            <div className="flex gap-2 flex-wrap">
              <div className="flex-1 min-w-[250px] relative">
                <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by DTN or document name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              {/* Document Type Filter */}
              {/* Assignment Filter - admin only */}
              {user?.role === "admin" && (
                <select
                  value={filterAssignedTo}
                  onChange={(e) => setFilterAssignedTo(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                >
                  <option value="all">All Assigned</option>
                  {employees
                    .filter((e) => e.role === "staff")
                    .map((employee) => (
                      <option key={employee.id} value={employee.email}>
                        {employee.name}
                      </option>
                    ))}
                </select>
              )}

              {/* Deadline Filter - admin only */}
              {user?.role === "admin" && (
                <select
                  value={filterDeadline}
                  onChange={(e) => setFilterDeadline(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                >
                  <option value="all">All Deadlines</option>
                  <option value="overdue">Overdue</option>
                  <option value="today">Due Today</option>
                  <option value="this-week">Due This Week</option>
                  <option value="upcoming">Upcoming</option>
                </select>
              )}
            </div>
          </div>

          {/* Document List */}
          <div className="divide-y divide-gray-200">
            {loading ? (
              <div className="p-12 text-center">
                <p className="text-gray-500">Loading documents...</p>
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">No documents found</p>
              </div>
            ) : (
              filteredDocuments.map((doc) => {
                const statusColor =
                  statusColors[doc.status as keyof typeof statusColors];
                const StatusIcon = statusColor.icon;
                const assignedEmployee = employees.find(
                  (e) => e.email === doc.assignedTo,
                );
                return (
                  <div
                    key={doc.id}
                    className="p-6 hover:bg-gray-50 transition cursor-pointer border-l-4"
                    style={{
                      borderLeftColor:
                        doc.status === "Overdue"
                          ? "#ef4444"
                          : doc.status === "Approved" ||
                              doc.status === "Released"
                            ? "#10b981"
                            : "#3b82f6",
                    }}
                    onClick={() => {
                      setSelectedDoc(doc);
                      setEditForm({
                        documentType: doc.type || "",
                        source: doc.source || "",
                        assignedTo: doc.assignedTo || "",
                        status: doc.status || "",
                        deadline: doc.deadline || "",
                        destination: doc.destination || "",
                      });
                    }}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                          <h4 className="text-lg font-semibold text-gray-900 truncate">
                            {doc.title}
                          </h4>
                          <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-700 whitespace-nowrap">
                            {doc.id}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-sm text-gray-600">
                          <div>
                            <p className="text-xs text-gray-500">Type</p>
                            <p className="font-medium text-gray-900">
                              {doc.type}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Received</p>
                            <p className="font-medium text-gray-900">
                              {doc.timestamp}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Assigned To</p>
                            <p className="font-medium text-gray-900">
                              {assignedEmployee?.name || doc.assignedTo}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Deadline</p>
                            <p className="font-medium text-gray-900">
                              {doc.deadline}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Select
                          value={getStatusValue(doc.status)}
                          onValueChange={(value) =>
                            handleDocStatusChange(
                              doc.id,
                              value as Document["status"],
                            )
                          }
                        >
                          <SelectTrigger
                            onClick={(e) => e.stopPropagation()}
                            className={`rounded-full border ${statusColor.border} bg-white text-left px-3 py-1.5 h-9 inline-flex items-center gap-2 w-fit min-w-[10rem]`}
                          >
                            <StatusIcon
                              className={`w-4 h-4 ${statusColor.text}`}
                            />
                            <span
                              className={`text-sm font-medium ${statusColor.text}`}
                            >
                              {getStatusDetails(doc.status).label}
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            {statusOptions.map((option) => {
                              const OptionIcon = option.icon;
                              return (
                                <SelectItem
                                  key={option.value}
                                  value={option.value}
                                >
                                  <div className="flex items-center gap-2">
                                    <OptionIcon
                                      className={`w-4 h-4 ${option.text}`}
                                    />
                                    <span>{option.label}</span>
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        {/* Document Actions Menu - admin only */}
                        {user?.role === "admin" && (
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuDocId(
                                  openMenuDocId === doc.id ? null : doc.id,
                                );
                              }}
                              className="p-2 hover:bg-gray-200 rounded-lg transition"
                              title="More options"
                            >
                              <MoreVertical className="w-5 h-5 text-gray-600" />
                            </button>

                            {openMenuDocId === doc.id && (
                              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-40">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedDoc(doc);
                                    setDocViewMode("view");
                                    setOpenMenuDocId(null);
                                  }}
                                  className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700 text-sm font-medium flex items-center gap-2"
                                >
                                  <Eye className="w-4 h-4" />
                                  View
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedDoc(doc);
                                    setDocViewMode("edit");
                                    setOpenMenuDocId(null);
                                  }}
                                  className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700 text-sm font-medium flex items-center gap-2"
                                >
                                  <Edit className="w-4 h-4" />
                                  Edit
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeletingDocId(doc.id);
                                    setShowDeleteConfirm(true);
                                    setOpenMenuDocId(null);
                                  }}
                                  className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 text-sm font-medium flex items-center gap-2"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>

      {/* Document Detail Modal */}
      {selectedDoc && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedDoc(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => {
              e.stopPropagation();
              // Initialize source when modal opens
              if (!selectedSource) {
                setSelectedSource(selectedDoc.source);
              }
            }}
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-primary to-secondary text-white p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-2xl font-bold">{selectedDoc.title}</h3>
                  <p className="text-white/80 text-sm mt-1">{selectedDoc.id}</p>
                  {user?.role === "admin" && (
                    <p className="text-white/70 text-xs mt-2">
                      Mode:{" "}
                      <span className="font-semibold capitalize">
                        {docViewMode}
                      </span>
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* Action buttons - admin only, visible in both modes */}
                  {user?.role === "admin" && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDocViewMode(
                            docViewMode === "view" ? "edit" : "view",
                          );
                        }}
                        className="p-2 bg-white/20 hover:bg-white/30 text-white rounded transition"
                        title={docViewMode === "view" ? "Edit" : "View"}
                      >
                        <Edit className="w-5 h-5" />
                      </button>

                      {/* SAVE BUTTON */}
                      {docViewMode === "edit" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSaveEdits();
                          }}
                          disabled={isSaving}
                          className="p-2 bg-green-500/20 hover:bg-green-500/30 text-green-100 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
                          title={isSaving ? "Saving..." : "Save"}
                        >
                          {isSaving ? (
                            <svg
                              className="w-5 h-5 animate-spin"
                              viewBox="0 0 24 24"
                              fill="none"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8v8z"
                              />
                            </svg>
                          ) : (
                            <CheckCircle className="w-5 h-5" />
                          )}
                        </button>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingDocId(selectedDoc.id);
                          setShowDeleteConfirm(true);
                        }}
                        className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-100 rounded transition"
                        title="Delete"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => {
                      setSelectedDoc(null);
                      setSelectedSource(null);
                      setDocViewMode("view");
                    }}
                    className="p-2 text-white/80 hover:text-white transition"
                    title="Close"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Key Information Grid */}
              <div className="grid grid-cols-3 gap-4 items-start">
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">
                    Type
                  </p>
                  {user?.role === "admin" && docViewMode === "edit" ? (
                    <div className="mt-1">
                      <select
                        className="text-base font-medium text-gray-900 px-2 py-1 border border-gray-300 rounded w-full"
                        value={editForm.documentType || ""}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            documentType: e.target.value,
                          })
                        }
                      >
                        <option value="">Select Type</option>
                        <option value="Infrastructure">Infrastructure</option>
                        <option value="Planning">Planning</option>
                        <option value="Development">Development</option>
                        <option value="Environmental">Environmental</option>
                        {customDocumentTypes.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                        <option value="Others">Others</option>
                      </select>
                      {editForm.documentType === "Others" && (
                        <div className="mt-2 flex gap-2">
                          <input
                            type="text"
                            value={newDocumentTypeName}
                            onChange={(e) =>
                              setNewDocumentTypeName(e.target.value)
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleAddCustomDocumentType();
                              }
                            }}
                            placeholder="Enter new document type"
                            className="flex-1 px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                          <button
                            onClick={handleAddCustomDocumentType}
                            className="p-1 bg-primary hover:bg-primary/90 text-white rounded transition"
                            title="Confirm"
                          >
                            ✓
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-lg font-medium text-gray-900 mt-1">
                      {selectedDoc.type}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">
                    Source
                  </p>
                  {user?.role === "admin" && docViewMode === "edit" ? (
                    <div className="mt-1">
                      <select
                        className="text-base font-medium text-gray-900 px-2 py-1 border border-gray-300 rounded w-full"
                        value={editForm.source || ""}
                        onChange={(e) =>
                          setEditForm({ ...editForm, source: e.target.value })
                        }
                      >
                        {locations.map((loc) => (
                          <option key={loc} value={loc}>
                            {loc}
                          </option>
                        ))}
                        {customSources.map((src) => (
                          <option key={src} value={src}>
                            {src}
                          </option>
                        ))}
                        <option value="Others">Others</option>
                      </select>
                      {editForm.source === "Others" && (
                        <div className="mt-2 flex gap-2">
                          <input
                            type="text"
                            value={newSourceName}
                            onChange={(e) => setNewSourceName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleAddCustomSource();
                              }
                            }}
                            placeholder="Enter new source"
                            className="flex-1 px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                          <button
                            onClick={handleAddCustomSource}
                            className="p-1 bg-primary hover:bg-primary/90 text-white rounded transition"
                            title="Confirm"
                          >
                            ✓
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-lg font-medium text-gray-900 mt-1">
                      {selectedDoc.source}
                    </p>
                  )}
                </div>
                {/* QR Code — spans 2 rows */}
                <div className="row-span-2 flex flex-col items-center justify-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowQrModal(true);
                    }}
                    className="group p-2 rounded-xl border-2 border-dashed border-gray-300 hover:border-primary hover:bg-primary/5 transition-all"
                    title="View QR Code"
                  >
                    <QRCodeSVG
                      value={`${window.location.origin}/dashboard?doc=${selectedDoc.id}`}
                      size={200}
                      level="M"
                      className="rounded"
                    />
                  </button>
                  <p className="text-xs text-gray-400 mt-1 font-medium">
                    Tap to expand
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">
                    Assigned To
                  </p>
                  {user?.role === "admin" && docViewMode === "edit" ? (
                    <select
                      className="text-base font-medium text-gray-900 mt-1 px-2 py-1 border border-gray-300 rounded w-full"
                      value={editForm.assignedTo || ""}
                      onChange={(e) =>
                        setEditForm({ ...editForm, assignedTo: e.target.value })
                      }
                    >
                      {employees
                        .filter((e) => e.role === "staff")
                        .map((employee) => (
                          <option key={employee.id} value={employee.email}>
                            {employee.name} | {employee.department}
                          </option>
                        ))}
                    </select>
                  ) : (
                    <p className="text-lg font-medium text-gray-900 mt-1">
                      {
                        employees.find(
                          (e) => e.email === selectedDoc.assignedTo,
                        )?.name
                      }
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">
                    Deadline
                  </p>
                  {user?.role === "admin" && docViewMode === "edit" ? (
                    <input
                      type="date"
                      className="text-base font-medium text-gray-900 mt-1 px-2 py-1 border border-gray-300 rounded w-full"
                      value={editForm.deadline || ""}
                      onChange={(e) =>
                        setEditForm({ ...editForm, deadline: e.target.value })
                      }
                    />
                  ) : (
                    <p className="text-lg font-medium text-gray-900 mt-1">
                      {selectedDoc.deadline}
                    </p>
                  )}
                </div>
              </div>

              {/* Destination field - only for outgoing documents (LGU Office source) */}
              {(editForm.source === "LGU Office" ||
                selectedDoc.destination) && (
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">
                    Destination
                  </p>
                  {user?.role === "admin" && docViewMode === "edit" ? (
                    <select
                      className="text-base font-medium text-gray-900 mt-1 px-2 py-1 border border-gray-300 rounded w-full"
                      value={editForm.destination || ""}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          destination: e.target.value,
                        })
                      }
                    >
                      {locations.map((loc) => (
                        <option key={loc} value={loc}>
                          {loc}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-lg font-medium text-gray-900 mt-1">
                      {selectedDoc.destination || "N/A"}
                    </p>
                  )}
                </div>
              )}

              {/* Status Field */}
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold mb-2">
                  Status
                </p>
                {docViewMode === "edit" ? (
                  <Select
                    value={editForm.status || ""}
                    onValueChange={(value) => {
                      setEditForm({
                        ...editForm,
                        status: value as Document["status"],
                      });
                      if (value === "Approved") {
                        setShowApprovalWorkflow(true);
                      }
                    }}
                  >
                    <SelectTrigger>
                      {editForm.status ? (
                        <div className="flex items-center gap-2">
                          {(() => {
                            const selectedStatus = getStatusDetails(
                              editForm.status,
                            );
                            const SelectedIcon = selectedStatus.icon;
                            return (
                              <>
                                <SelectedIcon
                                  className={`w-4 h-4 ${selectedStatus.text}`}
                                />
                                <span
                                  className={`text-sm font-medium ${selectedStatus.text}`}
                                >
                                  {selectedStatus.label}
                                </span>
                              </>
                            );
                          })()}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">
                          Select status
                        </span>
                      )}
                      <SelectValue
                        className="hidden"
                        placeholder="Select status"
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((option) => {
                        const OptionIcon = option.icon;
                        return (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex items-center gap-2">
                              <OptionIcon
                                className={`w-4 h-4 ${option.text}`}
                              />
                              <span>{option.label}</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg w-full">
                    {(() => {
                      const details = getStatusDetails(selectedDoc.status);
                      const StatusIcon = details.icon;
                      return (
                        <>
                          <StatusIcon className={`w-4 h-4 ${details.text}`} />
                          <span
                            className={`text-lg font-medium ${details.text}`}
                          >
                            {details.label}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* File Upload Section */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Documents</h4>
                <div className="space-y-3">
                  {selectedDoc.files.length === 0 ? (
                    <p className="text-sm text-gray-500">No files attached</p>
                  ) : (
                    selectedDoc.files.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {file.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            Uploaded by {file.uploadedBy} on {file.uploadedAt}
                          </p>
                        </div>
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex gap-2"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        </a>
                      </div>
                    ))
                  )}
                </div>

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                />

                {/* File Drop Zone */}
                <div
                  className="mt-4 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary transition cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  {selectedFile ? (
                    <p className="text-sm text-primary font-medium">
                      {selectedFile.name}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-600">
                      Drag and drop or{" "}
                      <span className="text-primary font-medium">
                        click to upload
                      </span>
                    </p>
                  )}
                </div>

                <Button
                  disabled={!selectedFile || isUploading}
                  onClick={async () => {
                    if (!selectedFile) return;
                    setIsUploading(true);
                    setUploadError(null);
                    try {
                      await uploadFile(
                        selectedDoc.id,
                        selectedFile,
                        user?.name || "User",
                      );
                      const updated = await getDocuments();
                      setDocuments(updated);
                      const refreshed = updated.find(
                        (d) => d.id === selectedDoc.id,
                      );
                      if (refreshed) setSelectedDoc(refreshed);
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    } catch (err: any) {
                      setUploadError(
                        err.message ||
                          "Upload failed. Make sure the backend server is running.",
                      );
                    } finally {
                      setIsUploading(false);
                    }
                  }}
                  className="w-full mt-3 bg-primary hover:bg-primary/90 text-white disabled:opacity-50"
                >
                  {isUploading ? "Uploading..." : "Upload File"}
                </Button>
                {uploadError && (
                  <p className="text-sm text-red-500 mt-2">{uploadError}</p>
                )}
              </div>

              {/* Routing Slip Section */}
              {selectedDoc.routingSlip && (
                <div className="border-t pt-6">
                  <h4 className="font-semibold text-gray-900 mb-4">
                    Routing Slip
                  </h4>
                  <div className="bg-blue-50 p-4 rounded-lg space-y-4">
                    {/* Actions */}
                    <div>
                      <p className="text-sm font-semibold text-gray-900 mb-2">
                        Actions Required:
                      </p>
                      <div className="space-y-1">
                        {selectedDoc.routingSlip.actions.map((action, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 text-sm text-gray-700"
                          >
                            <div className="w-2 h-2 bg-primary rounded-full"></div>
                            {action}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Remarks */}
                    {selectedDoc.routingSlip.remarks && (
                      <div>
                        <p className="text-sm font-semibold text-gray-900 mb-2">
                          Remarks:
                        </p>
                        <p className="text-sm text-gray-700 italic">
                          {selectedDoc.routingSlip.remarks}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Document History */}
              <div className="border-t pt-6">
                <h4 className="font-semibold text-gray-900 mb-4">
                  Document Audit Log
                </h4>
                <div className="space-y-4">
                  {selectedDoc.history.map((entry, idx) => (
                    <div key={idx} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-3 h-3 bg-primary rounded-full"></div>
                        {idx < selectedDoc.history.length - 1 && (
                          <div className="w-0.5 h-8 bg-gray-300 mt-2"></div>
                        )}
                      </div>
                      <div className="pb-4">
                        <p className="font-medium text-gray-900">
                          {entry.action}
                        </p>
                        <p className="text-sm text-gray-500">
                          {entry.date} • By {entry.by}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Staff-only Done Button */}
              {user?.role === "staff" && (
                <div className="border-t pt-6">
                  <Button
                    onClick={() => setShowDoneConfirm(true)}
                    className="w-full bg-gray-400 hover:bg-gray-500 text-white font-semibold py-2"
                  >
                    Mark as Done
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Camera QR Scanner Modal */}
      {showScannerModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[70]">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="bg-gradient-to-r from-primary to-secondary text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5" />
                <h3 className="text-lg font-bold">Scan QR Code</h3>
              </div>
              <button
                onClick={stopScanner}
                className="p-1 text-white/80 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scanner viewport */}
            {!scanResult && !scannerError && (
              <div className="relative bg-black">
                <div
                  id="qr-scanner-container"
                  className="w-full"
                  style={{ minHeight: 300 }}
                />
                {/* Corner guides */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-48 relative">
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
                  </div>
                </div>
              </div>
            )}

            {/* Error state */}
            {scannerError && (
              <div className="p-6 text-center space-y-4">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                  <Camera className="w-8 h-8 text-red-500" />
                </div>
                <p className="text-red-600 text-sm font-medium">
                  {scannerError}
                </p>
                <p className="text-gray-500 text-xs">
                  Make sure you allowed camera access in your browser settings.
                </p>
              </div>
            )}

            {/* Unknown QR result */}
            {scanResult && (
              <div className="p-6 text-center space-y-4">
                <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto">
                  <QrCode className="w-8 h-8 text-yellow-600" />
                </div>
                <p className="text-gray-800 text-sm font-medium">
                  {scanResult}
                </p>
              </div>
            )}

            {/* Instructions / footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
              {!scanResult && !scannerError ? (
                <p className="text-xs text-gray-500 text-center">
                  Point the camera at an MPDO document QR code to open it
                  instantly.
                </p>
              ) : (
                <button
                  onClick={stopScanner}
                  className="w-full py-2 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* QR Code Expanded Modal */}
      {showQrModal && selectedDoc && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[60]"
          onClick={() => setShowQrModal(false)}
        >
          <div
            className="bg-white rounded-2xl p-8 flex flex-col items-center gap-6 shadow-2xl max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <h3 className="text-xl font-bold text-gray-900">
                {selectedDoc.title}
              </h3>
              <p className="text-sm text-gray-500 font-mono mt-1">
                {selectedDoc.id}
              </p>
            </div>
            <div className="p-4 bg-white rounded-xl border-4 border-primary/20 shadow-inner">
              <QRCodeSVG
                value={`${window.location.origin}/dashboard?doc=${selectedDoc.id}`}
                size={260}
                level="H"
                marginSize={2}
              />
            </div>
            <div className="text-center space-y-1">
              <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide">
                Scan to verify document
              </p>
              <p className="text-xs text-gray-400">
                {selectedDoc.status} · {selectedDoc.source}
              </p>
            </div>
            <button
              onClick={() => setShowQrModal(false)}
              className="w-full py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="bg-red-100 border-l-4 border-red-500 p-6">
              <h3 className="font-bold text-red-900 text-lg">
                Delete Document
              </h3>
              <p className="text-red-700 text-sm mt-2">
                Are you sure you want to delete this document? This action
                cannot be undone.
              </p>
            </div>

            <div className="p-6 flex gap-3">
              <Button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletingDocId(null);
                }}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  if (!deletingDocId || isDeleting) return;
                  setIsDeleting(true);
                  try {
                    await deleteDocument(deletingDocId);
                    setDocuments((prev) =>
                      prev.filter((d) => d.id !== deletingDocId),
                    );
                    toast.success("Document and all files deleted.");
                    setShowDeleteConfirm(false);
                    setSelectedDoc(null);
                    setDeletingDocId(null);
                  } catch (err: any) {
                    console.error("Failed to delete document:", err);
                    toast.error(err.message || "Failed to delete document.");
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                disabled={isDeleting}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Internal MPDO Approval Workflow Modal */}
      {showApprovalWorkflow && selectedDoc && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full">
            <div className="bg-blue-100 border-l-4 border-blue-500 p-6">
              <h3 className="font-bold text-blue-900 text-lg">
                Internal MPDO Approval Workflow
              </h3>
              <p className="text-blue-700 text-sm mt-2">
                Document:{" "}
                <span className="font-semibold">{selectedDoc.title}</span>
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-2">
                  This document is now pending for approval.
                </p>
                <p className="text-sm text-gray-600 mb-4">
                  Please add any remarks or comments before approving this
                  document for the next stage.
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Approval Remarks
                </label>
                <textarea
                  value={approvalRemarks}
                  onChange={(e) => setApprovalRemarks(e.target.value)}
                  placeholder="Add any remarks, conditions, or notes for approval..."
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">Status:</span> This document
                  will be marked as "Approved" and routed accordingly.
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => {
                    setShowApprovalWorkflow(false);
                    setApprovalRemarks("");
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    if (!selectedDoc || isApproving) return;
                    setIsApproving(true);
                    try {
                      await updateDocument(selectedDoc.id, {
                        status: "Approved",
                      });
                      await addAuditLog(
                        selectedDoc.id,
                        "Document Approved",
                        user?.name || "Admin",
                        approvalRemarks || "Approved by admin",
                      );
                      const updated = await getDocuments();
                      setDocuments(updated);
                      const refreshed = updated.find(
                        (d) => d.id === selectedDoc.id,
                      );
                      if (refreshed) setSelectedDoc(refreshed);
                      toast.success("Document approved successfully.");
                    } catch (err) {
                      console.error("Failed to approve document:", err);
                      toast.error("Failed to approve document.");
                    } finally {
                      setIsApproving(false);
                      setShowApprovalWorkflow(false);
                      setApprovalRemarks("");
                    }
                  }}
                  disabled={isApproving}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isApproving ? "Approving..." : "Approve"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Done Confirmation Modal - for Staff */}
      {showDoneConfirm && selectedDoc && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="bg-blue-50 p-6 text-center">
              <h3 className="text-2xl font-bold text-blue-900 mb-2">
                Document Completed
              </h3>
              <p className="text-blue-700 text-lg font-semibold">
                RETURNED TO {selectedDoc.source.toUpperCase()}
              </p>
            </div>

            <div className="p-6 bg-gray-50">
              <p className="text-gray-700 text-center mb-6">
                This document has been marked as done and returned to its
                source.
              </p>
              <Button
                onClick={async () => {
                  if (!selectedDoc || isMarkingDone) return;
                  setIsMarkingDone(true);
                  try {
                    await updateDocument(selectedDoc.id, {
                      status: "Approved",
                    });
                    await addAuditLog(
                      selectedDoc.id,
                      "Marked as Done",
                      user?.name || "Staff",
                      `Returned to ${selectedDoc.source}`,
                    );
                    const updated = await getDocuments();
                    setDocuments(updated);
                    toast.success("Document marked as done.");
                  } catch (err) {
                    console.error("Failed to mark as done:", err);
                    toast.error("Failed to mark as done.");
                  } finally {
                    setIsMarkingDone(false);
                    setShowDoneConfirm(false);
                    setSelectedDoc(null);
                  }
                }}
                disabled={isMarkingDone}
                className="w-full bg-primary hover:bg-primary/90 text-white disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isMarkingDone ? "Processing..." : "Confirm"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Employee Modal */}
      {showAddEmployeeModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setShowAddEmployeeModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-primary to-secondary text-white p-6 flex justify-between items-center">
              <h3 className="text-2xl font-bold">Add New Employee</h3>
              <button
                onClick={() => setShowAddEmployeeModal(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={newEmployeeData.name}
                  onChange={(e) =>
                    setNewEmployeeData({
                      ...newEmployeeData,
                      name: e.target.value,
                    })
                  }
                  placeholder="Enter full name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  MPDO Unit
                </label>
                <select
                  value={newEmployeeData.unit}
                  onChange={(e) =>
                    setNewEmployeeData({
                      ...newEmployeeData,
                      unit: e.target.value,
                      designation:
                        designationOptionsByUnit[e.target.value]?.[0] || "",
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                >
                  <option value="MPDC">
                    Municipal Planning and Development Coordinator
                  </option>
                  <option value="ARIS">
                    Administrative, Records, and IEC Section
                  </option>
                  <option value="PRDD">
                    Plans, Research, and Development, Division
                  </option>
                  <option value="ZLURD">
                    Zoning & Land Use Regulation Division
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Designation
                </label>
                <select
                  value={newEmployeeData.designation}
                  onChange={(e) =>
                    setNewEmployeeData({
                      ...newEmployeeData,
                      designation: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                >
                  {designationOptionsByUnit[newEmployeeData.unit]?.map(
                    (designation) => (
                      <option key={designation} value={designation}>
                        {designation}
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm text-blue-700">
                  <span className="font-semibold">Email:</span>{" "}
                  {newEmployeeData.name.toLowerCase().replace(/\s+/g, ".")}
                  @alubijid.gov.ph
                </p>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <Button
                  onClick={() => {
                    setShowAddEmployeeModal(false);
                    setNewEmployeeData({
                      name: "",
                      unit: "MPDC",
                      designation: designationOptionsByUnit.MPDC[0],
                    });
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddEmployee}
                  className="flex-1 bg-primary hover:bg-primary/90 text-white flex gap-2 justify-center"
                >
                  <Plus className="w-4 h-4" />
                  Add Employee
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document Wizard Modal */}
      {showUploadModal && (
        <DocumentWizard
          isSubmitting={isSubmitting}
          onClose={() => {
            setShowUploadModal(false);
            setUploadFormData({
              title: "",
              documentType: "",
              source: "",
              assignedTo: "",
              deadline: "",
            });
            setSelectedRoutingActions([]);
            setRoutingRemarks("");
          }}
          onSubmit={async (wizardData) => {
            if (isSubmitting) return;
            setIsSubmitting(true);
            try {
              // Get the name of the assigned staff member
              const assignedStaff = employees.find(
                (e) => e.email === wizardData.assignedTo,
              );
              const assignedToName =
                assignedStaff?.name || wizardData.assignedTo;

              const dtn = await createDocument(
                {
                  id: "",
                  title: wizardData.title,
                  type: wizardData.documentType,
                  documentType: "Assigned",
                  status: "Pending",
                  submittedDate: new Date().toISOString().split("T")[0],
                  timestamp: new Date().toLocaleString(),
                  assignedTo: wizardData.assignedTo,
                  deadline: wizardData.deadline,
                  source: wizardData.source,
                  ...(wizardData.documentDirection === "Outgoing" && {
                    destination: "LGU Office",
                  }),
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
                wizardData.routingActions,
                wizardData.routingRemarks,
                user?.name || "Admin",
                assignedToName,
              );

              // Upload attached file to Google Drive under the new document
              if (wizardData.file) {
                try {
                  await uploadFile(dtn, wizardData.file, user?.name || "Admin");
                } catch (uploadErr) {
                  console.error("File upload failed:", uploadErr);
                }
              }

              const updated = await getDocuments();
              setDocuments(updated);
            } catch (err) {
              console.error("Failed to create document:", err);
              toast.error("Failed to create document.");
            } finally {
              setIsSubmitting(false);
            }
            setShowUploadModal(false);
            setUploadFormData({
              title: "",
              documentType: "",
              source: "",
              assignedTo: "",
              deadline: "",
            });
            setSelectedRoutingActions([]);
            setRoutingRemarks("");
          }}
        />
      )}
    </div>
  );
}
