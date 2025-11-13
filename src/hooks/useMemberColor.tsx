import { useColorPalette } from '@/contexts/ColorPaletteContext';

export function useMemberColor(colorKey?: string) {
  const { getMemberColorStyles, getColorHex } = useColorPalette();
  
  if (!colorKey) {
    return {
      hex: '#0ea5e9',
      styles: getMemberColorStyles('sky'),
    };
  }
  
  return {
    hex: getColorHex(colorKey),
    styles: getMemberColorStyles(colorKey),
  };
}
