import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Palette, Image as ImageIcon, Plus, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
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

interface AvatarIcon {
  id: string;
  name: string;
  svg_content: string;
  is_system: boolean;
}

interface ColorPalette {
  id: string;
  name: string;
  color_key: string;
  hex_value: string;
  is_system: boolean;
}

export default function ThemesManagement() {
  const queryClient = useQueryClient();
  const [iconDialogOpen, setIconDialogOpen] = useState(false);
  const [colorDialogOpen, setColorDialogOpen] = useState(false);
  const [deleteIconId, setDeleteIconId] = useState<string | null>(null);
  const [deleteColorId, setDeleteColorId] = useState<string | null>(null);
  const [editingIcon, setEditingIcon] = useState<AvatarIcon | null>(null);
  const [editingColor, setEditingColor] = useState<ColorPalette | null>(null);

  // Fetch avatar icons
  const { data: icons, isLoading: iconsLoading } = useQuery({
    queryKey: ['avatar-icons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avatar_icons')
        .select('*')
        .order('is_system', { ascending: false })
        .order('name');
      
      if (error) throw error;
      return data as AvatarIcon[];
    }
  });

  // Fetch color palettes
  const { data: colors, isLoading: colorsLoading } = useQuery({
    queryKey: ['color-palettes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('color_palettes')
        .select('*')
        .order('is_system', { ascending: false })
        .order('name');
      
      if (error) throw error;
      return data as ColorPalette[];
    }
  });

  // Icon mutations
  const saveIconMutation = useMutation({
    mutationFn: async (formData: { name: string; svg_content: string; id?: string }) => {
      if (formData.id) {
        const { error } = await supabase
          .from('avatar_icons')
          .update({ name: formData.name, svg_content: formData.svg_content })
          .eq('id', formData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('avatar_icons')
          .insert({ name: formData.name, svg_content: formData.svg_content });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['avatar-icons'] });
      setIconDialogOpen(false);
      setEditingIcon(null);
      toast.success(editingIcon ? 'Icon updated' : 'Icon added');
    },
    onError: () => {
      toast.error('Failed to save icon');
    }
  });

  const deleteIconMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('avatar_icons')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['avatar-icons'] });
      setDeleteIconId(null);
      toast.success('Icon deleted');
    },
    onError: () => {
      toast.error('Failed to delete icon');
    }
  });

  // Color mutations
  const saveColorMutation = useMutation({
    mutationFn: async (formData: { name: string; color_key: string; hex_value: string; id?: string }) => {
      if (formData.id) {
        const { error } = await supabase
          .from('color_palettes')
          .update({ name: formData.name, color_key: formData.color_key, hex_value: formData.hex_value })
          .eq('id', formData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('color_palettes')
          .insert({ name: formData.name, color_key: formData.color_key, hex_value: formData.hex_value });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['color-palettes'] });
      setColorDialogOpen(false);
      setEditingColor(null);
      toast.success(editingColor ? 'Color updated' : 'Color added');
    },
    onError: () => {
      toast.error('Failed to save color');
    }
  });

  const deleteColorMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('color_palettes')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['color-palettes'] });
      setDeleteColorId(null);
      toast.success('Color deleted');
    },
    onError: () => {
      toast.error('Failed to delete color');
    }
  });

  const handleSaveIcon = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    saveIconMutation.mutate({
      id: editingIcon?.id,
      name: formData.get('name') as string,
      svg_content: formData.get('svg_content') as string,
    });
  };

  const handleSaveColor = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    saveColorMutation.mutate({
      id: editingColor?.id,
      name: formData.get('name') as string,
      color_key: formData.get('color_key') as string,
      hex_value: formData.get('hex_value') as string,
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, iconId?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const svgContent = event.target?.result as string;
      if (iconId) {
        // Update existing icon
        saveIconMutation.mutate({
          id: iconId,
          name: icons?.find(i => i.id === iconId)?.name || '',
          svg_content: svgContent,
        });
      }
    };
    reader.readAsText(file);
  };

  return (
    <>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Themes & Visuals</h2>
          <p className="text-muted-foreground">Manage avatar icons and color palettes</p>
        </div>

        <Tabs defaultValue="icons" className="w-full">
          <TabsList>
            <TabsTrigger value="icons">
              <ImageIcon className="w-4 h-4 mr-2" />
              Avatar Icons
            </TabsTrigger>
            <TabsTrigger value="colors">
              <Palette className="w-4 h-4 mr-2" />
              Color Palettes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="icons" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => { setEditingIcon(null); setIconDialogOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Add Icon
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
              {iconsLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-6">
                      <div className="h-16 bg-muted rounded mb-2" />
                      <div className="h-4 bg-muted rounded" />
                    </CardContent>
                  </Card>
                ))
              ) : (
                icons?.map((icon) => (
                  <Card key={icon.id}>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center justify-between">
                        {icon.name}
                        {icon.is_system && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">System</span>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="h-16 flex items-center justify-center bg-muted rounded">
                        <div dangerouslySetInnerHTML={{ __html: icon.svg_content }} className="w-12 h-12" />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => { setEditingIcon(icon); setIconDialogOpen(true); }}
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => document.getElementById(`upload-${icon.id}`)?.click()}
                        >
                          Upload
                        </Button>
                        <input
                          id={`upload-${icon.id}`}
                          type="file"
                          accept=".svg"
                          className="hidden"
                          onChange={(e) => handleFileUpload(e, icon.id)}
                        />
                        {!icon.is_system && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setDeleteIconId(icon.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="colors" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => { setEditingColor(null); setColorDialogOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Add Color
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
              {colorsLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-6">
                      <div className="h-16 bg-muted rounded mb-2" />
                      <div className="h-4 bg-muted rounded" />
                    </CardContent>
                  </Card>
                ))
              ) : (
                colors?.map((color) => (
                  <Card key={color.id}>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center justify-between">
                        {color.name}
                        {color.is_system && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">System</span>
                        )}
                      </CardTitle>
                      <CardDescription className="text-xs font-mono">{color.color_key}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div 
                        className="h-16 rounded border border-border" 
                        style={{ backgroundColor: color.hex_value }}
                      />
                      <div className="text-xs text-muted-foreground font-mono">{color.hex_value}</div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => { setEditingColor(color); setColorDialogOpen(true); }}
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                        {!color.is_system && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setDeleteColorId(color.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
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
              <DialogDescription>
                Upload an SVG icon for member avatars
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Icon Name</Label>
                <Input 
                  id="name" 
                  name="name" 
                  defaultValue={editingIcon?.name}
                  placeholder="e.g., av7"
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="svg_content">SVG Content</Label>
                <textarea
                  id="svg_content"
                  name="svg_content"
                  defaultValue={editingIcon?.svg_content}
                  placeholder="Paste SVG code here"
                  className="w-full min-h-[200px] p-2 border border-input rounded-md bg-background text-sm font-mono"
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIconDialogOpen(false)}>
                Cancel
              </Button>
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
              <DialogDescription>
                Add a new color palette option
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="color_name">Color Name</Label>
                <Input 
                  id="color_name" 
                  name="name" 
                  defaultValue={editingColor?.name}
                  placeholder="e.g., Teal"
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="color_key">Color Key</Label>
                <Input 
                  id="color_key" 
                  name="color_key" 
                  defaultValue={editingColor?.color_key}
                  placeholder="e.g., teal (lowercase, no spaces)"
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hex_value">Hex Color Value</Label>
                <div className="flex gap-2">
                  <Input 
                    id="hex_value" 
                    name="hex_value" 
                    type="color"
                    defaultValue={editingColor?.hex_value}
                    className="w-20 h-10 p-1 cursor-pointer"
                    required 
                  />
                  <Input 
                    name="hex_value" 
                    defaultValue={editingColor?.hex_value}
                    placeholder="#000000"
                    className="flex-1"
                    pattern="^#[0-9A-Fa-f]{6}$"
                    required 
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Format: #RRGGBB (e.g., #0EA5E9)
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setColorDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save Color</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Icon Confirmation */}
      <AlertDialog open={!!deleteIconId} onOpenChange={() => setDeleteIconId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Icon</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this icon? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteIconId && deleteIconMutation.mutate(deleteIconId)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Color Confirmation */}
      <AlertDialog open={!!deleteColorId} onOpenChange={() => setDeleteColorId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Color</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this color? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteColorId && deleteColorMutation.mutate(deleteColorId)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}