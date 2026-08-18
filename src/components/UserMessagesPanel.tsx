import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { MessageSquare, Mail, Paperclip, Download, Zap, User, Eye, EyeOff, Trash2, ExternalLink, CheckSquare, Square, Settings2 } from "lucide-react";
import { HTMLContent } from "@/components/ui/html-content";
import { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { NotificationPreferencesManager } from "@/components/NotificationPreferencesManager";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

// Strip noisy email-style formatting for the compact in-dashboard notification view.
// Keeps content text identical to the email but removes horizontal rules, empty
// paragraphs and runs of <br>/whitespace that create huge gaps on mobile.
const compactMessageHtml = (html: string): string => {
  if (!html) return '';
  return html
    .replace(/&nbsp;|\u00a0/gi, ' ')
    .replace(/<hr[^>]*>/gi, '')
    .replace(/<p\b[^>]*>\s*(?:<[^>]+>\s*)*[━─—–\-_\s]{8,}(?:\s*<\/[^>]+>)*\s*<\/p>/gi, '')
    .replace(/<(?:strong|b)\b[^>]*>\s*[━─—–\-_\s]{8,}\s*<\/(?:strong|b)>/gi, '')
    .replace(/<p[^>]*>\s*(?:<br\s*\/?>\s*)*<\/p>/gi, '')
    .replace(/(?:<br\s*\/?>\s*){2,}/gi, '<br />')
    .replace(/(\r?\n\s*){2,}/g, '\n')
    .trim();
};

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  category: string;
  status: string;
  created_at: string;
  read_at: string | null;
  response: string | null;
  responded_at: string | null;
  response_read_at: string | null;
  user_id: string | null;
  attachments: any[];
}

