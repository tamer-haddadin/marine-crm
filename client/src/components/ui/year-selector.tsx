import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Calendar, ChevronDown, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface YearResponse {
  year: number;
}

export function YearSelector() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingYear, setPendingYear] = useState<number | null>(null);

  // Fetch current active year
  const { data: yearData, isLoading } = useQuery<YearResponse>({
    queryKey: ["/api/settings/year"],
    queryFn: async () => {
      const response = await fetch("/api/settings/year", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch year");
      return response.json();
    },
  });

  // Mutation to change year
  const changeYearMutation = useMutation({
    mutationFn: async (year: number) => {
      const response = await fetch("/api/settings/year", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ year }),
      });
      if (!response.ok) throw new Error("Failed to set year");
      return response.json();
    },
    onSuccess: (_, year) => {
      // Invalidate all queries to refresh data for new year
      queryClient.invalidateQueries();
      toast({
        title: "Year Changed",
        description: `Active year changed to ${year}. All data will now be filtered for ${year}.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to change year. Please try again.",
        variant: "destructive",
      });
    },
  });

  const currentYear = yearData?.year || new Date().getFullYear();
  const availableYears = [2025, 2026, 2027]; // Can be extended

  const handleYearSelect = (year: number) => {
    if (year !== currentYear) {
      setPendingYear(year);
      setShowConfirmDialog(true);
    }
  };

  const confirmYearChange = () => {
    if (pendingYear) {
      changeYearMutation.mutate(pendingYear);
    }
    setShowConfirmDialog(false);
    setPendingYear(null);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 shadow-sm hover:shadow hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600"
            disabled={isLoading}
          >
            <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="font-semibold">{currentYear}</span>
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Select Year
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {availableYears.map((year) => (
            <DropdownMenuItem
              key={year}
              onClick={() => handleYearSelect(year)}
              className={`cursor-pointer ${
                year === currentYear
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                  : ""
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span>{year}</span>
                {year === currentYear && (
                  <span className="text-xs bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 px-2 py-0.5 rounded-full">
                    Active
                  </span>
                )}
              </div>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-gray-500 dark:text-gray-400 text-sm cursor-default"
            disabled
          >
            <RefreshCw className="h-3 w-3 mr-2" />
            Switch years to start fresh
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              Switch to {pendingYear}?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                You are about to switch the active year from{" "}
                <strong>{currentYear}</strong> to <strong>{pendingYear}</strong>.
              </p>
              <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>What happens when you switch:</strong>
                </p>
                <ul className="text-sm text-blue-700 dark:text-blue-300 mt-2 space-y-1 list-disc list-inside">
                  <li>All existing {currentYear} data will be preserved</li>
                  <li>Dashboard will show {pendingYear} data (starts empty)</li>
                  <li>New entries will be saved under {pendingYear}</li>
                  <li>You can switch back to {currentYear} anytime</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmYearChange}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Switch to {pendingYear}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}




