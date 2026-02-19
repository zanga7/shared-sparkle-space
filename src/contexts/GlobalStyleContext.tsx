import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface GlobalStyles {
  // Page Headings
  pageHeadingSize: string;
  pageHeadingWeight: string;
  pageHeadingColor: string;
  // Section Headings
  sectionHeadingSize: string;
  sectionHeadingWeight: string;
  sectionHeadingColor: string;
  // Card Titles
  cardTitleSize: string;
  cardTitleWeight: string;
  cardTitleColor: string;
  // Dialog Titles
  dialogTitleSize: string;
  dialogTitleWeight: string;
  dialogTitleColor: string;
  // Body Text
  bodyTextSize: string;
  bodyTextWeight: string;
  bodyTextColor: string;
  // Small/Helper Text
  smallTextSize: string;
  smallTextWeight: string;
  smallTextColor: string;
  // Label Text
  labelTextSize: string;
  labelTextWeight: string;
  labelTextColor: string;
  // Button Text
  buttonTextSize: string;
  buttonTextWeight: string;
  // Border Radius
  borderRadius: string;
  // Fonts
  headingFontFamily: string;
  bodyFontFamily: string;
}

// Default styles matching current app styling
const defaultStyles: GlobalStyles = {
  pageHeadingSize: 'text-[39px]',
  pageHeadingWeight: 'font-bold',
  pageHeadingColor: 'text-foreground',
  sectionHeadingSize: 'text-[31px]',
  sectionHeadingWeight: 'font-semibold',
  sectionHeadingColor: 'text-foreground',
  cardTitleSize: 'text-[23px]',
  cardTitleWeight: 'font-semibold',
  cardTitleColor: 'text-foreground',
  dialogTitleSize: 'text-[23px]',
  dialogTitleWeight: 'font-semibold',
  dialogTitleColor: 'text-foreground',
  bodyTextSize: 'text-[21px]',
  bodyTextWeight: 'font-normal',
  bodyTextColor: 'text-foreground',
  smallTextSize: 'text-[18px]',
  smallTextWeight: 'font-normal',
  smallTextColor: 'text-muted-foreground',
  labelTextSize: 'text-[18px]',
  labelTextWeight: 'font-medium',
  labelTextColor: 'text-foreground',
  buttonTextSize: 'text-[18px]',
  buttonTextWeight: 'font-medium',
  borderRadius: '0.75rem',
  headingFontFamily: 'Inter',
  bodyFontFamily: 'Inter',
};

interface GlobalStyleContextType {
  styles: GlobalStyles;
  isLoading: boolean;
  // Compound class helpers
  pageHeading: string;
  sectionHeading: string;
  cardTitle: string;
  dialogTitle: string;
  bodyText: string;
  smallText: string;
  labelText: string;
  buttonText: string;
}

const GlobalStyleContext = createContext<GlobalStyleContextType | undefined>(undefined);

interface GlobalStyleProviderProps {
  children: ReactNode;
}

