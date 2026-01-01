import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertLiabilityOrderSchema, LiabilityOrder } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  LIABILITY_PRODUCT_TYPES,
  CURRENCIES,
  BUSINESS_TYPES,
  ORDER_STATUSES,
} from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import React from "react";

interface LiabilityOrderFormProps {
  onSuccess: (response?: {
    order: LiabilityOrder;
    hasMovedToClosed: boolean;
  }) => void;
  mode?: "create" | "edit";
  initialData?: LiabilityOrder | null;
}

export default function LiabilityOrderForm({
  onSuccess,
  mode = "create",
  initialData,
}: LiabilityOrderFormProps) {
  const { toast } = useToast();
  const form = useForm({
    resolver: zodResolver(insertLiabilityOrderSchema),
    defaultValues: initialData
      ? {
          ...initialData,
          premium: initialData.premium.toString(),
          orderDate: new Date(initialData.orderDate)
            .toISOString()
            .split("T")[0],
          statuses: initialData.statuses || [],
        }
      : {
          brokerName: "",
          insuredName: "",
          productType: LIABILITY_PRODUCT_TYPES[0],
          businessType: BUSINESS_TYPES[0],
          premium: "0",
          currency: CURRENCIES[0],
          orderDate: new Date().toISOString().split("T")[0],
          statuses: ["Firm Order Received", "KYC Pending"],
          notes: "",
        },
  });

  const createOrderMutation = useMutation({
    mutationFn: async (data: any) => {
      const formData = {
        ...data,
        orderDate: new Date(data.orderDate).toISOString(),
        premium: String(data.premium),
        notes: data.notes || "",
      };
      const res = await apiRequest("POST", "/api/liability/orders", formData);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/liability/orders"] });
      toast({
        title: "Success",
        description: "Liability order created successfully",
      });
      onSuccess(data);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateOrderMutation = useMutation({
    mutationFn: async (data: any) => {
      const formData = {
        ...data,
        orderDate: new Date(data.orderDate).toISOString(),
        premium: String(data.premium),
        notes: data.notes || "",
      };
      const res = await apiRequest(
        "PUT",
        `/api/liability/orders/${initialData?.id}`,
        formData
      );
      return res.json();
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["/api/liability/orders"] });

      if (initialData?.id) {
        queryClient.invalidateQueries({
          queryKey: ["/api/liability/orders", initialData.id],
        });
      }

      toast({
        title: "Success",
        description: "Liability order updated successfully",
      });
      onSuccess(response);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: any) => {
    if (mode === "edit" && initialData) {
      updateOrderMutation.mutate(data);
    } else {
      createOrderMutation.mutate(data);
    }
  };

  const handleStatusChange = (status: string, checked: boolean) => {
    const currentStatuses = form.getValues("statuses") || [];
    if (checked) {
      form.setValue("statuses", [...currentStatuses, status]);
    } else {
      form.setValue(
        "statuses",
        currentStatuses.filter((s) => s !== status)
      );
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="brokerName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Broker Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="insuredName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Insured Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="productType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Liability Product Type</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a product type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="max-h-[300px]">
                  {LIABILITY_PRODUCT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="businessType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Business Type</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select business type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {BUSINESS_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="premium"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Premium</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  {...field}
                  onChange={(e) => {
                    const value = e.target.value;
                    field.onChange(value === "" ? "0" : value);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="currency"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Currency</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {CURRENCIES.map((currency) => (
                    <SelectItem key={currency} value={currency}>
                      {currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="orderDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Order Date</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="statuses"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Order Status</FormLabel>
              <div className="space-y-2">
                {[...ORDER_STATUSES, "Policy Issued"].map((status) => (
                  <div key={status} className="flex items-center space-x-2">
                    <Checkbox
                      id={`liability-status-${status}`}
                      checked={field.value?.includes(status) || false}
                      onCheckedChange={(checked) =>
                        handleStatusChange(status, checked as boolean)
                      }
                    />
                    <label
                      htmlFor={`liability-status-${status}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {status}
                    </label>
                  </div>
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea {...field} value={field.value || ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="w-full"
          disabled={
            createOrderMutation.isPending || updateOrderMutation.isPending
          }
        >
          {mode === "edit" ? "Update" : "Create"} Liability Order
        </Button>
      </form>
    </Form>
  );
}
