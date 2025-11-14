import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ImageUpload } from '@/components/ui/image-upload';
import { CelebrationIconPicker } from './CelebrationIconPicker';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  celebration_type: z.enum(['birthday', 'anniversary', 'other']),
  celebration_date: z.string().min(1, 'Date is required'),
  year_specific: z.string().optional(),
  visual_type: z.enum(['photo', 'icon']),
  photo_url: z.string().optional(),
  icon_id: z.string().optional(),
});

interface AddCelebrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  familyId: string;
  profileId: string;
}

export const AddCelebrationDialog = ({
  open,
  onOpenChange,
  familyId,
  profileId,
}: AddCelebrationDialogProps) => {
  const [uploadedPhotoPath, setUploadedPhotoPath] = useState<string>();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      celebration_type: 'birthday',
      visual_type: 'icon',
    },
  });

  const visualType = form.watch('visual_type');

  const createMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const { data, error } = await supabase.from('celebrations').insert({
        family_id: familyId,
        created_by: profileId,
        name: values.name,
        celebration_type: values.celebration_type,
        celebration_date: values.celebration_date,
        year_specific: values.year_specific ? parseInt(values.year_specific) : null,
        visual_type: values.visual_type,
        photo_url: values.visual_type === 'photo' ? uploadedPhotoPath : null,
        icon_id: values.visual_type === 'icon' ? values.icon_id : null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['celebrations'] });
      toast.success('Celebration added successfully');
      onOpenChange(false);
      form.reset();
      setUploadedPhotoPath(undefined);
    },
    onError: (error) => {
      toast.error('Failed to add celebration: ' + error.message);
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createMutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Celebration</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="celebration_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="birthday">Birthday</SelectItem>
                      <SelectItem value="anniversary">Anniversary</SelectItem>
                      <SelectItem value="other">Other Celebration</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="celebration_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="year_specific"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Year (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="e.g., 1990"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="visual_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Visual</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="icon" id="icon" />
                        <label htmlFor="icon" className="cursor-pointer">
                          Icon
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="photo" id="photo" />
                        <label htmlFor="photo" className="cursor-pointer">
                          Photo
                        </label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {visualType === 'icon' && (
              <FormField
                control={form.control}
                name="icon_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Select Icon</FormLabel>
                    <FormControl>
                      <CelebrationIconPicker
                        selectedIconId={field.value}
                        onIconSelect={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {visualType === 'photo' && (
              <FormItem>
                <FormLabel>Upload Photo</FormLabel>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    if (file.size > 2 * 1024 * 1024) {
                      toast.error('File size must be less than 2MB');
                      return;
                    }

                    try {
                      const fileExt = file.name.split('.').pop();
                      const fileName = `${familyId}/${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

                      const { data, error } = await supabase.storage
                        .from('celebration-photos')
                        .upload(fileName, file);

                      if (error) throw error;

                      setUploadedPhotoPath(data.path);
                      form.setValue('photo_url', data.path);
                      toast.success('Photo uploaded successfully');
                    } catch (error: any) {
                      toast.error('Failed to upload photo: ' + error.message);
                    }
                  }}
                />
                <FormMessage />
              </FormItem>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Add Celebration
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
