import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { orderFormSchema, Order } from "@shared/schema";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  ORDER_STATUSES,
  MARINE_PRODUCT_TYPES,
  BUSINESS_TYPES,
  CURRENCIES,
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

interface OrderFormProps {
  onSuccess: (response: { order: Order; hasMovedToClosed: boolean }) => void;
  mode?: "create" | "edit";
  initialData?: Order | null;
}

export default function OrderForm({
  onSuccess,
  mode = "create",
  initialData,
}: OrderFormProps) {
  const { toast } = useToast();

  const form = useForm({
    resolver: zodResolver(orderFormSchema),
    defaultValues: initialData
      ? {
          ...initialData,
          premium: initialData.premium.toString(),
          orderDate: new Date(initialData.orderDate)
            .toISOString()
            .split("T")[0],
          requiresPreConditionSurvey: initialData.requiresPreConditionSurvey,
        }
      : {
          brokerName: "",
          insuredName: "",
          marineProductType: MARINE_PRODUCT_TYPES[0],
          businessType: BUSINESS_TYPES[0],
          premium: "",
          currency: CURRENCIES[0],
          orderDate: new Date().toISOString().split("T")[0],
          statuses: [ORDER_STATUSES[0]],
          notes: "",
          requiresPreConditionSurvey: false,
        },
  });

  const createOrderMutation = useMutation({
    mutationFn: async (data: any) => {
      const formData = {
        ...data,
        orderDate: new Date(data.orderDate).toISOString(),
        premium: String(data.premium),
        notes: data.notes || null,
      };
      const res = await apiRequest("POST", "/api/orders", formData);
      const responseData = await res.json();
      return { order: responseData, hasMovedToClosed: false };
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Success",
        description: "Firm order created successfully",
      });
      onSuccess(response);
    },
    onError: (error: Error) => {
      console.error("Order creation error:", error);
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
        notes: data.notes || null,
        brokerName: data.brokerName.trim(),
        insuredName: data.insuredName.trim(),
        marineProductType: data.marineProductType,
        businessType: data.businessType,
        currency: data.currency,
        statuses: data.statuses,
        requiresPreConditionSurvey: Boolean(data.requiresPreConditionSurvey),
      };

      const res = await apiRequest(
        "PUT",
        `/api/orders/${initialData?.id}`,
        formData
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to update order");
      }

      const responseData = await res.json();

      // Update both caches immediately
      ["/api/orders", ["/api/orders", "Policy Issued"]].forEach((queryKey) => {
        queryClient.setQueryData(queryKey, (oldData: Order[] | undefined) => {
          if (!oldData) return undefined;
          return oldData.map((order) =>
            order.id === initialData?.id
              ? {
                  ...responseData,
                  requiresPreConditionSurvey:
                    formData.requiresPreConditionSurvey,
                }
              : order
          );
        });
      });

      return {
        order: {
          ...responseData,
          requiresPreConditionSurvey: formData.requiresPreConditionSurvey,
        },
        hasMovedToClosed: false,
      };
    },
    onSuccess: (response) => {
      // Force a refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/orders", "Policy Issued"],
      });

      toast({
        title: "Success",
        description: "Order updated successfully",
      });

      onSuccess(response);
    },
    onError: (error: Error) => {
      console.error("Order update error:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: any) => {
    try {
      const formattedData = {
        ...data,
        premium: data.premium === "" ? "0" : data.premium,
        brokerName: data.brokerName.trim(),
        insuredName: data.insuredName.trim(),
        notes: data.notes?.trim() || null,
        requiresPreConditionSurvey: Boolean(data.requiresPreConditionSurvey),
      };

      if (mode === "edit" && initialData) {
        await updateOrderMutation.mutateAsync(formattedData);
      } else {
        await createOrderMutation.mutateAsync(formattedData);
      }
    } catch (error) {
      console.error("Form submission error:", error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="marineProductType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Marine Product Type</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a product type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {MARINE_PRODUCT_TYPES.map((type) => (
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
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
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
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    onBlur={(e) => {
                      const value = e.target.value;
                      if (value) {
                        field.onChange(parseFloat(value).toFixed(2));
                      }
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
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
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
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="orderDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Firm Order Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="requiresPreConditionSurvey"
            render={({ field }) => (
              <FormItem className="flex flex-col justify-end h-full">
                <div className="flex flex-row items-center space-x-3 pt-8">
                  <FormControl>
                    <Checkbox
                      checked={field.value === true}
                      onCheckedChange={(checked) => {
                        field.onChange(checked === true);
                      }}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Requires Satisfactory Survey</FormLabel>
                  </div>
                </div>
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="statuses"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Statuses</FormLabel>
              <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-2">
                {[...ORDER_STATUSES, "Policy Issued"].map((status) => (
                  <FormField
                    key={status}
                    control={form.control}
                    name="statuses"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value?.includes(status)}
                            onCheckedChange={(checked) => {
                              return checked
                                ? field.onChange([...field.value, status])
                                : field.onChange(
                                    field.value?.filter(
                                      (value) => value !== status
                                    )
                                  );
                            }}
                          />
                        </FormControl>
                        <FormLabel className="font-normal">{status}</FormLabel>
                      </FormItem>
                    )}
                  />
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
          {mode === "edit" ? "Update" : "Create"} Firm Order
        </Button>
      </form>
    </Form>
  );
}
