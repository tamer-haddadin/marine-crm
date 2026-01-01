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
import { Order, ORDER_STATUSES } from "@shared/schema";
import OrderStatus from "./order-status";
import {
  Edit2,
  FileDown,
  Search,
  Trash2,
  Loader2,
  ClipboardList,
  UploadCloud,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import OrderForm from "./order-form";
import { UploadOrderDialog } from "./upload-order-dialog";

export default function OrderList() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);

  const { data: orders, isLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: 0,
    retry: 3,
    select: (data) => {
      return data.map((order) => ({
        ...order,
        premium:
          typeof order.premium === "number"
            ? String(order.premium)
            : order.premium,
      }));
    },
  });

  // Filter states
  const [searchText, setSearchText] = useState("");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [selectedOrders, setSelectedOrders] = useState<number[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [filterPreConditionSurvey, setFilterPreConditionSurvey] =
    useState(false);

  const downloadExcel = async (status: string, businessType?: string) => {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate.toISOString());
      if (endDate) params.append("endDate", endDate.toISOString());
      if (businessType) params.append("businessType", businessType);

      // Add selected order IDs if exporting selected items
      if (status === "selected") {
        selectedOrders.forEach((id) => params.append("ids[]", id.toString()));
      }

      const response = await fetch(
        `/api/orders/export/${status}?${params.toString()}`,
        {
          credentials: "include",
        }
      );
      if (!response.ok) throw new Error("Failed to generate report");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const businessTypeText = businessType
        ? `_${businessType.replace(" ", "")}`
        : "";
      const selectedText = status === "selected" ? "_selected" : "";
      a.download = `orders${businessTypeText}${selectedText}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Success",
        description: `Excel report for ${
          status === "selected" ? "selected" : status
        }${
          businessType ? ` (${businessType})` : ""
        } firm orders has been downloaded.`,
      });
    } catch (error) {
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
        selectedOrders.map((orderId) =>
          apiRequest("DELETE", `/api/orders/${orderId}`)
        )
      );
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      setSelectedOrders([]);
      toast({
        title: "Success",
        description: `Successfully deleted ${selectedOrders.length} firm order(s)`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete orders",
        variant: "destructive",
      });
    }
    setShowDeleteDialog(false);
  };

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    return orders.filter((order) => {
    // Text search - handle potential undefined/null values
    const searchLower = searchText.toLowerCase();
    const matchesSearch =
      !searchText ||
      (order?.brokerName?.toLowerCase() ?? "").includes(searchLower) ||
      (order?.insuredName?.toLowerCase() ?? "").includes(searchLower);

    // Date range
    const orderDate = new Date(order.orderDate);
    const matchesDateRange =
      (!startDate || orderDate >= startDate) &&
      (!endDate || orderDate <= endDate);

    // Status filter
    const matchesStatus =
      selectedStatuses.length === 0 ||
      order.statuses.some((status) => selectedStatuses.includes(status));

    // Pre-condition survey filter - only show orders with requiresPreConditionSurvey=true when filter is active
    const matchesPreConditionSurvey =
      !filterPreConditionSurvey ||
      (filterPreConditionSurvey && order.requiresPreConditionSurvey === true);

      return (
        matchesSearch &&
        matchesDateRange &&
        matchesStatus &&
        matchesPreConditionSurvey
      );
    });
  }, [
    orders,
    searchText,
    startDate,
    endDate,
    selectedStatuses,
    filterPreConditionSurvey,
  ]);

  const handleEditSuccess = async (response: {
    order: Order;
    hasMovedToClosed: boolean;
  }) => {
    try {
      setEditingOrder(null);

      // Force a refetch to ensure we have the latest data
      await queryClient.invalidateQueries({
        queryKey: ["/api/orders"],
        exact: true,
      });

      if (response.hasMovedToClosed) {
        toast({
          title: "Order Status Updated",
          description: "The order has been moved to Closed Policies.",
        });
        // Remove the redirect - just let the order disappear from the list
      } else {
        toast({
          title: "Success",
          description: "Order updated successfully.",
        });
      }
    } catch (error) {
      console.error("Failed to update orders:", error);
      toast({
        title: "Error",
        description:
          "Failed to refresh the order list. Please refresh the page.",
        variant: "destructive",
      });
    }
  };

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
                placeholder="Search firm orders..."
                className="pl-10 w-full md:w-[300px] bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded-lg shadow-sm focus-visible:ring-blue-500 dark:text-gray-100 dark:placeholder:text-gray-400"
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
                  Reset Dates
                </Button>
              )}
            </div>
          </div>

          {/* Status Filter Checkboxes */}
          <div className="flex flex-wrap gap-2 p-5 bg-white dark:bg-gray-700 rounded-xl shadow-sm border border-gray-100 dark:border-gray-600">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-200 w-full sm:w-auto sm:mr-2 mb-2 sm:mb-0 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-blue-500"></div>
              Filter by Status:
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {ORDER_STATUSES.map((status: string) => (
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
                    className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
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
                className="ml-auto mt-2 sm:mt-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              >
                Clear Filters
              </Button>
            )}
          </div>

          {/* Pre-condition Survey Filter */}
          <div className="flex items-center space-x-2 p-5 bg-white dark:bg-gray-700 rounded-xl shadow-sm border border-gray-100 dark:border-gray-600">
            <Checkbox
              id="preConditionSurvey"
              checked={filterPreConditionSurvey}
              onCheckedChange={(checked) =>
                setFilterPreConditionSurvey(!!checked)
              }
              className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
            />
            <label
              htmlFor="preConditionSurvey"
              className="text-sm font-medium leading-none cursor-pointer flex items-center gap-2 dark:text-gray-200"
            >
              <div className="h-2 w-2 rounded-full bg-amber-500"></div>
              Show only orders requiring satisfactory survey
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 justify-end">
          <Button
            variant="secondary"
            onClick={() => setIsUploadDialogOpen(true)}
            className="gap-2 shadow hover:shadow-md transition-all rounded-lg"
          >
            <UploadCloud className="h-4 w-4" />
            Upload Quotation
          </Button>

          {selectedOrders.length > 0 && (
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
                className="gap-2 shadow hover:shadow-md transition-all rounded-lg"
              >
                <Trash2 className="h-4 w-4" />
                Delete Selected ({selectedOrders.length})
              </Button>
              <Button
                variant="secondary"
                onClick={() => downloadExcel("selected")}
                className="gap-2 shadow hover:shadow-md transition-all rounded-lg"
              >
                <FileDown className="h-4 w-4" />
                Export Selected ({selectedOrders.length})
              </Button>
            </div>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 shadow hover:shadow-md transition-all gap-2 rounded-lg">
                <FileDown className="h-4 w-4" />
                Export Firm Orders
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5 text-xs font-medium text-gray-500">
                Filter by Status
              </div>
              {ORDER_STATUSES.map((status: string) => (
                <DropdownMenuItem
                  key={status}
                  onClick={() => downloadExcel(status)}
                  className="gap-2 cursor-pointer"
                >
                  <FileDown className="h-4 w-4 text-gray-500" />
                  Export {status} Orders
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-xs font-medium text-gray-500">
                Filter by Business Type
              </div>
              <DropdownMenuItem
                onClick={() => downloadExcel("all", "New Business")}
                className="gap-2 cursor-pointer"
              >
                <FileDown className="h-4 w-4 text-gray-500" />
                Export New Business Orders
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => downloadExcel("all", "Renewal")}
                className="gap-2 cursor-pointer"
              >
                <FileDown className="h-4 w-4 text-gray-500" />
                Export Renewal Business Orders
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-gray-50 dark:bg-gray-700">
              <TableRow className="hover:bg-gray-50/80 dark:hover:bg-gray-600/50">
                <TableHead className="w-[40px] text-center">
                  <Checkbox
                    checked={
                      filteredOrders &&
                      filteredOrders.length > 0 &&
                      filteredOrders.every((order) =>
                        selectedOrders.includes(order.id)
                      )
                    }
                    onCheckedChange={(checked) => {
                      if (checked && filteredOrders) {
                        setSelectedOrders(
                          filteredOrders.map((order) => order.id)
                        );
                      } else {
                        setSelectedOrders([]);
                      }
                    }}
                    className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                  />
                </TableHead>
                <TableHead className="font-semibold dark:text-gray-200">Broker</TableHead>
                <TableHead className="font-semibold dark:text-gray-200">Insured Name</TableHead>
                <TableHead className="font-semibold dark:text-gray-200">Product Type</TableHead>
                <TableHead className="font-semibold dark:text-gray-200">Business Type</TableHead>
                <TableHead className="font-semibold dark:text-gray-200">Premium</TableHead>
                <TableHead className="font-semibold dark:text-gray-200">Date</TableHead>
                <TableHead className="font-semibold dark:text-gray-200">Status</TableHead>
                <TableHead className="font-semibold dark:text-gray-200 w-[200px]">Notes</TableHead>
                <TableHead className="text-right font-semibold dark:text-gray-200">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders && filteredOrders.length > 0 ? (
                filteredOrders.map((order) => (
                  <TableRow
                    key={order.id}
                    className="border-b dark:border-gray-700 hover:bg-gray-50/50 dark:hover:bg-gray-700/50"
                  >
                    <TableCell className="text-center">
                      <Checkbox
                        checked={selectedOrders.includes(order.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedOrders([...selectedOrders, order.id]);
                          } else {
                            setSelectedOrders(
                              selectedOrders.filter((id) => id !== order.id)
                            );
                          }
                        }}
                        className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                      />
                    </TableCell>
                    <TableCell className="font-medium text-blue-700 dark:text-blue-400">
                      {order.brokerName}
                    </TableCell>
                    <TableCell className="dark:text-gray-200">{order.insuredName}</TableCell>
                    <TableCell className="dark:text-gray-200">{order.marineProductType}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          order.businessType === "New Business"
                            ? "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                            : "bg-violet-100 dark:bg-violet-900 text-violet-800 dark:text-violet-200"
                        }`}
                      >
                        {order.businessType}
                      </span>
                    </TableCell>
                    <TableCell className="font-semibold dark:text-gray-200">
                      {parseFloat(order.premium).toFixed(2)} {order.currency}
                    </TableCell>
                    <TableCell className="dark:text-gray-200">
                      {new Date(order.orderDate).toLocaleDateString("en-GB")}
                    </TableCell>
                    <TableCell>
                      <OrderStatus order={order} />
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {order.notes ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="link"
                              size="sm"
                              className="h-auto p-0 gap-1"
                            >
                              <span className="truncate max-w-[150px] text-left">
                                {order.notes.substring(0, 40)}
                                {order.notes.length > 40 ? "..." : ""}
                              </span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[300px] p-4">
                            <p className="text-sm">{order.notes}</p>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingOrder(order)}
                        className="h-8 w-8 p-0 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900 hover:text-blue-700 dark:hover:text-blue-300 dark:text-gray-400"
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
                    className="text-center h-24 text-gray-500 dark:text-gray-400"
                  >
                    {isLoading ? (
                      <div className="flex justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-gray-400 dark:text-gray-500" />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-6">
                        <ClipboardList className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-2" />
                        <p className="dark:text-gray-300">No firm orders found</p>
                        <p className="text-sm text-gray-400 dark:text-gray-500">
                          Try adjusting your filters or adding a new order
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
        open={!!editingOrder}
        onOpenChange={(open) => {
          if (!open) {
            setEditingOrder(null);
          }
        }}
      >
        <DialogContent className="w-[calc(100%-32px)] max-w-[500px] p-0 gap-0 overflow-hidden rounded-xl">
          <DialogHeader className="bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-4 rounded-t-xl">
            <DialogTitle className="text-blue-800 flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-blue-600" />
              Edit Firm Order
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-8rem)]">
            <OrderForm
              mode="edit"
              initialData={editingOrder}
              onSuccess={(response) => {
                handleEditSuccess(response);
                setEditingOrder(null);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      <UploadOrderDialog
        open={isUploadDialogOpen}
        onOpenChange={setIsUploadDialogOpen}
        onSuccess={async () => {
          await queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
          await queryClient.invalidateQueries({ queryKey: ["/api/orders", "Policy Issued"] });
        }}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">
              Delete Selected Firm Orders
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedOrders.length} selected
              firm order(s)? This action cannot be undone.
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
