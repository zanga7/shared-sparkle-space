import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface GlobalStyles {
  pageHeadingSize: string;
  pageHeadingWeight: string;
  pageHeadingColor: string;
  pageHeadingTransform: string;
  sectionHeadingSize: string;
  sectionHeadingWeight: string;
  sectionHeadingColor: string;
  sectionHeadingTransform: string;
  cardTitleSize: string;
  cardTitleWeight: string;
  cardTitleColor: string;
  cardTitleTransform: string;
  dialogTitleSize: string;
  dialogTitleWeight: string;
  dialogTitleColor: string;
  dialogTitleTransform: string;
  bodyTextSize: string;
  bodyTextWeight: string;
  bodyTextColor: string;
  smallTextSize: string;
  smallTextWeight: string;
  smallTextColor: string;
  labelTextSize: string;
  labelTextWeight: string;
  labelTextColor: string;
  buttonTextSize: string;
  buttonTextWeight: string;
  borderRadius: string;
  headingFontFamily: string;
  bodyFontFamily: string;
}

const defaultStyles: GlobalStyles = {
  pageHeadingSize: 'text-[2.4375rem]',
  pageHeadingWeight: 'font-bold',
  pageHeadingColor: 'text-foreground',
  pageHeadingTransform: 'uppercase',
  sectionHeadingSize: 'text-[1.9375rem]',
  sectionHeadingWeight: 'font-semibold',
  sectionHeadingColor: 'text-foreground',
  sectionHeadingTransform: 'uppercase',
  cardTitleSize: 'text-[1.4375rem]',
  cardTitleWeight: 'font-semibold',
  cardTitleColor: 'text-foreground',
  cardTitleTransform: 'normal-case',
  dialogTitleSize: 'text-[1.4375rem]',
  dialogTitleWeight: 'font-semibold',
  dialogTitleColor: 'text-foreground',
  dialogTitleTransform: 'normal-case',
  bodyTextSize: 'text-[1.3125rem]',
  bodyTextWeight: 'font-normal',
  bodyTextColor: 'text-foreground',
  smallTextSize: 'text-[1.125rem]',
  smallTextWeight: 'font-normal',
  smallTextColor: 'text-muted-foreground',
  labelTextSize: 'text-[1.125rem]',
  labelTextWeight: 'font-medium',
  labelTextColor: 'text-foreground',
  buttonTextSize: 'text-[1.125rem]',
  buttonTextWeight: 'font-medium',
  borderRadius: '0.75rem',
  headingFontFamily: 'Erica One',
  bodyFontFamily: 'Inter',
};

interface GlobalStyleContextType {
  styles: GlobalStyles;
  isLoading: boolean;
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
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  const styles: GlobalStyles = styleSettings ? {
    pageHeadingSize: styleSettings.page_heading_size || defaultStyles.pageHeadingSize,
    pageHeadingWeight: styleSettings.page_heading_weight || defaultStyles.pageHeadingWeight,
    pageHeadingColor: styleSettings.page_heading_color || defaultStyles.pageHeadingColor,
    pageHeadingTransform: (styleSettings as any).page_heading_transform || defaultStyles.pageHeadingTransform,
    sectionHeadingSize: styleSettings.section_heading_size || defaultStyles.sectionHeadingSize,
    sectionHeadingWeight: styleSettings.section_heading_weight || defaultStyles.sectionHeadingWeight,
    sectionHeadingColor: styleSettings.section_heading_color || defaultStyles.sectionHeadingColor,
    sectionHeadingTransform: (styleSettings as any).section_heading_transform || defaultStyles.sectionHeadingTransform,
    cardTitleSize: styleSettings.card_title_size || defaultStyles.cardTitleSize,
    cardTitleWeight: styleSettings.card_title_weight || defaultStyles.cardTitleWeight,
    cardTitleColor: styleSettings.card_title_color || defaultStyles.cardTitleColor,
    cardTitleTransform: (styleSettings as any).card_title_transform || defaultStyles.cardTitleTransform,
    dialogTitleSize: styleSettings.dialog_title_size || defaultStyles.dialogTitleSize,
    dialogTitleWeight: styleSettings.dialog_title_weight || defaultStyles.dialogTitleWeight,
    dialogTitleColor: styleSettings.dialog_title_color || defaultStyles.dialogTitleColor,
    dialogTitleTransform: (styleSettings as any).dialog_title_transform || defaultStyles.dialogTitleTransform,
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

  const value: GlobalStyleContextType = {
    styles,
    isLoading,
    pageHeading: `${styles.pageHeadingSize} ${styles.pageHeadingWeight} ${styles.pageHeadingColor} ${styles.pageHeadingTransform}`,
    sectionHeading: `${styles.sectionHeadingSize} ${styles.sectionHeadingWeight} ${styles.sectionHeadingColor} ${styles.sectionHeadingTransform}`,
    cardTitle: `${styles.cardTitleSize} ${styles.cardTitleWeight} ${styles.cardTitleColor} ${styles.cardTitleTransform}`,
    dialogTitle: `${styles.dialogTitleSize} ${styles.dialogTitleWeight} ${styles.dialogTitleColor} ${styles.dialogTitleTransform}`,
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
    return {
      styles: defaultStyles,
      isLoading: false,
      pageHeading: `${defaultStyles.pageHeadingSize} ${defaultStyles.pageHeadingWeight} ${defaultStyles.pageHeadingColor} ${defaultStyles.pageHeadingTransform}`,
      sectionHeading: `${defaultStyles.sectionHeadingSize} ${defaultStyles.sectionHeadingWeight} ${defaultStyles.sectionHeadingColor} ${defaultStyles.sectionHeadingTransform}`,
      cardTitle: `${defaultStyles.cardTitleSize} ${defaultStyles.cardTitleWeight} ${defaultStyles.cardTitleColor} ${defaultStyles.cardTitleTransform}`,
      dialogTitle: `${defaultStyles.dialogTitleSize} ${defaultStyles.dialogTitleWeight} ${defaultStyles.dialogTitleColor} ${defaultStyles.dialogTitleTransform}`,
      bodyText: `${defaultStyles.bodyTextSize} ${defaultStyles.bodyTextWeight} ${defaultStyles.bodyTextColor}`,
      smallText: `${defaultStyles.smallTextSize} ${defaultStyles.smallTextWeight} ${defaultStyles.smallTextColor}`,
      labelText: `${defaultStyles.labelTextSize} ${defaultStyles.labelTextWeight} ${defaultStyles.labelTextColor}`,
      buttonText: `${defaultStyles.buttonTextSize} ${defaultStyles.buttonTextWeight}`,
    };
  }
  return context;
}
