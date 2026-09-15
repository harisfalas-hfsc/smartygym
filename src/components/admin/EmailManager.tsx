import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmailComposer } from "./EmailComposer";
import { EmailTemplatesManager } from "./EmailTemplatesManager";
import { ScheduledEmailsManager } from "./ScheduledEmailsManager";
import { TestEmailSender } from "./TestEmailSender";
import { Mail, FileText, Calendar, Send } from "lucide-react";

export const EmailManager = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="w-5 h-5" />
          Email Campaigns
        </CardTitle>
        <CardDescription>
          Manage email templates, schedule automated emails, send mass emails, and test delivery
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="templates" className="w-full">
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
            <TabsList className="inline-flex w-auto min-w-full sm:grid sm:w-full sm:grid-cols-4 gap-1">
              <TabsTrigger value="templates" className="flex items-center gap-1 sm:gap-2 whitespace-nowrap text-xs sm:text-sm px-2 sm:px-3">
                <FileText className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Templates</span>
                <span className="sm:hidden">Temp.</span>
              </TabsTrigger>
              <TabsTrigger value="scheduled" className="flex items-center gap-1 sm:gap-2 whitespace-nowrap text-xs sm:text-sm px-2 sm:px-3">
                <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Scheduled</span>
                <span className="sm:hidden">Sched.</span>
              </TabsTrigger>
              <TabsTrigger value="mass" className="flex items-center gap-1 sm:gap-2 whitespace-nowrap text-xs sm:text-sm px-2 sm:px-3">
                <Mail className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Mass Email</span>
                <span className="sm:hidden">Mass</span>
              </TabsTrigger>
              <TabsTrigger value="test" className="flex items-center gap-1 sm:gap-2 whitespace-nowrap text-xs sm:text-sm px-2 sm:px-3">
                <Send className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Test Email</span>
                <span className="sm:hidden">Test</span>
              </TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="templates">
            <EmailTemplatesManager />
          </TabsContent>
          
          
          
          <TabsContent value="scheduled">
            <ScheduledEmailsManager />
          </TabsContent>
          
          <TabsContent value="mass">
            <EmailComposer />
          </TabsContent>
          
          <TabsContent value="test">
            <TestEmailSender />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
