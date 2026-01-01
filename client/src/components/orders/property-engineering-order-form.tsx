import React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import { Check, ChevronDown } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  insertPropertyEngineeringOrderSchema,
  PROPERTY_ENGINEERING_PRODUCT_TYPES,
  BUSINESS_TYPES,
  CURRENCIES,
  ORDER_STATUSES,
  ENGINEERING_PRODUCT_TYPES,
  PROPERTY_PRODUCT_TYPES,
} from "@shared/schema";
import type { InsertPropertyEngineeringOrder } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

interface PropertyEngineeringOrderFormProps {
  onSuccess?: () => void;
}

// Form input type (before transformation)
type FormInputs = {
  brokerName: string;
  insuredName: string;
  productType?: PropertyEngineeringProductType;
  coverGroup?: "ENGINEERING" | "PROPERTY";
  businessType: BusinessType;
  premium: string;
  currency: Currency;
  orderDate: string;
  statuses: OrderStatus[];
  notes: string;
  requiresPreConditionSurvey: boolean;
};

import type {
  PropertyEngineeringProductType,
  BusinessType,
  Currency,
  OrderStatus,
} from "@shared/schema";

export default function PropertyEngineeringOrderForm({
  onSuccess,
}: PropertyEngineeringOrderFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [productTypeOpen, setProductTypeOpen] = React.useState(false);

  const form = useForm<FormInputs>({
    resolver: zodResolver(insertPropertyEngineeringOrderSchema),
    defaultValues: {
      brokerName: "",
      insuredName: "",
      productType: undefined,
      coverGroup: undefined,
      businessType: "New Business",
      premium: "",
      currency: "AED",
      orderDate: new Date().toISOString().split("T")[0],
      statuses: ["Firm Order Received"],
      notes: "",
      requiresPreConditionSurvey: false,
    },
  });

  const createOrderMutation = useMutation({
    mutationFn: async (data: FormInputs) => {
      // Ensure premium is sent as a string
      const payload = {
        ...data,
        premium: String(data.premium),
      };

      const response = await fetch("/api/property-engineering/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to create order");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/property-engineering/orders"],
      });
      toast({
        title: "Success",
        description: "Property & Engineering order created successfully.",
      });
      form.reset();
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  function onSubmit(data: FormInputs) {
    createOrderMutation.mutate(data);
  }

  const selectedProductType = form.watch("productType");

  // Determine cover group based on selected product type
  const determineCoverGroup = (productType: string) => {
    if (ENGINEERING_PRODUCT_TYPES.includes(productType as any)) {
      return "ENGINEERING";
    } else if (PROPERTY_PRODUCT_TYPES.includes(productType as any)) {
      return "PROPERTY";
    }
    return undefined;
  };

  // Update cover group when product type changes
  React.useEffect(() => {
    if (selectedProductType) {
      const coverGroup = determineCoverGroup(selectedProductType);
      if (coverGroup) {
        form.setValue("coverGroup", coverGroup);
      }
    }
  }, [selectedProductType, form]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="brokerName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Broker Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter broker name" {...field} />
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
                  <Input placeholder="Enter insured name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="productType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Product Type</FormLabel>
              <Popover open={productTypeOpen} onOpenChange={setProductTypeOpen}>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={productTypeOpen}
                      className="w-full justify-between"
                    >
                      {field.value || "Select product type"}
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command className="h-[300px]">
                    <CommandInput placeholder="Search product types..." />
                    <CommandEmpty>No product type found.</CommandEmpty>
                    <CommandGroup className="max-h-[240px] overflow-y-auto">
                      <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Engineering Products
                      </div>
                      {ENGINEERING_PRODUCT_TYPES.map((type) => (
                        <CommandItem
                          key={type}
                          onSelect={() => {
                            field.onChange(type);
                            setProductTypeOpen(false);
                          }}
                          className="cursor-pointer"
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${
                              field.value === type ? "opacity-100" : "opacity-0"
                            }`}
                          />
                          {type}
                        </CommandItem>
                      ))}
                      <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide border-t mt-2 pt-2">
                        Property Products
                      </div>
                      {PROPERTY_PRODUCT_TYPES.map((type) => (
                        <CommandItem
                          key={type}
                          onSelect={() => {
                            field.onChange(type);
                            setProductTypeOpen(false);
                          }}
                          className="cursor-pointer"
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${
                              field.value === type ? "opacity-100" : "opacity-0"
                            }`}
                          />
                          {type}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="businessType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Business Type</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
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
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Currency</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
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

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="premium"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Premium</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    placeholder="Enter premium amount"
                    {...field}
                    onChange={(e) => {
                      // Only allow numbers and decimal point
                      const value = e.target.value.replace(/[^0-9.]/g, "");
                      field.onChange(value);
                    }}
                  />
                </FormControl>
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
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Enter any additional notes..."
                  className="resize-none"
                  rows={3}
                  {...field}
                  value={field.value || ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="requiresPreConditionSurvey"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>Requires Satisfactory Survey</FormLabel>
              </div>
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="w-full"
          disabled={createOrderMutation.isPending}
        >
          {createOrderMutation.isPending ? "Creating..." : "Create Order"}
        </Button>
      </form>
    </Form>
  );
}
