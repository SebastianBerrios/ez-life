'use client';

import React, { useState } from 'react';
import { LocalTaskRepository } from '../../infrastructure/repositories/local/LocalTaskRepository';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface Props {
  userId: string;
  onComplete: () => void;
  onCancel: () => void;
}

export default function TaskForm({ userId, onComplete, onCancel }: Props) {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const repo = new LocalTaskRepository();
      await repo.save({
        id: '',
        user_id: userId,
        title,
        due_date: new Date(dueDate),
        status: 'pending',
      });

      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la tarea.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      <h2 className="mb-4 font-heading text-base leading-none font-medium">Nueva Tarea</h2>
      <form onSubmit={handleSubmit} data-testid="task-form" className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="taskTitle">Título</Label>
          <Input type="text" id="taskTitle" required value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="dueDate">Fecha límite</Label>
          <Input type="date" id="dueDate" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting} className="flex-1">
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting} className="flex-1">
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crear
          </Button>
        </div>
      </form>
    </div>
  );
}
