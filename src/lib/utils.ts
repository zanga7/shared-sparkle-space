import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Member color utilities
export const getMemberColorClasses = (color: string = 'sky') => {
  const colorMap = {
    sky: {
      bg: 'bg-sky-100 dark:bg-sky-950',
      bgSoft: 'bg-sky-50 dark:bg-sky-900/20',
      border: 'border-sky-300 dark:border-sky-700',
      text: 'text-sky-700 dark:text-sky-300',
      accent: 'bg-sky-500',
      avatar: 'bg-sky-500 text-white',
    },
    rose: {
      bg: 'bg-rose-100 dark:bg-rose-950',
      bgSoft: 'bg-rose-50 dark:bg-rose-900/20',
      border: 'border-rose-300 dark:border-rose-700',
      text: 'text-rose-700 dark:text-rose-300',
      accent: 'bg-rose-500',
      avatar: 'bg-rose-500 text-white',
    },
    emerald: {
      bg: 'bg-emerald-100 dark:bg-emerald-950',
      bgSoft: 'bg-emerald-50 dark:bg-emerald-900/20',
      border: 'border-emerald-300 dark:border-emerald-700',
      text: 'text-emerald-700 dark:text-emerald-300',
      accent: 'bg-emerald-500',
      avatar: 'bg-emerald-500 text-white',
    },
    amber: {
      bg: 'bg-amber-100 dark:bg-amber-950',
      bgSoft: 'bg-amber-50 dark:bg-amber-900/20',
      border: 'border-amber-300 dark:border-amber-700',
      text: 'text-amber-700 dark:text-amber-300',
      accent: 'bg-amber-500',
      avatar: 'bg-amber-500 text-white',
    },
    violet: {
      bg: 'bg-violet-100 dark:bg-violet-950',
      bgSoft: 'bg-violet-50 dark:bg-violet-900/20',
      border: 'border-violet-300 dark:border-violet-700',
      text: 'text-violet-700 dark:text-violet-300',
      accent: 'bg-violet-500',
      avatar: 'bg-violet-500 text-white',
    },
  };

  return colorMap[color as keyof typeof colorMap] || colorMap.sky;
};
