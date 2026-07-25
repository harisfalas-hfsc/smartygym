import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { Blockquote } from '@tiptap/extension-blockquote';
import { Bold } from '@tiptap/extension-bold';
import { Document } from '@tiptap/extension-document';
import { HardBreak } from '@tiptap/extension-hard-break';
import { Heading } from '@tiptap/extension-heading';
import { HorizontalRule } from '@tiptap/extension-horizontal-rule';
import { Italic } from '@tiptap/extension-italic';
import { BulletList, ListItem, ListKeymap, OrderedList } from '@tiptap/extension-list';
import { Paragraph } from '@tiptap/extension-paragraph';
import { Strike } from '@tiptap/extension-strike';
import { Text } from '@tiptap/extension-text';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TextAlign } from '@tiptap/extension-text-align';
import { Link } from '@tiptap/extension-link';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { Underline } from '@tiptap/extension-underline';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Image } from '@tiptap/extension-image';
import { Highlight } from '@tiptap/extension-highlight';
import { CodeBlock } from '@tiptap/extension-code-block';
import { Subscript } from '@tiptap/extension-subscript';
import { Superscript } from '@tiptap/extension-superscript';
import { Extension } from '@tiptap/core';
import { createTableSelectionPlugin } from '@/lib/tiptap-extensions/table-selection-plugin';
import { Button } from './button';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Table as TableIcon,
  Link as LinkIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo,
  Redo,
  Palette,
  ImageIcon,
  Upload,
  Highlighter,
  Quote,
  Minus,
  Code,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Search,
  X,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useExerciseLibrary } from "@/hooks/useExerciseLibrary";


interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  showExerciseSearch?: boolean;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Start typing...',
  minHeight = '600px',
  showExerciseSearch = false,
}) => {
  const [showTableDialog, setShowTableDialog] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showTableStyleDialog, setShowTableStyleDialog] = useState(false);
  const [tableBorderColor, setTableBorderColor] = useState('default');
  const [tableBgColor, setTableBgColor] = useState('none');
  const [exerciseSearchQuery, setExerciseSearchQuery] = useState('');

  const { exercises, isLoading: exercisesLoading, searchExercises } = useExerciseLibrary();
  
  // Track the last known cursor position to ensure correct inline insertion
  const lastSelectionRef = useRef<{ from: number; to: number } | null>(null);
  
  const exerciseResults = exerciseSearchQuery.length >= 2 
    ? searchExercises(exerciseSearchQuery, 10) 
    : [];

  const editor = useEditor({
    extensions: [
      Document,
      Text,
      Paragraph.configure({
        HTMLAttributes: {
          class: 'tiptap-paragraph',
        },
      }),
      Heading.configure({
        levels: [1, 2, 3],
      }),
      Bold,
      Italic,
      Strike,
      Blockquote,
      HardBreak,
      HorizontalRule,
      BulletList.configure({
        HTMLAttributes: {
          class: 'tiptap-bullet-list',
        },
        keepMarks: true,
        keepAttributes: false,
      }),
      OrderedList.configure({
        HTMLAttributes: {
          class: 'tiptap-ordered-list',
        },
        keepMarks: true,
        keepAttributes: false,
      }),
      ListItem.configure({
        HTMLAttributes: {
          class: 'tiptap-list-item',
        },
      }),
      ListKeymap,
      Underline,
      TextStyle,
      Color,
      Highlight.configure({
        multicolor: true,
      }),
      CodeBlock,
      Subscript,
      Superscript,
      Image.configure({
        inline: true,
        allowBase64: true,
        HTMLAttributes: {
          class: 'editor-image',
        },
      }),
        Table.configure({
          resizable: false,
          HTMLAttributes: {
            class: '',
          },
        }),
      TableRow,
      TableHeader,
      TableCell,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary hover:underline',
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      Extension.create({
        name: 'tableSelection',
        addProseMirrorPlugins() {
          return [createTableSelectionPlugin()];
        },
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    // Add paste handling for Word documents and formatted content
    editorProps: {
      transformPastedHTML(html) {
        console.log('🔴 RAW PASTED HTML:', html.substring(0, 200));
        
        let cleaned = html;
        
        // Remove Microsoft Word specific tags and classes
        cleaned = cleaned.replace(/<o:p>.*?<\/o:p>/gi, '');
        cleaned = cleaned.replace(/class="Mso[^"]*"/gi, '');
        cleaned = cleaned.replace(/style="[^"]*mso-[^"]*"/gi, '');
        
        // Convert Word list markers to proper HTML lists
        cleaned = cleaned.replace(/<p class="MsoListParagraph[^"]*"[^>]*>(.*?)<\/p>/gi, '<li>$1</li>');
        
        // Clean up excessive spans and formatting
        cleaned = cleaned.replace(/<span[^>]*>(.*?)<\/span>/gi, '$1');
        
        // Remove empty paragraphs
        cleaned = cleaned.replace(/<p[^>]*>\s*<\/p>/gi, '');
        
        // Convert Word bullets (•, -, *, etc.) at start of paragraphs to list items
        cleaned = cleaned.replace(/<p[^>]*>[\s]*[•\-\*]\s+(.*?)<\/p>/gi, '<li>$1</li>');
        
        // Wrap consecutive <li> tags in <ul>
        cleaned = cleaned.replace(/(<li>.*?<\/li>)(\s*<li>)/gi, '$1$2');
        cleaned = cleaned.replace(/(<li>.*?<\/li>)/g, '<ul>$1</ul>');
        cleaned = cleaned.replace(/<\/ul>\s*<ul>/gi, '');
        
        console.log('🟢 CLEANED HTML:', cleaned.substring(0, 200));
        return cleaned;
      },
      
      transformPastedText(text) {
        const lines = text.split('\n');
        const processedLines = lines.map(line => {
          // Detect bullet points (•, -, *, ○, ▪)
          if (/^[\s]*[•\-\*○▪]\s+/.test(line)) {
            return line.replace(/^[\s]*[•\-\*○▪]\s+/, '');
          }
          // Detect numbered lists (1. 2. 3.)
          if (/^[\s]*\d+[\.\)]\s+/.test(line)) {
            return line.replace(/^[\s]*\d+[\.\)]\s+/, '');
          }
          return line;
        });
        
        // Clean excessive line breaks
        return processedLines.join('\n').replace(/\n{3,}/g, '\n\n');
      },
      
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none',
      },
    },
  });

  // Track selection changes to preserve cursor position for exercise insertion
  useEffect(() => {
    if (!editor) return;
    
    const updateSelection = () => {
      const { from, to } = editor.state.selection;
      lastSelectionRef.current = { from, to };
    };
    
    editor.on('selectionUpdate', updateSelection);
    // Also capture initial selection
    updateSelection();
    
    return () => {
      editor.off('selectionUpdate', updateSelection);
    };
  }, [editor]);

  // Sync external value changes into the editor (e.g. "Insert standard structure"
  // button, template prefills, programmatic resets). Tiptap only reads `content`
  // on init, so without this the editor stays static while formData updates.
  useLayoutEffect(() => {
    if (!editor) return;
    const incoming = value || '';
    const current = editor.getHTML();
    if (incoming !== current) {
      editor.commands.setContent(incoming, { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) {
    return null;
  }

  const addLink = () => {
    const url = window.prompt('Enter URL:');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  const insertTableWithSize = () => {
    editor
      .chain()
      .focus()
      .insertTable({ rows: tableRows, cols: tableCols, withHeaderRow: true })
      .run();
    setShowTableDialog(false);
  };

  const insertImageFromURL = () => {
    if (imageUrl) {
      editor.chain().focus().setImage({ src: imageUrl }).run();
      setImageUrl('');
      setShowImageDialog(false);
    }
  };

  const uploadImage = async (file: File) => {
    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `editor-images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('editor-uploads')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('editor-uploads')
        .getPublicUrl(filePath);

      editor.chain().focus().setImage({ src: publicUrl }).run();
      toast.success('Image uploaded successfully');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadImage(file);
    }
  };

  const applyTableStyles = () => {
    if (!editor) return;

    // Check if cursor is inside a table
    if (!editor.isActive('table')) {
      toast.error("Please click inside a table before applying styles");
      return;
    }

    const classes: string[] = [];
    
    // Border color classes
    if (tableBorderColor === 'gold') classes.push('table-border-gold');
    if (tableBorderColor === 'black') classes.push('table-border-black');
    if (tableBorderColor === 'gray') classes.push('table-border-gray');
    if (tableBorderColor === 'blue') classes.push('table-border-blue');
    if (tableBorderColor === 'red') classes.push('table-border-red');
    if (tableBorderColor === 'borderless') classes.push('table-borderless');
    
    // Background color classes
    if (tableBgColor === 'gold') classes.push('table-bg-gold');
    if (tableBgColor === 'black') classes.push('table-bg-black');
    if (tableBgColor === 'gray') classes.push('table-bg-gray');
    if (tableBgColor === 'blue') classes.push('table-bg-blue');
    if (tableBgColor === 'red') classes.push('table-bg-red');
    
    // Apply the classes to the table
    editor.chain().focus().updateAttributes('table', {
      class: classes.join(' ')
    }).run();
    
    // Close dialog and reset
    setShowTableStyleDialog(false);
    setTableBorderColor('default');
    setTableBgColor('none');
  };

  return (
    <div className="w-full">
      <div className="border rounded-md">
        {/* Sticky Header: Exercise Search + Toolbar */}
        <div className="sticky top-0 z-30 bg-background border-b border-input shadow-sm">
          {/* Exercise Search Panel - above toolbar */}
          {showExerciseSearch && (
            <div className="border-b border-input">
              <div className="p-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search exercises to add..."
                    value={exerciseSearchQuery}
                    onChange={(e) => setExerciseSearchQuery(e.target.value)}
                    className="pl-8 pr-8"
                  />
                  {exerciseSearchQuery && (
                    <button
                      onClick={() => setExerciseSearchQuery('')}
                      className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              {/* Results list - only show when there's a query */}
              {exerciseSearchQuery.length >= 2 && (
                <div className="max-h-[200px] overflow-y-auto border-t border-input">
                  {exercisesLoading ? (
                    <div className="p-3 text-center text-sm text-muted-foreground">
                      Loading exercises...
                    </div>
                  ) : exerciseResults.length === 0 ? (
                    <div className="p-3 text-center text-sm text-muted-foreground">
                      No exercises found for "{exerciseSearchQuery}"
                    </div>
                  ) : (
                    <div className="p-1">
                      {exerciseResults.map((exercise) => (
                        <div
                          key={exercise.id}
                          className="flex items-center justify-between p-2 rounded-md hover:bg-accent cursor-pointer group"
                          onMouseDown={(e) => {
                            // Prevent focus loss from editor - keeps cursor position
                            e.preventDefault();
                          }}
                          onClick={() => {
                            const pos = lastSelectionRef.current;
                            if (pos) {
                              // Insert at the exact stored cursor position
                              editor
                                .chain()
                                .focus()
                                .insertContentAt(pos.from, [
                                  {
                                    type: 'text',
                                    text: `{{exercise:${exercise.id}:${exercise.name}}}`,
                                    marks: [{ type: 'bold' }]
                                  }
                                ])
                                .run();
                            } else {
                              // Fallback: insert at current position
                              editor
                                .chain()
                                .focus()
                                .insertContent([
                                  {
                                    type: 'text',
                                    text: `{{exercise:${exercise.id}:${exercise.name}}}`,
                                    marks: [{ type: 'bold' }]
                                  }
                                ])
                                .run();
                            }
                            setExerciseSearchQuery('');
                            toast.success(`Added: ${exercise.name}`);
                          }}
                        >
                          <div className="flex-1 min-w-0 mr-2">
                            <p className="text-sm font-medium whitespace-normal break-words">{exercise.name}</p>
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              <Badge variant="secondary" className="text-[10px] px-1 py-0">
                                {exercise.body_part}
                              </Badge>
                              <Badge variant="outline" className="text-[10px] px-1 py-0">
                                {exercise.equipment}
                              </Badge>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 shrink-0 opacity-0 group-hover:opacity-100"
                            onMouseDown={(e) => e.preventDefault()}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Toolbar */}
          <div className="flex flex-wrap gap-1 p-2">
          {/* Text Formatting */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={cn(editor.isActive('bold') && 'bg-accent')}
              >
                <Bold className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Bold</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={cn(editor.isActive('italic') && 'bg-accent')}
              >
                <Italic className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Italic</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                className={cn(editor.isActive('underline') && 'bg-accent')}
              >
                <UnderlineIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Underline</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleStrike().run()}
                className={cn(editor.isActive('strike') && 'bg-accent')}
              >
                <Strikethrough className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Strikethrough</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-8" />

          {/* Headings */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                className={cn(editor.isActive('heading', { level: 1 }) && 'bg-accent')}
              >
                <Heading1 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Heading 1</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={cn(editor.isActive('heading', { level: 2 }) && 'bg-accent')}
              >
                <Heading2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Heading 2</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                className={cn(editor.isActive('heading', { level: 3 }) && 'bg-accent')}
              >
                <Heading3 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Heading 3</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-8" />

          {/* Lists */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={cn(editor.isActive('bulletList') && 'bg-accent')}
              >
                <List className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Bullet List</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={cn(editor.isActive('orderedList') && 'bg-accent')}
              >
                <ListOrdered className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Numbered List</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-8" />

          {/* Alignment */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().setTextAlign('left').run()}
                className={cn(editor.isActive({ textAlign: 'left' }) && 'bg-accent')}
              >
                <AlignLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Align Left</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().setTextAlign('center').run()}
                className={cn(editor.isActive({ textAlign: 'center' }) && 'bg-accent')}
              >
                <AlignCenter className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Align Center</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().setTextAlign('right').run()}
                className={cn(editor.isActive({ textAlign: 'right' }) && 'bg-accent')}
              >
                <AlignRight className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Align Right</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-8" />

          {/* Color & Highlight */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Palette className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Text Color</TooltipContent>
            </Tooltip>
            <DropdownMenuContent side="bottom" align="center" collisionPadding={8}>
              <div className="grid grid-cols-6 gap-1 p-2">
                {['#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080', '#FFC0CB', '#808080', '#FFFFFF'].map((color) => (
                  <button
                    key={color}
                    className="w-6 h-6 rounded border border-input"
                    style={{ backgroundColor: color }}
                    onClick={() => editor.chain().focus().setColor(color).run()}
                  />
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Highlighter className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Highlight</TooltipContent>
            </Tooltip>
            <DropdownMenuContent side="bottom" align="center" collisionPadding={8}>
              <div className="grid grid-cols-6 gap-1 p-2">
                {['#FFFF00', '#00FF00', '#00FFFF', '#FF00FF', '#FFA500', '#FFC0CB'].map((color) => (
                  <button
                    key={color}
                    className="w-6 h-6 rounded border border-input"
                    style={{ backgroundColor: color }}
                    onClick={() => editor.chain().focus().toggleHighlight({ color }).run()}
                  />
                ))}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => editor.chain().focus().unsetHighlight().run()}
              >
                Remove Highlight
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Separator orientation="vertical" className="h-8" />

          {/* Advanced Formatting */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleSubscript().run()}
                className={cn(editor.isActive('subscript') && 'bg-accent')}
              >
                <SubscriptIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Subscript</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleSuperscript().run()}
                className={cn(editor.isActive('superscript') && 'bg-accent')}
              >
                <SuperscriptIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Superscript</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                className={cn(editor.isActive('blockquote') && 'bg-accent')}
              >
                <Quote className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Quote</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                className={cn(editor.isActive('codeBlock') && 'bg-accent')}
              >
                <Code className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Code Block</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
              >
                <Minus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Horizontal Line</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-8" />

          {/* Media */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={addLink}
              >
                <LinkIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Insert Link</TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Insert Image</TooltipContent>
            </Tooltip>
            <DropdownMenuContent side="bottom" align="center" collisionPadding={8}>
              <DropdownMenuItem onSelect={() => setShowImageDialog(true)}>
                From URL
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <label className="cursor-pointer">
                  <Upload className="h-4 w-4 mr-2 inline" />
                  Upload Image
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={isUploading}
                  />
                </label>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Table */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <TableIcon className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Table Operations</TooltipContent>
            </Tooltip>
            <DropdownMenuContent side="bottom" align="center" collisionPadding={8}>
                <DropdownMenuItem onSelect={() => setShowTableDialog(true)}>
                  Insert Table
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setShowTableStyleDialog(true)}>
                  Table Styles...
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => editor?.chain().focus().addRowBefore().run()}
              >
                Add Row Above
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => editor?.chain().focus().addRowAfter().run()}
              >
                Add Row Below
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => editor?.chain().focus().deleteRow().run()}
              >
                Delete Row
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => editor?.chain().focus().addColumnBefore().run()}
              >
                Add Column Left
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => editor?.chain().focus().addColumnAfter().run()}
              >
                Add Column Right
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => editor?.chain().focus().deleteColumn().run()}
              >
                Delete Column
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => editor?.chain().focus().mergeCells().run()}
              >
                Merge Cells
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => editor?.chain().focus().splitCell().run()}
              >
                Split Cell
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => editor?.chain().focus().toggleHeaderCell().run()}
              >
                Toggle Header Cell
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => editor?.chain().focus().deleteTable().run()}
                className="text-destructive"
              >
                Delete Table
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Separator orientation="vertical" className="h-8" />

          {/* Undo/Redo */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().undo().run()}
              >
                <Undo className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Undo</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().redo().run()}
              >
                <Redo className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Redo</TooltipContent>
          </Tooltip>

          </div>
        </div>

        {/* Editor Content */}
        <EditorContent
          editor={editor}
          className="prose prose-sm max-w-none p-4"
          style={{ minHeight }}
        />
      </div>

      {/* Table Dialog */}
      <Dialog open={showTableDialog} onOpenChange={setShowTableDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insert Table</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="rows" className="text-right">
                Rows
              </Label>
              <Input
                id="rows"
                type="number"
                value={tableRows}
                onChange={(e) => setTableRows(Number(e.target.value))}
                className="col-span-3"
                min="1"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="cols" className="text-right">
                Columns
              </Label>
              <Input
                id="cols"
                type="number"
                value={tableCols}
                onChange={(e) => setTableCols(Number(e.target.value))}
                className="col-span-3"
                min="1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTableDialog(false)}>
              Cancel
            </Button>
            <Button onClick={insertTableWithSize}>Insert</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image URL Dialog */}
      <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insert Image from URL</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="imageUrl" className="text-right">
                URL
              </Label>
              <Input
                id="imageUrl"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="col-span-3"
                placeholder="https://example.com/image.jpg"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImageDialog(false)}>
              Cancel
            </Button>
            <Button onClick={insertImageFromURL}>Insert</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Table Style Dialog */}
      <Dialog open={showTableStyleDialog} onOpenChange={setShowTableStyleDialog}>
        <DialogContent className="sm:max-w-[500px] max-h-[85vh] grid grid-rows-[auto,1fr,auto] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Table Styles</DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-4 overflow-y-auto pr-2 min-h-0">
            {/* Border Color Section */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Border Color</Label>
              <div className="grid gap-2">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="borderColor"
                    value="default"
                    checked={tableBorderColor === 'default'}
                    onChange={(e) => setTableBorderColor(e.target.value)}
                    className="w-4 h-4"
                  />
                  <span>Default (Gray Border)</span>
                </label>
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="borderColor"
                    value="gold"
                    checked={tableBorderColor === 'gold'}
                    onChange={(e) => setTableBorderColor(e.target.value)}
                    className="w-4 h-4"
                  />
                  <span className="flex items-center">
                    Blue Border
                    <span className="ml-2 w-6 h-6 rounded border-2 border-primary" />
                  </span>
                </label>
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="borderColor"
                    value="black"
                    checked={tableBorderColor === 'black'}
                    onChange={(e) => setTableBorderColor(e.target.value)}
                    className="w-4 h-4"
                  />
                  <span className="flex items-center">
                    Black Border
                    <span className="ml-2 w-6 h-6 rounded border-2 border-black" />
                  </span>
                </label>
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="borderColor"
                    value="gray"
                    checked={tableBorderColor === 'gray'}
                    onChange={(e) => setTableBorderColor(e.target.value)}
                    className="w-4 h-4"
                  />
                  <span className="flex items-center">
                    Gray Border
                    <span className="ml-2 w-6 h-6 rounded border-2 border-gray-400" />
                  </span>
                </label>
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="borderColor"
                    value="blue"
                    checked={tableBorderColor === 'blue'}
                    onChange={(e) => setTableBorderColor(e.target.value)}
                    className="w-4 h-4"
                  />
                  <span className="flex items-center">
                    Blue Border
                    <span className="ml-2 w-6 h-6 rounded border-2 border-blue-500" />
                  </span>
                </label>
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="borderColor"
                    value="red"
                    checked={tableBorderColor === 'red'}
                    onChange={(e) => setTableBorderColor(e.target.value)}
                    className="w-4 h-4"
                  />
                  <span className="flex items-center">
                    Red Border
                    <span className="ml-2 w-6 h-6 rounded border-2 border-red-500" />
                  </span>
                </label>
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="borderColor"
                    value="borderless"
                    checked={tableBorderColor === 'borderless'}
                    onChange={(e) => setTableBorderColor(e.target.value)}
                    className="w-4 h-4"
                  />
                  <span>Borderless (No Border)</span>
                </label>
              </div>
            </div>

            <Separator />

            {/* Background Color Section */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Background Color</Label>
              <div className="grid gap-2">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="bgColor"
                    value="none"
                    checked={tableBgColor === 'none'}
                    onChange={(e) => setTableBgColor(e.target.value)}
                    className="w-4 h-4"
                  />
                  <span>None (Transparent)</span>
                </label>
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="bgColor"
                    value="gold"
                    checked={tableBgColor === 'gold'}
                    onChange={(e) => setTableBgColor(e.target.value)}
                    className="w-4 h-4"
                  />
                  <span className="flex items-center">
                    Gold Background
                    <span className="ml-2 w-6 h-6 rounded bg-[#FFF8DC]" />
                  </span>
                </label>
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="bgColor"
                    value="black"
                    checked={tableBgColor === 'black'}
                    onChange={(e) => setTableBgColor(e.target.value)}
                    className="w-4 h-4"
                  />
                  <span className="flex items-center">
                    Black Background
                    <span className="ml-2 w-6 h-6 rounded bg-gray-800" />
                  </span>
                </label>
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="bgColor"
                    value="gray"
                    checked={tableBgColor === 'gray'}
                    onChange={(e) => setTableBgColor(e.target.value)}
                    className="w-4 h-4"
                  />
                  <span className="flex items-center">
                    Gray Background
                    <span className="ml-2 w-6 h-6 rounded bg-gray-100" />
                  </span>
                </label>
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="bgColor"
                    value="blue"
                    checked={tableBgColor === 'blue'}
                    onChange={(e) => setTableBgColor(e.target.value)}
                    className="w-4 h-4"
                  />
                  <span className="flex items-center">
                    Blue Background
                    <span className="ml-2 w-6 h-6 rounded bg-blue-50" />
                  </span>
                </label>
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="bgColor"
                    value="red"
                    checked={tableBgColor === 'red'}
                    onChange={(e) => setTableBgColor(e.target.value)}
                    className="w-4 h-4"
                  />
                  <span className="flex items-center">
                    Red Background
                    <span className="ml-2 w-6 h-6 rounded bg-red-50" />
                  </span>
                </label>
              </div>
            </div>

            <Separator />

            {/* Preview Section */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Preview</Label>
              <div className="flex justify-center p-4 bg-muted/30 rounded-md">
                <table 
                  className={`
                    ${tableBorderColor === 'gold' ? 'table-border-gold' : ''}
                    ${tableBorderColor === 'black' ? 'table-border-black' : ''}
                    ${tableBorderColor === 'gray' ? 'table-border-gray' : ''}
                    ${tableBorderColor === 'blue' ? 'table-border-blue' : ''}
                    ${tableBorderColor === 'red' ? 'table-border-red' : ''}
                    ${tableBorderColor === 'borderless' ? 'table-borderless' : ''}
                    ${tableBgColor === 'gold' ? 'table-bg-gold' : ''}
                    ${tableBgColor === 'black' ? 'table-bg-black' : ''}
                    ${tableBgColor === 'gray' ? 'table-bg-gray' : ''}
                    ${tableBgColor === 'blue' ? 'table-bg-blue' : ''}
                    ${tableBgColor === 'red' ? 'table-bg-red' : ''}
                  `.trim()}
                  style={{ 
                    borderCollapse: 'collapse',
                    fontSize: '0.75rem',
                    minWidth: '200px'
                  }}
                >
                  <thead>
                    <tr>
                      <th style={{ padding: '0.5rem', border: tableBorderColor === 'borderless' ? 'none' : '1px solid' }}>
                        Header 1
                      </th>
                      <th style={{ padding: '0.5rem', border: tableBorderColor === 'borderless' ? 'none' : '1px solid' }}>
                        Header 2
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: '0.5rem', border: tableBorderColor === 'borderless' ? 'none' : '1px solid' }}>
                        Cell 1
                      </td>
                      <td style={{ padding: '0.5rem', border: tableBorderColor === 'borderless' ? 'none' : '1px solid' }}>
                        Cell 2
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '0.5rem', border: tableBorderColor === 'borderless' ? 'none' : '1px solid' }}>
                        Cell 3
                      </td>
                      <td style={{ padding: '0.5rem', border: tableBorderColor === 'borderless' ? 'none' : '1px solid' }}>
                        Cell 4
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                This is how your table will look with the selected styles
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowTableStyleDialog(false);
              setTableBorderColor('default');
              setTableBgColor('none');
            }}>
              Cancel
            </Button>
            <Button onClick={applyTableStyles}>Apply Styles</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style>{`
        .ProseMirror {
          outline: none;
        }

        .ProseMirror p {
          margin: 0.5rem 0;
        }

        .ProseMirror h1,
        .ProseMirror h2,
        .ProseMirror h3 {
          margin: 1rem 0 0.5rem;
          font-weight: bold;
        }

        .ProseMirror h1 {
          font-size: 2em;
        }

        .ProseMirror h2 {
          font-size: 1.5em;
        }

        .ProseMirror h3 {
          font-size: 1.17em;
        }

        /* Enhanced list styling */
        .ProseMirror ul.tiptap-bullet-list,
        .ProseMirror ul {
          list-style-type: disc;
          padding-left: 1.5rem;
          margin: 0.5rem 0;
        }

        .ProseMirror ol.tiptap-ordered-list,
        .ProseMirror ol {
          list-style-type: decimal;
          padding-left: 1.5rem;
          margin: 0.5rem 0;
        }

        .ProseMirror li.tiptap-list-item,
        .ProseMirror li {
          margin: 0.25rem 0;
          padding-left: 0.25rem;
        }

        /* Nested lists */
        .ProseMirror ul ul,
        .ProseMirror ol ul {
          list-style-type: circle;
        }

        .ProseMirror ul ul ul,
        .ProseMirror ol ul ul,
        .ProseMirror ol ol ul {
          list-style-type: square;
        }

        .ProseMirror ol ol {
          list-style-type: lower-alpha;
        }

        .ProseMirror ol ol ol {
          list-style-type: lower-roman;
        }

        .ProseMirror blockquote {
          border-left: 3px solid hsl(var(--border));
          padding-left: 1rem;
          margin: 1rem 0;
          color: hsl(var(--muted-foreground));
        }

        .ProseMirror code {
          background-color: hsl(var(--muted));
          padding: 0.2em 0.4em;
          border-radius: 3px;
          font-size: 0.9em;
        }

        .ProseMirror pre {
          background-color: hsl(var(--muted));
          border-radius: 0.5rem;
          padding: 0.75rem 1rem;
          margin: 1rem 0;
        }

        .ProseMirror pre code {
          background: none;
          padding: 0;
          font-family: 'Courier New', monospace;
        }

        .ProseMirror a {
          color: hsl(var(--primary));
          text-decoration: underline;
          cursor: pointer;
        }

        .ProseMirror img {
          max-width: 100%;
          height: auto;
          border-radius: 0.5rem;
        }

        .ProseMirror table {
          border-collapse: collapse;
          margin: 1rem 0;
          overflow: hidden;
          table-layout: fixed;
          width: 100%;
        }

        .ProseMirror td,
        .ProseMirror th {
          border: 1px solid hsl(var(--border));
          padding: 0.5rem;
          vertical-align: top;
          box-sizing: border-box;
          position: relative;
          min-width: 1em;
        }

        .ProseMirror th {
          font-weight: bold;
          text-align: left;
          background-color: hsl(var(--muted));
        }

        .ProseMirror .selectedCell {
          background-color: hsl(var(--accent));
        }

        .ProseMirror .column-resize-handle {
          position: absolute;
          right: -2px;
          top: 0;
          bottom: -2px;
          width: 4px;
          background-color: hsl(var(--primary));
          pointer-events: none;
        }

        .ProseMirror.resize-cursor {
          cursor: col-resize;
        }

        /* Table Border Color Classes */
        .ProseMirror table.table-border-gold td,
        .ProseMirror table.table-border-gold th {
          border-color: hsl(var(--primary)) !important;
        }

        .ProseMirror table.table-border-black td,
        .ProseMirror table.table-border-black th {
          border-color: #000000 !important;
        }

        .ProseMirror table.table-border-gray td,
        .ProseMirror table.table-border-gray th {
          border-color: #9CA3AF !important;
        }

        .ProseMirror table.table-border-blue td,
        .ProseMirror table.table-border-blue th {
          border-color: #3B82F6 !important;
        }

        .ProseMirror table.table-border-red td,
        .ProseMirror table.table-border-red th {
          border-color: #EF4444 !important;
        }

        .ProseMirror table.table-borderless td,
        .ProseMirror table.table-borderless th {
          border: none !important;
        }

        /* Table Background Color Classes */
        .ProseMirror table.table-bg-gold {
          background-color: #FFF8DC !important;
        }

        .ProseMirror table.table-bg-black {
          background-color: #1F2937 !important;
          color: white !important;
        }

        .ProseMirror table.table-bg-black td,
        .ProseMirror table.table-bg-black th {
          color: white !important;
        }

        .ProseMirror table.table-bg-gray {
          background-color: #F3F4F6 !important;
        }

        .ProseMirror table.table-bg-blue {
          background-color: #EFF6FF !important;
        }

        .ProseMirror table.table-bg-red {
          background-color: #FEF2F2 !important;
        }
      `}</style>
    </div>
  );
};