export function GlobalStyleProvider({ children }: GlobalStyleProviderProps) {
  const { data: styleSettings, isLoading } = useQuery({
    queryKey: ['global-style-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('global_style_settings')
        .select('*')
        .eq('id', 1)
        .single();
      
      if (error) {
        console.warn('Failed to fetch global styles, using defaults:', error);
        return null;
      }
      return data;
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    retry: 1,
  });

  // Map database fields to style object
  const styles: GlobalStyles = styleSettings ? {
    pageHeadingSize: styleSettings.page_heading_size || defaultStyles.pageHeadingSize,
    pageHeadingWeight: styleSettings.page_heading_weight || defaultStyles.pageHeadingWeight,
    pageHeadingColor: styleSettings.page_heading_color || defaultStyles.pageHeadingColor,
    sectionHeadingSize: styleSettings.section_heading_size || defaultStyles.sectionHeadingSize,
    sectionHeadingWeight: styleSettings.section_heading_weight || defaultStyles.sectionHeadingWeight,
    sectionHeadingColor: styleSettings.section_heading_color || defaultStyles.sectionHeadingColor,
    cardTitleSize: styleSettings.card_title_size || defaultStyles.cardTitleSize,
    cardTitleWeight: styleSettings.card_title_weight || defaultStyles.cardTitleWeight,
    cardTitleColor: styleSettings.card_title_color || defaultStyles.cardTitleColor,
    dialogTitleSize: styleSettings.dialog_title_size || defaultStyles.dialogTitleSize,
    dialogTitleWeight: styleSettings.dialog_title_weight || defaultStyles.dialogTitleWeight,
    dialogTitleColor: styleSettings.dialog_title_color || defaultStyles.dialogTitleColor,
    bodyTextSize: styleSettings.body_text_size || defaultStyles.bodyTextSize,
    bodyTextWeight: styleSettings.body_text_weight || defaultStyles.bodyTextWeight,
    bodyTextColor: styleSettings.body_text_color || defaultStyles.bodyTextColor,
    smallTextSize: styleSettings.small_text_size || defaultStyles.smallTextSize,
    smallTextWeight: styleSettings.small_text_weight || defaultStyles.smallTextWeight,
    smallTextColor: styleSettings.small_text_color || defaultStyles.smallTextColor,
    labelTextSize: styleSettings.label_text_size || defaultStyles.labelTextSize,
    labelTextWeight: styleSettings.label_text_weight || defaultStyles.labelTextWeight,
    labelTextColor: styleSettings.label_text_color || defaultStyles.labelTextColor,
    buttonTextSize: styleSettings.button_text_size || defaultStyles.buttonTextSize,
    buttonTextWeight: styleSettings.button_text_weight || defaultStyles.buttonTextWeight,
    borderRadius: styleSettings.border_radius || defaultStyles.borderRadius,
    headingFontFamily: (styleSettings as any).heading_font_family || defaultStyles.headingFontFamily,
    bodyFontFamily: (styleSettings as any).body_font_family || defaultStyles.bodyFontFamily,
  } : defaultStyles;

  // Dynamically load Google Fonts
  useEffect(() => {
    const loadFont = (fontName: string) => {
      const id = `gf-${fontName.replace(/\s+/g, '-')}`;
      if (document.getElementById(id)) return;
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@400;500;600;700&display=swap`;
      document.head.appendChild(link);
    };
    if (styles.headingFontFamily && styles.headingFontFamily !== 'Inter') loadFont(styles.headingFontFamily);
    if (styles.bodyFontFamily && styles.bodyFontFamily !== 'Inter') loadFont(styles.bodyFontFamily);
  }, [styles.headingFontFamily, styles.bodyFontFamily]);

  // Compound class helpers
  const value: GlobalStyleContextType = {
    styles,
    isLoading,
    pageHeading: `${styles.pageHeadingSize} ${styles.pageHeadingWeight} ${styles.pageHeadingColor}`,
    sectionHeading: `${styles.sectionHeadingSize} ${styles.sectionHeadingWeight} ${styles.sectionHeadingColor}`,
    cardTitle: `${styles.cardTitleSize} ${styles.cardTitleWeight} ${styles.cardTitleColor}`,
    dialogTitle: `${styles.dialogTitleSize} ${styles.dialogTitleWeight} ${styles.dialogTitleColor}`,
    bodyText: `${styles.bodyTextSize} ${styles.bodyTextWeight} ${styles.bodyTextColor}`,
    smallText: `${styles.smallTextSize} ${styles.smallTextWeight} ${styles.smallTextColor}`,
    labelText: `${styles.labelTextSize} ${styles.labelTextWeight} ${styles.labelTextColor}`,
    buttonText: `${styles.buttonTextSize} ${styles.buttonTextWeight}`,
  };

  return (
    <GlobalStyleContext.Provider value={value}>
      {children}
    </GlobalStyleContext.Provider>
  );
}

export function useGlobalStyles() {
  const context = useContext(GlobalStyleContext);
  if (context === undefined) {
    // Return defaults if used outside provider
    return {
      styles: defaultStyles,
      isLoading: false,
      pageHeading: `${defaultStyles.pageHeadingSize} ${defaultStyles.pageHeadingWeight} ${defaultStyles.pageHeadingColor}`,
      sectionHeading: `${defaultStyles.sectionHeadingSize} ${defaultStyles.sectionHeadingWeight} ${defaultStyles.sectionHeadingColor}`,
      cardTitle: `${defaultStyles.cardTitleSize} ${defaultStyles.cardTitleWeight} ${defaultStyles.cardTitleColor}`,
      dialogTitle: `${defaultStyles.dialogTitleSize} ${defaultStyles.dialogTitleWeight} ${defaultStyles.dialogTitleColor}`,
      bodyText: `${defaultStyles.bodyTextSize} ${defaultStyles.bodyTextWeight} ${defaultStyles.bodyTextColor}`,
      smallText: `${defaultStyles.smallTextSize} ${defaultStyles.smallTextWeight} ${defaultStyles.smallTextColor}`,
      labelText: `${defaultStyles.labelTextSize} ${defaultStyles.labelTextWeight} ${defaultStyles.labelTextColor}`,
      buttonText: `${defaultStyles.buttonTextSize} ${defaultStyles.buttonTextWeight}`,
    };
  }
  return context;
}