interface SystemMessage {
  id: string;
  message_type: string;
  subject: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

interface ContactMessageHistoryItem {
  id: string;
  contact_message_id: string;
  message_type: string;
  content: string;
  sender: string;
  created_at: string;
}

type ViewFilter = 'all' | 'unread';

const MESSAGE_TYPE_DESTINATIONS: Record<string, string> = {
  checkin_reminder: '/userdashboard?tab=checkins',
  weekly_activity_report: '/userdashboard?tab=logbook',
  motivational_weekly: '/userdashboard?tab=logbook&scroll=active-goals',
  goal_achievement: '/userdashboard?tab=logbook&scroll=active-goals',
  daily_ritual: '/daily-ritual',
  wod_notification: '/workout/wod',
  morning_notification: '/workout/wod',
  renewal_reminder: '/userdashboard?tab=account',
  renewal_thank_you: '/userdashboard?tab=account',
  cancellation: '/userdashboard?tab=account',
  subscription_expired: '/smarty-premium',
  payment_failed: '/userdashboard?tab=account',
  purchase_subscription: '/userdashboard?tab=account',
  purchase_workout: '/userdashboard?tab=purchases',
  purchase_program: '/userdashboard?tab=purchases',
  purchase_ritual: '/daily-ritual',
  purchase_shop_product: '/userdashboard?tab=purchases',
  purchase_thank_you: '/userdashboard?tab=purchases',
  first_purchase: '/userdashboard?tab=purchases',
  welcome: '/userdashboard',
  welcome_onboarding: '/userdashboard',
  reactivation: '/smarty-premium',
  announcement_new_workout: '/workout',
  announcement_new_program: '/trainingprogram',
  announcement_new_article: '/blog',
  announcement_update: '/userdashboard?tab=messages',
  announcement_new_service: '/userdashboard?tab=messages',
  announcement_special_offer: '/smarty-premium',
  announcement_event: '/userdashboard?tab=messages',
  program_delivered: '/userdashboard?tab=purchases',
  status_update: '/userdashboard?tab=messages',
  support: '/userdashboard?tab=messages',
  mass_notification: '/userdashboard?tab=messages',
  unified_announcement: '/userdashboard?tab=messages',
  corporate_member_added: '/userdashboard',
  corporate_subscription: '/corporate-admin',
};

export const UserMessagesPanel = () => {
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<{ id: string; type: 'system' | 'contact' } | null>(null);
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all');
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState('all');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [sendingReplyFor, setSendingReplyFor] = useState<string | null>(null);
  const [expandedSystemMessages, setExpandedSystemMessages] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const openLinkInternally = (link: string, messageType?: string) => {
    const destination = messageType ? MESSAGE_TYPE_DESTINATIONS[messageType] : null;
    if (destination) {
      navigate(destination);
      return;
    }
    try {
      const url = new URL(link, window.location.origin);
      const sameOrigin = url.origin === window.location.origin
        || /smartygym\.(com|lovable\.app|lovableproject\.com)$/i.test(url.hostname);
      if (sameOrigin) {
        navigate(url.pathname + url.search + url.hash);
        return;
      }
    } catch {
      // Leave malformed links to the browser fallback below.
    }
    window.location.href = link;
  };

  const { data: rawContactMessages = [], isLoading: contactLoading, refetch: refetchContact } = useQuery({
    queryKey: ['user-contact-messages'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('contact_messages')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: systemMessages = [], isLoading: systemLoading, refetch: refetchSystem } = useQuery({
    queryKey: ['user-system-messages'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('user_system_messages')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const contactMessageIds = useMemo(
    () => (rawContactMessages || []).map((message) => message.id),
    [rawContactMessages]
  );

  const { data: contactMessageHistory = [], isLoading: historyLoading, refetch: refetchHistory } = useQuery({
    queryKey: ['user-contact-message-history', contactMessageIds],
    enabled: contactMessageIds.length > 0,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('contact_message_history')
        .select('*')
        .in('contact_message_id', contactMessageIds)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as ContactMessageHistoryItem[];
    },
  });

  const contactMessages: ContactMessage[] = (rawContactMessages || []).map(msg => ({
    ...msg,
    attachments: Array.isArray(msg.attachments) ? msg.attachments : []
  }));

  const isLoading = contactLoading || systemLoading || historyLoading;

  const historyByContactId = useMemo(() => {
    return (contactMessageHistory || []).reduce<Record<string, ContactMessageHistoryItem[]>>((acc, item) => {
      if (!acc[item.contact_message_id]) acc[item.contact_message_id] = [];
      acc[item.contact_message_id].push(item);
      return acc;
    }, {});
  }, [contactMessageHistory]);

  const getTeamReplies = (message: ContactMessage) => {
    const historyReplies = (historyByContactId[message.id] || []).filter((item) => item.sender !== 'customer');
    const directResponse = message.response
      ? [{
          id: `direct-${message.id}`,
          contact_message_id: message.id,
          message_type: 'admin_response',
          content: message.response,
          sender: 'admin',
          created_at: message.responded_at || message.created_at,
        }]
      : [];

    return [...historyReplies, ...directResponse]
      .filter((reply, index, replies) => replies.findIndex((candidate) => candidate.content.trim() === reply.content.trim()) === index)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  };

  // Filter messages based on viewFilter
  const filteredSystemMessages = useMemo(() => {
    if (viewFilter === 'all') return systemMessages;
    return systemMessages.filter(m => !m.is_read);
  }, [systemMessages, viewFilter]);

  const filteredContactMessages = useMemo(() => {
    if (viewFilter === 'all') return contactMessages;
    return contactMessages.filter(m => (m.response || (historyByContactId[m.id] || []).some(item => item.sender !== 'customer')) && !m.response_read_at);
  }, [contactMessages, historyByContactId, viewFilter]);

  // Get visible messages based on active tab
  const visibleMessageIds = useMemo(() => {
    const ids = new Set<string>();
    if (activeTab === 'all' || activeTab === 'system') {
      filteredSystemMessages.forEach(m => ids.add(`system-${m.id}`));
    }
    if (activeTab === 'all' || activeTab === 'contact') {
      filteredContactMessages.forEach(m => ids.add(`contact-${m.id}`));
    }
    return ids;
  }, [activeTab, filteredSystemMessages, filteredContactMessages]);

  // Clean up selected messages that are no longer visible
  const validSelectedMessages = useMemo(() => {
    const valid = new Set<string>();
    selectedMessages.forEach(id => {
      if (visibleMessageIds.has(id)) {
        valid.add(id);
      }
    });
    return valid;
  }, [selectedMessages, visibleMessageIds]);

  const handleMessageClick = async (messageId: string, type: 'system' | 'contact') => {
    if (expandedMessages.has(messageId)) {
      setExpandedMessages(prev => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
      return;
    }

    setExpandedMessages(prev => new Set(prev).add(messageId));

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (type === 'system') {
      const message = systemMessages.find(m => m.id === messageId);
      if (message && !message.is_read) {
        await supabase
          .from('user_system_messages')
          .update({ is_read: true })
          .eq('id', messageId);
        
        refetchSystem();
        queryClient.invalidateQueries({ queryKey: ['unread-messages-count'] });
      }
    } else if (type === 'contact') {
      const message = contactMessages.find(m => m.id === messageId);
      const hasReply = message ? getTeamReplies(message).length > 0 : false;
      if (message && hasReply && !message.response_read_at) {
        try {
          const { error } = await supabase
            .from('contact_messages')
            .update({ response_read_at: new Date().toISOString() })
            .eq('id', messageId)
            .is('response_read_at', null);
          
          if (error) {
            console.error('[UserMessagesPanel] Mark contact message as read failed:', error);
            toast.error('Failed to mark message as read');
            return;
          }

          await refetchContact();
          await refetchHistory();
          queryClient.invalidateQueries({ queryKey: ['unread-messages-count'] });
        } catch (e: any) {
          console.error('[UserMessagesPanel] Unexpected error:', e);
          toast.error(e?.message || "Failed to mark message as read");
        }
      }
    }
  };

  const handleToggleRead = async (messageId: string, type: 'system' | 'contact', currentState: boolean) => {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('[UserMessagesPanel] Auth error in toggle:', authError);
      toast.error("Authentication failed. Please refresh and try again.");
      return;
    }

    try {
      if (type === 'system') {
        const { error } = await supabase
          .from('user_system_messages')
          .update({ is_read: !currentState })
          .eq('id', messageId);
        
        if (error) {
          console.error('[UserMessagesPanel] Toggle system message read state failed:', error);
          toast.error(`Failed to update: ${error.message || 'Unknown error'}`);
          return;
        }
        
        toast.success(!currentState ? "Message marked as read" : "Message marked as unread");
        refetchSystem();
      } else if (type === 'contact') {
        const { error } = await supabase
          .from('contact_messages')
          .update({ response_read_at: !currentState ? new Date().toISOString() : null })
          .eq('id', messageId);
        
        if (error) {
          console.error('[UserMessagesPanel] Toggle contact message read state failed:', error);
          toast.error(`Failed to update: ${error.message || 'Unknown error'}`);
          return;
        }
        
        toast.success(!currentState ? "Response marked as read" : "Response marked as unread");
        refetchContact();
        refetchHistory();
      }
      
      queryClient.invalidateQueries({ queryKey: ['unread-messages-count'] });
    } catch (e: any) {
      console.error('[UserMessagesPanel] Toggle read exception:', e);
      toast.error(e?.message || "Failed to update message status");
    }
  };

  const handleDeleteClick = (messageId: string, type: 'system' | 'contact') => {
    setMessageToDelete({ id: messageId, type });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!messageToDelete) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Authentication failed");
      return;
    }

    try {
      if (messageToDelete.type === 'system') {
        const { error } = await supabase
          .from('user_system_messages')
          .delete()
          .eq('id', messageToDelete.id)
          .eq('user_id', user.id);

        if (error) {
          console.error('[UserMessagesPanel] Delete system message failed:', error);
          toast.error(`Failed to delete: ${error.message}`);
          return;
        }

        toast.success("Message deleted");
        refetchSystem();
      } else if (messageToDelete.type === 'contact') {
        const { error } = await supabase
          .from('contact_messages')
          .delete()
          .eq('id', messageToDelete.id)
          .eq('user_id', user.id);

        if (error) {
          console.error('[UserMessagesPanel] Delete contact message failed:', error);
          toast.error(`Failed to delete: ${error.message}`);
          return;
        }

        toast.success("Message deleted");
        refetchContact();
      }

      queryClient.invalidateQueries({ queryKey: ['unread-messages-count'] });
    } catch (e: any) {
      console.error('[UserMessagesPanel] Delete exception:', e);
      toast.error(e?.message || "Failed to delete message");
    } finally {
      setDeleteDialogOpen(false);
      setMessageToDelete(null);
    }
  };

  // Selection handlers
  const handleSelectMessage = (messageKey: string, checked: boolean) => {
    setSelectedMessages(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(messageKey);
      } else {
        next.delete(messageKey);
      }
      return next;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedMessages(new Set(visibleMessageIds));
    } else {
      setSelectedMessages(new Set());
    }
  };

  const isAllSelected = visibleMessageIds.size > 0 && validSelectedMessages.size === visibleMessageIds.size;
  const isSomeSelected = validSelectedMessages.size > 0 && validSelectedMessages.size < visibleMessageIds.size;

  // Bulk action handlers
  const handleBulkMarkRead = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Authentication failed");
      return;
    }

    try {
      const systemIds: string[] = [];
      const contactIds: string[] = [];

      validSelectedMessages.forEach(key => {
        const dashIndex = key.indexOf('-');
        const type = key.substring(0, dashIndex);
        const id = key.substring(dashIndex + 1);
        if (type === 'system') {
          const msg = systemMessages.find(m => m.id === id);
          if (msg && !msg.is_read) systemIds.push(id);
        } else if (type === 'contact') {
          const msg = contactMessages.find(m => m.id === id);
          if (msg && getTeamReplies(msg).length > 0 && !msg.response_read_at) contactIds.push(id);
        }
      });

      if (systemIds.length === 0 && contactIds.length === 0) {
        toast.info("All selected messages are already read");
        return;
      }

      if (systemIds.length > 0) {
        const { error } = await supabase
          .from('user_system_messages')
          .update({ is_read: true })
          .in('id', systemIds);
        if (error) throw error;
      }

      if (contactIds.length > 0) {
        const { error } = await supabase
          .from('contact_messages')
          .update({ response_read_at: new Date().toISOString() })
          .in('id', contactIds);
        if (error) throw error;
      }

      toast.success(`Marked ${systemIds.length + contactIds.length} messages as read`);
      refetchSystem();
      refetchContact();
      setSelectedMessages(new Set());
      queryClient.invalidateQueries({ queryKey: ['unread-messages-count'] });
    } catch (e: any) {
      console.error('[UserMessagesPanel] Bulk mark read failed:', e);
      toast.error(e?.message || "Failed to mark messages as read");
    }
  };

