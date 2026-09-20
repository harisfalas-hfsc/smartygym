import { useState, useEffect, useLayoutEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { A4Container } from "@/components/ui/a4-container";
import { normalizeWorkoutHtml } from "@/utils/htmlNormalizer";
import { buildProgramSkeleton, buildPhaseInstructions, buildDefaultTips } from "@/utils/programTemplate";

const PROGRAM_CATEGORIES = [
  "CARDIO ENDURANCE",
  "FUNCTIONAL STRENGTH",
  "MUSCLE HYPERTROPHY",
  "WEIGHT LOSS",
  "LOW BACK PAIN",
  "MOBILITY & STABILITY"
];

const DIFFICULTY_LEVELS = ["Beginner", "Intermediate", "Advanced"];

const WEEKS_OPTIONS = [4, 6, 8];
const DAYS_PER_WEEK_OPTIONS = [3, 4, 5, 6];

const EQUIPMENT_OPTIONS = [
  "Bodyweight",
  "Equipment"
];

interface WeekDayContent {
  week: number;
  day: number;
  content: string;
}

interface ProgramEditDialogProps {
  program: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}

export const ProgramEditDialog = ({ program, open, onOpenChange, onSave }: ProgramEditDialogProps) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    id: '',
    serial_number: 0,
    name: '',
    category: '',
    difficulty_stars: 1,
    weeks: 4,
    days_per_week: 4,
    equipment: '',
    overview: '',
    training_program: '',
    program_description: '',
    construction: '',
    final_tips: '',
    image_url: '',
    generate_unique_image: false,
    is_free: false,
    is_premium: false,
    is_standalone_purchase: false,
    price: '',
    stripe_product_id: '',
    stripe_price_id: '',
  });
  const [weekDayContents, setWeekDayContents] = useState<WeekDayContent[]>([]);
  const [sendNotification, setSendNotification] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const isExistingProgram = Boolean(program?.id);

  const getCategoryPrefix = (category: string) => {
    const prefixMap: { [key: string]: string } = {
      'CARDIO ENDURANCE': 'C',
      'FUNCTIONAL STRENGTH': 'F',
      'MUSCLE HYPERTROPHY': 'M',
      'WEIGHT LOSS': 'W',
      'LOW BACK PAIN': 'L',
      'MOBILITY & STABILITY': 'MS',
    };
    return prefixMap[category] || 'P';
  };

  useLayoutEffect(() => {
    const generateSerialNumber = async (category: string) => {
      const prefix = getCategoryPrefix(category);
      const { data } = await supabase
        .from('admin_training_programs')
        .select('id, serial_number')
        .like('id', `${prefix}-%`)
        .order('serial_number', { ascending: false })
        .limit(1);
      
      if (data && data.length > 0 && data[0].serial_number) {
        const currentSerial = typeof data[0].serial_number === 'string' 
          ? parseInt(data[0].serial_number) 
          : data[0].serial_number;
        return currentSerial + 1;
      }
      return 1;
    };

    if (program && program.id) {
      setFormData({
        id: program.id,
        serial_number: program.serial_number || 0,
        name: program.name,
        category: program.category,
        difficulty_stars: program.difficulty_stars || 1,
        weeks: program.weeks || 4,
        days_per_week: program.days_per_week || 4,
        equipment: program.equipment || '',
        overview: program.overview || '',
        training_program: program.weekly_schedule || '',
        program_description: program.description || '',
        construction: program.program_structure || '',
        final_tips: program.nutrition_tips || '',
        image_url: program.image_url || '',
        generate_unique_image: false,
        is_free: program.is_free || false,
        is_premium: program.is_premium || false,
        is_standalone_purchase: program.is_standalone_purchase || false,
        price: program.price ? program.price.toString() : '',
        stripe_product_id: program.stripe_product_id || '',
        stripe_price_id: program.stripe_price_id || '',
      });
      
      // Parse weekly_schedule if exists
      if (program.weekly_schedule) {
        try {
          const parsed = JSON.parse(program.weekly_schedule);
          setWeekDayContents(parsed);
        } catch {
          setWeekDayContents([]);
        }
      }
    } else if (program && !program.id) {
      // Wizard prefill: partial seed from ContentCreationWizard.
      setFormData({
        id: '',
        serial_number: 0,
        name: program.name || '',
        category: program.category || '',
        difficulty_stars: program.difficulty_stars ?? 1,
        weeks: program.weeks ?? 4,
        days_per_week: program.days_per_week ?? 4,
        equipment: program.equipment || '',
        overview: program.overview || '',
        training_program: program.training_program || '',
        program_description: program.program_description || '',
        construction: program.construction || '',
        final_tips: program.final_tips || '',
        image_url: program.image_url || '',
        generate_unique_image: !!program.generate_unique_image,
        is_free: !!program.is_free,
        is_premium: !!program.is_premium,
        is_standalone_purchase: !!program.is_standalone_purchase,
        price: program.price ? String(program.price) : '',
        stripe_product_id: '',
        stripe_price_id: '',
      });
      // Try to parse a JSON grid if the wizard supplied one; otherwise leave the
      // schedule as a single HTML blob in training_program (M-3 gold-standard).
      if (program.training_program) {
        try {
          const parsed = JSON.parse(program.training_program);
          if (Array.isArray(parsed)) {
            setWeekDayContents(parsed);
          } else {
            setWeekDayContents([]);
          }
        } catch {
          setWeekDayContents([]);
        }
      } else {
        setWeekDayContents([]);
      }
    } else {
      setFormData({
        id: '',
        serial_number: 0,
        name: '',
        category: '',
        difficulty_stars: 1,
        weeks: 4,
        days_per_week: 4,
        equipment: '',
        overview: '',
        training_program: '',
        program_description: '',
        construction: '',
        final_tips: '',
        image_url: '',
        generate_unique_image: false,
        is_free: false,
        is_premium: false,
        is_standalone_purchase: false,
        price: '',
        stripe_product_id: '',
        stripe_price_id: '',
      });
      setWeekDayContents([]);
    }
  }, [program]);

  // Auto-generate serial number when category changes using persistent counters
  useEffect(() => {
    if ((!program || !program.id) && formData.category) {
      const generateSerialNumber = async () => {
        const prefix = getCategoryPrefix(formData.category);
        
        // Fetch persistent counter from system_settings
        const { data: settings, error: settingsError } = await supabase
          .from('system_settings')
          .select('setting_value')
          .eq('setting_key', 'serial_number_counters')
          .single();
        
        if (settingsError) {
          console.error('Error fetching serial counters:', settingsError);
          // Fallback to old logic if counters not found
          const { data } = await supabase
            .from('admin_training_programs')
            .select('serial_number')
            .eq('category', formData.category)
            .order('serial_number', { ascending: false, nullsFirst: false })
            .limit(1);
          
          const nextSerial = (data?.[0]?.serial_number || 0) + 1;
          setFormData(prev => ({
            ...prev,
            serial_number: nextSerial,
            id: `${prefix}-${nextSerial.toString().padStart(3, '0')}`
          }));
          return;
        }
        
        const counters = settings?.setting_value as { programs?: Record<string, number> } || { programs: {} };
        const nextSerial = counters.programs?.[formData.category] || 1;
        
        setFormData(prev => ({
          ...prev,
          serial_number: nextSerial,
          id: `${prefix}-${nextSerial.toString().padStart(3, '0')}`
        }));
      };
      
      generateSerialNumber();
    }
  }, [formData.category, program]);

  // Generate week/day boxes when weeks or days_per_week changes
  useEffect(() => {
    const boxes: WeekDayContent[] = [];
    for (let week = 1; week <= formData.weeks; week++) {
      for (let day = 1; day <= formData.days_per_week; day++) {
        const existing = weekDayContents.find(wdc => wdc.week === week && wdc.day === day);
        boxes.push({
          week,
          day,
          content: existing?.content || ''
        });
      }
    }
    setWeekDayContents(boxes);
  }, [formData.weeks, formData.days_per_week]);

  const updateWeekDayContent = (week: number, day: number, content: string) => {
    setWeekDayContents(prev => 
      prev.map(wdc => 
        wdc.week === week && wdc.day === day ? { ...wdc, content } : wdc
      )
    );
  };

  const handleSave = async () => {
    try {
      // Validate required fields
      if (!formData.name || !formData.name.trim()) {
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: "Program name is required. Please provide a name for this training program.",
        });
        return;
      }

      if (!formData.category) {
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: "Category is required. Please select a category.",
        });
        return;
      }

      // Validate that free content cannot be standalone purchase
      if (!formData.is_premium && formData.is_standalone_purchase) {
        toast({
          variant: "destructive",
          title: "Invalid Configuration",
          description: "Free content cannot be sold as standalone purchase. Please enable Premium first.",
        });
        return;
      }

      const { data: complianceData, error: complianceError } = await supabase.functions.invoke('validate-training-program-compliance', {
        body: {
          category: formData.category,
          equipment: formData.equipment,
          weekly_schedule: normalizeWorkoutHtml(formData.training_program || ''),
        },
      });
      if (complianceError || !complianceData?.passed) {
        const firstIssue = complianceData?.issues?.[0]?.message;
        toast({
          variant: "destructive",
          title: "Program needs correction",
          description: firstIssue || "This program does not yet meet the training rules and was not saved.",
        });
        return;
      }

      setIsGeneratingImage(true);
      
      let imageUrl = formData.image_url;
      
      // Generate unique image if requested
      if (formData.generate_unique_image) {
        const { data: imageData, error: imageError } = await supabase.functions.invoke('generate-program-image', {
          body: {
            name: formData.name,
            category: formData.category,
            difficulty_stars: formData.difficulty_stars,
            weeks: formData.weeks,
          }
        });

        if (imageError) {
          console.error('Error generating image:', imageError);
          toast({
            title: "Warning",
            description: "Failed to generate image, saving without image",
            variant: "destructive",
          });
        } else if (imageData?.image_url) {
          imageUrl = imageData.image_url;
        }
      }

      const duration = `${formData.weeks} Weeks / ${formData.days_per_week} Days per Week`;
      
      // Map difficulty stars to difficulty level
      let difficultyLevel = 'Beginner';
      if (formData.difficulty_stars >= 5) {
        difficultyLevel = 'Advanced';
      } else if (formData.difficulty_stars >= 3) {
        difficultyLevel = 'Intermediate';
      }

      // GOLD STANDARD: Normalize HTML before saving
      const normalizedWeeklySchedule = normalizeWorkoutHtml(formData.training_program || '');
      const normalizedProgramStructure = normalizeWorkoutHtml(formData.construction || '');
      const normalizedOverview = normalizeWorkoutHtml(formData.overview || '');

      const baseData = {
        id: formData.id,
        serial_number: formData.serial_number,
        name: formData.name,
        category: formData.category,
        difficulty: difficultyLevel,
        difficulty_stars: formData.difficulty_stars,
        weeks: formData.weeks,
        days_per_week: formData.days_per_week,
        equipment: formData.equipment,
        duration,
        overview: normalizedOverview,
        weekly_schedule: normalizedWeeklySchedule,
        description: formData.program_description,
        program_structure: normalizedProgramStructure,
        nutrition_tips: formData.final_tips,
        image_url: imageUrl,
        is_premium: formData.is_premium,
        tier_required: null,
        is_standalone_purchase: formData.is_premium && formData.is_standalone_purchase,
        price: formData.is_premium && formData.price ? parseFloat(formData.price) : null,
      };

      if (isExistingProgram) {
        // Update existing program
        const { error } = await supabase
          .from('admin_training_programs')
          .update({
            ...baseData,
            stripe_product_id: formData.stripe_product_id,
            stripe_price_id: formData.stripe_price_id,
          })
          .eq('id', program.id);

        if (error) throw error;

        // Sync image to Stripe if image changed and Stripe product exists
        if (formData.stripe_product_id && imageUrl && imageUrl !== program.image_url) {
          try {
            let stripeUpdateImageUrl = imageUrl;
            if (imageUrl && imageUrl.startsWith('/')) {
              stripeUpdateImageUrl = `${window.location.origin}${imageUrl}`;
            }
            
            const { error: stripeUpdateError } = await supabase.functions.invoke('update-stripe-product', {
              body: {
                productId: formData.stripe_product_id,
                imageUrl: stripeUpdateImageUrl
              }
            });
            if (stripeUpdateError) {
              console.error('Failed to sync image to Stripe:', stripeUpdateError);
            } else {
              console.log('✅ Image synced to Stripe product');
            }
          } catch (syncError) {
            console.error('Error syncing image to Stripe:', syncError);
          }
        }

        toast({ title: "Success", description: "Program updated successfully" });
      } else {
        // NEW PROGRAM: First increment counter, then save to DB, then create Stripe product
        
        // Step 1: Increment counter atomically BEFORE saving
        const { data: counterSettings, error: counterError } = await supabase
          .from('system_settings')
          .select('setting_value')
          .eq('setting_key', 'serial_number_counters')
          .single();
        
        if (!counterError && counterSettings) {
          const counters = counterSettings.setting_value as { workouts?: Record<string, number>, programs?: Record<string, number> };
          const currentSerial = counters.programs?.[formData.category] || 1;
          
          // Increment for next use
          counters.programs = counters.programs || {};
          counters.programs[formData.category] = currentSerial + 1;
          
          await supabase
            .from('system_settings')
            .update({ setting_value: counters, updated_at: new Date().toISOString() })
            .eq('setting_key', 'serial_number_counters');
          
          console.log(`✅ Counter incremented: ${formData.category} now at ${currentSerial + 1}`);
        }
        
        // Step 2: Save to database FIRST (before Stripe)
        const { error: insertError } = await supabase
          .from('admin_training_programs')
          .insert([{
            ...baseData,
            stripe_product_id: null,
            stripe_price_id: null,
          }]);

        if (insertError) throw insertError;
        
        // Step 3: Create Stripe product AFTER DB save succeeds
        let stripeProductId = null;
        let stripePriceId = null;
        
        const shouldCreateStripeProduct =
          formData.is_premium &&
          formData.is_standalone_purchase &&
          formData.price &&
          parseFloat(formData.price) > 0;
        
        if (shouldCreateStripeProduct) {
          let stripeImageUrl = imageUrl;
          if (imageUrl && imageUrl.startsWith('/')) {
            stripeImageUrl = `${window.location.origin}${imageUrl}`;
          }
          
          const { data: stripeData, error: stripeError } = await supabase.functions.invoke('create-stripe-product', {
            body: {
              name: formData.name,
              price: formData.price,
              contentType: "Training Program",
              imageUrl: stripeImageUrl
            }
          });

          if (stripeError) {
            console.error('Error creating Stripe product:', stripeError);
            toast({
              title: "Warning",
              description: "Program saved but Stripe product creation failed. You can retry from the edit dialog.",
              variant: "destructive",
            });
          } else if (stripeData) {
            stripeProductId = stripeData.product_id;
            stripePriceId = stripeData.price_id;
            
            // Step 4: Update program with Stripe IDs
            await supabase
              .from('admin_training_programs')
              .update({
                stripe_product_id: stripeProductId,
                stripe_price_id: stripePriceId,
              })
              .eq('id', baseData.id);
          }
        }

        // Only schedule notification if admin explicitly enabled it
        // Skip notifications for test programs (names containing "test", "TEST", etc.)
        const isTestProgram = formData.name && /test/i.test(formData.name.trim());
        
        if (sendNotification && formData.name && formData.name.trim() && !isTestProgram) {
          try {
            // Use the pending_content_notifications table which has an actual processor
            await supabase
              .from('pending_content_notifications')
              .insert([{
                content_type: 'program',
                content_id: baseData.id,
                content_name: formData.name,
                content_category: formData.category || null,
              }]);
            
            if (import.meta.env.DEV) {
              console.log('✅ Notification queued for new program:', formData.name);
            }
            toast({ title: "Success", description: "Program created and notification queued!" });
          } catch (notifError) {
            if (import.meta.env.DEV) {
              console.error('Error queueing notification:', notifError);
            }
            toast({ title: "Success", description: "Program created successfully!" });
          }
        } else {
          const reason = isTestProgram ? ' (test program - no notification)' : '';
          toast({ title: "Success", description: `Program created successfully!${reason}` });
        }
      }
      onSave();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving program:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save program",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingImage(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-5xl max-h-[95vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>{isExistingProgram ? 'Edit Program' : 'Create New Program'}</DialogTitle>
          <DialogDescription>
            {isExistingProgram ? 'Update program details' : 'Add a new training program to your library'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pb-4">
          {/* 1. Category */}
          <div className="space-y-2">
            <Label htmlFor="category">1. Category</Label>
            <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {PROGRAM_CATEGORIES.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 2. Serial Number */}
          <div className="space-y-2">
            <Label htmlFor="serial_number">2. Serial Number</Label>
            <Input
              id="serial_number"
              type="number"
              value={formData.serial_number}
              onChange={(e) => {
                const serial = parseInt(e.target.value) || 0;
                setFormData({ 
                  ...formData, 
                  serial_number: serial,
                  id: `P-${serial.toString().padStart(3, '0')}`
                });
              }}
              placeholder="Auto-generated"
            />
            <p className="text-sm text-muted-foreground">Program ID: {formData.id}</p>
          </div>

          {/* 3. Name */}
          <div className="space-y-2">
            <Label htmlFor="name">3. Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Program name"
            />
          </div>

          {/* 4. Overview */}
          <div className="space-y-2">
            <Label htmlFor="overview">4. Overview</Label>
            <p className="text-sm text-muted-foreground">
              This is the first text block users see on the public program page. Explain what the program delivers, who it's for, and the expected outcomes.
            </p>
            <A4Container>
              <RichTextEditor
                value={formData.overview}
                onChange={(value) => setFormData({ ...formData, overview: value })}
                placeholder="Enter the program overview..."
                minHeight="150px"
              />
            </A4Container>
          </div>

          {/* 5. Difficulty Level */}
          <div className="space-y-2">
            <Label htmlFor="difficulty_stars">5. Difficulty Level</Label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5, 6].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setFormData({ ...formData, difficulty_stars: star })}
                  className="text-2xl focus:outline-none"
                >
                  {star <= formData.difficulty_stars ? '⭐' : '☆'}
                </button>
              ))}
              <span className="ml-2 text-sm text-muted-foreground">
                {formData.difficulty_stars <= 2 ? 'Beginner' : formData.difficulty_stars <= 4 ? 'Intermediate' : 'Advanced'}
              </span>
            </div>
          </div>

          {/* 5. Duration */}
          <div className="space-y-2">
            <Label>5. Duration</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="weeks">Weeks</Label>
                <Select 
                  value={formData.weeks.toString()} 
                  onValueChange={(value) => setFormData({ ...formData, weeks: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select weeks" />
                  </SelectTrigger>
                  <SelectContent>
                    {WEEKS_OPTIONS.map(weeks => (
                      <SelectItem key={weeks} value={weeks.toString()}>{weeks} Weeks</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="days_per_week">Training Days per Week</Label>
                <Select 
                  value={formData.days_per_week.toString()} 
                  onValueChange={(value) => setFormData({ ...formData, days_per_week: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select days" />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS_PER_WEEK_OPTIONS.map(days => (
                      <SelectItem key={days} value={days.toString()}>{days} Days</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* 6. Equipment */}
          <div className="space-y-2">
            <Label htmlFor="equipment">6. Equipment</Label>
            <Select value={formData.equipment} onValueChange={(value) => setFormData({ ...formData, equipment: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select equipment" />
              </SelectTrigger>
              <SelectContent>
                {EQUIPMENT_OPTIONS.map(equip => (
                  <SelectItem key={equip} value={equip}>{equip}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 7. Training Program Content - Single Box with Exercise Search */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Label htmlFor="training_program">7. Training Program</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const skeleton = buildProgramSkeleton({
                    category: formData.category,
                    weeks: formData.weeks,
                    daysPerWeek: formData.days_per_week,
                  });
                  const instructions = buildPhaseInstructions(formData.weeks, formData.category);
                  const tips = buildDefaultTips(formData.category);
                  setFormData({
                    ...formData,
                    training_program: skeleton,
                    construction: formData.construction?.trim() ? formData.construction : instructions,
                    final_tips: formData.final_tips?.trim() ? formData.final_tips : tips,
                  });
                  toast({
                    title: "Standardized template applied",
                    description: `${formData.weeks} weeks × ${formData.days_per_week} training days. Replace each "Exercise" bullet with a library exercise.`,
                  });
                }}
                disabled={!formData.category || !formData.weeks || !formData.days_per_week}
              >
                Standardized Training Program Format
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Enter the complete training program content. Click "Standardized Training Program Format" to insert the WEEK/OBJECTIVE/DAYS skeleton, then use the Exercises button in the toolbar to add linked exercises from the library.
            </p>
            <A4Container>
              <RichTextEditor
                value={formData.training_program}
                onChange={(value) => setFormData({ ...formData, training_program: value })}
                placeholder="Enter your complete training program content here..."
                minHeight="300px"
                showExerciseSearch={true}
              />
            </A4Container>
          </div>

          {/* 8. Description */}
          <div className="space-y-2">
            <Label htmlFor="program_description">8. Description</Label>
            <A4Container>
              <RichTextEditor
                value={formData.program_description}
                onChange={(value) => setFormData({ ...formData, program_description: value })}
                placeholder="Brief description of the program"
                minHeight="120px"
              />
            </A4Container>
          </div>

          {/* 9. Instructions */}
          <div className="space-y-2">
            <Label htmlFor="construction">9. Instructions</Label>
            <p className="text-sm text-muted-foreground italic">
              Note: A link to the Exercise Library will automatically appear above your instructions when displayed to users.
            </p>
            <A4Container>
              <RichTextEditor
                value={formData.construction}
                onChange={(value) => setFormData({ ...formData, construction: value })}
                placeholder="Program instructions and structure details"
                minHeight="150px"
              />
            </A4Container>
          </div>

          {/* 10. Tips */}
          <div className="space-y-2">
            <Label htmlFor="final_tips">10. Tips</Label>
            <A4Container>
              <RichTextEditor
                value={formData.final_tips}
                onChange={(value) => setFormData({ ...formData, final_tips: value })}
                placeholder="Tips and additional guidance"
                minHeight="150px"
              />
            </A4Container>
          </div>

          {/* 11. Image Generation */}
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="generate_unique_image">11. Generate Unique Image</Label>
                <p className="text-sm text-muted-foreground">
                  AI will create a unique program cover image that doesn't match any existing workout or program
                </p>
              </div>
              <Switch
                id="generate_unique_image"
                checked={formData.generate_unique_image}
                onCheckedChange={(checked) => setFormData({ ...formData, generate_unique_image: checked })}
              />
            </div>
            
            {!formData.generate_unique_image && (
              <div className="space-y-2">
                <Label htmlFor="image_url">Or Enter Image URL Manually</Label>
                <Input
                  id="image_url"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  placeholder="/src/assets/program-image.jpg"
                />
                <p className="text-xs text-muted-foreground">
                  For best results: 800x600px, .jpg format, under 200KB
                </p>
              </div>
            )}
          </div>

          {/* Notification info — sending is handled automatically by the new-content cron.
              The manual toggle was removed to avoid duplicate notifications. */}
          {!isExistingProgram && (
            <div className="space-y-1 pt-4 border-t border-orange-200 bg-orange-50/50 p-4 rounded-lg">
              <p className="text-sm text-orange-800 font-semibold">
                📢 Users will be notified automatically
              </p>
              <p className="text-sm text-orange-700">
                A new-content notification (email + dashboard) is sent by the scheduled job once this
                program goes live. Users who don't want these can opt out in their notification settings.
              </p>
              {formData.name && /test/i.test(formData.name) && (
                <p className="text-sm text-amber-600 bg-amber-100 p-2 rounded mt-2">
                  🧪 Test program detected — notifications will be automatically skipped.
                </p>
              )}
            </div>
          )}

          {/* Free Content Toggle */}
          <div className="space-y-2">
            <Label htmlFor="is_free" className="text-base font-semibold">Free Content</Label>
            <div className="flex items-center space-x-3 p-3 border rounded-lg">
              <Switch
                id="is_free"
                checked={formData.is_free}
                onCheckedChange={(checked) => setFormData({ 
                  ...formData, 
                  is_free: checked,
                  is_premium: checked ? false : formData.is_premium,
                  is_standalone_purchase: checked ? false : formData.is_standalone_purchase,
                  price: checked ? '' : formData.price
                })}
              />
              <div className="flex-1">
                <span className="text-sm font-medium">
                  {formData.is_free ? '🆓 Free Content (no Stripe product needed)' : 'Paid Content'}
                </span>
              </div>
            </div>
            {formData.is_free && (
              <p className="text-sm text-green-600 bg-green-50 p-2 rounded">
                ✓ This program is marked as FREE. No Stripe product will be created.
              </p>
            )}
          </div>

          {/* Premium/Free and Standalone Purchase - only show if not free */}
          {!formData.is_free && (
            <div className="space-y-2">
              <Label htmlFor="is_premium" className="text-base font-semibold">Premium or Free</Label>
              <div className="flex items-center space-x-3 p-3 border rounded-lg">
                <Switch
                  id="is_premium"
                  checked={formData.is_premium}
                  onCheckedChange={(checked) => setFormData({ 
                    ...formData, 
                    is_premium: checked,
                    is_standalone_purchase: checked ? formData.is_standalone_purchase : false,
                    price: checked ? formData.price : ''
                  })}
                />
                <div className="flex-1">
                  <span className="text-sm font-medium">
                    {formData.is_premium ? '🔒 Premium Content' : '🆓 Free Content'}
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Toggle ON for Premium (requires subscription), toggle OFF for Free (accessible to all)
              </p>
            </div>
          )}

          {formData.is_premium && !formData.is_free && (
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_standalone_purchase"
                  checked={formData.is_standalone_purchase}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_standalone_purchase: checked })}
                />
                <Label htmlFor="is_standalone_purchase">Available as Standalone Purchase</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Enable this to allow users to buy this program individually without a subscription
              </p>

              {formData.is_standalone_purchase && (
                <div className="space-y-2">
                  <Label htmlFor="price">Price (€) *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="e.g., 29.99"
                  />
                  {!formData.stripe_product_id ? (
                    <p className="text-sm text-muted-foreground">
                      This will automatically create a Stripe product when you save.
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Stripe product already created for this program.
                    </p>
                  )}
                  {formData.stripe_product_id && (
                    <p className="text-xs text-green-600">
                      ✓ Stripe Product ID: {formData.stripe_product_id}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isGeneratingImage}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isGeneratingImage}>
              {isGeneratingImage ? "Generating Image..." : "Save Program"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
