'use client';
import { useEffect, useState } from 'react';
import { IncomeSource } from '../../core/domain/models/types';
import { LocalIncomeSourceRepository } from '../../infrastructure/repositories/local/LocalIncomeSourceRepository';
import { parseMoney } from '../../core/use-cases/parseMoney';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
    <ul className="space-y-2">{sources.map(source => <li key={source.id} className="flex flex-wrap items-center gap-2">
      <span className="flex-1">{source.name} · S/ {(source.amount / 100).toFixed(2)}</span>
      <Button variant="ghost" onClick={() => { setEditingId(source.id); setName(source.name); setAmount((source.amount / 100).toFixed(2)); }}>Editar</Button>
      <Button variant="ghost" disabled={busy} onClick={async () => {
        if (!window.confirm('¿Eliminar esta fuente de ingreso?')) return;
        setBusy(true); setError('');
        try { await new LocalIncomeSourceRepository().delete(source.id); await reload(); }
        catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo eliminar.'); }
        finally { setBusy(false); }
      }}>Eliminar</Button>
    </li>)}</ul>
    <form className="space-y-2" onSubmit={async event => {
      event.preventDefault(); if (busy) return; setBusy(true); setError('');
      try {
        await new LocalIncomeSourceRepository().save({ id: editingId, user_id: userId, name, amount: parseMoney(amount) });
        setEditingId(''); setName(''); setAmount(''); await reload();
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar.'); }
      finally { setBusy(false); }
    }}>
      <Label htmlFor="source-name">Nombre de la fuente</Label>
      <Input id="source-name" required value={name} onChange={event => setName(event.target.value)} />
      <Label htmlFor="source-amount">Ingreso mensual esperado</Label>
      <Input id="source-amount" inputMode="decimal" required value={amount} onChange={event => setAmount(event.target.value)} />
      {error && <p role="alert" className="text-destructive">{error}</p>}
      <Button disabled={busy}>{editingId ? 'Guardar fuente' : 'Agregar fuente'}</Button>
      {editingId && <Button type="button" variant="ghost" onClick={() => { setEditingId(''); setName(''); setAmount(''); }}>Cancelar</Button>}
    </form>
  </div>;
}
