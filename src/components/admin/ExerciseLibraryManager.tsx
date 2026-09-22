import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Plus, Pencil, Trash2, Video, ExternalLink, Upload, Database, Image, FileSpreadsheet, Search, AlertTriangle } from "lucide-react";
import MismatchedExercises from "./MismatchedExercises";
import { toast } from "sonner";
import { extractYouTubeId, getYouTubeThumbnail, isValidYouTubeUrl, getRestrictedEmbedUrl } from "@/utils/youtube";
import { MUSCLE_CATEGORIES, MUSCLE_GROUPS, WORKOUT_CATEGORIES, PROGRAM_CATEGORIES, WORKOUT_PHASES } from "@/constants/exerciseCategories";

interface ExerciseVideo {
  id: string;
  title: string;
  description: string | null;
  youtube_video_id: string;
  youtube_url: string;
  thumbnail_url: string | null;
  category: string;
  muscle_group: string | null;
  target_muscle: string | null;
  workout_category: string | null;
  program_category: string | null;
  workout_phase: string | null;
  display_order: number;
  is_visible: boolean;
  is_promotional: boolean;
  created_at: string;
}

interface Exercise {
  id: string;
  name: string;
  body_part: string;
  equipment: string;
  target: string;
  secondary_muscles: string[] | null;
  instructions: string[] | null;
  gif_url: string | null;
  description: string | null;
  difficulty: string | null;
  category: string | null;
}


