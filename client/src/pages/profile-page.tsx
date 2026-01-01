import { useAuth } from "@/hooks/use-auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Mail,
  Shield,
  Calendar,
  Edit,
  ArrowLeft,
} from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";

export default function ProfilePage() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen dark:bg-gray-900">
        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  const getInitials = (username: string) => {
    return username
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getDepartmentColor = (department: string) => {
    switch (department) {
      case "Marine":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "Property & Engineering":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "Liability & Financial":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Profile
            </h1>
            <p className="text-muted-foreground dark:text-gray-400">
              Manage your account information
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
          {/* Profile Overview Card */}
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start">
                <div className="flex items-center space-x-4">
                  <Avatar className="h-20 w-20 dark:bg-gray-700">
                    <AvatarFallback className="text-2xl dark:bg-gray-700 dark:text-gray-200">
                      {getInitials(user.username)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-2xl dark:text-white">
                      {user.username}
                    </CardTitle>
                    <CardDescription>
                      <Badge
                        className={getDepartmentColor(
                          user.department || "Marine"
                        )}
                      >
                        {user.department || "Marine"} Department
                      </Badge>
                    </CardDescription>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Profile
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex items-center text-sm">
                    <Mail className="h-4 w-4 mr-2 text-muted-foreground dark:text-gray-500" />
                    <span className="text-muted-foreground dark:text-gray-400">
                      Email:
                    </span>
                    <span className="ml-2 font-medium dark:text-gray-200">
                      {user.username}@example.com
                    </span>
                  </div>
                  <div className="flex items-center text-sm">
                    <Building2 className="h-4 w-4 mr-2 text-muted-foreground dark:text-gray-500" />
                    <span className="text-muted-foreground dark:text-gray-400">
                      Department:
                    </span>
                    <span className="ml-2 font-medium dark:text-gray-200">
                      {user.department || "Marine"}
                    </span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center text-sm">
                    <Shield className="h-4 w-4 mr-2 text-muted-foreground dark:text-gray-500" />
                    <span className="text-muted-foreground dark:text-gray-400">
                      Role:
                    </span>
                    <span className="ml-2 font-medium dark:text-gray-200">
                      Underwriter
                    </span>
                  </div>
                  <div className="flex items-center text-sm">
                    <Calendar className="h-4 w-4 mr-2 text-muted-foreground dark:text-gray-500" />
                    <span className="text-muted-foreground dark:text-gray-400">
                      Member Since:
                    </span>
                    <span className="ml-2 font-medium dark:text-gray-200">
                      {format(new Date(), "MMM yyyy")}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Activity Summary Card */}
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="dark:text-white">
                Activity Summary
              </CardTitle>
              <CardDescription className="dark:text-gray-400">
                Your recent activity in the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-muted rounded-lg dark:bg-gray-700">
                  <div className="text-2xl font-bold dark:text-white">24</div>
                  <div className="text-sm text-muted-foreground dark:text-gray-400">
                    Quotations Created
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 dark:text-gray-500">
                    This Month
                  </div>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg dark:bg-gray-700">
                  <div className="text-2xl font-bold dark:text-white">18</div>
                  <div className="text-sm text-muted-foreground dark:text-gray-400">
                    Orders Processed
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 dark:text-gray-500">
                    This Month
                  </div>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg dark:bg-gray-700">
                  <div className="text-2xl font-bold dark:text-white">92%</div>
                  <div className="text-sm text-muted-foreground dark:text-gray-400">
                    Conversion Rate
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 dark:text-gray-500">
                    Last 30 Days
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security Settings Card */}
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="dark:text-white">Security</CardTitle>
              <CardDescription className="dark:text-gray-400">
                Manage your security preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-medium dark:text-white">Password</div>
                  <div className="text-sm text-muted-foreground dark:text-gray-400">
                    Last changed 30 days ago
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600"
                >
                  Change Password
                </Button>
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-medium dark:text-white">
                    Two-Factor Authentication
                  </div>
                  <div className="text-sm text-muted-foreground dark:text-gray-400">
                    Add an extra layer of security
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600"
                >
                  Enable
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
