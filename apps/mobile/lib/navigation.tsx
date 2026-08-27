import Feather from '@expo/vector-icons/Feather';
import { createContext, useContext, useMemo, useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';

/**
 * The side drawer is the app's primary navigation, so its open state lives
 * above the route tree: any screen can raise it through `Screen`'s menu
 * button, and there is exactly one drawer mounted for the whole app.
 */

export interface NavSection {
  href: string;
  label: string;
  icon: ComponentProps<typeof Feather>['name'];
}

/** Chat is first because it is the app's home. */
export const NAV_SECTIONS: NavSection[] = [
  { href: '/', label: 'Chat', icon: 'message-circle' },
  { href: '/today', label: 'Today', icon: 'sun' },
  { href: '/checks', label: 'Staying well', icon: 'shield' },
  { href: '/medicines', label: 'Medicines', icon: 'thermometer' },
  { href: '/records', label: 'Records', icon: 'folder' },
  { href: '/calls', label: 'Calls', icon: 'phone' },
  { href: '/profile', label: 'Profile', icon: 'user' },
];

/** Whether `pathname` is inside a section, so `/medicines/new` lights Medicines. */
export function isSectionActive(pathname: string, href: string): boolean {
  if (href === '/') {
    return pathname === '/';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface DrawerContextValue {
  open: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
}

const DrawerContext = createContext<DrawerContextValue | null>(null);

export function DrawerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const value = useMemo(
    () => ({ open, openDrawer: () => setOpen(true), closeDrawer: () => setOpen(false) }),
    [open],
  );
  return <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>;
}

export function useDrawer(): DrawerContextValue {
  const context = useContext(DrawerContext);
  if (!context) {
    throw new Error('useDrawer must be used inside <DrawerProvider>');
  }
  return context;
}
