import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  insertLiabilityQuotationSchema,
  LiabilityQuotation,
} from "@shared/schema";
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
import {
  LIABILITY_PRODUCT_TYPES,
  CURRENCIES,
  QUOTATION_STATUSES,
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

interface LiabilityQuotationFormProps {
  onSuccess: () => void;
  mode?: "create" | "edit";
  initialData?: LiabilityQuotation;
}

export default function LiabilityQuotationForm({
  onSuccess,
  mode = "create",
  initialData,
}: LiabilityQuotationFormProps) {
  const { toast } = useToast();
  const form = useForm({
    resolver: zodResolver(insertLiabilityQuotationSchema),
    defaultValues: initialData
      ? {
          ...initialData,
          estimatedPremium: initialData.estimatedPremium.toString(),
          quotationDate: new Date(initialData.quotationDate)
            .toISOString()
            .split("T")[0],
        }
      : {
          brokerName: "",
          insuredName: "",
          productType: LIABILITY_PRODUCT_TYPES[0],
          estimatedPremium: "0",
          currency: CURRENCIES[0],
          quotationDate: new Date().toISOString().split("T")[0],
          status: QUOTATION_STATUSES[0],
          declineReason: "",
          notes: "",
        },
  });

  // Watch status
  const status = form.watch("status");

  // Set premium to 0 when status changes to Decline
  React.useEffect(() => {
    if (status === "Decline") {
      form.setValue("estimatedPremium", "0");
    }
  }, [status, form]);

  const createQuotationMutation = useMutation({
    mutationFn: async (data: any) => {
      const formData = {
        ...data,
        quotationDate: new Date(data.quotationDate).toISOString(),
        estimatedPremium: String(data.estimatedPremium),
        notes: data.notes || "",
        declineReason: data.declineReason || "",
      };
      const res = await apiRequest(
        "POST",
        "/api/liability/quotations",
        formData
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/liability/quotations"],
      });

      // If the quotation was created as confirmed, also invalidate orders
      if (form.getValues("status") === "Confirmed") {
        queryClient.invalidateQueries({
          queryKey: ["/api/liability/orders"],
        });
      }

      toast({
        title: "Success",
        description: "Liability quotation created successfully",
      });
      onSuccess();
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
    mutationFn: async (data: any) => {
      const formData = {
        ...data,
        quotationDate: new Date(data.quotationDate).toISOString(),
        estimatedPremium: String(data.estimatedPremium),
        notes: data.notes || "",
        declineReason: data.declineReason || "",
      };
      const res = await apiRequest(
        "PUT",
        `/api/liability/quotations/${initialData?.id}`,
        formData
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/liability/quotations"],
      });

      if (initialData?.id) {
        queryClient.invalidateQueries({
          queryKey: ["/api/liability/quotations", initialData.id],
        });
      }

      // If the quotation was confirmed, also invalidate orders since a new order was created
      if (form.getValues("status") === "Confirmed") {
        queryClient.invalidateQueries({
          queryKey: ["/api/liability/orders"],
        });
      }

      toast({
        title: "Success",
        description: "Liability quotation updated successfully",
      });
      onSuccess();
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
      updateQuotationMutation.mutate(data);
    } else {
      createQuotationMutation.mutate(data);
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
          name="estimatedPremium"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Estimated Premium</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  disabled={status === "Decline"}
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
              <Select onValueChange={field.onChange} defaultValue={field.value}>
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

        {status === "Decline" && (
          <FormField
            control={form.control}
            name="declineReason"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Decline Reason</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="Please provide the reason for declining"
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
            createQuotationMutation.isPending ||
            updateQuotationMutation.isPending
          }
        >
          {mode === "edit" ? "Update" : "Create"} Liability Quotation
        </Button>
      </form>
    </Form>
  );
}
