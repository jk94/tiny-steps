import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { cn } from '../../lib/cn';
import { Sheet } from '../ui';
import { MORE_AREA_KEYS, type ChildNavigation } from './useChildNavigation';

export interface ChildAreasSheetProps {
  navigation: ChildNavigation;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The mobile "more" sheet: every area the bottom bar doesn't list, as
 * illustrated tiles, plus the child's settings. Following a link closes it.
 */
export function ChildAreasSheet({ navigation, isOpen, onOpenChange }: ChildAreasSheetProps) {
  const { t } = useTranslation();
  const close = () => onOpenChange(false);

  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      side="bottom"
      title={t('nav.child.moreTitle')}
    >
      <ul className="grid grid-cols-3 gap-3">
        {MORE_AREA_KEYS.map((key, index) => {
          const link = navigation.areas[key];
          const area = link.area!;
          return (
            <li key={key} className="animate-pop-in" style={{ animationDelay: `${index * 35}ms` }}>
              <Link
                to={link.to}
                onClick={close}
                aria-current={link.isActive ? 'page' : undefined}
                className={cn(
                  'flex h-full flex-col items-center gap-1.5 rounded-lg p-3 text-center text-sm font-bold text-foreground transition-transform active:scale-95',
                  area.tint,
                  link.isActive && 'ring-2 ring-primary',
                )}
              >
                <area.Illustration className="h-14 w-14" />
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <Link
        to={navigation.settings.to}
        onClick={close}
        className="mt-4 flex items-center gap-3 rounded-lg bg-muted px-4 py-3 text-sm font-bold text-foreground hover:bg-accent"
      >
        <navigation.settings.Icon aria-hidden="true" className="h-5 w-5 text-muted-foreground" />
        <span className="flex-1">{navigation.settings.label}</span>
        <ChevronRight aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
      </Link>
    </Sheet>
  );
}
