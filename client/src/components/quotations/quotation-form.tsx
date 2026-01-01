import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertQuotationSchema, Quotation } from "@shared/schema";
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
  MARINE_PRODUCT_TYPES,
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
import React, { useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { UploadCloud } from "lucide-react";
import { QuotationUploadSheet } from "./quotation-upload-sheet";

interface QuotationFormProps {
  onSuccess: () => void;
  mode?: "create" | "edit";
  initialData?: Quotation;
}

export default function QuotationForm({
  onSuccess,
  mode = "create",
  initialData,
}: QuotationFormProps) {
  const { toast } = useToast();
  const [uploadSheetOpen, setUploadSheetOpen] = useState(false);
  const [extractedData, setExtractedData] = useState<Record<string, any> | null>(null);

  const form = useForm({
    resolver: zodResolver(insertQuotationSchema),
    defaultValues: initialData
      ? {
          ...initialData,
          estimatedPremium: initialData.estimatedPremium.toString(),
          quotationDate: new Date(initialData.quotationDate)
            .toISOString()
            .split("T")[0],
          requiresPreConditionSurvey:
            initialData.requiresPreConditionSurvey || false,
        }
      : {
          brokerName: "",
          insuredName: "",
          marineProductType: MARINE_PRODUCT_TYPES[0],
          estimatedPremium: "0",
          currency: CURRENCIES[0],
          quotationDate: new Date().toISOString().split("T")[0],
          status: QUOTATION_STATUSES[0],
          declineReason: "",
          notes: "",
          requiresPreConditionSurvey: false,
        },
  });

  useEffect(() => {
    if (extractedData) {
      const currentValues = form.getValues();
      const updatedValues = {
        ...currentValues,
        ...Object.entries(extractedData).reduce((acc, [key, value]) => {
          if (value === undefined || value === null) return acc;
          switch (key) {
            case "estimatedPremium":
              return { ...acc, estimatedPremium: String(value) };
            case "quotationDate":
              return {
                ...acc,
                quotationDate: new Date(String(value)).toISOString().split("T")[0],
              };
            case "requiresPreConditionSurvey":
              return { ...acc, requiresPreConditionSurvey: Boolean(value) };
            default:
              return { ...acc, [key]: value };
          }
        }, {} as Record<string, any>),
      };

      form.reset(updatedValues);
      setExtractedData(null);
    }
  }, [extractedData, form]);

  // Watch both status and marine product type
  const status = form.watch("status");
  const marineProductType = form.watch("marineProductType");

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
      const res = await apiRequest("POST", "/api/quotations", formData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
      toast({
        title: "Success",
        description: "Quotation created successfully",
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
        `/api/quotations/${initialData?.id}`,
        formData
      );
      return res.json();
    },
    onSuccess: () => {
      // Invalidate all related queries to ensure UI updates
      queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
      // Also invalidate any specific quotation query if it exists
      if (initialData?.id) {
        queryClient.invalidateQueries({
          queryKey: ["/api/quotations", initialData.id],
        });
      }
      // Invalidate analysis queries if they exist
      queryClient.invalidateQueries({ queryKey: ["/api/quotations/analyze"] });

      toast({
        title: "Success",
        description: "Quotation updated successfully",
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
                <div className="flex gap-2">
                  <Input {...field} />
                  {mode === "create" && (
                    <Button
                      type="button"
                      variant="secondary"
                      className="gap-2 whitespace-nowrap"
                      onClick={() => setUploadSheetOpen(true)}
                    >
                      <UploadCloud className="h-4 w-4" /> Process
                    </Button>
                  )}
                </div>
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
          name="marineProductType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Marine Product Type</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
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

        {marineProductType === "Pleasure Boats" && (
          <FormField
            control={form.control}
            name="requiresPreConditionSurvey"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-3 space-y-0">
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
          {mode === "edit" ? "Update" : "Create"} Quotation
        </Button>
      </form>

      {mode === "create" && (
        <QuotationUploadSheet
          open={uploadSheetOpen}
          onOpenChange={setUploadSheetOpen}
          onClose={() => setUploadSheetOpen(false)}
          onExtract={(data) => setExtractedData(data)}
        />
      )}
    </Form>
  );
}
