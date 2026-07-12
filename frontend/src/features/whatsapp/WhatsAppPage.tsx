import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';
import { MessageSquarePlus, Send } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { cn } from '@/lib/utils';
import { useAuth } from '@/features/auth/AuthContext';
import type { MessageTemplate, WhatsappMessage } from '@/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';

interface Conversation {
  leadId: string;
  leadName: string;
  lastMessageBody: string | null;
  lastMessageAt: string | null;
}

function truncate(text: string | null, max = 60) {
  if (!text) return 'No messages yet';
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function ConversationList({
  conversations: data,
  isLoading,
  selectedLeadId,
  onSelect,
}: {
  conversations: Conversation[] | undefined;
  isLoading: boolean;
  selectedLeadId: string | null;
  onSelect: (leadId: string) => void;
}) {
  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading conversations…</div>;
  }

  if (!data || data.length === 0) {
    return <div className="p-4 text-sm text-muted-foreground">No conversations yet.</div>;
  }

  return (
    <div className="flex flex-col overflow-y-auto">
      {data.map((conversation) => (
        <button
          key={conversation.leadId}
          type="button"
          onClick={() => onSelect(conversation.leadId)}
          className={cn(
            'flex flex-col gap-1 border-b px-4 py-3 text-left transition-colors hover:bg-accent',
            selectedLeadId === conversation.leadId && 'bg-accent',
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium">{conversation.leadName}</span>
            {conversation.lastMessageAt && (
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(conversation.lastMessageAt), { addSuffix: true })}
              </span>
            )}
          </div>
          <span className="truncate text-xs text-muted-foreground">
            {truncate(conversation.lastMessageBody)}
          </span>
        </button>
      ))}
    </div>
  );
}

function TemplatesDialog({ onInsert }: { onInsert: (body: string) => void }) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [body, setBody] = React.useState('');
  const [variables, setVariables] = React.useState('');

  const canCreate = profile?.role === 'admin' || profile?.role === 'team_lead';

  const { data: templates, isLoading } = useQuery({
    queryKey: ['whatsapp-templates'],
    queryFn: async () => {
      const { data } = await apiClient.get<MessageTemplate[]>('/whatsapp/templates');
      return data;
    },
    enabled: open,
  });

  const createTemplate = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<MessageTemplate>('/whatsapp/templates', {
        name,
        body,
        variables: variables
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean),
      });
      return data;
    },
    onSuccess: () => {
      toast.success('Template created');
      setName('');
      setBody('');
      setVariables('');
      queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <MessageSquarePlus className="mr-2 h-4 w-4" />
          Templates
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Message templates</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {isLoading && <p className="text-sm text-muted-foreground">Loading templates…</p>}
          {templates && templates.length === 0 && (
            <p className="text-sm text-muted-foreground">No templates yet.</p>
          )}
          {templates?.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => {
                onInsert(template.body);
                setOpen(false);
              }}
              className="rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
            >
              <div className="font-medium">{template.name}</div>
              <div className="truncate text-xs text-muted-foreground">{template.body}</div>
            </button>
          ))}
        </div>

        {canCreate && (
          <>
            <Separator />
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                createTemplate.mutate();
              }}
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="template-name">Name</Label>
                <Input
                  id="template-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="template-body">Body</Label>
                <Textarea
                  id="template-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Hi {{name}}, ..."
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="template-variables">Variables (comma-separated)</Label>
                <Input
                  id="template-variables"
                  value={variables}
                  onChange={(e) => setVariables(e.target.value)}
                  placeholder="name, date"
                />
              </div>
              <Button type="submit" disabled={createTemplate.isPending}>
                {createTemplate.isPending ? 'Creating…' : 'Create template'}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ChatPanel({ leadId, leadName }: { leadId: string; leadName: string }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = React.useState('');
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const { data: messages, isLoading } = useQuery({
    queryKey: ['whatsapp-messages', leadId],
    queryFn: async () => {
      const { data } = await apiClient.get<WhatsappMessage[]>(`/whatsapp/messages/${leadId}`);
      return data;
    },
    refetchInterval: 10000,
  });

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const sendMessage = useMutation({
    mutationFn: async (body: string) => {
      const { data } = await apiClient.post<WhatsappMessage>(`/whatsapp/messages/${leadId}/send`, {
        body,
      });
      return data;
    },
    onSuccess: () => {
      setDraft('');
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages', leadId] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleSend = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    sendMessage.mutate(trimmed);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold">{leadName}</h2>
        <TemplatesDialog onInsert={(body) => setDraft((prev) => (prev ? `${prev}\n${body}` : body))} />
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
        {isLoading && <p className="text-sm text-muted-foreground">Loading messages…</p>}
        {messages && messages.length === 0 && (
          <p className="text-sm text-muted-foreground">No messages yet. Say hello!</p>
        )}
        <div className="flex flex-col gap-2">
          {messages?.map((message) => (
            <div
              key={message.id}
              className={cn('flex flex-col', message.direction === 'outbound' ? 'items-end' : 'items-start')}
            >
              <div
                className={cn(
                  'max-w-[75%] rounded-lg px-3 py-2 text-sm',
                  message.direction === 'outbound'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground',
                )}
              >
                {message.body}
              </div>
              <span className="mt-1 text-[11px] text-muted-foreground">
                {format(new Date(message.created_at), 'MMM d, HH:mm')}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t p-4">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message…"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <div className="flex justify-end">
          <Button onClick={handleSend} disabled={sendMessage.isPending || !draft.trim()}>
            <Send className="mr-2 h-4 w-4" />
            {sendMessage.isPending ? 'Sending…' : 'Send'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function WhatsAppPage() {
  const [selectedLeadId, setSelectedLeadId] = React.useState<string | null>(null);

  const { data: conversations, isLoading } = useQuery({
    queryKey: ['whatsapp-conversations'],
    queryFn: async () => {
      const { data } = await apiClient.get<Conversation[]>('/whatsapp/conversations');
      return data;
    },
  });

  const selectedConversation = conversations?.find((c) => c.leadId === selectedLeadId);

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">WhatsApp</h1>
        <p className="text-sm text-muted-foreground">Chat with your leads over WhatsApp.</p>
      </div>

      <div className="grid flex-1 grid-cols-1 overflow-hidden rounded-lg border md:grid-cols-[300px_1fr]">
        <div className="flex flex-col border-b md:border-b-0 md:border-r">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Conversations</h2>
          </div>
          <ConversationList
            conversations={conversations}
            isLoading={isLoading}
            selectedLeadId={selectedLeadId}
            onSelect={setSelectedLeadId}
          />
        </div>

        <div className="flex flex-col">
          {selectedLeadId && selectedConversation ? (
            <ChatPanel leadId={selectedLeadId} leadName={selectedConversation.leadName} />
          ) : (
            <div className="flex h-full flex-1 items-center justify-center text-sm text-muted-foreground">
              Select a conversation to start chatting.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
