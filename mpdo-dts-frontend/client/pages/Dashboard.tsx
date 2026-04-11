import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import DocumentWizard from "@/components/DocumentWizard";
import { mockDocuments, mockEmployees, locations, routingActionOptions } from "@/lib/data";
import { Document, DocumentType, RoutingAction } from "@shared/api";
import {
  FileText,
  LogOut,
  Upload,
  Search,
  Clock,
  CheckCircle,
  AlertCircle,
  HourglassIcon,
  Download,
  Eye,
  Archive,
  QrCode,
  Plus,
  Filter,
  MoreVertical,
  ChevronDown,
  Pencil,
  Trash2,
  Square,
} from "lucide-react";

const statusColors = {
  Pending: { bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-700", icon: AlertCircle },
  Processing: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", icon: HourglassIcon },
  Approved: { bg: "bg-green-50", border: "border-green-200", text: "text-green-700", icon: CheckCircle },
  Released: { bg: "bg-green-50", border: "border-green-200", text: "text-green-700", icon: CheckCircle },
  Overdue: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", icon: AlertCircle },
};

const statusOptions = ["Pending", "Processing", "Approved", "Released", "Overdue"] as const;

const documentTypeFilters: DocumentType[] = ["Received", "Assigned", "Opened", "Processed", "Approved", "Released"];

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<"all" | "incoming" | "outgoing">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<DocumentType | "all">("all");
  const [showEmployeeMenu, setShowEmployeeMenu] = useState(false);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [fileUpdateRequests, setFileUpdateRequests] = useState<
    { docId: string; staffEmail: string; fileName: string }[]
  >([]);
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
  const [employeeRoles, setEmployeeRoles] = useState<Record<string, "admin" | "staff">>(
    mockEmployees.reduce((acc, emp) => ({ ...acc, [emp.email]: emp.role }), {})
  );

  const handleLogout = () => {
    logout();
    window.location.href = "/login";
  };

  // Filter documents based on tab and role
  const getVisibleDocuments = () => {
    let docs = [...mockDocuments];

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
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                      <div className="p-4">
                        <h3 className="font-semibold text-gray-900 mb-3 text-sm">Employees</h3>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {mockEmployees.map((employee) => (
                            <div key={employee.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                              <div>
                                <p className="text-sm font-medium text-gray-900">{employee.email}</p>
                                <p className="text-xs text-gray-500">{employee.name}</p>
                              </div>
                              <select
                                value={employeeRoles[employee.email] || employee.role}
                                onChange={(e) => {
                                  const newRole = e.target.value as "admin" | "staff";
                                  setEmployeeRoles({
                                    ...employeeRoles,
                                    [employee.email]: newRole,
                                  });
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
                >
                  <Upload className="w-4 h-4" />
                  Upload Document
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

              {/* Document Type Filter - admin only */}
              {user?.role === "admin" && (
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
              )}

              {/* Assignment Filter - admin only */}
              {user?.role === "admin" && (
                <select
                  value={filterAssignedTo}
                  onChange={(e) => setFilterAssignedTo(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                >
                  <option value="all">All Assigned</option>
                  {mockEmployees
                    .filter((e) => e.role === "staff")
                    .map((employee) => (
                      <option key={employee.id} value={employee.email}>
                        {employee.name}
                      </option>
                    ))}
                </select>
              )}

              {/* Deadline Filter - visible to all roles */}
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

              <button className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                <QrCode className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Document List */}
          <div className="divide-y divide-gray-200">
            {filteredDocuments.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">No documents found</p>
              </div>
            ) : (
              filteredDocuments.map((doc) => {
                const statusColor = statusColors[doc.status as keyof typeof statusColors];
                const StatusIcon = statusColor.icon;
                const assignedEmployee = mockEmployees.find((e) => e.email === doc.assignedTo);
                const isDone = doc.status === "Released" && doc.history.some((h) => h.action === "Document Completed");
                return (
                  <div
                    key={doc.id}
                    className={`p-6 transition cursor-pointer border-l-4 ${
                      isDone ? "bg-gray-100 opacity-60 hover:opacity-75" : "hover:bg-gray-50"
                    }`}
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
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="text-lg font-semibold text-gray-900">{doc.title}</h4>
                          <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-700">
                            {doc.id}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-3 text-sm text-gray-600">
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

                      <div className="flex items-center gap-3">
                        {/* QR Code Placeholder */}
                        <div className="flex flex-col items-center gap-1" title="Document lookup via QR code">
                          <div className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center hover:border-primary transition cursor-default">
                            <QrCode className="w-8 h-8 text-gray-400" />
                          </div>
                          <span className="text-xs text-gray-500 font-medium">QR</span>
                        </div>

                        {/* Status Dropdown - Inline */}
                        <div className="relative">
                          <select
                            value={doc.status}
                            onChange={(e) => {
                              const newStatus = e.target.value as any;
                              const oldStatus = doc.status;

                              if (newStatus !== oldStatus) {
                                // Record status change in audit log with automatic timestamp
                                doc.history.push({
                                  action: `Status changed to ${newStatus}`,
                                  date: new Date().toLocaleString(),
                                  by: user?.name || (user?.role === "admin" ? "Admin" : "Staff"),
                                  details: `Status changed from ${oldStatus} to ${newStatus}`,
                                });

                                // Update document status
                                doc.status = newStatus;
                                // Force re-render
                                setSelectedDoc(null);
                                setSelectedDoc(doc);
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className={`${statusColors[doc.status as keyof typeof statusColors]?.bg} ${statusColors[doc.status as keyof typeof statusColors]?.border} border rounded-full px-3 py-1 font-medium text-sm cursor-pointer appearance-none pr-8 transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary`}
                            style={{
                              color: statusColors[doc.status as keyof typeof statusColors]?.text?.replace("text-", "") ? `var(--color-${statusColors[doc.status as keyof typeof statusColors]?.text?.replace("text-", "")})` : "inherit",
                            }}
                          >
                            {statusOptions.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className={`${statusColors[doc.status as keyof typeof statusColors]?.text} w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none`} />
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
                                  title="Edit document"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeletingDocId(doc.id);
                                    setShowDeleteConfirm(true);
                                    setOpenMenuDocId(null);
                                  }}
                                  className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 text-sm font-medium flex items-center gap-2"
                                  title="Delete document"
                                >
                                  <Trash2 className="w-4 h-4" />
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
                        title={docViewMode === "view" ? "Edit document" : "View document"}
                      >
                        <Pencil className="w-5 h-5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingDocId(selectedDoc.id);
                          setShowDeleteConfirm(true);
                        }}
                        className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-100 rounded transition"
                        title="Delete document"
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
                    className="text-white/80 hover:text-white text-2xl ml-2"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Key Information Grid */}
              <div className="grid grid-cols-2 gap-4">
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
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">Assigned To</p>
                  {user?.role === "admin" && docViewMode === "edit" ? (
                    <select className="text-base font-medium text-gray-900 mt-1 px-2 py-1 border border-gray-300 rounded w-full">
                      {mockEmployees
                        .filter((e) => e.role === "staff")
                        .map((employee) => (
                          <option key={employee.id} value={employee.email}>
                            {employee.name} | {employee.department}
                          </option>
                        ))}
                    </select>
                  ) : (
                    <p className="text-lg font-medium text-gray-900 mt-1">
                      {mockEmployees.find((e) => e.email === selectedDoc.assignedTo)?.name}
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
                      const newStatus = e.target.value as any;
                      const oldStatus = selectedDoc.status;

                      if (newStatus !== oldStatus) {
                        // Record status change in audit log with automatic timestamp
                        selectedDoc.history.push({
                          action: `Status changed to ${newStatus}`,
                          date: new Date().toLocaleString(),
                          by: user?.name || "Admin",
                          details: `Status changed from ${oldStatus} to ${newStatus}`,
                        });

                        // Update document status
                        selectedDoc.status = newStatus;
                        setSelectedDoc({ ...selectedDoc });
                      }

                      if (newStatus === "Approved") {
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
                        <Button variant="outline" size="sm" className="flex gap-2">
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>

                {/* File Upload Button */}
                <div className="mt-4 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary transition cursor-pointer">
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">
                    Drag and drop or <span className="text-primary font-medium">click to upload</span>
                  </p>
                </div>

                {user?.role === "staff" ? (
                  <Button
                    onClick={() => {
                      // Staff member requests approval for file update
                      setFileUpdateRequests([
                        ...fileUpdateRequests,
                        {
                          docId: selectedDoc.id,
                          staffEmail: user.email || "",
                          fileName: "document-update.pdf",
                        },
                      ]);
                      // Add to audit log
                      selectedDoc.history.push({
                        action: "File Upload Requested",
                        date: new Date().toLocaleString(),
                        by: user.name || "",
                        details: "Pending admin approval",
                      });
                      setSelectedDoc({ ...selectedDoc });
                    }}
                    className="w-full mt-3 bg-yellow-500 hover:bg-yellow-600 text-white"
                  >
                    Request File Update (Pending Approval)
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      // Admin adds file directly
                      selectedDoc.files.push({
                        id: Date.now().toString(),
                        name: "document-update.pdf",
                        uploadedAt: new Date().toLocaleString(),
                        uploadedBy: user?.name || "Admin",
                        url: "#",
                      });
                      // Add to audit log
                      selectedDoc.history.push({
                        action: "File Updated",
                        date: new Date().toLocaleString(),
                        by: user?.name || "Admin",
                        details: "File for approval",
                      });
                      setSelectedDoc({ ...selectedDoc });
                    }}
                    className="w-full mt-3 bg-primary hover:bg-primary/90 text-white"
                  >
                    Update Document
                  </Button>
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
                onClick={() => {
                  // Delete document from mock data
                  const index = mockDocuments.findIndex((d) => d.id === deletingDocId);
                  if (index > -1) {
                    mockDocuments.splice(index, 1);
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
                    // Add approval record to audit log
                    selectedDoc.history.push({
                      action: "Document Approved",
                      date: new Date().toLocaleString(),
                      by: user?.name || "Admin",
                      details: approvalRemarks || "Approved by admin",
                    });
                    setSelectedDoc({ ...selectedDoc });
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

      {/* File Update Approval Modal - for Admin */}
      {user?.role === "admin" && fileUpdateRequests.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="bg-yellow-100 border-l-4 border-yellow-500 p-6">
              <div className="flex items-center gap-3">
                <div className="text-yellow-600 text-3xl">!</div>
                <div>
                  <h3 className="font-bold text-yellow-900">File Update Request</h3>
                  <p className="text-sm text-yellow-800">
                    {fileUpdateRequests[0].staffEmail} has requested to update a document file.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <p className="text-gray-700 mb-6">
                <strong>File:</strong> {fileUpdateRequests[0].fileName}
                <br />
                <strong>Approve this update?</strong>
              </p>

              <div className="flex gap-3">
                <Button
                  onClick={() => {
                    // Reject
                    setFileUpdateRequests(fileUpdateRequests.slice(1));
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  No
                </Button>
                <Button
                  onClick={() => {
                    // Approve
                    if (selectedDoc) {
                      selectedDoc.files.push({
                        id: Date.now().toString(),
                        name: fileUpdateRequests[0].fileName,
                        uploadedAt: new Date().toLocaleString(),
                        uploadedBy: fileUpdateRequests[0].staffEmail,
                        url: "#",
                      });
                      selectedDoc.history.push({
                        action: "File Approved",
                        date: new Date().toLocaleString(),
                        by: user?.name || "Admin",
                        details: "File update approved",
                      });
                      setSelectedDoc({ ...selectedDoc });
                    }
                    setFileUpdateRequests(fileUpdateRequests.slice(1));
                  }}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  Yes
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
                  // Mark as done and record in audit log
                  if (selectedDoc) {
                    // Update document status
                    selectedDoc.status = "Released";
                    // Add comprehensive audit log entry with automatic timestamp
                    selectedDoc.history.push({
                      action: "Document Completed",
                      date: new Date().toLocaleString(),
                      by: user?.name || "Staff",
                      details: `Returned to ${selectedDoc.source}`,
                    });
                    // Force re-render
                    setSelectedDoc({ ...selectedDoc });
                  }
                  setShowDoneConfirm(false);
                }}
                className="w-full bg-primary hover:bg-primary/90 text-white"
              >
                Confirm
              </Button>
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
          onSubmit={(wizardData) => {
            // Create new document
            const newDoc: Document = {
              id: `DTN-${new Date().getFullYear()}-${String(mockDocuments.length + 1).padStart(3, "0")}`,
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
              files: [],
              history: [
                {
                  action: "Document Created",
                  date: new Date().toLocaleString(),
                  by: user?.name || "Admin",
                  details: `Document added to system (${wizardData.documentDirection})`,
                },
              ],
              routingSlip: {
                actions: wizardData.routingActions,
                remarks: wizardData.routingRemarks,
              },
              createdAt: new Date().toLocaleString(),
              updatedAt: new Date().toLocaleString(),
            };

            mockDocuments.push(newDoc);
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
