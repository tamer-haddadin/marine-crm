import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Filter, Trash2, FileDown, CalendarIcon, Eye, Edit } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { PropertyEngineeringQuotation, QUOTATION_STATUSES, PROPERTY_ENGINEERING_PRODUCT_TYPES } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import PropertyEngineeringEditDialog from "./property-engineering-edit-dialog";

export default function PropertyEngineeringQuotationList() {
  const { toast } = useToast();
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [selectedQuotation, setSelectedQuotation] = useState<PropertyEngineeringQuotation | null>(null);
  const [editingQuotation, setEditingQuotation] = useState<PropertyEngineeringQuotation | null>(null);
  const [selectedQuotations, setSelectedQuotations] = useState<number[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();

  const [brokerFilter, setBrokerFilter] = useState<string>("all");

  const { data: quotations, isLoading } = useQuery<PropertyEngineeringQuotation[]>({
    queryKey: ["/api/property-engineering/quotations"],
    queryFn: async () => {
      const response = await fetch("/api/property-engineering/quotations", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch quotations");
      return response.json();
    },
  });

  const deleteQuotationMutation = useMutation({
    mutationFn: async (quotationId: number) => {
      await apiRequest("DELETE", `/api/property-engineering/quotations/${quotationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/property-engineering/quotations"] });
      toast({
        title: "Success",
        description: "Quotation deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete quotation",
        variant: "destructive",
      });
    },
  });

  const handleDeleteSelected = async () => {
    try {
      await Promise.all(
        selectedQuotations.map((quotationId) =>
          apiRequest("DELETE", `/api/property-engineering/quotations/${quotationId}`)
        )
      );
      queryClient.invalidateQueries({ queryKey: ["/api/property-engineering/quotations"] });
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

  const filteredQuotations = quotations?.filter((quotation) => {
    if (!quotation) return false;
    
    const matchesSearch =
      searchText === "" ||
      quotation.brokerName?.toLowerCase().includes(searchText.toLowerCase()) ||
      quotation.insuredName?.toLowerCase().includes(searchText.toLowerCase()) ||
      quotation.productType?.toLowerCase().includes(searchText.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || quotation.status === statusFilter;

    const matchesProduct =
      productFilter === "all" || quotation.productType === productFilter;



    const matchesBroker =
      brokerFilter === "all" || quotation.brokerName === brokerFilter;

    const quotationDate = new Date(quotation.quotationDate);
    const matchesDateRange =
      (!startDate || quotationDate >= startDate) &&
      (!endDate || quotationDate <= endDate);

    return matchesSearch && matchesStatus && matchesProduct && matchesBroker && matchesDateRange;
  });

  // Get unique brokers for filter
  const uniqueBrokers = Array.from(new Set(quotations?.map(q => q.brokerName) || []));

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Open":
        return "bg-yellow-100 text-yellow-800";
      case "Confirmed":
        return "bg-green-100 text-green-800";
      case "Decline":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatCurrency = (amount: string | number, currency: string) => {
    const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
    return `${currency} ${numAmount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const exportToCSV = async (status: string | "all" | "selected") => {
    const params = new URLSearchParams();
    
    if (startDate) params.append("startDate", startDate.toISOString());
    if (endDate) params.append("endDate", endDate.toISOString());

    // Add selected quotation IDs if exporting selected items
    if (status === "selected") {
      selectedQuotations.forEach((id) => params.append("ids[]", id.toString()));
    }

    try {
      const response = await fetch(
        `/api/property-engineering/quotations/export${
          status === "all" ? "" : `/${status}`
        }?${params.toString()}`,
        { credentials: "include" }
      );

      if (!response.ok) throw new Error("Export failed");

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
      a.download = `property_engineering_quotations${
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
      toast({
        title: "Error",
        description: "Failed to export quotations",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search by broker, insured, or product..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {/* Date Range Filters */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[200px] justify-start text-left font-normal",
                  !startDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? format(startDate, "PPP") : "Start date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
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
                className={cn(
                  "w-[200px] justify-start text-left font-normal",
                  !endDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {endDate ? format(endDate, "PPP") : "End date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
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
            >
              Reset Dates
            </Button>
          )}
        </div>

        {/* Additional Filters */}
        <div className="flex flex-wrap gap-2">
          <Select value={brokerFilter} onValueChange={setBrokerFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Brokers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Brokers</SelectItem>
              {uniqueBrokers.map((broker) => (
                <SelectItem key={broker} value={broker}>
                  {broker}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={productFilter} onValueChange={setProductFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Products" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Products</SelectItem>
              {PROPERTY_ENGINEERING_PRODUCT_TYPES.map((product) => (
                <SelectItem key={product} value={product}>
                  {product}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>



          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {QUOTATION_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {filteredQuotations?.length || 0} quotation(s) found
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
                  Delete Selected ({selectedQuotations.length})
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => exportToCSV("selected")}
                  className="gap-2"
                >
                  <FileDown className="h-4 w-4" />
                  Export Selected ({selectedQuotations.length})
                </Button>
              </>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="bg-green-600 hover:bg-green-700 gap-2">
                  <FileDown className="h-4 w-4" />
                  Export Quotations
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5 text-xs font-medium text-gray-500">
                  Export Options
                </div>
                <DropdownMenuItem
                  onClick={() => exportToCSV("all")}
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
                    onClick={() => exportToCSV(status)}
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
      </div>

      {filteredQuotations?.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No quotations found</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="w-[40px]">
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
                          filteredQuotations.map((quotation) => quotation.id)
                        );
                      } else {
                        setSelectedQuotations([]);
                      }
                    }}
                  />
                </TableHead>
                <TableHead>Broker</TableHead>
                <TableHead>Insured</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Cover Group</TableHead>

                <TableHead>Premium</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredQuotations?.map((quotation) => quotation ? (
                <TableRow key={quotation.id} className="hover:bg-gray-50">
                  <TableCell>
                    <Checkbox
                      checked={selectedQuotations.includes(quotation.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedQuotations([...selectedQuotations, quotation.id]);
                        } else {
                          setSelectedQuotations(
                            selectedQuotations.filter((id) => id !== quotation.id)
                          );
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {quotation.brokerName}
                  </TableCell>
                  <TableCell>{quotation.insuredName}</TableCell>
                  <TableCell>{quotation.productType}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        quotation.coverGroup === "ENGINEERING"
                          ? "border-green-600 text-green-700"
                          : "border-orange-600 text-orange-700"
                      }
                    >
                      {quotation.coverGroup}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    {formatCurrency(quotation.estimatedPremium, quotation.currency)}
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(quotation.status)}>
                      {quotation.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(quotation.quotationDate).toLocaleDateString()}
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
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          •••
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setSelectedQuotation(quotation)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setEditingQuotation(quotation)}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Edit Quotation
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => deleteQuotationMutation.mutate(quotation.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Quotation
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ) : null)}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Selected Quotations</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedQuotations.length} selected
              quotation(s)? This action cannot be undone.
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

      {/* Quotation Details Dialog */}
      <Dialog
        open={!!selectedQuotation}
        onOpenChange={(open) => !open && setSelectedQuotation(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Quotation Details</DialogTitle>
          </DialogHeader>
          {selectedQuotation && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Broker</p>
                  <p className="font-medium">{selectedQuotation.brokerName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Insured</p>
                  <p className="font-medium">{selectedQuotation.insuredName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Product Type</p>
                  <p className="font-medium">{selectedQuotation.productType}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Cover Group</p>
                  <p className="font-medium">{selectedQuotation.coverGroup}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-500">Estimated Premium</p>
                  <p className="font-medium">
                    {formatCurrency(selectedQuotation.estimatedPremium, selectedQuotation.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Quotation Date</p>
                  <p className="font-medium">
                    {new Date(selectedQuotation.quotationDate).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <Badge className={getStatusColor(selectedQuotation.status)}>
                    {selectedQuotation.status}
                  </Badge>
                </div>
              </div>
              {selectedQuotation.notes && (
                <div>
                  <p className="text-sm text-gray-500">Notes</p>
                  <p className="mt-1">{selectedQuotation.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Quotation Dialog */}
      <PropertyEngineeringEditDialog
        quotation={editingQuotation}
        open={!!editingQuotation}
        onOpenChange={(open) => !open && setEditingQuotation(null)}
      />
    </div>
  );
} 