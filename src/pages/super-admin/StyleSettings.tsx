import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeading, SmallText, SectionHeading, BodyText, LabelText, CardTitleStyled } from '@/components/ui/typography';
import { Type, Heading1, Heading2, LetterText, Square, FileText, Tag, MousePointer, Eye, Smile } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { UserAvatar } from '@/components/ui/user-avatar';

const TEXT_SIZES = [
  { value: 'text-xs', label: 'Extra Small (12px)' },
  { value: 'text-sm', label: 'Small (14px)' },
  { value: 'text-base', label: 'Base (16px)' },
  { value: 'text-lg', label: 'Large (18px)' },
  { value: 'text-xl', label: 'XL (20px)' },
  { value: 'text-2xl', label: '2XL (24px)' },
  { value: 'text-3xl', label: '3XL (30px)' },
  { value: 'text-4xl', label: '4XL (36px)' },
];

const FONT_WEIGHTS = [
  { value: 'font-normal', label: 'Normal (400)' },
  { value: 'font-medium', label: 'Medium (500)' },
  { value: 'font-semibold', label: 'Semibold (600)' },
  { value: 'font-bold', label: 'Bold (700)' },
];

const TEXT_COLORS = [
  { value: 'text-foreground', label: 'Foreground (Default)' },
  { value: 'text-muted-foreground', label: 'Muted' },
  { value: 'text-primary', label: 'Primary' },
  { value: 'text-secondary-foreground', label: 'Secondary' },
];

const BORDER_RADII = [
  { value: '0', label: 'None (0)' },
  { value: '0.25rem', label: 'Small (4px)' },
  { value: '0.5rem', label: 'Medium (8px)' },
  { value: '0.75rem', label: 'Large (12px)' },
  { value: '1rem', label: 'XL (16px)' },
  { value: '1.5rem', label: '2XL (24px)' },
];

const KAWAII_FACE_STYLES = [
  { value: 'line', label: 'Line (^_^)' },
  { value: 'round', label: 'Round (●_●)' },
  { value: 'happy', label: 'Happy (◠‿◠)' },
];

const KAWAII_FREQUENCIES = [
  { value: 'slow', label: 'Slow' },
  { value: 'normal', label: 'Normal' },
  { value: 'fast', label: 'Fast' },
];

interface StyleSettings {
  page_heading_size: string;
  page_heading_weight: string;
  page_heading_color: string;
  section_heading_size: string;
  section_heading_weight: string;
  section_heading_color: string;
  card_title_size: string;
  card_title_weight: string;
  card_title_color: string;
  dialog_title_size: string;
  dialog_title_weight: string;
  dialog_title_color: string;
  body_text_size: string;
  body_text_weight: string;
  body_text_color: string;
  small_text_size: string;
  small_text_weight: string;
  small_text_color: string;
  label_text_size: string;
  label_text_weight: string;
  label_text_color: string;
  button_text_size: string;
  button_text_weight: string;
  border_radius: string;
  // Kawaii face settings
  kawaii_faces_enabled: boolean;
  kawaii_animations_enabled: boolean;
  kawaii_face_style: string;
  kawaii_animation_frequency: string;
  kawaii_min_animate_size: number;
}

