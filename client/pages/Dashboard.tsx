import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import DocumentWizard from "@/components/DocumentWizard";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import {
  getDocuments,
  getEmployees,
  addEmployee,
  updateEmployeeRole,
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
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  X,
} from "lucide-react";

const statusColors = {
  Pending: { bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-700", icon: AlertCircle },
  Processing: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", icon: HourglassIcon },
  Approved: { bg: "bg-green-50", border: "border-green-200", text: "text-green-700", icon: CheckCircle },
  Released: { bg: "bg-green-50", border: "border-green-200", text: "text-green-700", icon: CheckCircle },
  Overdue: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", icon: AlertCircle },
};

const documentTypeFilters: DocumentType[] = ["Received", "Assigned", "Opened", "Processed", "Approved", "Released"];

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "incoming" | "outgoing">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<DocumentType | "all">("all");
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
  const [selectedRoutingActions, setSelectedRoutingActions] = useState<RoutingAction[]>([]);
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
  const [showQrModal, setShowQrModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadModalFileInputRef = useRef<HTMLInputElement>(null);
  const [newEmployeeData, setNewEmployeeData] = useState({
    name: "",
    unit: "MPDC",
  });

  // Load employees and documents from Supabase on mount
  useEffect(() => {
    getEmployees().then(setEmployees).catch(console.error);
    getDocuments()
      .then(setDocuments)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleAddEmployee = async () => {
    if (!newEmployeeData.name.trim()) return;
    const email = `${newEmployeeData.name.toLowerCase().replace(/\s+/g, ".")}@alubijid.gov.ph`;
    try {
      const newEmployee = await addEmployee({
        email,
        name: newEmployeeData.name,
        role: "staff",
        department: newEmployeeData.unit,
      });
      setEmployees([...employees, newEmployee]);
    } catch (err) {
      console.error("Failed to add employee:", err);
    }
    setNewEmployeeData({ name: "", unit: "MPDC" });
    setShowAddEmployeeModal(false);
  };

  const handleLogout = () => {
    logout();
    window.location.href = "/login";
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
    processing: visibleDocuments.filter((d) => d.status === "Processing").length,
    completed: visibleDocuments.filter((d) => d.status === "Approved" || d.status === "Released").length,
    overdue: visibleDocuments.filter((d) => d.status === "Overdue").length,
  };

  const avgResponseTime = "3.2 days";

  // Filter by search (DTN), document type, assignment, and deadline
  const filteredDocuments = visibleDocuments.filter((doc) => {
    const matchesSearch = doc.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDocType = selectedFilter === "all" || doc.documentType === selectedFilter;
    const matchesAssignment = filterAssignedTo === "all" || doc.assignedTo === filterAssignedTo;

    let matchesDeadline = true;
    if (filterDeadline !== "all") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const docDeadline = new Date(doc.deadline);
      docDeadline.setHours(0, 0, 0, 0);
      const daysUntilDeadline = Math.ceil((docDeadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (filterDeadline === "overdue") matchesDeadline = daysUntilDeadline < 0;
      else if (filterDeadline === "today") matchesDeadline = daysUntilDeadline === 0;
      else if (filterDeadline === "this-week") matchesDeadline = daysUntilDeadline >= 0 && daysUntilDeadline <= 7;
      else if (filterDeadline === "upcoming") matchesDeadline = daysUntilDeadline > 7;
    }

    return matchesSearch && matchesDocType && matchesAssignment && matchesDeadline;
  });

  return (
    <div className="min-h-screen bg-gray-50">
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
                <p className="font-semibold text-gray-900">{user?.email?.split("@")[0]}</p>
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
                          <h3 className="font-semibold text-gray-900 text-sm">Employees</h3>
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
                            <div key={employee.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                              <div>
                                <p className="text-sm font-medium text-gray-900">{employee.email}</p>
                                <p className="text-xs text-gray-500">{employee.name}</p>
                              </div>
                              <select
                                value={employee.role}
                                onChange={async (e) => {
                                  const role = e.target.value as "admin" | "staff";
                                  try {
                                    await updateEmployeeRole(employee.id, role);
                                    setEmployees((prev) =>
                                      prev.map((emp) => emp.id === employee.id ? { ...emp, role } : emp)
                                    );
                                  } catch (err) {
                                    console.error("Failed to update role:", err);
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
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.pending}</p>
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
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.processing}</p>
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
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.completed}</p>
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
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.overdue}</p>
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
                  placeholder="Search by DTN..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              {/* Document Type Filter */}
              <select
                value={selectedFilter}
                onChange={(e) => setSelectedFilter(e.target.value as DocumentType | "all")}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
              >
                <option value="all">All Types</option>
                {documentTypeFilters.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>

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

              <button className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                <QrCode className="w-5 h-5 text-gray-600" />
              </button>
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
                const statusColor = statusColors[doc.status as keyof typeof statusColors];
                const StatusIcon = statusColor.icon;
                const assignedEmployee = employees.find((e) => e.email === doc.assignedTo);
                return (
                  <div
                    key={doc.id}
                    className="p-6 hover:bg-gray-50 transition cursor-pointer border-l-4"
                    style={{
                      borderLeftColor:
                        doc.status === "Overdue"
                          ? "#ef4444"
                          : doc.status === "Approved" || doc.status === "Released"
                            ? "#10b981"
                            : "#3b82f6",
                    }}
                    onClick={() => setSelectedDoc(doc)}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                          <h4 className="text-lg font-semibold text-gray-900 truncate">{doc.title}</h4>
                          <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-700 whitespace-nowrap">
                            {doc.id}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-sm text-gray-600">
                          <div>
                            <p className="text-xs text-gray-500">Type</p>
                            <p className="font-medium text-gray-900">{doc.type}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Received</p>
                            <p className="font-medium text-gray-900">{doc.timestamp}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Assigned To</p>
                            <p className="font-medium text-gray-900">{assignedEmployee?.name || doc.assignedTo}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Deadline</p>
                            <p className="font-medium text-gray-900">{doc.deadline}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className={`${statusColor.bg} ${statusColor.border} border rounded-full px-3 py-1 flex items-center gap-2 whitespace-nowrap`}>
                          <StatusIcon className={`w-4 h-4 ${statusColor.text}`} />
                          <span className={`text-sm font-medium ${statusColor.text}`}>{doc.status}</span>
                        </div>
                        {/* Document Actions Menu - admin only */}
                        {user?.role === "admin" && (
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuDocId(openMenuDocId === doc.id ? null : doc.id);
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
                      Mode: <span className="font-semibold capitalize">{docViewMode}</span>
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
                          setDocViewMode(docViewMode === "view" ? "edit" : "view");
                        }}
                        className="p-2 bg-white/20 hover:bg-white/30 text-white rounded transition"
                        title={docViewMode === "view" ? "Edit" : "View"}
                      >
                        <Edit className="w-5 h-5" />
                      </button>
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
                  <p className="text-xs text-gray-500 uppercase font-semibold">Type</p>
                  <p className="text-lg font-medium text-gray-900 mt-1">{selectedDoc.type}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">Source</p>
                  {user?.role === "admin" && docViewMode === "edit" ? (
                    <select
                      className="text-base font-medium text-gray-900 mt-1 px-2 py-1 border border-gray-300 rounded w-full"
                      value={selectedSource || ""}
                      onChange={(e) => setSelectedSource(e.target.value)}
                    >
                      {locations.map((loc) => (
                        <option key={loc} value={loc}>
                          {loc}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-lg font-medium text-gray-900 mt-1">{selectedDoc.source}</p>
                  )}
                </div>
                {/* QR Code — spans 2 rows */}
                <div className="row-span-2 flex flex-col items-center justify-center">
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowQrModal(true); }}
                    className="group p-2 rounded-xl border-2 border-dashed border-gray-300 hover:border-primary hover:bg-primary/5 transition-all"
                    title="View QR Code"
                  >
                    <QRCodeSVG
                      value={`DTN:${selectedDoc.id}|TITLE:${selectedDoc.title}|STATUS:${selectedDoc.status}`}
                      size={200}
                      level="M"
                      className="rounded"
                    />
                  </button>
                  <p className="text-xs text-gray-400 mt-1 font-medium">Tap to expand</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">Assigned To</p>
                  {user?.role === "admin" && docViewMode === "edit" ? (
                    <select className="text-base font-medium text-gray-900 mt-1 px-2 py-1 border border-gray-300 rounded w-full">
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
                      {employees.find((e) => e.email === selectedDoc.assignedTo)?.name}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">Deadline</p>
                  <p className="text-lg font-medium text-gray-900 mt-1">{selectedDoc.deadline}</p>
                </div>
              </div>

              {/* Destination field - only for outgoing documents (LGU Office source) */}
              {(selectedSource === "LGU Office" || selectedDoc.destination) && (
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">Destination</p>
                  {user?.role === "admin" && docViewMode === "edit" ? (
                    <select className="text-base font-medium text-gray-900 mt-1 px-2 py-1 border border-gray-300 rounded w-full">
                      {locations.map((loc) => (
                        <option key={loc} value={loc}>
                          {loc}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-lg font-medium text-gray-900 mt-1">{selectedDoc.destination || "N/A"}</p>
                  )}
                </div>
              )}

              {/* Status Field */}
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold mb-2">Status</p>
                {docViewMode === "edit" ? (
                  <select
                    defaultValue={selectedDoc.status}
                    onChange={(e) => {
                      if (e.target.value === "Approved") {
                        setShowApprovalWorkflow(true);
                      }
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-lg font-medium w-full"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Processing">Processing</option>
                    <option value="Approved">Approved</option>
                    <option value="Released">Released</option>
                    <option value="Overdue">Overdue</option>
                  </select>
                ) : (
                  <p className="text-lg font-medium text-gray-900 mt-1">{selectedDoc.status}</p>
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
                      <div key={file.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{file.name}</p>
                          <p className="text-xs text-gray-500">Uploaded by {file.uploadedBy} on {file.uploadedAt}</p>
                        </div>
                        <a href={file.url} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm" className="flex gap-2">
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
                    <p className="text-sm text-primary font-medium">{selectedFile.name}</p>
                  ) : (
                    <p className="text-sm text-gray-600">
                      Drag and drop or <span className="text-primary font-medium">click to upload</span>
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
                      await uploadFile(selectedDoc.id, selectedFile, user?.name || "User");
                      const updated = await getDocuments();
                      setDocuments(updated);
                      const refreshed = updated.find((d) => d.id === selectedDoc.id);
                      if (refreshed) setSelectedDoc(refreshed);
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    } catch (err: any) {
                      setUploadError(err.message || "Upload failed. Make sure the backend server is running.");
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
                  <h4 className="font-semibold text-gray-900 mb-4">Routing Slip</h4>
                  <div className="bg-blue-50 p-4 rounded-lg space-y-4">
                    {/* Actions */}
                    <div>
                      <p className="text-sm font-semibold text-gray-900 mb-2">Actions Required:</p>
                      <div className="space-y-1">
                        {selectedDoc.routingSlip.actions.map((action, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-sm text-gray-700">
                            <div className="w-2 h-2 bg-primary rounded-full"></div>
                            {action}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Remarks */}
                    {selectedDoc.routingSlip.remarks && (
                      <div>
                        <p className="text-sm font-semibold text-gray-900 mb-2">Remarks:</p>
                        <p className="text-sm text-gray-700 italic">{selectedDoc.routingSlip.remarks}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Document History */}
              <div className="border-t pt-6">
                <h4 className="font-semibold text-gray-900 mb-4">Document Audit Log</h4>
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
                        <p className="font-medium text-gray-900">{entry.action}</p>
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
              <h3 className="text-xl font-bold text-gray-900">{selectedDoc.title}</h3>
              <p className="text-sm text-gray-500 font-mono mt-1">{selectedDoc.id}</p>
            </div>
            <div className="p-4 bg-white rounded-xl border-4 border-primary/20 shadow-inner">
              <QRCodeSVG
                value={`DTN:${selectedDoc.id}|TITLE:${selectedDoc.title}|STATUS:${selectedDoc.status}|SOURCE:${selectedDoc.source}|DEADLINE:${selectedDoc.deadline}`}
                size={260}
                level="H"
                marginSize={2}
              />
            </div>
            <div className="text-center space-y-1">
              <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide">Scan to verify document</p>
              <p className="text-xs text-gray-400">{selectedDoc.status} · {selectedDoc.source}</p>
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
              <h3 className="font-bold text-red-900 text-lg">Delete Document</h3>
              <p className="text-red-700 text-sm mt-2">
                Are you sure you want to delete this document? This action cannot be undone.
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
                  if (deletingDocId) {
                    try {
                      await deleteDocument(deletingDocId);
                      setDocuments((prev) => prev.filter((d) => d.id !== deletingDocId));
                    } catch (err) {
                      console.error("Failed to delete document:", err);
                    }
                  }
                  setShowDeleteConfirm(false);
                  setSelectedDoc(null);
                  setDeletingDocId(null);
                }}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                Delete
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
              <h3 className="font-bold text-blue-900 text-lg">Internal MPDO Approval Workflow</h3>
              <p className="text-blue-700 text-sm mt-2">
                Document: <span className="font-semibold">{selectedDoc.title}</span>
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-2">This document is now pending for approval.</p>
                <p className="text-sm text-gray-600 mb-4">
                  Please add any remarks or comments before approving this document for the next stage.
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
                  <span className="font-semibold">Status:</span> This document will be marked as "Approved" and routed accordingly.
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
                  onClick={() => {
                    if (selectedDoc) {
                      const updatedDoc = {
                        ...selectedDoc,
                        history: [
                          ...selectedDoc.history,
                          {
                            action: "Document Approved",
                            date: new Date().toLocaleString(),
                            by: user?.name || "Admin",
                            details: approvalRemarks || "Approved by admin",
                          },
                        ],
                      };
                      setSelectedDoc(updatedDoc);
                    }
                    setShowApprovalWorkflow(false);
                    setApprovalRemarks("");
                  }}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  Approve
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
              <h3 className="text-2xl font-bold text-blue-900 mb-2">Document Completed</h3>
              <p className="text-blue-700 text-lg font-semibold">
                RETURNED TO {selectedDoc.source.toUpperCase()}
              </p>
            </div>

            <div className="p-6 bg-gray-50">
              <p className="text-gray-700 text-center mb-6">
                This document has been marked as done and returned to its source.
              </p>
              <Button
                onClick={() => {
                  setShowDoneConfirm(false);
                  setSelectedDoc(null);
                  // Document marked as done - history would be saved in backend
                }}
                className="w-full bg-primary hover:bg-primary/90 text-white"
              >
                Confirm
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
                  onChange={(e) => setNewEmployeeData({ ...newEmployeeData, name: e.target.value })}
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
                  onChange={(e) => setNewEmployeeData({ ...newEmployeeData, unit: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                >
                  <option value="MPDC">MPDC</option>
                  <option value="Planning Staff">Planning Staff</option>
                  <option value="GIS Staff">GIS Staff</option>
                  <option value="Technical Staff">Technical Staff</option>
                </select>
              </div>

              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm text-blue-700">
                  <span className="font-semibold">Email:</span> {newEmployeeData.name.toLowerCase().replace(/\s+/g, ".")}@alubijid.gov.ph
                </p>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <Button
                  onClick={() => {
                    setShowAddEmployeeModal(false);
                    setNewEmployeeData({ name: "", unit: "MPDC" });
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
          onClose={() => {
            setShowUploadModal(false);
            setUploadFormData({ title: "", documentType: "", source: "", assignedTo: "", deadline: "" });
            setSelectedRoutingActions([]);
            setRoutingRemarks("");
          }}
          onSubmit={async (wizardData) => {
            // Create new document
            try {
              await createDocument(
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
                  // Set destination only for outgoing documents
                  ...(wizardData.documentDirection === "Outgoing" && { destination: "LGU Office" }),
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
                wizardData.routingActions,
                wizardData.routingRemarks,
                user?.name || "Admin"
              );
              // Refresh documents list
              const updated = await getDocuments();
              setDocuments(updated);
            } catch (err) {
              console.error("Failed to create document:", err);
            }
            setShowUploadModal(false);
            setUploadFormData({ title: "", documentType: "", source: "", assignedTo: "", deadline: "" });
            setSelectedRoutingActions([]);
            setRoutingRemarks("");
          }}
        />
      )}
    </div>
  );
}
