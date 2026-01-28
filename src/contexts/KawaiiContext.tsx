import React, { createContext, useContext, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { KawaiiFaceStyle } from '@/components/ui/kawaii-face-overlay';

export interface KawaiiSettings {
  enabled: boolean;
  animationsEnabled: boolean;
  defaultStyle: KawaiiFaceStyle;
  animationFrequency: 'slow' | 'normal' | 'fast';
  minAnimateSize: number;
}

const defaultSettings: KawaiiSettings = {
  enabled: true,
  animationsEnabled: true,
  defaultStyle: 'line',
  animationFrequency: 'normal',
  minAnimateSize: 30,
};

const KawaiiContext = createContext<KawaiiSettings>(defaultSettings);

interface KawaiiProviderProps {
  children: ReactNode;
}

export function KawaiiProvider({ children }: KawaiiProviderProps) {
  const { data: dbSettings } = useQuery({
    queryKey: ['kawaii-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('global_style_settings')
        .select('kawaii_faces_enabled, kawaii_animations_enabled, kawaii_face_style, kawaii_animation_frequency, kawaii_min_animate_size')
        .eq('id', 1)
        .maybeSingle();
      
      if (error) {
        console.warn('Failed to fetch kawaii settings, using defaults:', error);
        return null;
      }
      return data;
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    retry: 1,
  });

  const settings: KawaiiSettings = dbSettings ? {
    enabled: dbSettings.kawaii_faces_enabled ?? defaultSettings.enabled,
    animationsEnabled: dbSettings.kawaii_animations_enabled ?? defaultSettings.animationsEnabled,
    defaultStyle: (dbSettings.kawaii_face_style as KawaiiFaceStyle) ?? defaultSettings.defaultStyle,
    animationFrequency: (dbSettings.kawaii_animation_frequency as KawaiiSettings['animationFrequency']) ?? defaultSettings.animationFrequency,
    minAnimateSize: dbSettings.kawaii_min_animate_size ?? defaultSettings.minAnimateSize,
  } : defaultSettings;

  return (
    <KawaiiContext.Provider value={settings}>
      {children}
    </KawaiiContext.Provider>
  );
}

export function useKawaiiSettings(): KawaiiSettings {
  return useContext(KawaiiContext);
}
