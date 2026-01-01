import { useQuery } from "@tanstack/react-query";
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
import {
  Edit2,
  Search,
  Filter,
  Trash2,
  FileDown,
  CalendarIcon,
} from "lucide-react";
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
  PropertyEngineeringOrder,
  ORDER_STATUSES,
  PROPERTY_ENGINEERING_PRODUCT_TYPES,
  BUSINESS_TYPES,
} from "@shared/schema";
import StatusDisplay from "./status-display";
import PropertyEngineeringEditOrderDialog from "./property-engineering-edit-order-dialog";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function PropertyEngineeringOrderList() {
  const { toast } = useToast();
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [editingOrder, setEditingOrder] =
    useState<PropertyEngineeringOrder | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<number[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [businessTypeFilter, setBusinessTypeFilter] = useState<string>("all");
  const [brokerFilter, setBrokerFilter] = useState<string>("all");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [filterPreConditionSurvey, setFilterPreConditionSurvey] =
    useState(false);

  const { data: orders, isLoading } = useQuery<PropertyEngineeringOrder[]>({
    queryKey: ["/api/property-engineering/orders"],
    queryFn: async () => {
      const response = await fetch("/api/property-engineering/orders", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch orders");
      return response.json();
    },
    refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
  });

  // Filter out Policy Issued orders for display only
  const displayOrders =
    orders?.filter((order) => !order.statuses.includes("Policy Issued")) || [];

  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: number) => {
      await apiRequest("DELETE", `/api/property-engineering/orders/${orderId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/property-engineering/orders"],
      });
      toast({
        title: "Success",
        description: "Order deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete order",
        variant: "destructive",
      });
    },
  });

  const handleDeleteSelected = async () => {
    try {
      await Promise.all(
        selectedOrders.map((orderId) =>
          apiRequest("DELETE", `/api/property-engineering/orders/${orderId}`)
        )
      );
      queryClient.invalidateQueries({
        queryKey: ["/api/property-engineering/orders"],
      });
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

  const filteredOrders = displayOrders?.filter((order) => {
    if (!order) return false;

    const matchesSearch =
      searchText === "" ||
      order.brokerName?.toLowerCase().includes(searchText.toLowerCase()) ||
      order.insuredName?.toLowerCase().includes(searchText.toLowerCase()) ||
      order.productType?.toLowerCase().includes(searchText.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      (order.statuses &&
        order.statuses.some((status) => status === statusFilter));

    const matchesProduct =
      productFilter === "all" || order.productType === productFilter;

    const matchesBusinessType =
      businessTypeFilter === "all" || order.businessType === businessTypeFilter;

    const matchesBroker =
      brokerFilter === "all" || order.brokerName === brokerFilter;

    const orderDate = new Date(order.orderDate);
    const matchesDateRange =
      (!startDate || orderDate >= startDate) &&
      (!endDate || orderDate <= endDate);

    // Status filter using checkboxes
    const matchesSelectedStatuses =
      selectedStatuses.length === 0 ||
      order.statuses.some((status) => selectedStatuses.includes(status));

    // Pre-condition survey filter
    const matchesPreConditionSurvey =
      !filterPreConditionSurvey ||
      (filterPreConditionSurvey && order.requiresPreConditionSurvey === true);

    return (
      matchesSearch &&
      matchesStatus &&
      matchesProduct &&
      matchesBusinessType &&
      matchesBroker &&
      matchesDateRange &&
      matchesSelectedStatuses &&
      matchesPreConditionSurvey
    );
  });

  // Get unique brokers for filter
  const uniqueBrokers = Array.from(
    new Set(displayOrders?.map((o) => o.brokerName) || [])
  );

  const formatCurrency = (amount: string | number, currency: string) => {
    const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
    return `${currency} ${numAmount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

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
        `/api/property-engineering/orders/export/${status}?${params.toString()}`,
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
      a.download = `property_engineering_orders${businessTypeText}${selectedText}.xlsx`;
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
        } orders has been downloaded.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download report",
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

          <Select
            value={businessTypeFilter}
            onValueChange={setBusinessTypeFilter}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Business Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Business Types</SelectItem>
              {BUSINESS_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
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
              {ORDER_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status Filter Checkboxes */}
        <div className="flex flex-wrap gap-2 p-5 bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="text-sm font-medium text-gray-700 w-full sm:w-auto sm:mr-2 mb-2 sm:mb-0 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500"></div>
            Filter by Status:
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {[...ORDER_STATUSES, "Policy Issued"].map((status: string) => (
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
                  className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                />
                <label
                  htmlFor={status}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
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
              className="ml-auto mt-2 sm:mt-0 text-green-600 hover:text-green-700 hover:bg-green-50"
            >
              Clear Filters
            </Button>
          )}
        </div>

        {/* Pre-condition Survey Filter */}
        <div className="flex items-center space-x-2 p-5 bg-white rounded-xl shadow-sm border border-gray-100">
          <Checkbox
            id="preConditionSurvey"
            checked={filterPreConditionSurvey}
            onCheckedChange={(checked) =>
              setFilterPreConditionSurvey(!!checked)
            }
            className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
          />
          <label
            htmlFor="preConditionSurvey"
            className="text-sm font-medium leading-none cursor-pointer flex items-center gap-2"
          >
            <div className="h-2 w-2 rounded-full bg-amber-500"></div>
            Show only orders requiring satisfactory survey
          </label>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {filteredOrders?.length || 0} order(s) found
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
                  Delete Selected ({selectedOrders.length})
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => downloadExcel("selected")}
                  className="gap-2"
                >
                  <FileDown className="h-4 w-4" />
                  Export Selected ({selectedOrders.length})
                </Button>
              </>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="bg-green-600 hover:bg-green-700 gap-2">
                  <FileDown className="h-4 w-4" />
                  Export Orders
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
      </div>

      {filteredOrders?.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No orders found</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="w-[40px]">
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
                  />
                </TableHead>
                <TableHead>Broker</TableHead>
                <TableHead>Insured</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Cover Group</TableHead>
                <TableHead>Business Type</TableHead>
                <TableHead>Premium</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Survey</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders?.map((order) =>
                order ? (
                  <TableRow key={order.id} className="hover:bg-gray-50">
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
                    <TableCell>{order.productType}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          order.coverGroup === "ENGINEERING"
                            ? "border-green-600 text-green-700"
                            : "border-orange-600 text-orange-700"
                        }
                      >
                        {order.coverGroup}
                      </Badge>
                    </TableCell>
                    <TableCell>{order.businessType}</TableCell>
                    <TableCell>
                      {formatCurrency(order.premium, order.currency)}
                    </TableCell>
                    <TableCell>
                      <StatusDisplay statuses={order.statuses} />
                    </TableCell>
                    <TableCell>
                      {new Date(order.orderDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {order.requiresPreConditionSurvey ? (
                        <Badge variant="outline" className="text-amber-700">
                          Yes
                        </Badge>
                      ) : (
                        <span className="text-gray-400">No</span>
                      )}
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
                ) : null
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
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

      {/* Edit Order Dialog */}
      {editingOrder && (
        <PropertyEngineeringEditOrderDialog
          order={editingOrder}
          open={!!editingOrder}
          onOpenChange={(open) => !open && setEditingOrder(null)}
        />
      )}
    </div>
  );
}
