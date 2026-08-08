import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/features/auth/AuthContext';
import type { Task, UserProfile } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

type TaskStatus = Task['status'];

const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'Pending',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
};

const STATUS_BADGE_VARIANT: Record<TaskStatus, 'secondary' | 'warning' | 'success' | 'destructive'> = {
  pending: 'secondary',
  submitted: 'warning',
  approved: 'success',
  rejected: 'destructive',
};

async function fetchTasks(): Promise<Task[]> {
  const { data } = await apiClient.get<Task[]>('/tasks');
  return data;
}

async function fetchStaffUsers(): Promise<UserProfile[]> {
  const { data } = await apiClient.get<UserProfile[]>('/users', { params: { role: 'staff' } });
  return data;
}

const taskFormSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  assignedTo: z.string().min(1, 'Assignee is required'),
  dueDate: z.string().optional(),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

function NewTaskDialog({
  open,
  onOpenChange,
  staffUsers,
  task,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffUsers: UserProfile[];
  task?: Task | null;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!task;

  const defaultValues = React.useCallback(
    (): TaskFormValues => ({
      title: task?.title ?? '',
      description: task?.description ?? '',
      assignedTo: task?.assigned_to ?? '',
      dueDate: task?.due_date ?? '',
    }),
    [task],
  );

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: defaultValues(),
  });

  React.useEffect(() => {
    if (open) reset(defaultValues());
  }, [open, defaultValues, reset]);

  const createMutation = useMutation({
    mutationFn: async (values: TaskFormValues) => {
      const { data } = await apiClient.post<Task>('/tasks', {
        title: values.title,
        description: values.description || undefined,
        assignedTo: values.assignedTo,
        dueDate: values.dueDate || undefined,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task created');
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: TaskFormValues) => {
      const { data } = await apiClient.patch<Task>(`/tasks/${task!.id}`, {
        title: values.title,
        description: values.description || undefined,
        assignedTo: values.assignedTo,
        dueDate: values.dueDate || undefined,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task updated');
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const onSubmit = (values: TaskFormValues) => {
    if (isEdit) updateMutation.mutate(values);
    else createMutation.mutate(values);
  };
  const submitting = isSubmitting || createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Task' : 'New Task'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update this task.' : 'Assign a task to a staff member.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" {...register('title')} />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" {...register('description')} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="assignedTo">Assign to</Label>
            <Controller
              control={control}
              name="assignedTo"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="assignedTo">
                    <SelectValue placeholder="Select staff member" />
                  </SelectTrigger>
                  <SelectContent>
                    {staffUsers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.assignedTo && <p className="text-xs text-destructive">{errors.assignedTo.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dueDate">Due date</Label>
            <Input id="dueDate" type="date" {...register('dueDate')} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TasksPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const canManage = profile?.role === 'admin' || profile?.role === 'team_lead';
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingTask, setEditingTask] = React.useState<Task | null>(null);

  const tasksQuery = useQuery({
    queryKey: ['tasks'],
    queryFn: fetchTasks,
  });

  const staffQuery = useQuery({
    queryKey: ['staff-users'],
    queryFn: fetchStaffUsers,
    enabled: canManage,
  });

  const staffUsers = staffQuery.data ?? [];
  const staffNameById = React.useMemo(() => {
    const map = new Map<string, string>();
    staffUsers.forEach((s) => map.set(s.id, s.full_name));
    return map;
  }, [staffUsers]);

  const invalidateTasks = () => queryClient.invalidateQueries({ queryKey: ['tasks'] });

  const submitMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.patch<Task>(`/tasks/${id}/submit`);
      return data;
    },
    onSuccess: () => {
      invalidateTasks();
      toast.success('Task submitted');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.patch<Task>(`/tasks/${id}/approve`);
      return data;
    },
    onSuccess: () => {
      invalidateTasks();
      toast.success('Task approved');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.patch<Task>(`/tasks/${id}/reject`);
      return data;
    },
    onSuccess: () => {
      invalidateTasks();
      toast.success('Task rejected');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/tasks/${id}`);
    },
    onSuccess: () => {
      invalidateTasks();
      toast.success('Task deleted');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleDelete = (task: Task) => {
    if (window.confirm(`Delete task "${task.title}"?`)) {
      deleteMutation.mutate(task.id);
    }
  };

  const handleAddClick = () => {
    setEditingTask(null);
    setDialogOpen(true);
  };

  const handleEditClick = (task: Task) => {
    setEditingTask(task);
    setDialogOpen(true);
  };

  const resolveAssignee = (task: Task): string => {
    if (!task.assigned_to) return '—';
    if (task.assigned_to === profile?.id) return `${profile?.full_name ?? 'You'} (you)`;
    return staffNameById.get(task.assigned_to) ?? task.assigned_to.slice(0, 8);
  };

  const anyActionPending =
    submitMutation.isPending || approveMutation.isPending || rejectMutation.isPending || deleteMutation.isPending;

  const tasks = tasksQuery.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Tasks</h1>
          <p className="text-sm text-muted-foreground">
            {canManage ? 'Assign and review tasks for your team.' : 'Tasks assigned to you.'}
          </p>
        </div>
        {canManage && <Button onClick={handleAddClick}>New Task</Button>}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Assigned to</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Due date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasksQuery.isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Loading tasks…
                </TableCell>
              </TableRow>
            )}
            {!tasksQuery.isLoading && tasks.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No tasks found.
                </TableCell>
              </TableRow>
            )}
            {tasks.map((task) => {
              const isAssignee = task.assigned_to === profile?.id;
              const isOwnCreation = task.created_by === profile?.id;
              const canDelete = profile?.role === 'admin' || (profile?.role === 'team_lead' && isOwnCreation);

              return (
                <TableRow key={task.id}>
                  <TableCell className="font-medium">{task.title}</TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">
                    {task.description ?? '—'}
                  </TableCell>
                  <TableCell>{resolveAssignee(task)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE_VARIANT[task.status]}>{STATUS_LABELS[task.status]}</Badge>
                  </TableCell>
                  <TableCell>{task.due_date ? format(new Date(task.due_date), 'MMM d, yyyy') : '—'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {profile?.role === 'staff' && isAssignee && task.status === 'pending' && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={submitMutation.isPending}
                          onClick={() => submitMutation.mutate(task.id)}
                        >
                          Submit
                        </Button>
                      )}
                      {canManage && task.status === 'submitted' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={anyActionPending}
                            onClick={() => approveMutation.mutate(task.id)}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={anyActionPending}
                            onClick={() => rejectMutation.mutate(task.id)}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                      {canDelete && (
                        <Button size="sm" variant="outline" onClick={() => handleEditClick(task)}>
                          Edit
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={deleteMutation.isPending}
                          onClick={() => handleDelete(task)}
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {canManage && (
        <NewTaskDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setEditingTask(null);
          }}
          staffUsers={staffUsers}
          task={editingTask}
        />
      )}
    </div>
  );
}
