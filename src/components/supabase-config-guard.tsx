/**
 * Supabase Configuration Guard
 * 
 * Wraps the application and displays a friendly configuration
 * prompt when Supabase credentials are missing.
 */

import { AlertCircle, ExternalLink } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isSupabaseConfigured, SUPABASE_CONFIG_ERROR } from "@/lib/supabase";

interface SupabaseConfigGuardProps {
  children: React.ReactNode;
}

export function SupabaseConfigGuard({ children }: SupabaseConfigGuardProps) {
  // If Supabase is configured, render the app normally
  if (isSupabaseConfigured) {
    return <>{children}</>;
  }

  // Otherwise, show configuration instructions
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-6 w-6 text-destructive" />
            <CardTitle>{SUPABASE_CONFIG_ERROR.title}</CardTitle>
          </div>
          <CardDescription>{SUPABASE_CONFIG_ERROR.message}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTitle>Setup Instructions</AlertTitle>
            <AlertDescription>
              <ol className="list-decimal list-inside space-y-2 mt-2">
                {SUPABASE_CONFIG_ERROR.instructions.map((instruction, i) => (
                  <li key={i} className="text-sm">
                    {instruction}
                  </li>
                ))}
              </ol>
            </AlertDescription>
          </Alert>

          <div className="flex flex-col gap-2 pt-4">
            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-4 w-4" />
              Open Supabase Dashboard
            </a>
            <a
              href="https://supabase.com/docs/guides/getting-started"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:underline"
            >
              <ExternalLink className="h-4 w-4" />
              Supabase Getting Started Guide
            </a>
          </div>

          <div className="mt-6 p-4 bg-muted rounded-lg">
            <p className="text-sm font-medium mb-2">Example .env.local:</p>
            <pre className="text-xs bg-background p-3 rounded overflow-x-auto">
              {`VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Server-only (optional, for admin operations)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
