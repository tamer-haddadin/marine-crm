import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Quotation, QUOTATION_STATUSES } from "@shared/schema";
import {
  Edit2,
  FileDown,
  Search,
  Trash2,
  Loader2,
  FileText,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import QuotationForm from "./quotation-form";

export default function QuotationList() {
  const { toast } = useToast();
  const { data: quotations, isLoading } = useQuery<Quotation[]>({
    queryKey: ["/api/quotations"],
  });

  // Filter states
  const [searchText, setSearchText] = useState("");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [selectedQuotations, setSelectedQuotations] = useState<number[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(
    null
  );
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

  const downloadCSV = async (status: string | "all" | "selected") => {
    try {
      // Build the query parameters for date filtering
      const params = new URLSearchParams();

      // Only add valid dates
      if (startDate && !isNaN(startDate.getTime())) {
        params.append("startDate", startDate.toISOString());
      }
      if (endDate && !isNaN(endDate.getTime())) {
        params.append("endDate", endDate.toISOString());
      }

      // Add selected quotation IDs if exporting selected items
      if (status === "selected") {
        selectedQuotations.forEach((id) =>
          params.append("ids[]", id.toString())
        );
      } else if (status !== "all") {
        // Only validate status if it's not 'all' or 'selected'
        if (QUOTATION_STATUSES.includes(status as any)) {
          params.append("status", status);
        } else {
          throw new Error("Invalid quotation status");
        }
      }

      const response = await fetch(
        `/api/quotations/export${
          status === "all" ? "" : `/${status}`
        }?${params.toString()}`,
        {
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to generate report");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const dateStr =
        startDate &&
        endDate &&
        !isNaN(startDate.getTime()) &&
        !isNaN(endDate.getTime())
          ? `_${format(startDate, "dd-MM-yyyy")}_to_${format(
              endDate,
              "dd-MM-yyyy"
            )}`
          : "";
      a.download = `quotations${
        status === "selected"
          ? "_selected"
          : status === "all"
          ? ""
          : `-${status}`
      }${dateStr}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Success",
        description: `CSV report for ${
          status === "selected" ? "selected" : status === "all" ? "all" : status
        } quotations has been downloaded.`,
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Error",
        description: "Failed to download report",
        variant: "destructive",
      });
    }
  };

  const handleDeleteSelected = async () => {
    try {
      await Promise.all(
        selectedQuotations.map((quotationId) =>
          apiRequest("DELETE", `/api/quotations/${quotationId}`)
        )
      );
      queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
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

  const filteredQuotations = quotations
    ?.filter((quotation) => {
      // Smart search - searches across multiple fields including notes
      const searchLower = searchText.toLowerCase();
      const matchesSearch =
        !searchText ||
        quotation.brokerName.toLowerCase().includes(searchLower) ||
        quotation.insuredName.toLowerCase().includes(searchLower) ||
        (quotation.notes?.toLowerCase() ?? "").includes(searchLower) ||
        (quotation.marineProductType?.toLowerCase() ?? "").includes(searchLower) ||
        (quotation.currency?.toLowerCase() ?? "").includes(searchLower) ||
        (quotation.status?.toLowerCase() ?? "").includes(searchLower);

      // Date range
      const quotationDate = new Date(quotation.quotationDate);
      // Set time to start of day for start date
      const startOfDay = startDate
        ? new Date(startDate.setHours(0, 0, 0, 0))
        : null;
      // Set time to end of day for end date
      const endOfDay = endDate
        ? new Date(endDate.setHours(23, 59, 59, 999))
        : null;

      const matchesDateRange =
        (!startOfDay || quotationDate >= startOfDay) &&
        (!endOfDay || quotationDate <= endOfDay);

      // Status filter
      const matchesStatus =
        selectedStatuses.length === 0 ||
        selectedStatuses.includes(quotation.status);

      return matchesSearch && matchesDateRange && matchesStatus;
    })
    ?.sort((a, b) => {
      // Sort by quotation date - newest first
      const dateA = new Date(a.quotationDate);
      const dateB = new Date(b.quotationDate);
      return dateB.getTime() - dateA.getTime();
    });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-5">
        <div className="space-y-5 w-full md:w-auto">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-auto flex-1 md:flex-none">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
              <Input
                placeholder="Search quotations..."
                className="pl-10 w-full md:w-[300px] bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded-lg shadow-sm focus-visible:ring-purple-500 dark:text-gray-100 dark:placeholder:text-gray-400"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-0">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto border-gray-200 dark:border-gray-600 shadow-sm hover:shadow bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
                  >
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
                    className="w-full sm:w-auto border-gray-200 dark:border-gray-600 shadow-sm hover:shadow bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
                  >
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
                  onClick={() => {
                    setStartDate(undefined);
                    setEndDate(undefined);
                  }}
                  className="w-full sm:w-auto"
                >
                  Clear Dates
                </Button>
              )}
            </div>
          </div>

          {/* Status Filter Checkboxes */}
          <div className="flex flex-wrap gap-2 p-5 bg-white dark:bg-gray-700 rounded-xl shadow-sm border border-gray-100 dark:border-gray-600">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-200 w-full sm:w-auto sm:mr-2 mb-2 sm:mb-0 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-purple-500"></div>
              Filter by Status:
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {QUOTATION_STATUSES.map((status) => (
                <div key={status} className="flex items-center space-x-2">
                  <Checkbox
                    id={status}
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
                    className="data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                  />
                  <label
                    htmlFor={status}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer dark:text-gray-200"
                  >
                    {status}
                  </label>
                </div>
              ))}
            </div>
            {selectedStatuses.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedStatuses([])}
                className="ml-auto mt-2 sm:mt-0 text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:text-purple-400 dark:hover:text-purple-300 dark:hover:bg-purple-900/30"
              >
                Clear Filters
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 justify-end">
          {selectedQuotations.length > 0 && (
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
                className="gap-2 shadow hover:shadow-md transition-all rounded-lg"
              >
                <Trash2 className="h-4 w-4" />
                Delete Selected ({selectedQuotations.length})
              </Button>
              <Button
                variant="secondary"
                onClick={() => downloadCSV("selected")}
                className="gap-2 shadow hover:shadow-md transition-all rounded-lg"
              >
                <FileDown className="h-4 w-4" />
                Export Selected ({selectedQuotations.length})
              </Button>
            </div>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="bg-purple-600 hover:bg-purple-700 shadow hover:shadow-md transition-all gap-2 rounded-lg">
                <FileDown className="h-4 w-4" />
                Export Quotations
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5 text-xs font-medium text-gray-500">
                Export Options
              </div>
              <DropdownMenuItem
                key="all"
                onClick={() => downloadCSV("all")}
                className="gap-2 cursor-pointer"
              >
                <FileDown className="h-4 w-4 text-gray-500" />
                Export All Quotations
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-xs font-medium text-gray-500">
                Filter by Status
              </div>
              {QUOTATION_STATUSES.map((status) => (
                <DropdownMenuItem
                  key={status}
                  onClick={() => downloadCSV(status)}
                  className="gap-2 cursor-pointer"
                >
                  <FileDown className="h-4 w-4 text-gray-500" />
                  Export {status} Quotations
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div
          className="overflow-x-auto md:overflow-visible"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <Table className="w-full relative md:min-w-0 table-fixed">
            <TableHeader className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
              <TableRow className="hover:bg-gray-50/80 dark:hover:bg-gray-600/50">
                <TableHead className="w-[30px] md:w-[40px] text-center px-1 md:px-4">
                  <Checkbox
                    checked={
                      filteredQuotations &&
                      filteredQuotations.length > 0 &&
                      filteredQuotations.every((quotation) =>
                        selectedQuotations.includes(quotation.id)
                      )
                    }
                    onCheckedChange={(checked) => {
                      if (checked && filteredQuotations) {
                        setSelectedQuotations(
                          filteredQuotations.map((quotation) => quotation.id) ||
                            []
                        );
                      } else {
                        setSelectedQuotations([]);
                      }
                    }}
                    className="data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                  />
                </TableHead>
                <TableHead className="font-semibold w-[12%] px-2 md:px-4 text-xs md:text-sm dark:text-gray-200">
                  Broker
                </TableHead>
                <TableHead className="font-semibold w-[14%] px-2 md:px-4 text-xs md:text-sm dark:text-gray-200">
                  Insured Name
                </TableHead>
                <TableHead className="font-semibold w-[15%] px-2 md:px-4 text-xs md:text-sm dark:text-gray-200">
                  Product Type
                </TableHead>
                <TableHead className="font-semibold w-[11%] px-2 md:px-4 text-xs md:text-sm dark:text-gray-200">
                  Est. Premium
                </TableHead>
                <TableHead className="font-semibold w-[8%] px-2 md:px-4 text-xs md:text-sm dark:text-gray-200">
                  Date
                </TableHead>
                <TableHead className="font-semibold w-[8%] px-2 md:px-4 text-xs md:text-sm dark:text-gray-200">
                  Status
                </TableHead>
                <TableHead className="font-semibold w-[11%] px-2 md:px-4 text-xs md:text-sm dark:text-gray-200">
                  Decline Reason
                </TableHead>
                <TableHead className="font-semibold w-[11%] px-2 md:px-4 text-xs md:text-sm dark:text-gray-200">
                  Notes
                </TableHead>
                <TableHead className="font-semibold w-[5%] px-1 md:px-4 text-center text-xs md:text-sm dark:text-gray-200">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredQuotations && filteredQuotations.length > 0 ? (
                filteredQuotations?.map((quotation) => (
                  <TableRow
                    key={quotation.id}
                    className="border-b dark:border-gray-700 hover:bg-gray-50/50 dark:hover:bg-gray-700/50 text-xs md:text-sm"
                  >
                    <TableCell className="text-center px-1 md:px-4">
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
                        className="data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                      />
                    </TableCell>
                    <TableCell className="font-medium text-purple-700 dark:text-purple-400 px-2 md:px-4">
                      <div className="truncate" title={quotation.brokerName}>
                        {quotation.brokerName}
                      </div>
                    </TableCell>
                    <TableCell className="px-2 md:px-4 dark:text-gray-200">
                      <div className="truncate" title={quotation.insuredName}>
                        {quotation.insuredName}
                      </div>
                    </TableCell>
                    <TableCell className="px-2 md:px-4 dark:text-gray-200">
                      <div
                        className="truncate"
                        title={quotation.marineProductType}
                      >
                        {quotation.marineProductType}
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold whitespace-nowrap px-2 md:px-4 dark:text-gray-200">
                      {parseFloat(
                        quotation.estimatedPremium.toString()
                      ).toFixed(2)}{" "}
                      {quotation.currency}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-2 md:px-4 dark:text-gray-200">
                      {new Date(quotation.quotationDate).toLocaleDateString(
                        "en-GB"
                      )}
                    </TableCell>
                    <TableCell className="px-2 md:px-4">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-1.5 py-0.5 md:px-2.5 md:py-1 text-xs font-medium",
                          {
                            "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200":
                              quotation.status === "Open",
                            "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200":
                              quotation.status === "Confirmed",
                            "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200":
                              quotation.status === "Decline",
                          }
                        )}
                      >
                        {quotation.status}
                      </span>
                    </TableCell>
                    <TableCell className="px-2 md:px-4">
                      {quotation.status === "Decline" &&
                      quotation.declineReason ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="link"
                              size="sm"
                              className="h-auto p-0 gap-1"
                            >
                              <span className="truncate max-w-full text-left">
                                {quotation.declineReason.substring(0, 15)}
                                {quotation.declineReason.length > 15
                                  ? "..."
                                  : ""}
                              </span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[300px] p-4">
                            <p className="text-sm">{quotation.declineReason}</p>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">-</span>
                      )}
                    </TableCell>
                    <TableCell className="px-2 md:px-4">
                      {quotation.notes ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="link"
                              size="sm"
                              className="h-auto p-0 gap-1"
                            >
                              <span className="truncate max-w-full text-left">
                                {quotation.notes.substring(0, 15)}
                                {quotation.notes.length > 15 ? "..." : ""}
                              </span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[300px] p-4">
                            <p className="text-sm">{quotation.notes}</p>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center px-1 md:px-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingQuotation(quotation)}
                        className="h-6 w-6 md:h-8 md:w-8 p-0 rounded-full hover:bg-purple-100 dark:hover:bg-purple-900 hover:text-purple-700 dark:hover:text-purple-300 dark:text-gray-400"
                      >
                        <Edit2 className="h-3 w-3 md:h-4 md:w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="text-center h-24 text-gray-500 dark:text-gray-400"
                  >
                    {isLoading ? (
                      <div className="flex justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-gray-400 dark:text-gray-500" />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-6">
                        <FileText className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-2" />
                        <p className="dark:text-gray-300">No quotations found</p>
                        <p className="text-sm text-gray-400 dark:text-gray-500">
                          Try adjusting your filters or adding a new quotation
                        </p>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog
        open={!!editingQuotation}
        onOpenChange={(open) => {
          if (!open) {
            setEditingQuotation(null);
          }
        }}
      >
        <DialogContent className="w-[calc(100%-32px)] max-w-[500px] p-0 gap-0 overflow-hidden rounded-xl">
          <DialogHeader className="bg-gradient-to-r from-purple-50 to-purple-100 px-6 py-4 rounded-t-xl">
            <DialogTitle className="text-purple-800 flex items-center gap-2">
              <FileText className="h-5 w-5 text-purple-600" />
              Edit Quotation
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-8rem)]">
            {editingQuotation && (
              <QuotationForm
                mode="edit"
                initialData={editingQuotation}
                onSuccess={() => setEditingQuotation(null)}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">
              Delete Selected Quotations
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedQuotations.length}{" "}
              selected quotation(s)? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSelected}
              className="bg-red-600 hover:bg-red-700 rounded-lg"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
