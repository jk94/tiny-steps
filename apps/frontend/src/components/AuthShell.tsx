import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BabyIllustration } from './illustrations';
import { Card } from './ui';

export interface AuthShellProps {
  title: string;
  children: ReactNode;
}

/**
 * The frame shared by the login and register screens: the app's baby mascot
 * and tagline above a card holding the page title and form — a friendlier
 * first impression than a bare form card.
 */
export function AuthShell({ title, children }: AuthShellProps) {
  const { t } = useTranslation();

  return (
    <section className="mx-auto flex w-full max-w-sm flex-col items-center gap-4 py-6">
      <div className="flex flex-col items-center gap-1 text-center">
        <BabyIllustration className="h-32 w-32 animate-pop-in" />
        <p className="text-sm font-bold text-muted-foreground">{t('auth.tagline')}</p>
      </div>
      <Card className="w-full shadow-md">
        <Card.Body className="flex flex-col items-center gap-6 p-6 sm:p-8">
          <h1 className="text-2xl font-black text-foreground">{title}</h1>
          {children}
        </Card.Body>
      </Card>
    </section>
  );
}
