import { Badge } from "@/components/ui/badge";
import { Order } from "@shared/schema";

const statusColors: Record<string, { bg: string; text: string }> = {
  "Firm Order Received": { bg: "bg-blue-100", text: "text-blue-800" },
  "COI Issued": { bg: "bg-yellow-100", text: "text-yellow-800" },
  "KYC Pending": { bg: "bg-red-100", text: "text-red-800" },
  "KYC Completed": { bg: "bg-green-100", text: "text-green-800" },
  "Policy Issued": { bg: "bg-purple-100", text: "text-purple-800" },
};

export default function OrderStatus({ order }: { order: Order }) {
  return (
    <div className="space-y-1">
      <div className="flex flex-col gap-1">
        {order.statuses.map((status) => (
          <Badge
            key={status}
            variant="secondary"
            className={`${statusColors[status]?.bg} ${statusColors[status]?.text} w-fit`}
          >
            {status}
          </Badge>
        ))}
      </div>
    </div>
  );
}
