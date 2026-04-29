import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
// import { mockEmployees, locations, routingActionOptions } from "@/lib/data";
import { getEmployees, locations, routingActionOptions } from "@/lib/data";
import { RoutingAction } from "@shared/api";

interface DocumentWizardProps {
  onClose: () => void;
  onSubmit: (formData: {
    title: string;
    documentType: string;
    source: string;
    assignedTo: string;
    deadline: string;
    documentDirection: "Incoming" | "Outgoing";
    routingActions: RoutingAction[];
    routingRemarks: string;
    file: File | null;
  }) => void;
}

export default function DocumentWizard({
  onClose,
  onSubmit,
}: DocumentWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    title: "",
    documentType: "",
    source: "",
    assignedTo: "",
    deadline: "",
    documentDirection: "Incoming" as "Incoming" | "Outgoing",
  });
  const [selectedRoutingActions, setSelectedRoutingActions] = useState<
    RoutingAction[]
  >([]);
  const [routingRemarks, setRoutingRemarks] = useState("");
  const [employees, setEmployees] = useState<
    {
      id: string;
      name: string;
      email: string;
      department: string;
      role: string;
    }[]
  >([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    const loadEmployees = async () => {
      const data = await getEmployees();
      setEmployees(data);
    };
    loadEmployees();
  }, []);

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = () => {
    onSubmit({
      ...formData,
      documentDirection: formData.documentDirection,
      routingActions: selectedRoutingActions,
      routingRemarks,
      file: selectedFile, // ← add this
    });
  };

  const isStep1Valid =
    formData.title &&
    formData.documentType &&
    formData.source &&
    formData.deadline;
  const isStep2Valid = formData.assignedTo;
  const isStep3Valid = isStep1Valid && isStep2Valid;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-primary to-secondary text-white p-6 flex justify-between items-center">
          <div>
            <h3 className="text-2xl font-bold">Add New Document</h3>
            <p className="text-white/80 text-sm mt-1">
              Step {currentStep} of 3
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white text-2xl"
          >
            ✕
          </button>
        </div>

        {/* Progress Bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex gap-2">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex-1 flex items-center gap-2">
                <div
                  className={`flex-1 h-2 rounded-full transition ${
                    step <= currentStep ? "bg-primary" : "bg-gray-300"
                  }`}
                />
                <span className="text-sm font-medium text-gray-700">
                  Step {step}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Step 1: Document Details */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900 mb-4">
                Document Details
              </h4>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Document Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="Enter document title"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Document Type
                </label>
                <select
                  value={formData.documentType}
                  onChange={(e) =>
                    setFormData({ ...formData, documentType: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                >
                  <option value="">Select Type</option>
                  <option value="Infrastructure">Infrastructure</option>
                  <option value="Planning">Planning</option>
                  <option value="Development">Development</option>
                  <option value="Environmental">Environmental</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Source
                </label>
                <select
                  value={formData.source}
                  onChange={(e) =>
                    setFormData({ ...formData, source: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                >
                  <option value="">Select Source</option>
                  {locations.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Document Direction
                </label>
                <select
                  value={formData.documentDirection}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      documentDirection: e.target.value as
                        | "Incoming"
                        | "Outgoing",
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                >
                  <option value="Incoming">Incoming</option>
                  <option value="Outgoing">Outgoing</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Deadline
                </label>
                <input
                  type="date"
                  value={formData.deadline}
                  onChange={(e) =>
                    setFormData({ ...formData, deadline: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* File Upload Drop Zone */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Attach File{" "}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                />

                {/* Drop Zone */}
                <div
                  className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary transition cursor-pointer"
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

                {/* Clear selection */}
                {selectedFile && (
                  <Button
                    onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                    variant="destructive"
                    size="sm"
                    className="mt-2 flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove file
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Assignment & Routing */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900 mb-4">
                Assignment & Routing
              </h4>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Assign To Staff Member
                </label>
                <select
                  value={formData.assignedTo}
                  onChange={(e) =>
                    setFormData({ ...formData, assignedTo: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                >
                  <option value="">Select Staff Member</option>
                  {employees
                    .filter((e) => e.role === "staff")
                    .map((employee) => (
                      <option key={employee.id} value={employee.email}>
                        {employee.name} | {employee.department}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  Routing Slip Actions
                </label>
                <p className="text-sm text-gray-600 mb-3">
                  Select action points for the assigned staff member:
                </p>
                <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50">
                  {routingActionOptions.map((action) => (
                    <label
                      key={action}
                      className="flex items-center gap-3 p-2 hover:bg-white rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedRoutingActions.includes(action)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedRoutingActions([
                              ...selectedRoutingActions,
                              action,
                            ]);
                          } else {
                            setSelectedRoutingActions(
                              selectedRoutingActions.filter(
                                (a) => a !== action,
                              ),
                            );
                          }
                        }}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-700">{action}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Remarks / Instructions
                </label>
                <textarea
                  value={routingRemarks}
                  onChange={(e) => setRoutingRemarks(e.target.value)}
                  placeholder="Add any instructions or remarks for the assigned staff member..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>
            </div>
          )}

          {/* Step 3: Review & Confirm */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900 mb-4">
                Review & Confirm
              </h4>
              <div className="bg-gray-50 rounded-lg p-4 space-y-3 border border-gray-200">
                <div className="border-b pb-3">
                  <p className="text-xs text-gray-500 uppercase font-semibold">
                    Document Title
                  </p>
                  <p className="text-sm font-medium text-gray-900 mt-1">
                    {formData.title || "—"}
                  </p>
                </div>
                <div className="border-b pb-3">
                  <p className="text-xs text-gray-500 uppercase font-semibold">
                    Type
                  </p>
                  <p className="text-sm font-medium text-gray-900 mt-1">
                    {formData.documentType || "—"}
                  </p>
                </div>
                <div className="border-b pb-3">
                  <p className="text-xs text-gray-500 uppercase font-semibold">
                    Source
                  </p>
                  <p className="text-sm font-medium text-gray-900 mt-1">
                    {formData.source || "—"}
                  </p>
                </div>
                <div className="border-b pb-3">
                  <p className="text-xs text-gray-500 uppercase font-semibold">
                    Direction
                  </p>
                  <p className="text-sm font-medium text-gray-900 mt-1">
                    {formData.documentDirection || "—"}
                  </p>
                </div>
                <div className="border-b pb-3">
                  <p className="text-xs text-gray-500 uppercase font-semibold">
                    Deadline
                  </p>
                  <p className="text-sm font-medium text-gray-900 mt-1">
                    {formData.deadline || "—"}
                  </p>
                </div>
                <div className="border-b pb-3">
                  <p className="text-xs text-gray-500 uppercase font-semibold">
                    Assigned To
                  </p>
                  <p className="text-sm font-medium text-gray-900 mt-1">
                    {employees.find((e) => e.email === formData.assignedTo)
                      ?.name || "—"}
                  </p>
                </div>
                {selectedRoutingActions.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold">
                      Routing Actions
                    </p>
                    <div className="mt-2 space-y-1">
                      {selectedRoutingActions.map((action) => (
                        <p
                          key={action}
                          className="text-sm text-gray-700 flex items-center gap-2"
                        >
                          <span className="w-2 h-2 bg-primary rounded-full"></span>
                          {action}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="border-t border-gray-200 p-6 flex gap-3">
          {currentStep > 1 && (
            <Button
              onClick={handleBack}
              variant="outline"
              className="flex gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </Button>
          )}
          <div className="flex-1" />
          <Button onClick={onClose} variant="outline">
            Cancel
          </Button>
          {currentStep < 3 ? (
            <Button
              onClick={handleNext}
              disabled={currentStep === 1 ? !isStep1Valid : !isStep2Valid}
              className={`bg-primary hover:bg-primary/90 text-white flex gap-2 ${
                (currentStep === 1 ? !isStep1Valid : !isStep2Valid)
                  ? "opacity-50 cursor-not-allowed"
                  : ""
              }`}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={!isStep3Valid}
              className={`bg-primary hover:bg-primary/90 text-white flex gap-2 ${!isStep3Valid ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <Upload className="w-4 h-4" />
              Create Document
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
