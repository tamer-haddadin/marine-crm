import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Edit2,
  Trash2,
  Download,
  Eye,
  FileText,
  Shield,
  Search,
  CalendarIcon,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { LiabilityQuotation, QUOTATION_STATUSES } from "@shared/schema";
import LiabilityQuotationForm from "./liability-quotation-form";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";

export default function LiabilityQuotationList() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedQuotations, setSelectedQuotations] = useState<number[]>([]);
  const [editingQuotation, setEditingQuotation] =
    useState<LiabilityQuotation | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();

  const { data: quotations, isLoading } = useQuery({
    queryKey: ["/api/liability/quotations"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/liability/quotations");
      return res.json() as Promise<LiabilityQuotation[]>;
    },
  });

  const deleteQuotationMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/liability/quotations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/liability/quotations"],
      });
      toast({
        title: "Success",
        description: "Quotation deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDeleteSelected = async () => {
    try {
      await Promise.all(
        selectedQuotations.map((id) =>
          apiRequest("DELETE", `/api/liability/quotations/${id}`)
        )
      );
      queryClient.invalidateQueries({
        queryKey: ["/api/liability/quotations"],
      });
      setSelectedQuotations([]);
      toast({
        title: "Success",
        description: `Successfully deleted ${selectedQuotations.length} quotation(s)`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete quotations",
        variant: "destructive",
      });
    }
    setShowDeleteDialog(false);
  };

  const downloadCSV = async (status?: string) => {
    const filteredData =
      quotations?.filter((q) =>
        status === "selected"
          ? selectedQuotations.includes(q.id)
          : status
          ? q.status === status
          : true
      ) || [];

    const csv = [
      [
        "Broker Name",
        "Insured Name",
        "Product Type",
        "Estimated Premium",
        "Currency",
        "Date",
        "Status",
        "Decline Reason",
        "Notes",
      ],
      ...filteredData.map((q) => [
        q.brokerName,
        q.insuredName,
        q.productType,
        q.estimatedPremium,
        q.currency,
        new Date(q.quotationDate).toLocaleDateString("en-GB"),
        q.status,
        q.declineReason || "",
        q.notes || "",
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `liability_quotations_${status || "all"}_${
      new Date().toISOString().split("T")[0]
    }.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredQuotations = quotations?.filter((quotation) => {
    const matchesSearch =
      !searchTerm ||
      quotation.brokerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quotation.insuredName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quotation.productType.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      selectedStatuses.length === 0 ||
      selectedStatuses.includes(quotation.status);

    // Date range filter
    const quotationDate = new Date(quotation.quotationDate);
    const matchesDateRange =
      (!startDate || quotationDate >= startDate) &&
      (!endDate || quotationDate <= endDate);

    return matchesSearch && matchesStatus && matchesDateRange;
  });

  if (isLoading) {
    return <div className="flex justify-center py-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div className="flex flex-col gap-4 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-auto flex-1 md:flex-none">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <Input
                placeholder="Search quotations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full md:w-[300px] bg-white border-gray-200 rounded-lg shadow-sm focus-visible:ring-indigo-500"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto border-gray-200 shadow-sm hover:shadow bg-white text-gray-700"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate
                      ? format(startDate, "MMM d, yyyy")
                      : "Start Date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto border-gray-200 shadow-sm hover:shadow bg-white text-gray-700"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "MMM d, yyyy") : "End Date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {(startDate || endDate) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStartDate(undefined);
                    setEndDate(undefined);
                  }}
                  className="text-indigo-600 hover:text-indigo-700"
                >
                  Clear dates
                </Button>
              )}
            </div>
          </div>

          {/* Status Filter */}
          <div className="flex flex-wrap gap-2 p-4 bg-white rounded-lg border">
            <div className="text-sm font-medium text-gray-700 w-full mb-2 flex items-center gap-2">
              <Shield className="h-4 w-4 text-indigo-600" />
              Filter by Status:
            </div>
            {QUOTATION_STATUSES.map((status) => (
              <div key={status} className="flex items-center space-x-2">
                <Checkbox
                  id={`liability-${status}`}
                  checked={selectedStatuses.includes(status)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedStatuses([...selectedStatuses, status]);
                    } else {
                      setSelectedStatuses(
                        selectedStatuses.filter((s) => s !== status)
                      );
                    }
                  }}
                  className="data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                />
                <label
                  htmlFor={`liability-${status}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  {status}
                </label>
              </div>
            ))}
            {selectedStatuses.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedStatuses([])}
                className="ml-auto text-indigo-600 hover:text-indigo-700"
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          {selectedQuotations.length > 0 && (
            <>
              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Delete ({selectedQuotations.length})
              </Button>
              <Button
                variant="secondary"
                onClick={() => downloadCSV("selected")}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Export Selected
              </Button>
            </>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="bg-indigo-600 hover:bg-indigo-700 gap-2">
                <Download className="h-4 w-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Export Options</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => downloadCSV()}>
                Export All
              </DropdownMenuItem>
              {QUOTATION_STATUSES.map((status) => (
                <DropdownMenuItem
                  key={status}
                  onClick={() => downloadCSV(status)}
                >
                  Export {status}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={
                    filteredQuotations &&
                    filteredQuotations.length > 0 &&
                    filteredQuotations.every((q) =>
                      selectedQuotations.includes(q.id)
                    )
                  }
                  onCheckedChange={(checked) => {
                    if (checked && filteredQuotations) {
                      setSelectedQuotations(
                        filteredQuotations.map((q) => q.id)
                      );
                    } else {
                      setSelectedQuotations([]);
                    }
                  }}
                />
              </TableHead>
              <TableHead>Broker</TableHead>
              <TableHead>Insured</TableHead>
              <TableHead>Product Type</TableHead>
              <TableHead>Est. Premium</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Decline Reason</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredQuotations && filteredQuotations.length > 0 ? (
              filteredQuotations.map((quotation) => (
                <TableRow key={quotation.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedQuotations.includes(quotation.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedQuotations([
                            ...selectedQuotations,
                            quotation.id,
                          ]);
                        } else {
                          setSelectedQuotations(
                            selectedQuotations.filter(
                              (id) => id !== quotation.id
                            )
                          );
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {quotation.brokerName}
                  </TableCell>
                  <TableCell>{quotation.insuredName}</TableCell>
                  <TableCell>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-left"
                        >
                          {quotation.productType.length > 40
                            ? `${quotation.productType.substring(0, 40)}...`
                            : quotation.productType}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80">
                        <p className="text-sm">{quotation.productType}</p>
                      </PopoverContent>
                    </Popover>
                  </TableCell>
                  <TableCell>
                    {parseFloat(quotation.estimatedPremium.toString()).toFixed(
                      2
                    )}{" "}
                    {quotation.currency}
                  </TableCell>
                  <TableCell>
                    {new Date(quotation.quotationDate).toLocaleDateString(
                      "en-GB"
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={cn(
                        "text-xs",
                        quotation.status === "Open" &&
                          "bg-yellow-100 text-yellow-800",
                        quotation.status === "Confirmed" &&
                          "bg-green-100 text-green-800",
                        quotation.status === "Decline" &&
                          "bg-red-100 text-red-800"
                      )}
                    >
                      {quotation.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {quotation.declineReason ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto p-0"
                          >
                            View reason
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80">
                          <p className="text-sm">{quotation.declineReason}</p>
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {quotation.notes ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto p-0"
                          >
                            View notes
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80">
                          <p className="text-sm">{quotation.notes}</p>
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingQuotation(quotation)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={10}
                  className="text-center h-24 text-gray-500"
                >
                  <div className="flex flex-col items-center justify-center py-6">
                    <FileText className="h-12 w-12 text-gray-300 mb-2" />
                    <p>No liability quotations found</p>
                    <p className="text-sm text-gray-400">
                      Try adjusting your filters or adding a new quotation
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={!!editingQuotation}
        onOpenChange={(open) => {
          if (!open) {
            setEditingQuotation(null);
          }
        }}
      >
        <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden rounded-xl">
          <DialogHeader className="bg-gradient-to-r from-indigo-50 to-indigo-100 px-6 py-4 rounded-t-xl">
            <DialogTitle className="text-indigo-800 flex items-center gap-2">
              <Shield className="h-5 w-5 text-indigo-600" />
              Edit Liability Quotation
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-8rem)]">
            {editingQuotation && (
              <LiabilityQuotationForm
                mode="edit"
                initialData={editingQuotation}
                onSuccess={() => setEditingQuotation(null)}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Selected Quotations</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedQuotations.length}{" "}
              selected quotation(s)? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSelected}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
