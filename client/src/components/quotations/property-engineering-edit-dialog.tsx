import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import PropertyEngineeringQuotationForm from "./property-engineering-quotation-form";
import type { PropertyEngineeringQuotation } from "@shared/schema";
import { Building2 } from "lucide-react";

interface PropertyEngineeringEditDialogProps {
  quotation: PropertyEngineeringQuotation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PropertyEngineeringEditDialog({
  quotation,
  open,
  onOpenChange,
}: PropertyEngineeringEditDialogProps) {
  if (!quotation) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="bg-gradient-to-r from-green-50 to-green-100 px-6 py-4 rounded-t-xl">
          <DialogTitle className="text-green-800 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-green-600" />
            Edit Property & Engineering Quotation
          </DialogTitle>
        </DialogHeader>
        <div className="p-6 overflow-y-auto max-h-[calc(95vh-8rem)]">
          <PropertyEngineeringQuotationForm
            mode="edit"
            initialData={quotation}
            onSuccess={() => onOpenChange(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
