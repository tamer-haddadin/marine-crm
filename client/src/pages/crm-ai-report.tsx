import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import {
  FileDown,
  Loader2,
  ArrowLeft,
  Ship,
  FileText,
  MessageSquare,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { ScrollToTop } from "@/components/ui/scroll-to-top";

export default function CRMAIReport() {
  const { toast } = useToast();
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [instructions, setInstructions] = useState<string>("");
  const [queryKey, setQueryKey] = useState(0);

  const { data: analysis, isLoading } = useQuery({
    queryKey: [
      "/api/quotations/analyze",
      startDate?.toISOString(),
      endDate?.toISOString(),
      instructions,
      queryKey,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();

      // Format dates with precision to ensure server gets correct timestamps
      if (startDate) {
        // Create a new date to avoid mutating state
        const start = new Date(startDate);
        // Set to start of day in local timezone, then convert to ISO string
        start.setHours(0, 0, 0, 0);
        // Store the timezone offset before converting to ISO
        const tzOffset = start.getTimezoneOffset() * 60000;
        // Adjust the date to account for timezone - this preserves the local date
        const localISOTime =
          new Date(start.getTime() - tzOffset).toISOString().split("T")[0] +
          "T00:00:00.000Z";
        params.append("startDate", localISOTime);
        console.log("Sending start date (local midnight):", localISOTime);
      }

      if (endDate) {
        // Create a new date to avoid mutating state
        const end = new Date(endDate);
        // Set to end of day in local timezone, then convert to ISO string
        end.setHours(23, 59, 59, 999);
        // Store the timezone offset before converting to ISO
        const tzOffset = end.getTimezoneOffset() * 60000;
        // Adjust the date to account for timezone - this preserves the local date
        const localISOTime =
          new Date(end.getTime() - tzOffset).toISOString().split("T")[0] +
          "T23:59:59.999Z";
        params.append("endDate", localISOTime);
        console.log("Sending end date (local end of day):", localISOTime);
      }

      // Add instructions if provided
      if (instructions.trim()) {
        params.append("instructions", instructions.trim());
      }

      console.log("Sending date parameters for analysis:", {
        startDate: params.get("startDate"),
        endDate: params.get("endDate"),
        instructions: params.get("instructions"),
      });

      const response = await fetch(
        `/api/quotations/analyze?${params.toString()}`,
        {
          credentials: "include",
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Analysis request failed:", errorData);
        throw new Error(errorData.message || "Failed to fetch analysis");
      }

      const data = await response.json();
      return data.analysis;
    },
    enabled: Boolean(queryKey > 0),
    retry: 1,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Function to format text with bold headers
  const formatAnalysisText = (text: string) => {
    return text.split("\n").map((paragraph: string, index: number) => {
      // Check if the paragraph starts with a number followed by a dot (main section header)
      if (/^\d+\.\s[A-Z]/.test(paragraph.trim())) {
        return (
          <p key={index} className="mt-6 mb-4 text-lg text-gray-900 dark:text-white font-bold">
            {paragraph}
          </p>
        );
      }
      // Regular bullet points or content
      return (
        <p key={index} className="mb-3 text-gray-700 dark:text-slate-300 leading-relaxed">
          {paragraph}
        </p>
      );
    });
  };

  const downloadReport = () => {
    if (!analysis) return;

    // Format the content with proper styling and bold headers
    const content = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; padding: 40px; }
            h1 { color: #333; text-align: center; margin-bottom: 30px; }
            .date-range { color: #666; text-align: center; margin-bottom: 40px; }
            .content { text-align: justify; }
            .section-header { 
              font-weight: bold; 
              font-size: 1.1em;
              margin-top: 30px;
              margin-bottom: 15px;
              color: #333;
            }
            .text { 
              margin-bottom: 12px;
              color: #444;
            }
            .footer { margin-top: 40px; text-align: center; color: #666; }
          </style>
        </head>
        <body>
          <h1>Insurance Quotation Analysis Report</h1>
          <div class="date-range">
            ${
              startDate && endDate
                ? `Period: ${format(startDate, "dd MMM yyyy")} - ${format(
                    endDate,
                    "dd MMM yyyy"
                  )}`
                : "All Time Analysis"
            }
          </div>
          <div class="content">
            ${analysis
              .split("\n")
              .map((paragraph: string) => {
                if (/^\d+\.\s[A-Z]/.test(paragraph.trim())) {
                  return `<div class="section-header">${paragraph}</div>`;
                }
                return `<div class="text">${paragraph}</div>`;
              })
              .join("")}
          </div>
          <div class="footer">
            Generated on ${format(new Date(), "dd MMM yyyy HH:mm")}
          </div>
        </body>
      </html>
    `;

    // Create a Blob with HTML content
    const blob = new Blob([content], { type: "text/html" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const dateStr =
      startDate && endDate
        ? `_${format(startDate, "dd-MM-yyyy")}_to_${format(
            endDate,
            "dd-MM-yyyy"
          )}`
        : "";
    a.download = `crm-analysis${dateStr}.html`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    toast({
      title: "Success",
      description: "Analysis report has been downloaded.",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <header className="bg-white dark:bg-gray-800 shadow-md border-b dark:border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Ship className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Insurance CRM Management
              </h1>
            </div>
            <Link href="/">
              <Button variant="outline" size="sm" className="gap-2 shadow-sm hover:shadow dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                Insurance Quotation Analysis Report
              </h2>
              <p className="mt-2 text-gray-600 dark:text-slate-400">
                Generate AI-powered insights from your quotation data
              </p>
            </div>
            {analysis && (
              <Button
                onClick={downloadReport}
                className="bg-primary hover:bg-primary/90"
              >
                <FileDown className="h-4 w-4 mr-2" />
                Download HTML Report
              </Button>
            )}
          </div>

          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                Analysis Configuration
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-slate-400">
                Configure your analysis parameters and custom instructions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label
                  htmlFor="date-range"
                  className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-3 block"
                >
                  Date Range Selection
                </Label>
              <div className="flex items-center gap-4">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-[200px] justify-start text-left font-normal"
                    >
                      {startDate
                        ? format(startDate, "PPP")
                        : "Select start date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-[200px] justify-start text-left font-normal"
                    >
                      {endDate ? format(endDate, "PPP") : "Select end date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                {(startDate || endDate) && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setStartDate(undefined);
                      setEndDate(undefined);
                        setQueryKey(0); // Clear analysis
                    }}
                  >
                      Reset Dates
                    </Button>
                  )}

                  {((startDate && endDate && startDate <= endDate) ||
                    instructions.trim()) && (
                    <Button
                      onClick={() => {
                        // Validate that we have either valid dates or instructions
                        if (
                          !(
                            (startDate && endDate && startDate <= endDate) ||
                            instructions.trim()
                          )
                        ) {
                          return;
                        }
                        setQueryKey((prev) => prev + 1); // Force new query
                      }}
                      className="bg-gradient-to-r from-gray-800 to-black hover:from-black hover:to-gray-900 text-white font-semibold px-6 py-2.5 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-md"
                      disabled={
                        isLoading ||
                        !(
                          (startDate && endDate && startDate <= endDate) ||
                          instructions.trim()
                        )
                      }
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                          <span>Generating Analysis...</span>
                        </>
                      ) : (
                        <>
                          <FileText className="h-5 w-5 mr-2" />
                          <span>
                            {analysis
                              ? "Generate New Report"
                              : "Generate Report"}
                          </span>
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>

              <div>
                <Label
                  htmlFor="instructions"
                  className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-3 block"
                >
                  <MessageSquare className="h-4 w-4 inline mr-2" />
                  Custom Instructions for AI Analysis
                </Label>
                <Textarea
                  id="instructions"
                  placeholder="Enter specific instructions for the AI analysis (e.g., 'Focus only on Marine Cargo quotations', 'Analyze broker performance trends', 'Compare premium rates by product type')..."
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  className="min-h-[100px] resize-none bg-gray-50 dark:bg-white/10 border-gray-300 dark:border-white/20 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-slate-500"
                />
                <div className="flex justify-between items-center mt-2">
                  <p className="text-xs text-gray-500 dark:text-slate-500">
                    Provide specific instructions to customize the AI analysis.
                    Leave empty for standard analysis.
                  </p>
                  {instructions && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setInstructions("");
                        setQueryKey(0); // Clear analysis
                      }}
                      className="text-xs h-6 px-2"
                    >
                      Clear Instructions
                  </Button>
                  )}
                </div>
                {instructions && (
                  <p className="text-xs text-blue-600 mt-1">
                    Custom instructions will be applied to the analysis.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {isLoading ? (
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm">
              <CardContent className="flex justify-center items-center py-8">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
                  <p className="text-sm text-gray-600 dark:text-slate-400">
                    Generating analysis...
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : analysis ? (
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                  Analysis Results
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-slate-400">
                  AI-generated insights for the selected date range
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  {formatAnalysisText(analysis)}
                </div>
              </CardContent>
            </Card>
          ) : (startDate && endDate) || instructions.trim() ? (
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm">
              <CardContent className="py-8">
                <div className="text-center">
                  <FileText className="mx-auto h-12 w-12 text-gray-400 dark:text-slate-500" />
                  <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
                    Ready to Generate Report
                  </h3>
                  <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
                    {startDate && endDate
                      ? 'Click "Generate Report" to analyze data for the selected date range'
                      : 'Click "Generate Report" to analyze all data with your custom instructions'}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm">
              <CardContent className="py-8">
                <div className="text-center">
                  <FileText className="mx-auto h-12 w-12 text-gray-400 dark:text-slate-500" />
                  <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
                    Select Date Range
                  </h3>
                  <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
                    Choose start and end dates to generate your analysis report
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      <ScrollToTop />
    </div>
  );
}
