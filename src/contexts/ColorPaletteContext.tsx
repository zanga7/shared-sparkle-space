import { createContext, useContext, ReactNode, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ColorPalette {
  id: string;
  name: string;
  color_key: string;
  hex_value: string;
}

// Hardcoded fallback colors to ensure colors are always available
const FALLBACK_COLORS: Record<string, string> = {
  sky: '#0ea5e9',
  blue: '#005DE5',
  rose: '#f43f5e',
  emerald: '#10b981',
  amber: '#f59e0b',
  violet: '#9568E7',
  pink: '#FA8FE6',
  green: '#4DBC4E',
  lime: '#B6F202',
  mustard: '#E6D726',
  melon: '#FF7865',
};

interface ColorPaletteContextType {
  colors: ColorPalette[];
  getColorHex: (colorKey: string) => string;
  getMemberColorStyles: (colorKey: string) => {
    bg: React.CSSProperties;
    bgSoft: React.CSSProperties;
    bg10: React.CSSProperties;
    bg20: React.CSSProperties;
    bg50: React.CSSProperties;
    border: React.CSSProperties;
    text: React.CSSProperties;
    accent: React.CSSProperties;
    avatar: React.CSSProperties;
  };
  isLoading: boolean;
}

const ColorPaletteContext = createContext<ColorPaletteContextType | undefined>(undefined);

export function ColorPaletteProvider({ children }: { children: ReactNode }) {
  const { data: colors = [], isLoading } = useQuery({
    queryKey: ['color-palettes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('color_palettes')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as ColorPalette[];
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Build a lookup map that includes both DB colors and fallbacks
  const colorLookup = useMemo(() => {
    const lookup: Record<string, string> = { ...FALLBACK_COLORS };
    colors.forEach(c => {
      lookup[c.color_key] = c.hex_value;
    });
    return lookup;
  }, [colors]);

  const getColorHex = (colorKey: string): string => {
    return colorLookup[colorKey] || colorLookup['sky'] || '#0ea5e9';
  };

  const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  };

  const getMemberColorStyles = (colorKey: string) => {
    const hex = getColorHex(colorKey);
    const rgb = hexToRgb(hex);
    
    if (!rgb) {
      // Fallback styles
      return {
        bg: { backgroundColor: hex },
        bgSoft: { backgroundColor: `${hex}20` },
        bg10: { backgroundColor: `${hex}1A` },
        bg20: { backgroundColor: `${hex}33` },
        bg50: { backgroundColor: `${hex}80` },
        border: { borderColor: hex },
        text: { color: hex },
        accent: { backgroundColor: hex },
        avatar: { backgroundColor: hex, color: 'white' },
      };
    }

    return {
      bg: { backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)` },
      bgSoft: { backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.05)` },
      bg10: { backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)` },
      bg20: { backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)` },
      bg50: { backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)` },
      border: { borderColor: hex },
      text: { color: hex },
      accent: { backgroundColor: hex },
      avatar: { backgroundColor: hex, color: 'white' },
    };
  };

  return (
    <ColorPaletteContext.Provider value={{ colors, getColorHex, getMemberColorStyles, isLoading }}>
      {children}
    </ColorPaletteContext.Provider>
  );
}

export function useColorPalette() {
  const context = useContext(ColorPaletteContext);
  if (context === undefined) {
    throw new Error('useColorPalette must be used within a ColorPaletteProvider');
  }
  return context;
}
