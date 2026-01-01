import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UploadCloud, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

const uploadSchema = z.object({
  brokerName: z.string().optional().transform((value) => value?.trim() || ""),
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

interface QuotationUploadSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
  onExtract?: (quotation: Record<string, any>) => void;
}

export function QuotationUploadSheet({ open, onOpenChange, onClose, onExtract }: QuotationUploadSheetProps) {
  const { toast } = useToast();
  const [generalError, setGeneralError] = useState<string | null>(null);

  const form = useForm<z.infer<typeof uploadSchema>>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      brokerName: "",
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
      if (values.notes) {
        formData.append("notes", values.notes);
      }

      const file = values.quotationFile;
      if (file instanceof File && file.size > 0) {
        formData.append("quotation", file, file.name);
      }

      if (!file || file.size === 0) {
        formData.append("manualText", values.manualText || "");
      }

      const response = await fetch("/api/quotations/extract", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => undefined);
        throw new Error(data?.message || "Failed to extract quotation");
      }

      return response.json();
    },
    onSuccess: async (quotation) => {
      onExtract?.(quotation);
      toast({
        title: "Quotation processed",
        description: "The quotation details were extracted successfully.",
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
      onClose();
      onOpenChange(false);
      form.reset();
      setGeneralError(null);
      return quotation;
    },
    onError: (error: Error) => {
      setGeneralError(error.message);
      toast({
        title: "Processing failed",
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:w-[540px] max-h-[100vh] overflow-y-auto">
        <SheetHeader className="space-y-2 text-left sticky top-0 bg-background z-10 pb-4">
          <SheetTitle className="flex items-center gap-2">
            <UploadCloud className="h-5 w-5" /> Process Quotation
          </SheetTitle>
          <SheetDescription>
            Upload a quotation document or paste the quotation text. Fields will be extracted automatically.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 pb-6">
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
                        placeholder="Optional override if broker is missing in the document"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                        placeholder="Optional notes to add to the quotation"
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
                  <p>The insured name, product type, premium, currency, date, status, and notes are extracted automatically.</p>
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
                  {uploadMutation.isPending ? "Processing…" : "Process Quotation"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </SheetContent>
    </Sheet>
  );
}

