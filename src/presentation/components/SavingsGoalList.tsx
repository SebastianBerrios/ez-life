'use client';

import React, { useEffect, useState } from 'react';
import { LocalSavingsGoalRepository } from '../../infrastructure/repositories/local/LocalSavingsGoalRepository';
import { LocalMovementRepository } from '../../infrastructure/repositories/local/LocalMovementRepository';
import { SavingsGoal, Movement } from '../../core/domain/models/types';

interface Props {
  userId: string;
}

interface GoalWithProgress extends SavingsGoal {
  currentAmount: number;
}

export default function SavingsGoalList({ userId }: Props) {
  const [goals, setGoals] = useState<GoalWithProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGoals();
  }, [userId]);

  const loadGoals = async () => {
    try {
      const goalRepo = new LocalSavingsGoalRepository();
      const moveRepo = new LocalMovementRepository();
      
      const [allGoals, allMoves] = await Promise.all([
        goalRepo.getAll(userId),
        moveRepo.getAll(userId) // we need all time movements for goals, not just current cycle
      ]);

      const goalsWithProgress = allGoals.map(goal => {
        const currentAmount = allMoves
          .filter(m => m.type === 'EXPENSE' && m.savings_goal_id === goal.id)
          .reduce((acc, m) => acc + m.amount, 0);
          
        return { ...goal, currentAmount };
      });
      
      setGoals(goalsWithProgress);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Seguro que deseas eliminar esta meta?')) return;
    try {
      const repo = new LocalSavingsGoalRepository();
      await repo.delete(id);
      await loadGoals();
    } catch (err) {
      if (err instanceof Error) {
        alert(err.message);
      }
    }
  };

  if (loading) return <div className="text-center py-4 text-gray-500">Cargando...</div>;

  if (goals.length === 0) {
    return (
      <div className="text-center py-8 bg-white rounded-xl shadow-sm border border-gray-100">
        <p className="text-gray-500">No tienes metas de ahorro registradas.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {goals.map(goal => {
        const progress = Math.min((goal.currentAmount / goal.target_amount) * 100, 100);
        const isExpired = goal.deadline && new Date(goal.deadline) < new Date() && progress < 100;

        return (
          <div key={goal.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-bold text-gray-900">{goal.name}</h3>
                {goal.deadline && (
                  <p className="text-xs text-gray-500 mt-1">
                    Límite: {new Date(goal.deadline).toLocaleDateString()}
                    {isExpired && <span className="text-red-500 font-bold ml-2">Vencida</span>}
                  </p>
                )}
              </div>
              <button 
                onClick={() => handleDelete(goal.id)}
                className="text-red-500 hover:text-red-700 text-xs font-medium"
              >
                Borrar
              </button>
            </div>
            
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-blue-600 font-medium">S/ {(goal.currentAmount / 100).toFixed(2)}</span>
                <span className="text-gray-500">de S/ {(goal.target_amount / 100).toFixed(2)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className={`h-2.5 rounded-full ${isExpired ? 'bg-red-500' : 'bg-blue-600'}`} 
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
