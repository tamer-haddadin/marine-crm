import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Moon,
  Sun,
  Monitor,
  Bell,
  Download,
  Globe,
  Palette,
  ArrowLeft,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

export default function SettingsPage() {
  const { toast } = useToast();
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [notifications, setNotifications] = useState({
    email: true,
    desktop: false,
    newQuotations: true,
    orderUpdates: true,
    reportReady: true,
  });
  const [language, setLanguage] = useState("en");
  const [dateFormat, setDateFormat] = useState("dd/MM/yyyy");
  const [autoExport, setAutoExport] = useState(false);

  // Load theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as
      | "light"
      | "dark"
      | "system"
      | null;
    if (savedTheme) {
      setTheme(savedTheme);
      applyTheme(savedTheme);
    }
  }, []);

  const applyTheme = (selectedTheme: "light" | "dark" | "system") => {
    const root = window.document.documentElement;

    if (selectedTheme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";
      root.classList.toggle("dark", systemTheme === "dark");
    } else {
      root.classList.toggle("dark", selectedTheme === "dark");
    }

    localStorage.setItem("theme", selectedTheme);
  };

  const handleThemeChange = (value: "light" | "dark" | "system") => {
    setTheme(value);
    applyTheme(value);
    toast({
      title: "Theme updated",
      description: `Theme has been changed to ${value} mode`,
    });
  };

  const handleNotificationToggle = (key: keyof typeof notifications) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSaveSettings = () => {
    // Save settings to localStorage or backend
    localStorage.setItem("notifications", JSON.stringify(notifications));
    localStorage.setItem("language", language);
    localStorage.setItem("dateFormat", dateFormat);
    localStorage.setItem("autoExport", String(autoExport));

    toast({
      title: "Settings saved",
      description: "Your preferences have been saved successfully",
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Settings
            </h1>
            <p className="text-muted-foreground dark:text-gray-400">
              Manage your application preferences
            </p>
          </div>
          <Link href="/">
            <Button
              variant="outline"
              size="sm"
              className="dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>

        <div className="grid gap-6">
          {/* Appearance Settings */}
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 dark:text-white">
                <Palette className="h-5 w-5" />
                Appearance
              </CardTitle>
              <CardDescription className="dark:text-gray-400">
                Customize how the application looks
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label className="dark:text-gray-200">Theme</Label>
                <RadioGroup value={theme} onValueChange={handleThemeChange}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="light" id="light" />
                    <Label
                      htmlFor="light"
                      className="flex items-center gap-2 cursor-pointer dark:text-gray-200"
                    >
                      <Sun className="h-4 w-4" />
                      Light
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="dark" id="dark" />
                    <Label
                      htmlFor="dark"
                      className="flex items-center gap-2 cursor-pointer dark:text-gray-200"
                    >
                      <Moon className="h-4 w-4" />
                      Dark
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="system" id="system" />
                    <Label
                      htmlFor="system"
                      className="flex items-center gap-2 cursor-pointer dark:text-gray-200"
                    >
                      <Monitor className="h-4 w-4" />
                      System
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 dark:text-white">
                <Bell className="h-5 w-5" />
                Notifications
              </CardTitle>
              <CardDescription className="dark:text-gray-400">
                Configure how you receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label
                    htmlFor="email-notifications"
                    className="dark:text-gray-200"
                  >
                    Email Notifications
                  </Label>
                  <p className="text-sm text-muted-foreground dark:text-gray-400">
                    Receive notifications via email
                  </p>
                </div>
                <Switch
                  id="email-notifications"
                  checked={notifications.email}
                  onCheckedChange={() => handleNotificationToggle("email")}
                  className="data-[state=checked]:bg-primary"
                />
              </div>
              <Separator className="dark:bg-gray-700" />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label
                    htmlFor="desktop-notifications"
                    className="dark:text-gray-200"
                  >
                    Desktop Notifications
                  </Label>
                  <p className="text-sm text-muted-foreground dark:text-gray-400">
                    Show system notifications
                  </p>
                </div>
                <Switch
                  id="desktop-notifications"
                  checked={notifications.desktop}
                  onCheckedChange={() => handleNotificationToggle("desktop")}
                  className="data-[state=checked]:bg-primary"
                />
              </div>
              <Separator className="dark:bg-gray-700" />
              <div className="space-y-3">
                <Label className="dark:text-gray-200">Notification Types</Label>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="new-quotations"
                      className="font-normal dark:text-gray-300"
                    >
                      New Quotations
                    </Label>
                    <Switch
                      id="new-quotations"
                      checked={notifications.newQuotations}
                      onCheckedChange={() =>
                        handleNotificationToggle("newQuotations")
                      }
                      className="data-[state=checked]:bg-primary"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="order-updates"
                      className="font-normal dark:text-gray-300"
                    >
                      Order Status Updates
                    </Label>
                    <Switch
                      id="order-updates"
                      checked={notifications.orderUpdates}
                      onCheckedChange={() =>
                        handleNotificationToggle("orderUpdates")
                      }
                      className="data-[state=checked]:bg-primary"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="report-ready"
                      className="font-normal dark:text-gray-300"
                    >
                      Reports Ready
                    </Label>
                    <Switch
                      id="report-ready"
                      checked={notifications.reportReady}
                      onCheckedChange={() =>
                        handleNotificationToggle("reportReady")
                      }
                      className="data-[state=checked]:bg-primary"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Regional Settings */}
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 dark:text-white">
                <Globe className="h-5 w-5" />
                Regional
              </CardTitle>
              <CardDescription className="dark:text-gray-400">
                Language and format preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="language" className="dark:text-gray-200">
                  Language
                </Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger
                    id="language"
                    className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="ar">Arabic</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="date-format" className="dark:text-gray-200">
                  Date Format
                </Label>
                <Select value={dateFormat} onValueChange={setDateFormat}>
                  <SelectTrigger
                    id="date-format"
                    className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dd/MM/yyyy">DD/MM/YYYY</SelectItem>
                    <SelectItem value="MM/dd/yyyy">MM/DD/YYYY</SelectItem>
                    <SelectItem value="yyyy-MM-dd">YYYY-MM-DD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Export Settings */}
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 dark:text-white">
                <Download className="h-5 w-5" />
                Export
              </CardTitle>
              <CardDescription className="dark:text-gray-400">
                Configure automatic export settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-export" className="dark:text-gray-200">
                    Automatic Weekly Export
                  </Label>
                  <p className="text-sm text-muted-foreground dark:text-gray-400">
                    Automatically export reports every week
                  </p>
                </div>
                <Switch
                  id="auto-export"
                  checked={autoExport}
                  onCheckedChange={setAutoExport}
                  className="data-[state=checked]:bg-primary"
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              onClick={handleSaveSettings}
              className="dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
            >
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
