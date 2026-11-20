'use client';

import React from 'react';
import { RotateCcw } from 'lucide-react';
import { Panel } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ reset }: ErrorPageProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Panel
        role="alert"
        className="w-full max-w-md items-center gap-4 p-6 text-center"
      >
        <p className="font-fredoka text-headline-lg text-foreground">
          ez<span className="text-primary">·</span>life
        </p>
        <div className="space-y-1.5">
          <h1 className="font-fredoka text-headline-md text-foreground">
            Algo no salió como esperábamos
          </h1>
          <p className="text-body-md text-muted-foreground">
            Tus datos locales siguen a salvo. Puedes intentarlo de nuevo ahora mismo.
          </p>
        </div>
        <Button type="button" onClick={reset} className="min-h-11 gap-2">
          <RotateCcw className="size-4" aria-hidden="true" />
          Reintentar
        </Button>
      </Panel>
    </main>
  );
}
