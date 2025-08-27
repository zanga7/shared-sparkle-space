import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, Shield, Lock, AlertTriangle } from 'lucide-react';

export const SecurityFixSummary = () => {
  const securityFixes = [
    {
      issue: "Calendar Access Tokens Could Be Stolen by Hackers",
      severity: "critical",
      status: "fixed",
      description: "Enforced AES-256 encryption for all calendar tokens with owner-only access policies",
      impact: "Prevents token theft and unauthorized calendar access"
    },
    {
      issue: "Google Photos Tokens Could Be Stolen by Hackers", 
      severity: "critical",
      status: "fixed",
      description: "Implemented secure token encryption and restrictive RLS policies for Google Photos integrations",
      impact: "Protects private photo access from unauthorized users"
    },
    {
      issue: "User PIN Codes Could Be Cracked by Family Members",
      severity: "medium",
      status: "fixed",
      description: "Restricted PIN hash visibility to owners only through secure functions",
      impact: "Prevents family members from accessing each other's PIN hashes"
    },
    {
      issue: "Direct Token Database Access",
      severity: "high", 
      status: "fixed",
      description: "Replaced direct table access with secure functions that never expose raw tokens",
      impact: "Eliminates possibility of token exposure through database queries"
    }
  ];

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      default: return 'secondary';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-green-600" />
          Security Vulnerabilities Fixed
        </CardTitle>
        <CardDescription>
          Critical security issues have been resolved to protect your family's data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Security Alert Resolved:</strong> All critical token vulnerabilities have been fixed. Your calendar and Google Photos tokens are now encrypted and protected.
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          <h4 className="font-medium">Issues Resolved</h4>
          {securityFixes.map((fix, index) => (
            <div key={index} className="border rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h5 className="font-medium text-sm">{fix.issue}</h5>
                <div className="flex items-center gap-2">
                  <Badge variant={getSeverityColor(fix.severity)}>
                    {fix.severity}
                  </Badge>
                  <Badge variant="outline" className="text-green-600 border-green-200">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Fixed
                  </Badge>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{fix.description}</p>
              <p className="text-sm font-medium text-green-600">{fix.impact}</p>
            </div>
          ))}
        </div>

        <div className="space-y-3 pt-4 border-t">
          <h4 className="font-medium">Security Enhancements Implemented</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-center gap-2 p-3 border rounded-lg">
              <Lock className="h-4 w-4 text-green-600" />
              <span className="text-sm">Token Encryption Enforced</span>
            </div>
            <div className="flex items-center gap-2 p-3 border rounded-lg">
              <Shield className="h-4 w-4 text-green-600" />
              <span className="text-sm">Owner-Only Access Policies</span>
            </div>
            <div className="flex items-center gap-2 p-3 border rounded-lg">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">Secure API Functions</span>
            </div>
            <div className="flex items-center gap-2 p-3 border rounded-lg">
              <AlertTriangle className="h-4 w-4 text-green-600" />
              <span className="text-sm">Access Audit Logging</span>
            </div>
          </div>
        </div>

        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            <strong>Next Steps:</strong> Your application now follows security best practices. Existing tokens have been automatically encrypted, and all new integrations will use secure storage by default.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};