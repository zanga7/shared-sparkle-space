import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PageHeading, SmallText, SectionHeading, BodyText, LabelText, CardTitleStyled } from '@/components/ui/typography';
import { Type, Heading1, Heading2, LetterText, Square, FileText, Tag, MousePointer, Eye, Smile, Search, Loader2, Plus, Edit, Trash2, Users, Calendar, Palette, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { UserAvatar } from '@/components/ui/user-avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { sanitizeSVG } from '@/lib/utils';

const TEXT_SIZES = [
  { value: 'text-[1rem]', label: 'Extra Small (16px)' },
  { value: 'text-[1.125rem]', label: 'Small (18px)' },
  { value: 'text-[1.3125rem]', label: 'Base (21px)' },
  { value: 'text-[1.4375rem]', label: 'Large (23px)' },
  { value: 'text-[1.625rem]', label: 'XL (26px)' },
  { value: 'text-[1.9375rem]', label: '2XL (31px)' },
  { value: 'text-[2.4375rem]', label: '3XL (39px)' },
  { value: 'text-[2.9375rem]', label: '4XL (47px)' },
  { value: 'text-[3.75rem]', label: '5XL (60px)' },
];

const TEXT_TRANSFORMS = [
  { value: 'uppercase', label: 'UPPERCASE' },
  { value: 'lowercase', label: 'lowercase' },
  { value: 'capitalize', label: 'Capitalize' },
  { value: 'normal-case', label: 'Normal' },
];

// Popular Google Fonts for selection
const POPULAR_GOOGLE_FONTS = [
  'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins',
  'Oswald', 'Raleway', 'Nunito', 'Playfair Display', 'Merriweather',
  'Source Sans 3', 'PT Sans', 'Rubik', 'Work Sans', 'Quicksand',
  'Outfit', 'Space Grotesk', 'DM Sans', 'Manrope', 'Sora',
  'Bitter', 'Crimson Text', 'Libre Baskerville', 'EB Garamond',
  'Josefin Sans', 'Archivo', 'Barlow', 'Cabin', 'Karla',
  'Fira Sans', 'Mulish', 'Noto Sans', 'IBM Plex Sans', 'Ubuntu',
  'Bebas Neue', 'Anton', 'Righteous', 'Permanent Marker', 'Pacifico',
  'Comfortaa', 'Titan One', 'Fredoka', 'Baloo 2', 'Lilita One',
  'Erica One',
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
  page_heading_transform: string;
  section_heading_size: string;
  section_heading_weight: string;
  section_heading_color: string;
  section_heading_transform: string;
  card_title_size: string;
  card_title_weight: string;
  card_title_color: string;
  card_title_transform: string;
  dialog_title_size: string;
  dialog_title_weight: string;
  dialog_title_color: string;
  dialog_title_transform: string;
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
  heading_font_family: string;
  body_font_family: string;
  kawaii_faces_enabled: boolean;
  kawaii_animations_enabled: boolean;
  kawaii_face_style: string;
  kawaii_animation_frequency: string;
  kawaii_min_animate_size: number;
}

interface AvatarIcon {
  id: string;
  name: string;
  svg_content: string;
  is_system: boolean;
  icon_type: string | null;
}

interface ColorPalette {
  id: string;
  name: string;
  color_key: string;
  hex_value: string;
  is_system: boolean;
}

// Load a Google Font dynamically
function loadGoogleFont(fontName: string) {
  const id = `gf-${fontName.replace(/\s+/g, '-')}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@400;500;600;700&display=swap`;
  document.head.appendChild(link);
}

function GoogleFontPicker({ label, description, value, onChange }: {
  label: string;
  description: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [search, setSearch] = useState('');
  const filtered = POPULAR_GOOGLE_FONTS.filter(f =>
    f.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => { loadGoogleFont(value); }, [value]);
  useEffect(() => { filtered.slice(0, 8).forEach(loadGoogleFont); }, [search]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{label}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search fonts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <ScrollArea className="h-48">
          <div className="space-y-1">
            {filtered.map(font => (
              <button
                key={font}
                type="button"
                onClick={() => onChange(font)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  value === font
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                }`}
                style={{ fontFamily: `"${font}", sans-serif` }}
              >
                {font}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground p-3">No fonts match "{search}"</p>
            )}
          </div>
        </ScrollArea>
        <p className="text-xs text-muted-foreground">
          Current: <span style={{ fontFamily: `"${value}", sans-serif` }} className="font-medium">{value}</span>
        </p>
      </CardContent>
    </Card>
  );
}

export default function StyleSettings() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<StyleSettings | null>(null);

  // Icon/color state
  const [iconDialogOpen, setIconDialogOpen] = useState(false);
  const [colorDialogOpen, setColorDialogOpen] = useState(false);
  const [deleteIconId, setDeleteIconId] = useState<string | null>(null);
  const [deleteColorId, setDeleteColorId] = useState<string | null>(null);
  const [editingIcon, setEditingIcon] = useState<AvatarIcon | null>(null);
  const [editingColor, setEditingColor] = useState<ColorPalette | null>(null);
  const [newIconType, setNewIconType] = useState<string>('avatar');

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

  // Fetch avatar icons
  const { data: icons, isLoading: iconsLoading } = useQuery({
    queryKey: ['avatar-icons'],
    queryFn: async () => {
      const { data, error } = await supabase.from('avatar_icons').select('*').order('is_system', { ascending: false }).order('name');
      if (error) throw error;
      return data as AvatarIcon[];
    }
  });

  // Fetch color palettes
  const { data: colors, isLoading: colorsLoading } = useQuery({
    queryKey: ['color-palettes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('color_palettes').select('*').order('is_system', { ascending: false }).order('name');
      if (error) throw error;
      return data as ColorPalette[];
    }
  });

  const avatarIcons = icons?.filter(icon => icon.icon_type === 'avatar' || icon.icon_type === null) || [];
  const celebrationIcons = icons?.filter(icon => icon.icon_type === 'celebration') || [];

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<StyleSettings>) => {
      const { error } = await supabase.from('global_style_settings').update(updates).eq('id', 1);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-style-settings'] });
      toast.success('Style settings updated');
    },
    onError: () => { toast.error('Failed to update style settings'); }
  });

  // Icon mutations
  const saveIconMutation = useMutation({
    mutationFn: async (formData: { name: string; svg_content: string; icon_type: string; id?: string }) => {
      if (formData.id) {
        const { error } = await supabase.from('avatar_icons').update({ name: formData.name, svg_content: formData.svg_content, icon_type: formData.icon_type }).eq('id', formData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('avatar_icons').insert({ name: formData.name, svg_content: formData.svg_content, icon_type: formData.icon_type });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['avatar-icons'] });
      setIconDialogOpen(false);
      setEditingIcon(null);
      toast.success(editingIcon ? 'Icon updated' : 'Icon added');
    },
    onError: () => { toast.error('Failed to save icon'); }
  });

  const deleteIconMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('avatar_icons').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['avatar-icons'] });
      setDeleteIconId(null);
      toast.success('Icon deleted');
    },
    onError: () => { toast.error('Failed to delete icon'); }
  });

  const saveColorMutation = useMutation({
    mutationFn: async (formData: { name: string; color_key: string; hex_value: string; id?: string }) => {
      if (formData.id) {
        const { error } = await supabase.from('color_palettes').update({ name: formData.name, color_key: formData.color_key, hex_value: formData.hex_value }).eq('id', formData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('color_palettes').insert({ name: formData.name, color_key: formData.color_key, hex_value: formData.hex_value });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['color-palettes'] });
      setColorDialogOpen(false);
      setEditingColor(null);
      toast.success(editingColor ? 'Color updated' : 'Color added');
    },
    onError: () => { toast.error('Failed to save color'); }
  });

  const deleteColorMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('color_palettes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['color-palettes'] });
      setDeleteColorId(null);
      toast.success('Color deleted');
    },
    onError: () => { toast.error('Failed to delete color'); }
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
      page_heading_size: 'text-[2.4375rem]',
      page_heading_weight: 'font-bold',
      page_heading_color: 'text-foreground',
      page_heading_transform: 'uppercase',
      section_heading_size: 'text-[1.9375rem]',
      section_heading_weight: 'font-semibold',
      section_heading_color: 'text-foreground',
      section_heading_transform: 'uppercase',
      card_title_size: 'text-[1.4375rem]',
      card_title_weight: 'font-semibold',
      card_title_color: 'text-foreground',
      card_title_transform: 'normal-case',
      dialog_title_size: 'text-[1.4375rem]',
      dialog_title_weight: 'font-semibold',
      dialog_title_color: 'text-foreground',
      dialog_title_transform: 'normal-case',
      body_text_size: 'text-[1.3125rem]',
      body_text_weight: 'font-normal',
      body_text_color: 'text-foreground',
      small_text_size: 'text-[1.125rem]',
      small_text_weight: 'font-normal',
      small_text_color: 'text-muted-foreground',
      label_text_size: 'text-[1.125rem]',
      label_text_weight: 'font-medium',
      label_text_color: 'text-foreground',
      button_text_size: 'text-[1.125rem]',
      button_text_weight: 'font-medium',
      border_radius: '0.75rem',
      heading_font_family: 'Erica One',
      body_font_family: 'Inter',
      kawaii_faces_enabled: true,
      kawaii_animations_enabled: true,
      kawaii_face_style: 'line',
      kawaii_animation_frequency: 'normal',
      kawaii_min_animate_size: 30,
    });
  };

  const handleSaveIcon = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    saveIconMutation.mutate({
      id: editingIcon?.id,
      name: fd.get('name') as string,
      svg_content: fd.get('svg_content') as string,
      icon_type: newIconType,
    });
  };

  const handleSaveColor = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    saveColorMutation.mutate({
      id: editingColor?.id,
      name: fd.get('name') as string,
      color_key: fd.get('color_key') as string,
      hex_value: fd.get('hex_value') as string,
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, iconId?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const svgContent = event.target?.result as string;
      if (iconId) {
        const icon = icons?.find(i => i.id === iconId);
        saveIconMutation.mutate({ id: iconId, name: icon?.name || '', svg_content: svgContent, icon_type: icon?.icon_type || 'avatar' });
      }
    };
    reader.readAsText(file);
  };

  const openAddIconDialog = (type: 'avatar' | 'celebration') => {
    setEditingIcon(null);
    setNewIconType(type);
    setIconDialogOpen(true);
  };

  const openEditIconDialog = (icon: AvatarIcon) => {
    setEditingIcon(icon);
    setNewIconType(icon.icon_type || 'avatar');
    setIconDialogOpen(true);
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
              <CardHeader><Skeleton className="h-5 w-32" /><Skeleton className="h-4 w-48" /></CardHeader>
              <CardContent className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  type StringField = Exclude<keyof StyleSettings, 'kawaii_faces_enabled' | 'kawaii_animations_enabled' | 'kawaii_min_animate_size'>;
  
  const renderStyleCard = (
    title: string,
    description: string,
    icon: React.ReactNode,
    sizeField: StringField,
    weightField: StringField,
    colorField: StringField,
    transformField?: StringField,
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
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
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
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
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
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TEXT_COLORS.map(color => (
                <SelectItem key={color.value} value={color.value}>{color.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {transformField && (
          <div className="space-y-2">
            <Label className="text-xs">Text Transform</Label>
            <Select value={formData[transformField] as string} onValueChange={(v) => handleChange(transformField, v)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TEXT_TRANSFORMS.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="pt-2 border-t">
          <Label className="text-xs text-muted-foreground">Preview</Label>
          <div className={`mt-1 ${formData[sizeField]} ${formData[weightField]} ${formData[colorField]} ${transformField ? formData[transformField] : ''}`}>
            Sample Text
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderIconGrid = (iconList: AvatarIcon[], type: 'avatar' | 'celebration') => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          {type === 'avatar' ? <Users className="w-5 h-5 text-muted-foreground" /> : <Calendar className="w-5 h-5 text-muted-foreground" />}
          <h3 className="font-medium">{type === 'avatar' ? 'Avatar Icons' : 'Celebration Icons'}</h3>
          <span className="text-sm text-muted-foreground">({iconList.length})</span>
        </div>
        <Button size="sm" onClick={() => openAddIconDialog(type)}>
          <Plus className="w-4 h-4 mr-2" />
          Add {type === 'avatar' ? 'Avatar' : 'Celebration'} Icon
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
        {iconsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse"><CardContent className="p-6"><div className="h-16 bg-muted rounded mb-2" /><div className="h-4 bg-muted rounded" /></CardContent></Card>
          ))
        ) : iconList.length === 0 ? (
          <div className="col-span-full text-center py-8 text-muted-foreground">No {type} icons found</div>
        ) : (
          iconList.map((icon) => (
            <Card key={icon.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  {icon.name}
                  {icon.is_system && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">System</span>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="h-16 flex items-center justify-center bg-muted rounded">
                  <div dangerouslySetInnerHTML={{ __html: sanitizeSVG(icon.svg_content) }} className="w-12 h-12" />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => openEditIconDialog(icon)}><Edit className="w-3 h-3" /></Button>
                  <Button variant="outline" size="sm" onClick={() => document.getElementById(`upload-${icon.id}`)?.click()}>Upload</Button>
                  <input id={`upload-${icon.id}`} type="file" accept=".svg" className="hidden" onChange={(e) => handleFileUpload(e, icon.id)} />
                  <Button variant="destructive" size="sm" onClick={() => setDeleteIconId(icon.id)}><Trash2 className="w-3 h-3" /></Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );

  return (
    <>
      <div className="page-padding component-spacing">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 section-spacing">
          <div>
            <PageHeading>Style Settings</PageHeading>
            <SmallText>Manage global typography, icons, and styling throughout the app</SmallText>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleReset}>Reset to Defaults</Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="headings" className="w-full">
          <TabsList className="w-full max-w-3xl grid grid-cols-7">
            <TabsTrigger value="headings">Headings</TabsTrigger>
            <TabsTrigger value="text">Text</TabsTrigger>
            <TabsTrigger value="components">Components</TabsTrigger>
            <TabsTrigger value="fonts">Fonts</TabsTrigger>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="avatars">Avatars</TabsTrigger>
            <TabsTrigger value="icons">Icons & Colors</TabsTrigger>
          </TabsList>

          <TabsContent value="headings" className="space-y-4 mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              {renderStyleCard('Page Headings', 'Main page titles (H1)', <Heading1 className="w-4 h-4" />, 'page_heading_size', 'page_heading_weight', 'page_heading_color', 'page_heading_transform')}
              {renderStyleCard('Section Headings', 'Section titles (H2)', <Heading2 className="w-4 h-4" />, 'section_heading_size', 'section_heading_weight', 'section_heading_color', 'section_heading_transform')}
            </div>
          </TabsContent>

          <TabsContent value="text" className="space-y-4 mt-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {renderStyleCard('Body Text', 'Regular paragraph text', <Type className="w-4 h-4" />, 'body_text_size', 'body_text_weight', 'body_text_color')}
              {renderStyleCard('Small Text', 'Helper and meta text', <LetterText className="w-4 h-4" />, 'small_text_size', 'small_text_weight', 'small_text_color')}
              {renderStyleCard('Label Text', 'Form labels and captions', <Tag className="w-4 h-4" />, 'label_text_size', 'label_text_weight', 'label_text_color')}
            </div>
          </TabsContent>

          <TabsContent value="components" className="space-y-4 mt-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {renderStyleCard('Card Titles', 'Titles in cards and widgets', <Square className="w-4 h-4" />, 'card_title_size', 'card_title_weight', 'card_title_color', 'card_title_transform')}
              {renderStyleCard('Dialog Titles', 'Modal and dialog headings', <FileText className="w-4 h-4" />, 'dialog_title_size', 'dialog_title_weight', 'dialog_title_color', 'dialog_title_transform')}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2"><MousePointer className="w-4 h-4" />Button Text</CardTitle>
                  <CardDescription>Text style for buttons</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Size</Label>
                    <Select value={formData.button_text_size} onValueChange={(v) => handleChange('button_text_size', v)}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>{TEXT_SIZES.slice(0, 4).map(size => (<SelectItem key={size.value} value={size.value}>{size.label}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Weight</Label>
                    <Select value={formData.button_text_weight} onValueChange={(v) => handleChange('button_text_weight', v)}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>{FONT_WEIGHTS.map(weight => (<SelectItem key={weight.value} value={weight.value}>{weight.label}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  <div className="pt-2 border-t">
                    <Label className="text-xs text-muted-foreground">Preview</Label>
                    <div className="mt-2"><Button className={`${formData.button_text_size} ${formData.button_text_weight}`}>Sample Button</Button></div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="fonts" className="space-y-4 mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <GoogleFontPicker label="Heading Font" description="Used for page and section headings" value={formData.heading_font_family} onChange={(v) => handleChange('heading_font_family', v)} />
              <GoogleFontPicker label="Body Font" description="Used for body text, labels, and buttons" value={formData.body_font_family} onChange={(v) => handleChange('body_font_family', v)} />
            </div>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><Eye className="w-4 h-4" />Font Preview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p style={{ fontFamily: `"${formData.heading_font_family}", sans-serif` }} className="text-2xl font-bold">Heading: The quick brown fox jumps over the lazy dog</p>
                <p style={{ fontFamily: `"${formData.body_font_family}", sans-serif` }} className="text-base">Body: The quick brown fox jumps over the lazy dog. 0123456789</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="general" className="space-y-4 mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2"><Square className="w-4 h-4" />Border Radius</CardTitle>
                  <CardDescription>Global border radius for cards, buttons, and inputs</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Radius</Label>
                    <Select value={formData.border_radius} onValueChange={(v) => handleChange('border_radius', v)}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>{BORDER_RADII.map(radius => (<SelectItem key={radius.value} value={radius.value}>{radius.label}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  <div className="pt-2 border-t">
                    <Label className="text-xs text-muted-foreground">Preview</Label>
                    <div className="mt-2 flex gap-2">
                      <div className="w-16 h-16 bg-primary" style={{ borderRadius: formData.border_radius }} />
                      <div className="w-24 h-10 bg-secondary flex items-center justify-center text-sm" style={{ borderRadius: formData.border_radius }}>Button</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="avatars" className="space-y-4 mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2"><Smile className="w-4 h-4" />Kawaii Faces</CardTitle>
                  <CardDescription>Add cute animated faces to avatars</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div><Label>Enable Kawaii Faces</Label><p className="text-xs text-muted-foreground">Show face overlays on avatars</p></div>
                    <Switch checked={formData.kawaii_faces_enabled} onCheckedChange={(checked) => handleChange('kawaii_faces_enabled', checked)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div><Label>Enable Animations</Label><p className="text-xs text-muted-foreground">Occasional blink, wink, smile</p></div>
                    <Switch checked={formData.kawaii_animations_enabled} onCheckedChange={(checked) => handleChange('kawaii_animations_enabled', checked)} disabled={!formData.kawaii_faces_enabled} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Default Face Style</Label>
                    <Select value={formData.kawaii_face_style} onValueChange={(v) => handleChange('kawaii_face_style', v)} disabled={!formData.kawaii_faces_enabled}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>{KAWAII_FACE_STYLES.map(style => (<SelectItem key={style.value} value={style.value}>{style.label}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Animation Frequency</Label>
                    <Select value={formData.kawaii_animation_frequency} onValueChange={(v) => handleChange('kawaii_animation_frequency', v)} disabled={!formData.kawaii_faces_enabled || !formData.kawaii_animations_enabled}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>{KAWAII_FREQUENCIES.map(freq => (<SelectItem key={freq.value} value={freq.value}>{freq.label}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Min Size for Animation (px)</Label>
                    <Input type="number" min={20} max={100} value={formData.kawaii_min_animate_size} onChange={(e) => handleChange('kawaii_min_animate_size', parseInt(e.target.value) || 30)} disabled={!formData.kawaii_faces_enabled || !formData.kawaii_animations_enabled} className="h-9" />
                    <p className="text-xs text-muted-foreground">Avatars smaller than this won't animate</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2"><Eye className="w-4 h-4" />Preview</CardTitle>
                  <CardDescription>See how kawaii faces look on different avatar sizes</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap items-end gap-4">
                    {[{ name: 'Extra Small', size: 'xs' as const, color: 'sky' }, { name: 'Small', size: 'sm' as const, color: 'rose' }, { name: 'Medium', size: 'md' as const, color: 'emerald' }, { name: 'Large', size: 'lg' as const, color: 'amber' }].map(a => (
                      <div key={a.size} className="text-center">
                        <UserAvatar name={a.name} size={a.size} color={a.color} kawaiiFace={formData.kawaii_faces_enabled} faceStyle={formData.kawaii_face_style as 'line' | 'round' | 'happy'} />
                        <p className="text-xs text-muted-foreground mt-1">{a.size}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-4">Animations only run on md and lg sizes when enabled.</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="icons" className="space-y-6 mt-4">
            {renderIconGrid(avatarIcons, 'avatar')}
            <div className="border-t border-border pt-6">
              {renderIconGrid(celebrationIcons, 'celebration')}
            </div>
            <div className="border-t border-border pt-6">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <Palette className="w-5 h-5 text-muted-foreground" />
                  <h3 className="font-medium">Color Palettes</h3>
                  <span className="text-sm text-muted-foreground">({colors?.length || 0})</span>
                </div>
                <Button size="sm" onClick={() => { setEditingColor(null); setColorDialogOpen(true); }}>
                  <Plus className="w-4 h-4 mr-2" />Add Color
                </Button>
              </div>
              <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
                {colorsLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (<Card key={i} className="animate-pulse"><CardContent className="p-6"><div className="h-16 bg-muted rounded mb-2" /><div className="h-4 bg-muted rounded" /></CardContent></Card>))
                ) : (
                  colors?.map((color) => (
                    <Card key={color.id}>
                      <CardHeader>
                        <CardTitle className="text-sm flex items-center justify-between">
                          {color.name}
                          {color.is_system && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">System</span>}
                        </CardTitle>
                        <CardDescription className="text-xs font-mono">{color.color_key}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="h-16 rounded border border-border" style={{ backgroundColor: color.hex_value }} />
                        <div className="text-xs text-muted-foreground font-mono">{color.hex_value}</div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="flex-1" onClick={() => { setEditingColor(color); setColorDialogOpen(true); }}><Edit className="w-3 h-3" /></Button>
                          <Button variant="destructive" size="sm" onClick={() => setDeleteColorId(color.id)}><Trash2 className="w-3 h-3" /></Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Icon Dialog */}
      <Dialog open={iconDialogOpen} onOpenChange={setIconDialogOpen}>
        <DialogContent>
          <form onSubmit={handleSaveIcon}>
            <DialogHeader>
              <DialogTitle>{editingIcon ? 'Edit Icon' : 'Add New Icon'}</DialogTitle>
              <DialogDescription>{newIconType === 'avatar' ? 'Upload an SVG icon for member avatars' : 'Upload an SVG icon for celebrations and events'}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="icon_type">Icon Type</Label>
                <Select value={newIconType} onValueChange={setNewIconType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="avatar">Avatar Icon</SelectItem>
                    <SelectItem value="celebration">Celebration Icon</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Icon Name</Label>
                <Input id="name" name="name" defaultValue={editingIcon?.name} placeholder={newIconType === 'avatar' ? 'e.g., av7' : 'e.g., birthday-cake'} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="svg_content">SVG Content</Label>
                <textarea id="svg_content" name="svg_content" defaultValue={editingIcon?.svg_content} placeholder="Paste SVG code here" className="w-full min-h-[200px] p-2 border border-input rounded-md bg-background text-sm font-mono" required />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIconDialogOpen(false)}>Cancel</Button>
              <Button type="submit">Save Icon</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Color Dialog */}
      <Dialog open={colorDialogOpen} onOpenChange={setColorDialogOpen}>
        <DialogContent>
          <form onSubmit={handleSaveColor}>
            <DialogHeader>
              <DialogTitle>{editingColor ? 'Edit Color' : 'Add New Color'}</DialogTitle>
              <DialogDescription>Add a new color palette option</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="color_name">Color Name</Label>
                <Input id="color_name" name="name" defaultValue={editingColor?.name} placeholder="e.g., Teal" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="color_key">Color Key</Label>
                <Input id="color_key" name="color_key" defaultValue={editingColor?.color_key} placeholder="e.g., teal (lowercase, no spaces)" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hex_value">Hex Color Value</Label>
                <div className="flex gap-2">
                  <input id="hex_value_picker" type="color" defaultValue={editingColor?.hex_value || '#000000'} className="w-20 h-10 p-1 cursor-pointer rounded-md border border-input" onChange={(e) => { const t = document.getElementById('hex_value') as HTMLInputElement; if (t) t.value = e.target.value; }} />
                  <Input id="hex_value" name="hex_value" defaultValue={editingColor?.hex_value || '#000000'} placeholder="#000000" className="flex-1" pattern="^#[0-9A-Fa-f]{6}$" required onChange={(e) => { const c = document.getElementById('hex_value_picker') as HTMLInputElement; if (c && /^#[0-9A-Fa-f]{6}$/.test(e.target.value)) c.value = e.target.value; }} />
                </div>
                <p className="text-xs text-muted-foreground">Format: #RRGGBB (e.g., #0EA5E9)</p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setColorDialogOpen(false)}>Cancel</Button>
              <Button type="submit">Save Color</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmations */}
      <AlertDialog open={!!deleteIconId} onOpenChange={() => setDeleteIconId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Icon</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete this icon? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteIconId && deleteIconMutation.mutate(deleteIconId)}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteColorId} onOpenChange={() => setDeleteColorId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Color</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete this color? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteColorId && deleteColorMutation.mutate(deleteColorId)}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
