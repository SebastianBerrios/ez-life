'use client';

import React, { useState } from 'react';
import { LocalSavingsGoalRepository } from '../../infrastructure/repositories/local/LocalSavingsGoalRepository';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface Props {
  userId: string;
  onComplete: () => void;
  onCancel: () => void;
}

export default function SavingsGoalForm({ userId, onComplete, onCancel }: Props) {
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const repo = new LocalSavingsGoalRepository();
      const amountInCents = Math.round(parseFloat(targetAmount.replace(/,/g, '')) * 100);

      await repo.save({
        id: '', // Handled by repo UUID generation
        user_id: userId,
        name,
        target_amount: amountInCents,
        deadline: deadline ? new Date(deadline) : undefined,
      });

      onComplete();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Nueva Meta de Ahorro</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} data-testid="goal-form" className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre de la Meta</Label>
            <Input
              type="text"
              id="name"
              required
              placeholder="Ej. Viaje a Cancún"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="targetAmount">Monto Objetivo</Label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-muted-foreground text-base font-medium">S/</span>
              </div>
              <Input
                type="text"
                id="targetAmount"
                required
                className="pl-9"
                placeholder="0.00"
                value={targetAmount}
                onFocus={() => {
                  if (targetAmount) {
                    setTargetAmount(targetAmount.replace(/,/g, ''));
                  }
                }}
                onBlur={() => {
                  if (targetAmount && !isNaN(Number(targetAmount))) {
                    setTargetAmount(
                      Number(targetAmount).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    );
                  }
                }}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9.]/g, '');
                  setTargetAmount(val);
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="deadline">Fecha límite (Opcional)</Label>
            <Input
              type="date"
              id="deadline"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear Meta
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
