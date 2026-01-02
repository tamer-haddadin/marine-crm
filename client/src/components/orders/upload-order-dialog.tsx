import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UploadCloud, FileText, CalendarIcon } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const uploadSchema = z.object({
  brokerName: z.string().optional().transform((value) => value?.trim() || ""),
  businessType: z.enum(["New Business", "Renewal"]),
  orderDate: z.date({ required_error: "Please select a date" }),
  notes: z.string().optional().transform((value) => value?.trim() || ""),
  manualText: z.string().optional().transform((value) => value?.trim() || ""),
  quotationFile: z
    .any()
    .optional()
    .refine(
      (value) => {
        if (!value || (value instanceof File && value.size === 0)) return true;
        if (value instanceof File) {
          return value.size <= 10 * 1024 * 1024;
        }
        return true;
      },
      { message: "File size must be 10MB or less" },
    ),
}).superRefine((data, ctx) => {
  const hasFile = data.quotationFile instanceof File && data.quotationFile.size > 0;
  const hasText = Boolean(data.manualText);
  if (!hasFile && !hasText) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Upload a quotation file or paste the quotation text",
      path: ["manualText"],
    });
  }
});

interface UploadOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function UploadOrderDialog({ open, onOpenChange, onSuccess }: UploadOrderDialogProps) {
  const { toast } = useToast();
  const [generalError, setGeneralError] = useState<string | null>(null);

  const form = useForm<z.infer<typeof uploadSchema>>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      brokerName: "",
      businessType: "New Business",
      orderDate: new Date(),
      notes: "",
      manualText: "",
      quotationFile: undefined,
    },
  });

  useEffect(() => {
    if (!open) {
      form.reset();
      setGeneralError(null);
    }
  }, [open, form]);

  const uploadMutation = useMutation({
    mutationFn: async (values: z.infer<typeof uploadSchema>) => {
      const formData = new FormData();

      if (values.brokerName) {
        formData.append("brokerName", values.brokerName);
      }

      // Add business type and order date
      formData.append("businessType", values.businessType);
      formData.append("orderDate", values.orderDate.toISOString());

      if (values.notes) {
        formData.append("notes", values.notes);
      }

      const file = values.quotationFile;
      if (file instanceof File && file.size > 0) {
        formData.append("quotation", file, file.name);
      }

      if (!file || file.size === 0) {
        formData.append("text", values.manualText || "");
      }

      const response = await fetch("/api/orders/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => undefined);
        throw new Error(data?.message || "Failed to process quotation");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Firm order created",
        description: "Quotation details were populated automatically.",
      });
      onSuccess();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      setGeneralError(error.message);
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: z.infer<typeof uploadSchema>) => {
    setGeneralError(null);
    uploadMutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UploadCloud className="h-5 w-5" /> Upload Quotation
          </DialogTitle>
          <DialogDescription>
            Upload a quotation document or paste the quotation text. The firm order will be created automatically with statuses set to Firm Order Received and KYC Pending.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="brokerName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Broker Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter the broker name if missing from the quotation"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Business Type and Date Row */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="businessType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type of Business</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="New Business">New Business</SelectItem>
                        <SelectItem value="Renewal">Renewal</SelectItem>
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
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="quotationFile"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quotation File</FormLabel>
                  <FormControl>
                    <Input
                      type="file"
                      accept=".pdf,.txt,.csv,.doc,.docx,.rtf,.html"
                      onChange={(event) => {
                        const files = event.target.files;
                        field.onChange(files && files.length > 0 ? files[0] : undefined);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="text-xs text-muted-foreground -mt-2">
              PDF and text files are supported (10MB max). Leave empty if you prefer to paste the quotation text instead.
            </div>

            <FormField
              control={form.control}
              name="manualText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quotation Text (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Paste the quotation details here if you do not have a file"
                      className="min-h-[140px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Additional Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Optional notes to include with the firm order"
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Alert className="bg-purple-50 border-purple-200">
              <FileText className="h-4 w-4" />
              <AlertDescription className="mt-2 space-y-1 text-xs text-purple-900">
                <p>The marine product type, business type, premium, currency, date, and notes are extracted automatically.</p>
                <p>For Pleasure Boats or Jetski quotations, the yacht or jetski name will be added to the notes automatically.</p>
                <p>If the broker name is missing in the document, please supply it above.</p>
              </AlertDescription>
            </Alert>

            {generalError && (
              <div className={cn("text-sm text-red-600", uploadMutation.isError && "pt-1")}>{generalError}</div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  form.reset();
                  setGeneralError(null);
                }}
                disabled={uploadMutation.isPending}
              >
                Reset
              </Button>
              <Button type="submit" disabled={uploadMutation.isPending}>
                {uploadMutation.isPending ? "Processing…" : "Create Firm Order"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

