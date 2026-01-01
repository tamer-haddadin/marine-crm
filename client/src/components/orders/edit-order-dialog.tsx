import { useState } from "react";
import { Order } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import OrderForm from "./order-form";
import { queryClient } from "@/lib/queryClient";

interface EditOrderDialogProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (response: { order: Order; hasMovedToClosed: boolean }) => void;
}

export default function EditOrderDialog({
  order,
  open,
  onOpenChange,
  onSuccess,
}: EditOrderDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSuccess = (response: {
    order: Order;
    hasMovedToClosed: boolean;
  }) => {
    // Immediately update the cache
    queryClient.setQueryData(
      ["/api/orders"],
      (oldData: Order[] | undefined) => {
        if (!oldData) return [response.order];
        return oldData.map((order) =>
          order.id === response.order.id ? response.order : order
        );
      }
    );

    // Call the success callback
    onSuccess?.(response);

    // Close the dialog
    onOpenChange(false);

    // Force a refetch to ensure consistency
    queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-32px)] max-w-[500px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-4 rounded-t-xl">
          <DialogTitle className="text-blue-800">Edit Firm Order</DialogTitle>
        </DialogHeader>
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-8rem)]">
          {order && (
            <OrderForm
              mode="edit"
              initialData={order}
              onSuccess={handleSuccess}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