  const handleBulkMarkUnread = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Authentication failed");
      return;
    }

    try {
      const systemIds: string[] = [];
      const contactIds: string[] = [];

      validSelectedMessages.forEach(key => {
        const dashIndex = key.indexOf('-');
        const type = key.substring(0, dashIndex);
        const id = key.substring(dashIndex + 1);
        if (type === 'system') {
          const msg = systemMessages.find(m => m.id === id);
          if (msg && msg.is_read) systemIds.push(id);
        } else if (type === 'contact') {
          const msg = contactMessages.find(m => m.id === id);
          if (msg && getTeamReplies(msg).length > 0 && msg.response_read_at) contactIds.push(id);
        }
      });

      if (systemIds.length === 0 && contactIds.length === 0) {
        toast.info("All selected messages are already unread");
        return;
      }

      if (systemIds.length > 0) {
        const { error } = await supabase
          .from('user_system_messages')
          .update({ is_read: false })
          .in('id', systemIds);
        if (error) throw error;
      }

      if (contactIds.length > 0) {
        const { error } = await supabase
          .from('contact_messages')
          .update({ response_read_at: null })
          .in('id', contactIds);
        if (error) throw error;
      }

      toast.success(`Marked ${systemIds.length + contactIds.length} messages as unread`);
      refetchSystem();
      refetchContact();
      setSelectedMessages(new Set());
      queryClient.invalidateQueries({ queryKey: ['unread-messages-count'] });
    } catch (e: any) {
      console.error('[UserMessagesPanel] Bulk mark unread failed:', e);
      toast.error(e?.message || "Failed to mark messages as unread");
    }
  };

  const handleBulkDeleteClick = () => {
    if (validSelectedMessages.size === 0) {
      toast.error("No messages selected");
      return;
    }
    setBulkDeleteDialogOpen(true);
  };

  const handleBulkDeleteConfirm = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Authentication failed");
      return;
    }

    try {
      const systemIds = [...validSelectedMessages]
        .filter(key => key.startsWith('system-'))
        .map(key => key.substring(7)); // 'system-'.length = 7

      const contactIds = [...validSelectedMessages]
        .filter(key => key.startsWith('contact-'))
        .map(key => key.substring(8)); // 'contact-'.length = 8

      if (systemIds.length === 0 && contactIds.length === 0) {
        toast.error("No messages selected");
        setBulkDeleteDialogOpen(false);
        return;
      }

      let deletedCount = 0;

      // Delete system messages
      if (systemIds.length > 0) {
        const { error } = await supabase
          .from('user_system_messages')
          .delete()
          .in('id', systemIds)
          .eq('user_id', user.id);

        if (error) {
          console.error('[UserMessagesPanel] Bulk delete system messages failed:', error);
          toast.error(`Failed to delete system messages: ${error.message}`);
          return;
        }
        deletedCount += systemIds.length;
      }

      // Delete contact messages
      if (contactIds.length > 0) {
        const { error } = await supabase
          .from('contact_messages')
          .delete()
          .in('id', contactIds)
          .eq('user_id', user.id);

        if (error) {
          console.error('[UserMessagesPanel] Bulk delete contact messages failed:', error);
          toast.error(`Failed to delete contact messages: ${error.message}`);
          return;
        }
        deletedCount += contactIds.length;
      }

      toast.success(`Deleted ${deletedCount} messages`);
      refetchSystem();
      refetchContact();
      setSelectedMessages(new Set());
      queryClient.invalidateQueries({ queryKey: ['unread-messages-count'] });
    } catch (e: any) {
      console.error('[UserMessagesPanel] Bulk delete exception:', e);
      toast.error(e?.message || "Failed to delete messages");
    } finally {
      setBulkDeleteDialogOpen(false);
    }
  };

  const extractLink = (content: string): string | null => {
    const hrefMatch = content.match(/href="([^"]+)"/);
    return hrefMatch ? hrefMatch[1] : null;
  };

  const handleSendReply = async (messageId: string) => {
    const draft = (replyDrafts[messageId] || "").trim();
    if (!draft) {
      toast.error("Please type a reply first");
      return;
    }
    setSendingReplyFor(messageId);
    try {
      const { data, error } = await supabase.functions.invoke(
        "send-customer-reply-notification",
        { body: { messageId, replyContent: draft } }
      );
      if (error || (data as any)?.error) {
        throw new Error((error as any)?.message || (data as any)?.error || "Failed to send reply");
      }
      toast.success("Reply sent — our team has been notified");
      setReplyDrafts((prev) => {
        const next = { ...prev };
        delete next[messageId];
        return next;
      });
      await refetchContact();
      await refetchHistory();
      queryClient.invalidateQueries({ queryKey: ["unread-messages-count"] });
    } catch (e: any) {
      console.error("[UserMessagesPanel] Send reply failed:", e);
      toast.error(e?.message || "Failed to send reply");
    } finally {
      setSendingReplyFor(null);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'support':
        return <MessageSquare className="h-4 w-4" />;
      case 'coach_direct':
        return <Mail className="h-4 w-4" />;
      default:
        return <Mail className="h-4 w-4" />;
    }
  };

  const getMessageTypeIcon = (type: string) => {
    switch (type) {
      case 'welcome':
        return <User className="h-4 w-4 text-green-600" />;
      case 'announcement_update':
        return <Zap className="h-4 w-4 text-primary" />;
      case 'renewal_reminder':
      case 'renewal_thank_you':
        return <Zap className="h-4 w-4 text-yellow-600" />;
      case 'motivational_weekly':
        return <MessageSquare className="h-4 w-4 text-green-600" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getMessageTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      welcome: 'Welcome',
      announcement_update: 'Announcement',
      renewal_reminder: 'Renewal Reminder',
      renewal_thank_you: 'Thank You',
      motivational_weekly: 'Motivation',
      cancellation: 'Cancellation'
    };
    return labels[type] || type;
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading messages...</div>;
  }

  // Note: Do NOT early-return when there are no messages — users still need
  // access to the tabs bar (View filter, Settings tab with notification
  // preferences). The empty state is rendered inside each TabsContent below.

  const renderSystemMessage = (message: SystemMessage, showBorder = true) => {
    const link = extractLink(message.content);
    const messageKey = `system-${message.id}`;
    const isSelected = validSelectedMessages.has(messageKey);
    const isExpanded = expandedSystemMessages.has(message.id);
    const isLong = (message.content || '').length > 600;
    
    return (
      <Card key={messageKey} className={!message.is_read && showBorder ? 'border-blue-500' : ''}>
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={isSelected}
                onCheckedChange={(checked) => handleSelectMessage(messageKey, !!checked)}
                onClick={(e) => e.stopPropagation()}
                className="mt-1"
              />
              {getMessageTypeIcon(message.message_type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <h3 className="font-semibold">{message.subject}</h3>
                {!message.is_read && <Badge variant="destructive">New</Badge>}
                <Badge variant="outline" className="text-xs">
                  <Zap className="h-3 w-3 mr-1" />
                  {getMessageTypeLabel(message.message_type)}
                </Badge>
                <div className="ml-auto flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleToggleRead(message.id, 'system', message.is_read)}
                    title={message.is_read ? "Mark as unread" : "Mark as read"}
                  >
                    {message.is_read ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => handleDeleteClick(message.id, 'system')}
                    title="Delete message"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div
                className={`text-sm mb-2 ${isLong && !isExpanded ? 'max-h-40 overflow-hidden relative after:content-[""] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-12 after:bg-gradient-to-t after:from-card after:to-transparent' : ''}`}
              >
                <HTMLContent
                  content={compactMessageHtml(message.content)}
                  className="[&_hr]:hidden [&_p:empty]:hidden [&_p]:my-1.5 [&_p]:leading-normal [&_h1]:my-2 [&_h2]:my-2 [&_h3]:my-2 [&_ul]:my-1.5 [&_ol]:my-1.5"
                />
              </div>
              {isLong && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 mb-2 text-primary"
                  onClick={() => setExpandedSystemMessages(prev => {
                    const next = new Set(prev);
                    if (next.has(message.id)) next.delete(message.id); else next.add(message.id);
                    return next;
                  })}
                >
                  {isExpanded ? 'Show less' : 'Read more'}
                </Button>
              )}
              <div className="flex items-center gap-4 flex-wrap">
                <span className="text-xs text-muted-foreground">
                  {format(new Date(message.created_at), 'MMM dd, yyyy HH:mm')}
                </span>
                {link && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7"
                    onClick={() => openLinkInternally(link, message.message_type)}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    View Content
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderContactMessage = (message: ContactMessage, showBorder = true) => {
    const messageKey = `contact-${message.id}`;
    const isSelected = validSelectedMessages.has(messageKey);
    const isExpanded = expandedMessages.has(message.id);
    const teamReplies = getTeamReplies(message);
    const hasTeamReply = Boolean(message.response) || teamReplies.length > 0;
    
    return (
      <Card
        key={messageKey}
        className={`${!message.response_read_at && hasTeamReply && showBorder ? 'border-green-500' : ''} cursor-pointer transition-colors hover:bg-muted/40`}
        onClick={() => handleMessageClick(message.id, 'contact')}
      >
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={isSelected}
                onCheckedChange={(checked) => handleSelectMessage(messageKey, !!checked)}
                onClick={(e) => e.stopPropagation()}
                className="mt-1"
              />
              {getCategoryIcon(message.category)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <h3 className="font-semibold">{message.subject}</h3>
                {!message.response_read_at && hasTeamReply && (
                  <Badge variant="destructive">New Response</Badge>
                )}
                <Badge variant="outline" className="text-xs">
                  <User className="h-3 w-3 mr-1" />
                  Your Message
                </Badge>
                <div className="ml-auto flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMessageClick(message.id, 'contact');
                    }}
                  >
                    {isExpanded ? 'Hide' : 'Open'}
                  </Button>
                  {hasTeamReply && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleRead(message.id, 'contact', !!message.response_read_at);
                      }}
                      title={message.response_read_at ? "Mark response as unread" : "Mark response as read"}
                    >
                      {message.response_read_at ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClick(message.id, 'contact');
                    }}
                    title="Delete message"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className={`text-sm text-muted-foreground mb-3 ${isExpanded ? 'whitespace-pre-wrap' : 'line-clamp-2'}`}>
                {message.message}
              </p>
              <div className="flex items-center gap-4 flex-wrap">
                <span className="text-xs text-muted-foreground">
                  {format(new Date(message.created_at), 'MMM dd, yyyy HH:mm')}
                </span>
                {hasTeamReply ? (
                  <Badge variant="default" className="bg-green-600">Coach Replied</Badge>
                ) : (
                  <Badge variant="secondary">Pending</Badge>
                )}
              </div>

              {isExpanded && (
                <div className="mt-4 space-y-4 border-t pt-4">
                  <div>
                    <p className="text-sm font-semibold mb-2">Your full message:</p>
                    <div className="bg-muted p-3 rounded-lg text-sm whitespace-pre-wrap break-words-safe content-container">
                      {message.message}
                    </div>
                  </div>

                  {(() => {
                    const fullThread = [
                      ...teamReplies,
                      ...((historyByContactId[message.id] || []).filter((item) => item.sender === 'customer')),
                    ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

                    if (fullThread.length === 0) return null;
                    return (
                      <div className="space-y-3">
                        <p className="text-sm font-semibold">Conversation:</p>
                        {fullThread.map((reply) => {
                          const isCustomer = reply.sender === 'customer';
                          return (
                            <div
                              key={reply.id}
                              className={`p-3 rounded-lg text-sm text-display break-words-safe content-container border ${
                                isCustomer
                                  ? 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800'
                                  : 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
                              }`}
                            >
                              <p className="text-xs font-semibold mb-1">
                                {isCustomer ? 'You' : 'SmartyGym Team'}
                              </p>
                              <p className="whitespace-pre-wrap">{reply.content}</p>
                              <p className="text-xs text-muted-foreground mt-2">
                                {format(new Date(reply.created_at), 'MMM dd, yyyy HH:mm')}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                    <p className="text-sm font-semibold">Reply to this conversation:</p>
                    <Textarea
                      value={replyDrafts[message.id] || ''}
                      onChange={(e) =>
                        setReplyDrafts((prev) => ({ ...prev, [message.id]: e.target.value }))
                      }
                      placeholder="Type your reply… our team will receive it by email and respond in this same thread."
                      rows={4}
                      maxLength={5000}
                      disabled={sendingReplyFor === message.id}
                    />
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSendReply(message.id);
                        }}
                        disabled={
                          sendingReplyFor === message.id ||
                          !(replyDrafts[message.id] || '').trim()
                        }
                      >
                        {sendingReplyFor === message.id ? 'Sending…' : 'Send Reply'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {message.attachments && message.attachments.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs text-muted-foreground mb-2">Attachments</p>
                  <div className="flex flex-wrap gap-2">
                    {message.attachments.map((attachment: any, index: number) => (
                      <div key={index} className="flex items-center gap-1 bg-muted px-2 py-1 rounded text-xs">
                        <Paperclip className="h-3 w-3" />
                        <span className="truncate max-w-[150px]">{attachment.name}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 w-5 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(attachment.url, '_blank');
                          }}
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const deletableCount = validSelectedMessages.size;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">My Messages</h2>
      <p className="text-muted-foreground">
        View your messages, system notifications, and responses from the team
      </p>

      <Tabs defaultValue="all" className="w-full" onValueChange={setActiveTab}>
        {/* Header row with tabs, filter, and bulk actions */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <TabsList className="w-full sm:w-auto grid grid-cols-4 gap-1">
            <TabsTrigger value="all" className="text-xs sm:text-sm px-2 sm:px-3">All ({contactMessages.length + systemMessages.length})</TabsTrigger>
            <TabsTrigger value="system" className="text-xs sm:text-sm px-2 sm:px-3">System ({systemMessages.length})</TabsTrigger>
            <TabsTrigger value="contact" className="text-xs sm:text-sm px-1.5 sm:px-3">Requests ({contactMessages.length})</TabsTrigger>
            <TabsTrigger value="subscriptions" className="text-xs sm:text-sm px-2 sm:px-3 gap-1">
              <Settings2 className="h-3 w-3" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>
          
          <div className="flex items-center gap-2 sm:ml-auto">
            <Select value={viewFilter} onValueChange={(value: ViewFilter) => setViewFilter(value)}>
              <SelectTrigger className="w-[130px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">View All</SelectItem>
                <SelectItem value="unread">View Unread</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Bulk actions bar */}
        {visibleMessageIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 p-3 bg-muted rounded-lg mb-4">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={isAllSelected}
                onCheckedChange={handleSelectAll}
                className={isSomeSelected ? 'data-[state=checked]:bg-primary/50' : ''}
              />
              <span className="text-sm font-medium">
                {validSelectedMessages.size > 0 
                  ? `${validSelectedMessages.size} selected` 
                  : 'Select all'}
              </span>
            </div>
            
            {validSelectedMessages.size > 0 && (
              <>
                <div className="h-4 w-px bg-border mx-2 hidden sm:block" />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkMarkRead}
                    className="h-8"
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    Mark Read
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkMarkUnread}
                    className="h-8"
                  >
                    <EyeOff className="h-3 w-3 mr-1" />
                    Mark Unread
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkDeleteClick}
                    className="h-8 text-destructive hover:text-destructive"
                    disabled={deletableCount === 0}
                    title={deletableCount === 0 ? "No messages selected" : `Delete ${deletableCount} selected messages`}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete {deletableCount > 0 && `(${deletableCount})`}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedMessages(new Set())}
                    className="h-8"
                  >
                    Clear
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        <TabsContent value="all" className="space-y-4 mt-0">
          {filteredSystemMessages.length === 0 && filteredContactMessages.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground">
                  {viewFilter === 'unread' ? 'No unread messages' : 'No messages'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {filteredSystemMessages.map((message) => renderSystemMessage(message))}
              {filteredContactMessages.map((message) => renderContactMessage(message))}
            </>
          )}
        </TabsContent>

        <TabsContent value="system" className="space-y-4 mt-0">
          {filteredSystemMessages.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground">
                  {viewFilter === 'unread' ? 'No unread system messages' : 'No system messages yet'}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredSystemMessages.map((message) => renderSystemMessage(message, false))
          )}
        </TabsContent>

        <TabsContent value="contact" className="space-y-4 mt-0">
          {filteredContactMessages.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground">
                  {viewFilter === 'unread' ? 'No unread contact messages' : 'No contact messages yet'}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredContactMessages.map((message) => renderContactMessage(message, false))
          )}
        </TabsContent>

        <TabsContent value="subscriptions" className="mt-0 space-y-6">
          <NotificationPreferencesManager />
        </TabsContent>
      </Tabs>

      {/* Single delete dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Message</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this message? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete dialog */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deletableCount} Messages</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deletableCount} selected message{deletableCount !== 1 ? 's' : ''}? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete {deletableCount} Message{deletableCount !== 1 ? 's' : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