const ExerciseLibraryManager = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("database");
  
  // Video management state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<ExerciseVideo | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  // Import state
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState("");
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const gifInputRef = useRef<HTMLInputElement>(null);
  
  // GIF upload state
  const [isUploadingGifs, setIsUploadingGifs] = useState(false);
  const [gifUploadProgress, setGifUploadProgress] = useState(0);
  const [gifUploadStatus, setGifUploadStatus] = useState("");
  
  // Exercise filter state
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [bodyPartFilter, setBodyPartFilter] = useState("all");
  const [equipmentFilter, setEquipmentFilter] = useState("all");
  
  // Form state for videos
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    youtube_url: '',
    muscle_group: '',
    target_muscle: '',
    workout_phase: '',
    workout_category: '',
    program_category: '',
    display_order: 0,
    is_visible: true,
    is_promotional: false
  });
  const [previewVideoId, setPreviewVideoId] = useState<string | null>(null);

  // Fetch ALL exercises using pagination to overcome 1000 row limit
  const { data: exercises, isLoading: exercisesLoading } = useQuery({
    queryKey: ['admin-exercises'],
    queryFn: async () => {
      const allExercises: Exercise[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('exercises')
          .select('*')
          .order('name', { ascending: true })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;
        
        if (data && data.length > 0) {
          allExercises.push(...data);
          hasMore = data.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }

      return allExercises;
    }
  });

  // Get unique body parts and equipment for filters
  const bodyParts = [...new Set(exercises?.map(e => e.body_part) || [])].sort();
  const equipmentList = [...new Set(exercises?.map(e => e.equipment) || [])].sort();
  const exercisesWithGifs = exercises?.filter(e => e.gif_url)?.length || 0;

  // Filter exercises
  const filteredExercises = exercises?.filter(exercise => {
    const matchesSearch = exercise.name.toLowerCase().includes(exerciseSearch.toLowerCase()) ||
                         exercise.target.toLowerCase().includes(exerciseSearch.toLowerCase());
    const matchesBodyPart = bodyPartFilter === "all" || exercise.body_part === bodyPartFilter;
    const matchesEquipment = equipmentFilter === "all" || exercise.equipment === equipmentFilter;
    return matchesSearch && matchesBodyPart && matchesEquipment;
  }) || [];

  // Fetch videos
  const { data: videos, isLoading: videosLoading } = useQuery({
    queryKey: ['admin-exercise-library-videos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exercise_library_videos')
        .select('*')
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ExerciseVideo[];
    }
  });

  // JSON Import handler
  const handleJSONUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportProgress(0);
    setImportStatus("Reading JSON file...");

    try {
      const text = await file.text();
      const jsonData = JSON.parse(text);
      
      // Handle both array format and object with exercises array
      const exercisesArray = Array.isArray(jsonData) ? jsonData : (jsonData.exercises || []);
      
      if (!exercisesArray.length) {
        throw new Error("No exercises found in JSON file");
      }

      setImportStatus(`Parsing ${exercisesArray.length} exercises...`);
      setImportProgress(10);

      const exercisesToInsert: any[] = [];

      for (const item of exercisesArray) {
        const exercise = {
          id: item.id?.toString() || '',
          name: item.name?.trim() || '',
          body_part: item.bodyPart?.trim() || '',
          equipment: item.equipment?.trim() || '',
          target: item.target?.trim() || '',
          secondary_muscles: Array.isArray(item.secondaryMuscles) ? item.secondaryMuscles : [],
          instructions: Array.isArray(item.instructions) ? item.instructions : [],
          description: item.description?.trim() || null,
          difficulty: item.difficulty?.trim() || null,
          category: item.category?.trim() || null,
          gif_url: null, // GIFs are uploaded separately
        };
        
        if (exercise.id && exercise.name) {
          exercisesToInsert.push(exercise);
        }
      }

      setImportStatus(`Parsed ${exercisesToInsert.length} exercises. Clearing existing data...`);
      setImportProgress(30);

      // Clear existing exercises
      const { error: deleteError } = await supabase
        .from("exercises")
        .delete()
        .neq("id", "");

      if (deleteError) throw deleteError;

      setImportStatus("Inserting exercises in batches...");
      
      // Insert in batches of 50
      const batchSize = 50;
      let inserted = 0;
      
      for (let i = 0; i < exercisesToInsert.length; i += batchSize) {
        const batch = exercisesToInsert.slice(i, i + batchSize);
        const { error } = await supabase.from("exercises").insert(batch);
        
        if (error) {
          console.error(`Batch error at ${i}:`, error);
        } else {
          inserted += batch.length;
        }
        
        const progress = 30 + Math.round((i / exercisesToInsert.length) * 70);
        setImportProgress(progress);
        setImportStatus(`Inserted ${inserted} of ${exercisesToInsert.length} exercises...`);
      }

      setImportProgress(100);
      setImportStatus(`Successfully imported ${inserted} exercises!`);
      toast.success(`Imported ${inserted} exercises successfully!`);
      
      // Refresh the exercises list
      queryClient.invalidateQueries({ queryKey: ['admin-exercises'] });
      
    } catch (error) {
      console.error("Import error:", error);
      toast.error(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setImportStatus("Import failed. Please try again.");
    } finally {
      setIsImporting(false);
      if (jsonInputRef.current) {
        jsonInputRef.current.value = "";
      }
    }
  };

  // GIF Upload handler
  const handleGIFUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingGifs(true);
    setGifUploadProgress(0);
    setGifUploadStatus(`Uploading ${files.length} GIF files...`);

    try {
      let uploaded = 0;
      let matched = 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const filename = file.name.replace('.gif', '').trim();
        
        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('exercise-gifs')
          .upload(file.name, file, { upsert: true });

        if (uploadError) {
          console.error(`Failed to upload ${file.name}:`, uploadError);
          continue;
        }

        uploaded++;

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('exercise-gifs')
          .getPublicUrl(file.name);

        // Update exercise with matching ID
        const { error: updateError } = await supabase
          .from('exercises')
          .update({ gif_url: urlData.publicUrl })
          .eq('id', filename);

        if (!updateError) {
          matched++;
        }

        const progress = Math.round(((i + 1) / files.length) * 100);
        setGifUploadProgress(progress);
        setGifUploadStatus(`Uploaded ${uploaded} files, matched ${matched} exercises...`);
      }

      setGifUploadProgress(100);
      setGifUploadStatus(`Uploaded ${uploaded} GIFs, matched ${matched} exercises!`);
      toast.success(`Uploaded ${uploaded} GIFs, matched ${matched} exercises!`);
      
      // Refresh the exercises list
      queryClient.invalidateQueries({ queryKey: ['admin-exercises'] });

    } catch (error) {
      console.error("GIF upload error:", error);
      toast.error(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setGifUploadStatus("Upload failed. Please try again.");
    } finally {
      setIsUploadingGifs(false);
      if (gifInputRef.current) {
        gifInputRef.current.value = "";
      }
    }
  };

  // Video mutations (keeping existing functionality)
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const videoId = extractYouTubeId(data.youtube_url);
      if (!videoId) throw new Error('Invalid YouTube URL');

      const { error } = await supabase
        .from('exercise_library_videos')
        .insert({
          title: data.title,
          description: data.description || null,
          youtube_url: data.youtube_url,
          youtube_video_id: videoId,
          thumbnail_url: getYouTubeThumbnail(videoId, 'hq'),
          category: data.muscle_group || 'General',
          muscle_group: data.muscle_group || null,
          target_muscle: data.target_muscle || null,
          workout_phase: data.workout_phase || null,
          workout_category: data.workout_category || null,
          program_category: data.program_category || null,
          display_order: data.display_order,
          is_visible: data.is_visible,
          is_promotional: data.is_promotional
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-exercise-library-videos'] });
      queryClient.invalidateQueries({ queryKey: ['exercise-library-videos'] });
      toast.success('Video added successfully');
      closeDialog();
    },
    onError: (error) => {
      toast.error(`Failed to add video: ${error.message}`);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const videoId = extractYouTubeId(data.youtube_url);
      if (!videoId) throw new Error('Invalid YouTube URL');

      const { error } = await supabase
        .from('exercise_library_videos')
        .update({
          title: data.title,
          description: data.description || null,
          youtube_url: data.youtube_url,
          youtube_video_id: videoId,
          thumbnail_url: getYouTubeThumbnail(videoId, 'hq'),
          category: data.muscle_group || 'General',
          muscle_group: data.muscle_group || null,
          target_muscle: data.target_muscle || null,
          workout_phase: data.workout_phase || null,
          workout_category: data.workout_category || null,
          program_category: data.program_category || null,
          display_order: data.display_order,
          is_visible: data.is_visible,
          is_promotional: data.is_promotional
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-exercise-library-videos'] });
      queryClient.invalidateQueries({ queryKey: ['exercise-library-videos'] });
      toast.success('Video updated successfully');
      closeDialog();
    },
    onError: (error) => {
      toast.error(`Failed to update video: ${error.message}`);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('exercise_library_videos')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-exercise-library-videos'] });
      queryClient.invalidateQueries({ queryKey: ['exercise-library-videos'] });
      toast.success('Video deleted successfully');
      setDeleteConfirmId(null);
    },
    onError: (error) => {
      toast.error(`Failed to delete video: ${error.message}`);
    }
  });

  const toggleVisibilityMutation = useMutation({
    mutationFn: async ({ id, is_visible }: { id: string; is_visible: boolean }) => {
      const { error } = await supabase
        .from('exercise_library_videos')
        .update({ is_visible })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-exercise-library-videos'] });
      queryClient.invalidateQueries({ queryKey: ['exercise-library-videos'] });
    }
  });

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingVideo(null);
    setPreviewVideoId(null);
    setFormData({
      title: '',
      description: '',
      youtube_url: '',
      muscle_group: '',
      target_muscle: '',
      workout_phase: '',
      workout_category: '',
      program_category: '',
      display_order: 0,
      is_visible: true,
      is_promotional: false
    });
  };

  const openEditDialog = (video: ExerciseVideo) => {
    setEditingVideo(video);
    setFormData({
      title: video.title,
      description: video.description || '',
      youtube_url: video.youtube_url,
      muscle_group: video.muscle_group || '',
      target_muscle: video.target_muscle || '',
      workout_phase: video.workout_phase || '',
      workout_category: video.workout_category || '',
      program_category: video.program_category || '',
      display_order: video.display_order,
      is_visible: video.is_visible,
      is_promotional: video.is_promotional || false
    });
    setPreviewVideoId(video.youtube_video_id);
    setIsDialogOpen(true);
  };

  const handleYouTubeUrlChange = (url: string) => {
    setFormData(prev => ({ ...prev, youtube_url: url }));
    const videoId = extractYouTubeId(url);
    setPreviewVideoId(videoId);
  };

  const handleMuscleGroupChange = (value: string) => {
    setFormData(prev => ({ 
      ...prev, 
      muscle_group: value === 'none' ? '' : value,
      target_muscle: ''
    }));
  };

  const handleSubmit = () => {
    if (!formData.title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!isValidYouTubeUrl(formData.youtube_url)) {
      toast.error('Please enter a valid YouTube URL');
      return;
    }

    if (editingVideo) {
      updateMutation.mutate({ id: editingVideo.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const availableMuscles = formData.muscle_group && formData.muscle_group !== 'none'
    ? MUSCLE_CATEGORIES[formData.muscle_group as keyof typeof MUSCLE_CATEGORIES] || []
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Exercise Library</h2>
        <p className="text-muted-foreground">Manage exercise database and video demonstrations</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="database" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Exercise Database
          </TabsTrigger>
          <TabsTrigger value="mismatched" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Mismatched Exercises
          </TabsTrigger>
          <TabsTrigger value="videos" className="flex items-center gap-2">
            <Video className="h-4 w-4" />
            Exercise Videos
          </TabsTrigger>
        </TabsList>

        {/* Mismatched Exercises Tab */}
        <TabsContent value="mismatched" className="space-y-6">
          <MismatchedExercises />
        </TabsContent>

        {/* Exercise Database Tab */}
        <TabsContent value="database" className="space-y-6">
          {/* Import Tools Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Import Tools
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Stats */}
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <span className="flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  {exercises?.length || 0} exercises
                </span>
                <span className="flex items-center gap-2">
                  <Image className="h-4 w-4" />
                  {exercisesWithGifs} with images
                </span>
              </div>

              {/* Upload Buttons */}
              <div className="flex flex-wrap gap-4">
                <div>
                  <input
                    ref={jsonInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleJSONUpload}
                    className="hidden"
                    disabled={isImporting}
                  />
                  <Button
                    onClick={() => jsonInputRef.current?.click()}
                    disabled={isImporting}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    Upload JSON File
                  </Button>
                </div>

                <div>
                  <input
                    ref={gifInputRef}
                    type="file"
                    accept=".gif"
                    multiple
                    onChange={handleGIFUpload}
                    className="hidden"
                    disabled={isUploadingGifs}
                  />
                  <Button
                    onClick={() => gifInputRef.current?.click()}
                    disabled={isUploadingGifs}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Image className="h-4 w-4" />
                    Upload GIF Files
                  </Button>
                </div>
              </div>

              {/* CSV Import Progress */}
              {isImporting && (
                <div className="space-y-2">
                  <Progress value={importProgress} className="h-2" />
                  <p className="text-sm text-muted-foreground">{importStatus}</p>
                </div>
              )}

              {/* GIF Upload Progress */}
              {isUploadingGifs && (
                <div className="space-y-2">
                  <Progress value={gifUploadProgress} className="h-2" />
                  <p className="text-sm text-muted-foreground">{gifUploadStatus}</p>
                </div>
              )}

              {/* Import Instructions */}
              <div className="text-xs text-muted-foreground border-t pt-4 space-y-1">
                <p><strong>JSON Format:</strong> ExerciseDB format with fields: id, name, bodyPart, equipment, target, secondaryMuscles[], instructions[], description, difficulty, category</p>
                <p><strong>GIF Files:</strong> Name files by exercise ID (e.g., 0001.gif matches exercise id "0001")</p>
              </div>
            </CardContent>
          </Card>

          {/* Exercises Card — same look as the public Exercise Library, plus the use/don't-use switch */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Exercises
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AdminExerciseDatabase />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Exercise Videos Tab */}
        <TabsContent value="videos" className="space-y-6">
          <div className="flex items-center justify-end">
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Video
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5" />
                Videos ({videos?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {videosLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading videos...</div>
              ) : !videos || videos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Video className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No videos added yet.</p>
                  <p className="text-sm">Click "Add Video" to get started.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Thumbnail</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Muscle</TableHead>
                        <TableHead>Phase</TableHead>
                        <TableHead>Workout</TableHead>
                        <TableHead>Program</TableHead>
                        <TableHead>Promo</TableHead>
                        <TableHead>Order</TableHead>
                        <TableHead>Visible</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {videos.map((video) => (
                        <TableRow key={video.id}>
                          <TableCell>
                            <img
                              src={getYouTubeThumbnail(video.youtube_video_id, 'default')}
                              alt={video.title}
                              className="w-24 h-auto rounded"
                            />
                          </TableCell>
                          <TableCell className="font-medium max-w-[200px]">
                            <p className="line-clamp-2">{video.title}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(video.created_at).toLocaleDateString()}
                            </p>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {video.muscle_group && (
                                <p className="font-medium">{video.muscle_group}</p>
                              )}
                              {video.target_muscle && (
                                <p className="text-xs text-muted-foreground">{video.target_muscle}</p>
                              )}
                              {!video.muscle_group && <span className="text-muted-foreground">-</span>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{video.workout_phase || '-'}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{video.workout_category || '-'}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{video.program_category || '-'}</span>
                          </TableCell>
                          <TableCell>
                            {video.is_promotional ? (
                              <span className="text-xs bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200 px-2 py-0.5 rounded">
                                Yes
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>{video.display_order}</TableCell>
                          <TableCell>
                            <Switch
                              checked={video.is_visible}
                              onCheckedChange={(checked) => 
                                toggleVisibilityMutation.mutate({ id: video.id, is_visible: checked })
                              }
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => window.open(video.youtube_url, '_blank')}
                                title="View on YouTube"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(video)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setDeleteConfirmId(video.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Video Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingVideo ? 'Edit Video' : 'Add New Video'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="youtube_url">YouTube URL *</Label>
              <Input
                id="youtube_url"
                value={formData.youtube_url}
                onChange={(e) => handleYouTubeUrlChange(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
              />
              {formData.youtube_url && !isValidYouTubeUrl(formData.youtube_url) && (
                <p className="text-sm text-destructive">Invalid YouTube URL</p>
              )}
            </div>

            {previewVideoId && (
              <div className="space-y-2">
                <Label>Preview</Label>
                <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                  <iframe
                    className="absolute inset-0 w-full h-full rounded-lg"
                    src={getRestrictedEmbedUrl(previewVideoId, false)}
                    title="Video Preview"
                    frameBorder="0"
                    allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Exercise demonstration title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Optional description..."
                rows={3}
              />
            </div>

            {/* Muscle Category Section */}
            <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
              <h4 className="font-semibold text-sm">Muscle Targeting</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Body Region</Label>
                  <Select
                    value={formData.muscle_group || 'none'}
                    onValueChange={handleMuscleGroupChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select body region" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {MUSCLE_GROUPS.map((group) => (
                        <SelectItem key={group} value={group}>{group}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Target Muscle</Label>
                  <Select
                    value={formData.target_muscle || 'none'}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, target_muscle: value === 'none' ? '' : value }))}
                    disabled={!formData.muscle_group}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select muscle" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {availableMuscles.map((muscle) => (
                        <SelectItem key={muscle} value={muscle}>{muscle}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Workout Context Section */}
            <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
              <h4 className="font-semibold text-sm">Workout Context</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Workout Phase</Label>
                  <Select
                    value={formData.workout_phase || 'none'}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, workout_phase: value === 'none' ? '' : value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select phase" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {WORKOUT_PHASES.map((phase) => (
                        <SelectItem key={phase} value={phase}>{phase}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Workout Category</Label>
                  <Select
                    value={formData.workout_category || 'none'}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, workout_category: value === 'none' ? '' : value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select workout category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {WORKOUT_CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Program Context Section */}
            <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
              <h4 className="font-semibold text-sm">Program Context</h4>
              <div className="space-y-2">
                <Label>Program Category</Label>
                <Select
                  value={formData.program_category || 'none'}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, program_category: value === 'none' ? '' : value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select program category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {PROGRAM_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Promotional Context Section */}
            <div className="border border-pink-500 rounded-lg p-4 space-y-4 bg-pink-50/30 dark:bg-pink-950/20">
              <h4 className="font-semibold text-sm text-pink-700 dark:text-pink-300">Promotional Context</h4>
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_promotional"
                  checked={formData.is_promotional}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_promotional: checked }))}
                />
                <Label htmlFor="is_promotional" className="text-sm">
                  Mark as Promotional Video (Instagram, Facebook, TikTok)
                </Label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="display_order">Display Order</Label>
                <Input
                  id="display_order"
                  type="number"
                  value={formData.display_order}
                  onChange={(e) => setFormData(prev => ({ ...prev, display_order: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="flex items-center space-x-2 pt-7">
                <Switch
                  id="is_visible"
                  checked={formData.is_visible}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_visible: checked }))}
                />
                <Label htmlFor="is_visible">Visible to users</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button 
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? 'Saving...' : editingVideo ? 'Update' : 'Add Video'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Video?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Are you sure you want to delete this video? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExerciseLibraryManager;
