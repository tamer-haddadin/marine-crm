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
  Shield,
  ClipboardList,
  Search,
  CalendarIcon,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { LiabilityOrder, ORDER_STATUSES } from "@shared/schema";
import LiabilityOrderForm from "./liability-order-form";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import StatusDisplay from "./status-display";
import { useLocation } from "wouter";
import * as XLSX from "xlsx";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";

export default function LiabilityOrderList() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrders, setSelectedOrders] = useState<number[]>([]);
  const [editingOrder, setEditingOrder] = useState<LiabilityOrder | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();

  const { data: orders, isLoading } = useQuery({
    queryKey: ["/api/liability/orders"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/liability/orders");
      return res.json() as Promise<LiabilityOrder[]>;
    },
  });

  const deleteOrderMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/liability/orders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/liability/orders"] });
      toast({
        title: "Success",
        description: "Order deleted successfully",
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
        selectedOrders.map((id) =>
          apiRequest("DELETE", `/api/liability/orders/${id}`)
        )
      );
      queryClient.invalidateQueries({ queryKey: ["/api/liability/orders"] });
      setSelectedOrders([]);
      toast({
        title: "Success",
        description: `Successfully deleted ${selectedOrders.length} order(s)`,
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

  const downloadExcel = async (status?: string, businessType?: string) => {
    const filteredData =
      orders?.filter((o) => {
        if (status === "selected") {
          return selectedOrders.includes(o.id);
        }
        if (status && status !== "all") {
          return o.statuses.includes(status);
        }
        if (businessType && businessType !== "all") {
          return o.businessType === businessType;
        }
        return true;
      }) || [];

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(
      filteredData.map((order) => ({
        "Broker Name": order.brokerName,
        "Insured Name": order.insuredName,
        "Product Type": order.productType,
        "Business Type": order.businessType,
        Premium: `${parseFloat(order.premium.toString()).toFixed(2)} ${
          order.currency
        }`,
        "Order Date": new Date(order.orderDate).toLocaleDateString("en-GB"),
        Statuses: order.statuses.join(", "),
        Notes: order.notes || "",
        "Last Updated": new Date(
          order.updatedAt || order.createdAt || new Date()
        ).toLocaleDateString("en-GB"),
      }))
    );

    XLSX.utils.book_append_sheet(workbook, worksheet, "Liability Orders");
    const excelBuffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });

    const blob = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `liability_orders_${status || "all"}_${
      new Date().toISOString().split("T")[0]
    }.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleEditSuccess = async (response: {
    order: LiabilityOrder;
    hasMovedToClosed: boolean;
  }) => {
    try {
      setEditingOrder(null);

      await queryClient.invalidateQueries({
        queryKey: ["/api/liability/orders"],
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

  const filteredOrders = orders?.filter((order) => {
    const matchesSearch =
      !searchTerm ||
      order.brokerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.insuredName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.productType.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      selectedStatuses.length === 0 ||
      order.statuses.some((status) => selectedStatuses.includes(status));

    // Date range filter
    const orderDate = new Date(order.orderDate);
    const matchesDateRange =
      (!startDate || orderDate >= startDate) &&
      (!endDate || orderDate <= endDate);

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
                placeholder="Search orders..."
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
            {[...ORDER_STATUSES, "Policy Issued"].map((status) => (
              <div key={status} className="flex items-center space-x-2">
                <Checkbox
                  id={`liability-order-${status}`}
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
                  htmlFor={`liability-order-${status}`}
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
          {selectedOrders.length > 0 && (
            <>
              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Delete ({selectedOrders.length})
              </Button>
              <Button
                variant="secondary"
                onClick={() => downloadExcel("selected")}
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
              <DropdownMenuItem onClick={() => downloadExcel()}>
                Export All
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>By Status</DropdownMenuLabel>
              {[...ORDER_STATUSES, "Policy Issued"].map((status) => (
                <DropdownMenuItem
                  key={status}
                  onClick={() => downloadExcel(status)}
                >
                  Export {status}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>By Business Type</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => downloadExcel("all", "New Business")}
              >
                Export New Business
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => downloadExcel("all", "Renewal")}>
                Export Renewal
              </DropdownMenuItem>
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
                    filteredOrders &&
                    filteredOrders.length > 0 &&
                    filteredOrders.every((o) => selectedOrders.includes(o.id))
                  }
                  onCheckedChange={(checked) => {
                    if (checked && filteredOrders) {
                      setSelectedOrders(filteredOrders.map((o) => o.id));
                    } else {
                      setSelectedOrders([]);
                    }
                  }}
                />
              </TableHead>
              <TableHead>Broker</TableHead>
              <TableHead>Insured</TableHead>
              <TableHead>Product Type</TableHead>
              <TableHead>Business Type</TableHead>
              <TableHead>Premium</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrders && filteredOrders.length > 0 ? (
              filteredOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>
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
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {order.brokerName}
                  </TableCell>
                  <TableCell>{order.insuredName}</TableCell>
                  <TableCell>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-left"
                        >
                          {order.productType.length > 40
                            ? `${order.productType.substring(0, 40)}...`
                            : order.productType}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80">
                        <p className="text-sm">{order.productType}</p>
                      </PopoverContent>
                    </Popover>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={cn(
                        "text-xs",
                        order.businessType === "New Business" &&
                          "bg-blue-100 text-blue-800",
                        order.businessType === "Renewal" &&
                          "bg-violet-100 text-violet-800"
                      )}
                    >
                      {order.businessType}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-semibold">
                    {parseFloat(order.premium.toString()).toFixed(2)}{" "}
                    {order.currency}
                  </TableCell>
                  <TableCell>
                    {new Date(order.orderDate).toLocaleDateString("en-GB")}
                  </TableCell>
                  <TableCell>
                    <StatusDisplay statuses={order.statuses} />
                  </TableCell>
                  <TableCell>
                    {order.notes ? (
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
                          <p className="text-sm">{order.notes}</p>
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
                      onClick={() => setEditingOrder(order)}
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
                    <ClipboardList className="h-12 w-12 text-gray-300 mb-2" />
                    <p>No liability orders found</p>
                    <p className="text-sm text-gray-400">
                      Try adjusting your filters or adding a new order
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={!!editingOrder}
        onOpenChange={(open) => {
          if (!open) {
            setEditingOrder(null);
          }
        }}
      >
        <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden rounded-xl">
          <DialogHeader className="bg-gradient-to-r from-indigo-50 to-indigo-100 px-6 py-4 rounded-t-xl">
            <DialogTitle className="text-indigo-800 flex items-center gap-2">
              <Shield className="h-5 w-5 text-indigo-600" />
              Edit Liability Order
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-8rem)]">
            {editingOrder && (
              <LiabilityOrderForm
                mode="edit"
                initialData={editingOrder}
                onSuccess={(response) => {
                  if (response) {
                    handleEditSuccess(response);
                  }
                  setEditingOrder(null);
                }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Selected Orders</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedOrders.length} selected
              order(s)? This action cannot be undone.
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
