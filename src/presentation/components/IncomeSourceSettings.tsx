'use client';
import { useEffect, useState } from 'react';
import { IncomeSource } from '../../core/domain/models/types';
import { LocalIncomeSourceRepository } from '../../infrastructure/repositories/local/LocalIncomeSourceRepository';
import { parseMoney } from '../../core/use-cases/parseMoney';
import { centsToAmountInput } from '../../core/use-cases/addQuickAmount';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Money } from '@/components/ui/money';

export default function IncomeSourceSettings({ userId }: { userId: string }) {
  const [sources, setSources] = useState<IncomeSource[]>([]);
  const [editingId, setEditingId] = useState('');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let cancelled = false;
    new LocalIncomeSourceRepository().getAll(userId).then(rows => { if (!cancelled) setSources(rows); });
    return () => { cancelled = true; };
  }, [userId]);
  async function reload() { setSources(await new LocalIncomeSourceRepository().getAll(userId)); }
  return <div className="space-y-4">
    {sources.length === 0
      ? <p className="text-body-md text-muted-foreground">Todavía no tienes fuentes de ingreso.</p>
      : <ul className="divide-y divide-border rounded-lg border border-border">{sources.map(source => <li key={source.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
        <span className="min-w-0 basis-full break-words text-body-md font-medium text-foreground sm:basis-0 sm:flex-1">{source.name}</span>
        <Money cents={source.amount} size="sm" className="mr-auto sm:mr-0" aria-label={`Ingreso mensual de ${source.name}`} />
        <Button variant="ghost" size="sm" aria-label={`Editar ${source.name}`} onClick={() => { setEditingId(source.id); setName(source.name); setAmount(centsToAmountInput(source.amount)); }}>Editar</Button>
        <Button variant="ghost" size="sm" aria-label={`Eliminar ${source.name}`} className="text-destructive hover:text-destructive" disabled={busy} onClick={async () => {
          if (!window.confirm('¿Eliminar esta fuente de ingreso?')) return;
          setBusy(true); setError('');
          try { await new LocalIncomeSourceRepository().delete(source.id); await reload(); }
          catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo eliminar.'); }
          finally { setBusy(false); }
        }}>Eliminar</Button>
      </li>)}</ul>}
    <form className="space-y-3" onSubmit={async event => {
      event.preventDefault(); if (busy) return; setBusy(true); setError('');
      try {
        await new LocalIncomeSourceRepository().save({ id: editingId, user_id: userId, name, amount: parseMoney(amount) });
        setEditingId(''); setName(''); setAmount(''); await reload();
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar.'); }
      finally { setBusy(false); }
    }}>
      <div className="space-y-2">
        <Label htmlFor="source-name">Nombre de la fuente</Label>
        <Input id="source-name" required value={name} onChange={event => setName(event.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="source-amount">Ingreso mensual esperado</Label>
        <Input id="source-amount" inputMode="decimal" required className="tabular-nums" value={amount} onChange={event => setAmount(event.target.value)} />
      </div>
      {error && <p role="alert" className="text-body-md text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy} className="flex-1">{editingId ? 'Guardar fuente' : 'Agregar fuente'}</Button>
        {editingId && <Button type="button" variant="ghost" onClick={() => { setEditingId(''); setName(''); setAmount(''); }}>Cancelar</Button>}
      </div>
    </form>
  </div>;
}