export default function StyleSettings() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<StyleSettings | null>(null);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['global-style-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('global_style_settings')
        .select('*')
        .eq('id', 1)
        .single();
      
      if (error) throw error;
      return data as StyleSettings;
    }
  });

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<StyleSettings>) => {
      const { error } = await supabase
        .from('global_style_settings')
        .update(updates)
        .eq('id', 1);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-style-settings'] });
      toast.success('Style settings updated');
    },
    onError: () => {
      toast.error('Failed to update style settings');
    }
  });

  const handleChange = (field: keyof StyleSettings, value: string | number | boolean) => {
    if (!formData) return;
    setFormData(prev => prev ? { ...prev, [field]: value } : prev);
  };

  const handleSave = () => {
    if (!formData) return;
    updateMutation.mutate(formData);
  };

  const handleReset = () => {
    updateMutation.mutate({
      page_heading_size: 'text-3xl',
      page_heading_weight: 'font-bold',
      page_heading_color: 'text-foreground',
      section_heading_size: 'text-2xl',
      section_heading_weight: 'font-semibold',
      section_heading_color: 'text-foreground',
      card_title_size: 'text-lg',
      card_title_weight: 'font-semibold',
      card_title_color: 'text-foreground',
      dialog_title_size: 'text-lg',
      dialog_title_weight: 'font-semibold',
      dialog_title_color: 'text-foreground',
      body_text_size: 'text-base',
      body_text_weight: 'font-normal',
      body_text_color: 'text-foreground',
      small_text_size: 'text-sm',
      small_text_weight: 'font-normal',
      small_text_color: 'text-muted-foreground',
      label_text_size: 'text-sm',
      label_text_weight: 'font-medium',
      label_text_color: 'text-foreground',
      button_text_size: 'text-sm',
      button_text_weight: 'font-medium',
      border_radius: '0.75rem',
      kawaii_faces_enabled: true,
      kawaii_animations_enabled: true,
      kawaii_face_style: 'line',
      kawaii_animation_frequency: 'normal',
      kawaii_min_animate_size: 30,
    });
  };

  if (isLoading || !formData) {
    return (
      <div className="page-padding component-spacing">
        <div className="section-spacing">
          <PageHeading>Style Settings</PageHeading>
          <SmallText>Manage global typography and styling</SmallText>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Helper type for string-only fields (typography)
  type StringField = Exclude<keyof StyleSettings, 'kawaii_faces_enabled' | 'kawaii_animations_enabled' | 'kawaii_min_animate_size'>;
  
  const renderStyleCard = (
    title: string,
    description: string,
    icon: React.ReactNode,
    sizeField: StringField,
    weightField: StringField,
    colorField: StringField,
    previewClass: string
  ) => (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs">Size</Label>
          <Select value={formData[sizeField] as string} onValueChange={(v) => handleChange(sizeField, v)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TEXT_SIZES.map(size => (
                <SelectItem key={size.value} value={size.value}>{size.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Weight</Label>
          <Select value={formData[weightField] as string} onValueChange={(v) => handleChange(weightField, v)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_WEIGHTS.map(weight => (
                <SelectItem key={weight.value} value={weight.value}>{weight.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Color</Label>
          <Select value={formData[colorField] as string} onValueChange={(v) => handleChange(colorField, v)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TEXT_COLORS.map(color => (
                <SelectItem key={color.value} value={color.value}>{color.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="pt-2 border-t">
          <Label className="text-xs text-muted-foreground">Preview</Label>
          <div className={`mt-1 ${formData[sizeField]} ${formData[weightField]} ${formData[colorField]}`}>
            Sample Text
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="page-padding component-spacing">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 section-spacing">
        <div>
          <PageHeading>Style Settings</PageHeading>
          <SmallText>Manage global typography and styling throughout the app</SmallText>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset}>
            Reset to Defaults
          </Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="headings" className="w-full">
        <TabsList className="w-full max-w-2xl grid grid-cols-5">
          <TabsTrigger value="headings">Headings</TabsTrigger>
          <TabsTrigger value="text">Text</TabsTrigger>
          <TabsTrigger value="components">Components</TabsTrigger>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="avatars">Avatars</TabsTrigger>
        </TabsList>

        <TabsContent value="headings" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            {renderStyleCard(
              'Page Headings',
              'Main page titles (H1)',
              <Heading1 className="w-4 h-4" />,
              'page_heading_size',
              'page_heading_weight',
              'page_heading_color',
              'page-heading'
            )}
            {renderStyleCard(
              'Section Headings',
              'Section titles (H2)',
              <Heading2 className="w-4 h-4" />,
              'section_heading_size',
              'section_heading_weight',
              'section_heading_color',
              'section-heading'
            )}
          </div>
        </TabsContent>

        <TabsContent value="text" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {renderStyleCard(
              'Body Text',
              'Regular paragraph text',
              <Type className="w-4 h-4" />,
              'body_text_size',
              'body_text_weight',
              'body_text_color',
              'body-text'
            )}
            {renderStyleCard(
              'Small Text',
              'Helper and meta text',
              <LetterText className="w-4 h-4" />,
              'small_text_size',
              'small_text_weight',
              'small_text_color',
              'small-text'
            )}
            {renderStyleCard(
              'Label Text',
              'Form labels and captions',
              <Tag className="w-4 h-4" />,
              'label_text_size',
              'label_text_weight',
              'label_text_color',
              'label-text'
            )}
          </div>
        </TabsContent>

        <TabsContent value="components" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {renderStyleCard(
              'Card Titles',
              'Titles in cards and widgets',
              <Square className="w-4 h-4" />,
              'card_title_size',
              'card_title_weight',
              'card_title_color',
              'card-title'
            )}
            {renderStyleCard(
              'Dialog Titles',
              'Modal and dialog headings',
              <FileText className="w-4 h-4" />,
              'dialog_title_size',
              'dialog_title_weight',
              'dialog_title_color',
              'dialog-title'
            )}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MousePointer className="w-4 h-4" />
                  Button Text
                </CardTitle>
                <CardDescription>Text style for buttons</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs">Size</Label>
                  <Select value={formData.button_text_size} onValueChange={(v) => handleChange('button_text_size', v)}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEXT_SIZES.slice(0, 4).map(size => (
                        <SelectItem key={size.value} value={size.value}>{size.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Weight</Label>
                  <Select value={formData.button_text_weight} onValueChange={(v) => handleChange('button_text_weight', v)}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FONT_WEIGHTS.map(weight => (
                        <SelectItem key={weight.value} value={weight.value}>{weight.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="pt-2 border-t">
                  <Label className="text-xs text-muted-foreground">Preview</Label>
                  <div className="mt-2">
                    <Button className={`${formData.button_text_size} ${formData.button_text_weight}`}>
                      Sample Button
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="general" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Square className="w-4 h-4" />
                  Border Radius
                </CardTitle>
                <CardDescription>Global border radius for cards, buttons, and inputs</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs">Radius</Label>
                  <Select value={formData.border_radius} onValueChange={(v) => handleChange('border_radius', v)}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BORDER_RADII.map(radius => (
                        <SelectItem key={radius.value} value={radius.value}>{radius.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="pt-2 border-t">
                  <Label className="text-xs text-muted-foreground">Preview</Label>
                  <div className="mt-2 flex gap-2">
                    <div 
                      className="w-16 h-16 bg-primary"
                      style={{ borderRadius: formData.border_radius }}
                    />
                    <div 
                      className="w-24 h-10 bg-secondary flex items-center justify-center text-sm"
                      style={{ borderRadius: formData.border_radius }}
                    >
                      Button
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="avatars" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Kawaii Face Settings */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Smile className="w-4 h-4" />
                  Kawaii Faces
                </CardTitle>
                <CardDescription>Add cute animated faces to avatars</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Kawaii Faces</Label>
                    <p className="text-xs text-muted-foreground">Show face overlays on avatars</p>
                  </div>
                  <Switch 
                    checked={formData.kawaii_faces_enabled}
                    onCheckedChange={(checked) => handleChange('kawaii_faces_enabled', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Animations</Label>
                    <p className="text-xs text-muted-foreground">Occasional blink, wink, smile</p>
                  </div>
                  <Switch 
                    checked={formData.kawaii_animations_enabled}
                    onCheckedChange={(checked) => handleChange('kawaii_animations_enabled', checked)}
                    disabled={!formData.kawaii_faces_enabled}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Default Face Style</Label>
                  <Select 
                    value={formData.kawaii_face_style} 
                    onValueChange={(v) => handleChange('kawaii_face_style', v)}
                    disabled={!formData.kawaii_faces_enabled}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {KAWAII_FACE_STYLES.map(style => (
                        <SelectItem key={style.value} value={style.value}>{style.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Animation Frequency</Label>
                  <Select 
                    value={formData.kawaii_animation_frequency} 
                    onValueChange={(v) => handleChange('kawaii_animation_frequency', v)}
                    disabled={!formData.kawaii_faces_enabled || !formData.kawaii_animations_enabled}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {KAWAII_FREQUENCIES.map(freq => (
                        <SelectItem key={freq.value} value={freq.value}>{freq.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Min Size for Animation (px)</Label>
                  <Input 
                    type="number"
                    min={20}
                    max={100}
                    value={formData.kawaii_min_animate_size}
                    onChange={(e) => handleChange('kawaii_min_animate_size', parseInt(e.target.value) || 30)}
                    disabled={!formData.kawaii_faces_enabled || !formData.kawaii_animations_enabled}
                    className="h-9"
                  />
                  <p className="text-xs text-muted-foreground">Avatars smaller than this won't animate</p>
                </div>
              </CardContent>
            </Card>

            {/* Preview Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  Preview
                </CardTitle>
                <CardDescription>See how kawaii faces look on different avatar sizes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-end gap-4">
                  <div className="text-center">
                    <UserAvatar 
                      name="Extra Small" 
                      size="xs" 
                      color="sky"
                      kawaiiFace={formData.kawaii_faces_enabled}
                      faceStyle={formData.kawaii_face_style as 'line' | 'round' | 'happy'}
                    />
                    <p className="text-xs text-muted-foreground mt-1">xs (20px)</p>
                  </div>
                  <div className="text-center">
                    <UserAvatar 
                      name="Small" 
                      size="sm" 
                      color="rose"
                      kawaiiFace={formData.kawaii_faces_enabled}
                      faceStyle={formData.kawaii_face_style as 'line' | 'round' | 'happy'}
                    />
                    <p className="text-xs text-muted-foreground mt-1">sm (24px)</p>
                  </div>
                  <div className="text-center">
                    <UserAvatar 
                      name="Medium" 
                      size="md" 
                      color="emerald"
                      kawaiiFace={formData.kawaii_faces_enabled}
                      faceStyle={formData.kawaii_face_style as 'line' | 'round' | 'happy'}
                    />
                    <p className="text-xs text-muted-foreground mt-1">md (32px)</p>
                  </div>
                  <div className="text-center">
                    <UserAvatar 
                      name="Large" 
                      size="lg" 
                      color="amber"
                      kawaiiFace={formData.kawaii_faces_enabled}
                      faceStyle={formData.kawaii_face_style as 'line' | 'round' | 'happy'}
                    />
                    <p className="text-xs text-muted-foreground mt-1">lg (40px)</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  Animations only run on md and lg sizes when enabled. Small avatars show static faces.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
