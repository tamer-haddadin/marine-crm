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
  insertPropertyEngineeringQuotationSchema,
  QUOTATION_STATUSES,
  CURRENCIES,
  ENGINEERING_PRODUCT_TYPES,
  PROPERTY_PRODUCT_TYPES,
} from "@shared/schema";
import type {
  InsertPropertyEngineeringQuotation,
  PropertyEngineeringQuotation,
} from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

interface PropertyEngineeringQuotationFormProps {
  onSuccess?: () => void;
  mode?: "create" | "edit";
  initialData?: PropertyEngineeringQuotation;
}

// Form data type that matches what the form expects (before schema transformation)
type FormData = {
  brokerName: string;
  insuredName: string;
  productType: string | undefined;
  coverGroup: string | undefined;
  estimatedPremium: string;
  currency: string;
  quotationDate: string;
  status: string;
  declineReason: string;
  notes: string;
  requiresPreConditionSurvey: boolean;
};

export default function PropertyEngineeringQuotationForm({
  onSuccess,
  mode = "create",
  initialData,
}: PropertyEngineeringQuotationFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [productTypeOpen, setProductTypeOpen] = React.useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(insertPropertyEngineeringQuotationSchema),
    defaultValues: initialData
      ? {
          brokerName: initialData.brokerName,
          insuredName: initialData.insuredName,
          productType: initialData.productType,
          coverGroup: initialData.coverGroup,
          estimatedPremium: initialData.estimatedPremium.toString(),
          currency: initialData.currency,
          quotationDate: new Date(initialData.quotationDate)
            .toISOString()
            .split("T")[0],
          status: initialData.status,
          declineReason: initialData.declineReason || "",
          notes: initialData.notes || "",
          requiresPreConditionSurvey:
            initialData.requiresPreConditionSurvey || false,
        }
      : {
          brokerName: "",
          insuredName: "",
          productType: undefined,
          coverGroup: undefined,
          estimatedPremium: "",
          currency: "AED",
          quotationDate: new Date().toISOString().split("T")[0],
          status: "Open",
          declineReason: "",
          notes: "",
          requiresPreConditionSurvey: false,
        },
  });

  const createQuotationMutation = useMutation({
    mutationFn: async (data: InsertPropertyEngineeringQuotation) => {
      // Convert estimatedPremium to string to match schema
      const payload = {
        ...data,
        estimatedPremium: String(data.estimatedPremium),
        declineReason: data.declineReason || null,
      };

      const response = await fetch("/api/property-engineering/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to create quotation");
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["/api/property-engineering/quotations"],
      });

      // If the quotation was confirmed, also invalidate orders since a new order was created
      if (form.getValues("status") === "Confirmed") {
        queryClient.invalidateQueries({
          queryKey: ["/api/property-engineering/orders"],
        });
      }

      toast({
        title: "Success",
        description: "Property & Engineering quotation created successfully.",
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

  const updateQuotationMutation = useMutation({
    mutationFn: async (data: InsertPropertyEngineeringQuotation) => {
      // Convert estimatedPremium to string to match schema
      const payload = {
        ...data,
        estimatedPremium: String(data.estimatedPremium),
        declineReason: data.declineReason || null,
      };

      const response = await fetch(
        `/api/property-engineering/quotations/${initialData?.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update quotation");
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["/api/property-engineering/quotations"],
      });

      // If the quotation was confirmed, also invalidate orders since a new order was created
      if (form.getValues("status") === "Confirmed") {
        queryClient.invalidateQueries({
          queryKey: ["/api/property-engineering/orders"],
        });
      }

      toast({
        title: "Success",
        description: "Property & Engineering quotation updated successfully.",
      });
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

  function onSubmit(data: InsertPropertyEngineeringQuotation) {
    if (mode === "edit" && initialData) {
      updateQuotationMutation.mutate(data);
    } else {
      createQuotationMutation.mutate(data);
    }
  }

  const selectedProductType = form.watch("productType");
  const status = form.watch("status");

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

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="productType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Product Type</FormLabel>
                <Popover
                  open={productTypeOpen}
                  onOpenChange={setProductTypeOpen}
                >
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
                                field.value === type
                                  ? "opacity-100"
                                  : "opacity-0"
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
                                field.value === type
                                  ? "opacity-100"
                                  : "opacity-0"
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
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="estimatedPremium"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estimated Premium</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Enter estimated premium"
                    {...field}
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
            name="quotationDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quotation Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {QUOTATION_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {status === "Decline" && (
          <FormField
            control={form.control}
            name="declineReason"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Decline Reason</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Enter reason for decline..."
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
        )}

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
          disabled={
            createQuotationMutation.isPending ||
            updateQuotationMutation.isPending
          }
        >
          {mode === "edit"
            ? updateQuotationMutation.isPending
              ? "Updating..."
              : "Update Quotation"
            : createQuotationMutation.isPending
            ? "Creating..."
            : "Create Quotation"}
        </Button>
      </form>
    </Form>
  );
}
