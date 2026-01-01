import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PropertyEngineeringOrder,
  BUSINESS_TYPES,
  CURRENCIES,
  ORDER_STATUSES,
  ENGINEERING_PRODUCT_TYPES,
  PROPERTY_PRODUCT_TYPES,
} from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import StatusDisplay from "./status-display";

interface PropertyEngineeringEditOrderDialogProps {
  order: PropertyEngineeringOrder;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PropertyEngineeringEditOrderDialog({
  order,
  open,
  onOpenChange,
}: PropertyEngineeringEditOrderDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    brokerName: order.brokerName,
    insuredName: order.insuredName,
    productType: order.productType,
    businessType: order.businessType,
    premium: order.premium,
    currency: order.currency,
    statuses: order.statuses,
    notes: order.notes || "",
    requiresPreConditionSurvey: order.requiresPreConditionSurvey,
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `/api/property-engineering/orders/${order.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...formData,
            premium: String(formData.premium),
          }),
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update order");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/property-engineering/orders"],
      });

      // If the order status includes "Policy Issued", also invalidate the closed policies query
      if (formData.statuses.includes("Policy Issued")) {
        queryClient.invalidateQueries({
          queryKey: ["/api/property-engineering/orders", "Policy Issued"],
        });
      }

      toast({
        title: "Success",
        description: "Order updated successfully.",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleStatusToggle = (status: string) => {
    setFormData((prev) => ({
      ...prev,
      statuses: prev.statuses.includes(status)
        ? prev.statuses.filter((s) => s !== status)
        : [...prev.statuses, status],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="bg-gradient-to-r from-green-50 to-green-100 px-6 py-4 rounded-t-xl">
          <DialogTitle className="text-green-800">
            Edit Property & Engineering Order
          </DialogTitle>
        </DialogHeader>
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-8rem)]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateMutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="brokerName">Broker Name</Label>
                <Input
                  id="brokerName"
                  value={formData.brokerName}
                  onChange={(e) =>
                    setFormData({ ...formData, brokerName: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="insuredName">Insured Name</Label>
                <Input
                  id="insuredName"
                  value={formData.insuredName}
                  onChange={(e) =>
                    setFormData({ ...formData, insuredName: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="productType">Product Type</Label>
              <Select
                value={formData.productType}
                onValueChange={(value) =>
                  setFormData({ ...formData, productType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Engineering Products
                  </div>
                  {ENGINEERING_PRODUCT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                  <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide border-t mt-2 pt-2">
                    Property Products
                  </div>
                  {PROPERTY_PRODUCT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="businessType">Business Type</Label>
                <Select
                  value={formData.businessType}
                  onValueChange={(value) =>
                    setFormData({ ...formData, businessType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BUSINESS_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="currency">Currency</Label>
                <Select
                  value={formData.currency}
                  onValueChange={(value) =>
                    setFormData({ ...formData, currency: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((currency) => (
                      <SelectItem key={currency} value={currency}>
                        {currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="premium">Premium</Label>
              <Input
                id="premium"
                type="number"
                step="0.01"
                value={formData.premium}
                onChange={(e) =>
                  setFormData({ ...formData, premium: e.target.value })
                }
                required
              />
            </div>

            <div>
              <Label>Order Status</Label>
              <div className="space-y-2 mt-2">
                {[...ORDER_STATUSES, "Policy Issued"].map((status) => (
                  <div key={status} className="flex items-center space-x-2">
                    <Checkbox
                      id={status}
                      checked={formData.statuses.includes(status)}
                      onCheckedChange={() => handleStatusToggle(status)}
                    />
                    <label
                      htmlFor={status}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {status}
                    </label>
                  </div>
                ))}
              </div>
              <div className="mt-2">
                <StatusDisplay statuses={formData.statuses} />
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="requiresPreConditionSurvey"
                checked={formData.requiresPreConditionSurvey}
                onCheckedChange={(checked) =>
                  setFormData({
                    ...formData,
                    requiresPreConditionSurvey: !!checked,
                  })
                }
              />
              <label
                htmlFor="requiresPreConditionSurvey"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Requires Satisfactory Survey
              </label>
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Updating..." : "Update Order"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
