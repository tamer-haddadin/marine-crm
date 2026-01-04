import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import {
  Ship,
  Building,
  ArrowLeft,
  FileCheck2,
  Search,
  Trash2,
  Edit2,
  FileDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Order, PropertyEngineeringOrder } from "@shared/schema";
import { Link } from "wouter";
import { ScrollToTop } from "@/components/ui/scroll-to-top";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import OrderForm from "@/components/orders/order-form";
import PropertyEngineeringEditOrderDialog from "@/components/orders/property-engineering-edit-order-dialog";
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
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import LiabilityOrderForm from "@/components/orders/liability-order-form";
import { YearSelector } from "@/components/ui/year-selector";

export default function ClosedPolicies() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [searchText, setSearchText] = useState("");
  const [selectedOrders, setSelectedOrders] = useState<number[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingOrder, setEditingOrder] = useState<
    Order | PropertyEngineeringOrder | null
  >(null);
  const [filterPreConditionSurvey, setFilterPreConditionSurvey] =
    useState(false);

  // Determine which API endpoint to use based on department
  const apiEndpoint =
    user?.department === "Property & Engineering"
      ? "/api/property-engineering/orders"
      : user?.department === "Liability & Financial"
      ? "/api/liability/orders"
      : "/api/orders";

  // Query closed orders (those with "Policy Issued" status)
  const { data: closedOrders, isLoading } = useQuery<
    (Order | PropertyEngineeringOrder)[]
  >({
    queryKey: [
      apiEndpoint,
      "Policy Issued",
      startDate?.toISOString(),
      endDate?.toISOString(),
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("status", "Policy Issued");
      if (startDate) params.append("startDate", startDate.toISOString());
      if (endDate) params.append("endDate", endDate.toISOString());

      const response = await fetch(`${apiEndpoint}?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch closed policies");
      return response.json();
    },
  });

  const handleEditSuccess = async (response?: {
    order: any;
    hasMovedToClosed: boolean;
  }) => {
    try {
      console.log("Handling edit success:", response);
      setEditingOrder(null);

      // First invalidate all queries to ensure cache is cleared
      await queryClient.invalidateQueries({
        queryKey: [apiEndpoint],
        refetchType: "all",
      });

      // Then force refetch the specific queries we need
      await queryClient.refetchQueries({
        queryKey: [
          apiEndpoint,
          "Policy Issued",
          startDate?.toISOString(),
          endDate?.toISOString(),
        ],
        type: "all",
      });

      toast({
        title: "Success",
        description: "Policy updated successfully",
      });

      console.log("Cache invalidated and queries refetched");
    } catch (error) {
      console.error("Failed to update policies:", error);
      toast({
        title: "Error",
        description:
          "Failed to refresh the policy list. Please refresh the page.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteSelected = async () => {
    try {
      await Promise.all(
        selectedOrders.map((orderId) =>
          apiRequest("DELETE", `${apiEndpoint}/${orderId}`)
        )
      );
      queryClient.invalidateQueries({ queryKey: [apiEndpoint] });
      setSelectedOrders([]);
      toast({
        title: "Success",
        description: `Successfully deleted ${selectedOrders.length} closed policy/policies`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete policies",
        variant: "destructive",
      });
    }
    setShowDeleteDialog(false);
  };

  const filteredOrders = closedOrders?.filter((order) => {
    // Smart search - searches across multiple fields including notes
    const searchLower = searchText.toLowerCase();
    const matchesSearch =
      !searchText ||
      order.brokerName.toLowerCase().includes(searchLower) ||
      order.insuredName.toLowerCase().includes(searchLower) ||
      (order.notes?.toLowerCase() ?? "").includes(searchLower) ||
      ((order as any).marineProductType?.toLowerCase() ?? "").includes(searchLower) ||
      ((order as any).businessType?.toLowerCase() ?? "").includes(searchLower) ||
      (order.currency?.toLowerCase() ?? "").includes(searchLower);

    // Date range
    const orderDate = new Date(order.orderDate);
    const matchesDateRange =
      (!startDate || orderDate >= startDate) &&
      (!endDate || orderDate <= endDate);

    // Pre-condition survey filter - only show orders with requiresPreConditionSurvey=true when filter is active
    const matchesPreConditionSurvey =
      !filterPreConditionSurvey ||
      (filterPreConditionSurvey && order.requiresPreConditionSurvey === true);

    return matchesSearch && matchesDateRange && matchesPreConditionSurvey;
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <header className="bg-white dark:bg-gray-800 shadow-md border-b dark:border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              {user?.department === "Property & Engineering" ? (
                <Building className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              ) : (
                <Ship className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              )}
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Closed Policies
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <YearSelector />
              <Link href="/">
                <Button variant="outline" size="sm" className="gap-2 shadow-sm hover:shadow dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
              <FileCheck2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              Issued Policies
            </CardTitle>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search policies..."
                  className="pl-8"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline">
                    {startDate ? format(startDate, "PPP") : "Select start date"}
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
                  <Button variant="outline">
                    {endDate ? format(endDate, "PPP") : "Select end date"}
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
                  Reset
                </Button>
              )}

              {selectedOrders.length > 0 && (
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Selected ({selectedOrders.length})
                </Button>
              )}
            </div>
          </CardHeader>
          {/* Add Pre-condition Survey Filter */}
          <div className="px-6 py-4">
            <div className="flex items-center space-x-2 p-4 bg-white/5 rounded-lg border border-white/10">
              <Checkbox
                id="preConditionSurvey"
                checked={filterPreConditionSurvey}
                onCheckedChange={(checked) =>
                  setFilterPreConditionSurvey(!!checked)
                }
              />
              <label
                htmlFor="preConditionSurvey"
                className="text-sm font-medium leading-none text-slate-300"
              >
                Show only policies requiring satisfactory survey
              </label>
            </div>
          </div>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-4 text-slate-300">Loading...</div>
            ) : filteredOrders?.length === 0 ? (
              <div className="text-center py-4 text-slate-400">
                No closed policies found
              </div>
            ) : (
              <div className="overflow-x-auto relative">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px] bg-slate-800 sticky left-0 text-slate-300">
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
                      <TableHead className="min-w-[120px] text-slate-300">
                        Broker Name
                      </TableHead>
                      <TableHead className="min-w-[120px] text-slate-300">
                        Insured Name
                      </TableHead>
                      <TableHead className="min-w-[140px] text-slate-300">
                        Product Type
                      </TableHead>
                      <TableHead className="min-w-[100px] text-slate-300">Premium</TableHead>
                      <TableHead className="min-w-[90px] text-slate-300">Order Date</TableHead>
                      <TableHead className="min-w-[90px] text-slate-300">
                        Last Updated
                      </TableHead>
                      {user?.department !== "Liability & Financial" && (
                        <TableHead className="min-w-[100px] text-slate-300">
                          Satisfactory Survey
                        </TableHead>
                      )}
                      <TableHead className="min-w-[120px] text-slate-300">Notes</TableHead>
                      <TableHead className="w-[70px] bg-slate-800 sticky right-0 shadow-[-8px_0_8px_-4px_rgba(0,0,0,0.2)] text-slate-300">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders?.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="bg-slate-800 sticky left-0 text-slate-200">
                          <Checkbox
                            checked={selectedOrders.includes(order.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedOrders([
                                  ...selectedOrders,
                                  order.id,
                                ]);
                              } else {
                                setSelectedOrders(
                                  selectedOrders.filter((id) => id !== order.id)
                                );
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-slate-200">{order.brokerName}</TableCell>
                        <TableCell className="text-slate-200">{order.insuredName}</TableCell>
                        <TableCell className="text-slate-200">
                          {(order as any).marineProductType ||
                            (order as any).productType}
                        </TableCell>
                        <TableCell className="text-slate-200">
                          {parseFloat(order.premium.toString()).toFixed(2)}{" "}
                          {order.currency}
                        </TableCell>
                        <TableCell className="text-slate-200">
                          {new Date(order.orderDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-slate-200">
                          {new Date(
                            (order as any).lastUpdated ||
                              (order as any).updatedAt
                          ).toLocaleDateString()}
                        </TableCell>
                        {user?.department !== "Liability & Financial" && (
                          <TableCell className="text-slate-200">
                            {(order as any).requiresPreConditionSurvey
                              ? "Yes"
                              : "No"}
                          </TableCell>
                        )}
                        <TableCell>
                          {order.notes ? (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="h-auto p-0 gap-1 text-blue-400"
                                >
                                  <span className="truncate max-w-full text-left">
                                    {order.notes.substring(0, 15)}
                                    {order.notes.length > 15 ? "..." : ""}
                                  </span>
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[300px] p-4 bg-slate-800 border-white/10">
                                <p className="text-sm text-slate-200">{order.notes}</p>
                              </PopoverContent>
                            </Popover>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </TableCell>
                        <TableCell className="bg-slate-800 sticky right-0 shadow-[-8px_0_8px_-4px_rgba(0,0,0,0.2)]">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingOrder(order)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Delete Selected Closed Policies
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedOrders.length} selected
                closed policy/policies? This action cannot be undone.
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
        {user?.department === "Property & Engineering" && editingOrder ? (
          <PropertyEngineeringEditOrderDialog
            order={editingOrder as PropertyEngineeringOrder}
            open={!!editingOrder}
            onOpenChange={(open) => !open && setEditingOrder(null)}
          />
        ) : user?.department === "Liability & Financial" && editingOrder ? (
          <Dialog
            open={!!editingOrder}
            onOpenChange={(open) => {
              if (!open) {
                setEditingOrder(null);
              }
            }}
          >
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Edit Closed Policy</DialogTitle>
              </DialogHeader>
              <LiabilityOrderForm
                mode="edit"
                initialData={editingOrder as any}
                onSuccess={handleEditSuccess}
              />
            </DialogContent>
          </Dialog>
        ) : (
          <Dialog
            open={!!editingOrder}
            onOpenChange={(open) => {
              if (!open) {
                setEditingOrder(null);
              }
            }}
          >
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Edit Closed Policy</DialogTitle>
              </DialogHeader>
              <OrderForm
                mode="edit"
                initialData={editingOrder as Order}
                onSuccess={handleEditSuccess}
              />
            </DialogContent>
          </Dialog>
        )}
      </main>
      <ScrollToTop />
    </div>
  );
}
