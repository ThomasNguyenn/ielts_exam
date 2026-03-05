import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MoreVertical, X } from 'lucide-react';
import { api } from '@/shared/api/client';
import { useNotification } from '@/shared/context/NotificationContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

function speakingToForm(speaking) {
  if (!speaking) {
    return {
      _id: '',
      title: '',
      part2_question_title: '',
      part: '1',
      prompt: '',
      cue_card: '',
      sub_questions: [],
      keywords: [],
      sample_highlights: '',
      isActive: true,
      aiProvider: 'openai',
      aiModel: 'gpt-4o-mini-tts',
      aiVoice: 'alloy',
      generatedAudioUrl: '',
      createdAt: null,
    };
  }

  const part = String(speaking.part || '1');
  const isPart2 = part === '2';
  const storedTitle = String(speaking.title || '').trim();
  const storedPrompt = String(speaking.prompt || '').trim();
  const storedPart2QuestionTitle = String(speaking.part2_question_title || '').trim();
  const storedCueCard = String(speaking.cue_card || '').trim();

  return {
    _id: speaking._id || '',
    title: storedTitle,
    part2_question_title: isPart2 ? (storedPart2QuestionTitle || storedPrompt) : storedPart2QuestionTitle,
    part,
    prompt: storedPrompt,
    cue_card: storedCueCard,
    sub_questions: Array.isArray(speaking.sub_questions) ? speaking.sub_questions : [],
    keywords: Array.isArray(speaking.keywords) ? speaking.keywords : [],
    sample_highlights: speaking.sample_highlights || '',
    isActive: speaking.is_active ?? true,
    aiProvider: speaking.read_aloud?.provider || 'openai',
    aiModel: speaking.read_aloud?.model || 'gpt-4o-mini-tts',
    aiVoice: speaking.read_aloud?.voice || 'alloy',
    generatedAudioUrl: speaking.read_aloud?.prompt?.url || '',
    createdAt: speaking.created_at || speaking.createdAt || null,
  };
}

export default function AddSpeaking({ editIdOverride = null, embedded = false, onSaved = null, onCancel = null }) {
  const { id: routeEditId } = useParams();
  const normalizedRouteEditId = routeEditId === 'new' ? null : routeEditId;
  const editId = editIdOverride ?? normalizedRouteEditId;
  const navigate = useNavigate();
  const { showNotification } = useNotification();

  const [form, setForm] = useState(speakingToForm(null));
  const [keywordInput, setKeywordInput] = useState('');
  const [newSubQuestion, setNewSubQuestion] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [generateAudioLoading, setGenerateAudioLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isMetadataOpen, setIsMetadataOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        if (editId) {
          const response = await api.getSpeakingById(editId);
          setForm(speakingToForm(response));
        } else {
          setForm({
            ...speakingToForm(null),
            _id: `speaking-${Date.now()}`,
          });
        }
      } catch (loadErr) {
        setLoadError(loadErr.message);
        showNotification(`Error loading speaking test: ${loadErr.message}`, 'error');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [editId, showNotification]);

  const metadataDate = useMemo(() => {
    if (!form.createdAt) {
      return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return new Date(form.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }, [form.createdAt]);

  const updateForm = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const addSubQuestion = () => {
    if (!newSubQuestion.trim()) return;
    setForm((prev) => ({ ...prev, sub_questions: [...prev.sub_questions, newSubQuestion.trim()] }));
    setNewSubQuestion('');
  };

  const removeSubQuestion = (index) => {
    setForm((prev) => ({ ...prev, sub_questions: prev.sub_questions.filter((_, idx) => idx !== index) }));
  };

  const addKeyword = () => {
    const value = keywordInput.trim();
    if (!value) return;
    if (form.keywords.includes(value)) {
      setKeywordInput('');
      return;
    }
    setForm((prev) => ({ ...prev, keywords: [...prev.keywords, value] }));
    setKeywordInput('');
  };

  const removeKeyword = (index) => {
    setForm((prev) => ({ ...prev, keywords: prev.keywords.filter((_, idx) => idx !== index) }));
  };

  const handleGenerateAudio = async (event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    const sourcePrompt = form.part === '2' ? form.part2_question_title : form.prompt;
    if (!sourcePrompt.trim()) {
      showNotification('Please enter the main prompt first.', 'warning');
      return;
    }

    setGenerateAudioLoading(true);
    try {
      const response = await api.generateSpeakingReadAloud({
        topicId: (form._id || `speaking-${Date.now()}`).trim(),
        prompt: sourcePrompt,
        provider: form.aiProvider || 'openai',
        model: form.aiModel || undefined,
        voice: form.aiVoice || undefined,
      });

      const payload = response?.data || response;
      const audioUrl = String(payload?.url || '').trim();
      if (!audioUrl) {
        throw new Error('Generate audio succeeded but URL is missing');
      }

      updateForm('generatedAudioUrl', audioUrl);
      showNotification('Generated MP3 successfully.', 'success');
    } catch (generateErr) {
      console.error('Generate speaking read-aloud failed:', generateErr);
      showNotification(generateErr.message || 'Could not generate audio. Please try again.', 'error');
    } finally {
      setGenerateAudioLoading(false);
    }
  };

  const saveSpeaking = async ({ asDraft = false } = {}) => {
    setError(null);

    const normalizedPart = Number(form.part);
    const normalizedTitle = form.title.trim();
    const normalizedPart2QuestionTitle = normalizedPart === 2 ? String(form.part2_question_title || '').trim() : '';
    const normalizedPrompt = normalizedPart === 2 ? normalizedPart2QuestionTitle : form.prompt.trim();
    const normalizedCueCard = form.cue_card?.trim() || '';

    if (!form._id.trim() || !normalizedTitle || !normalizedPrompt || (normalizedPart === 2 && !normalizedPart2QuestionTitle)) {
      showNotification('ID, topic category, and prompt title are required.', 'error');
      return;
    }

    setSubmitLoading(true);
    try {
      const payload = {
        _id: form._id.trim(),
        title: normalizedTitle,
        part: normalizedPart,
        prompt: normalizedPrompt,
        part2_question_title: normalizedPart2QuestionTitle,
        cue_card: normalizedCueCard,
        sub_questions: form.sub_questions.filter(Boolean),
        keywords: form.keywords.filter(Boolean),
        sample_highlights: form.sample_highlights?.trim() || '',
        is_active: asDraft ? false : form.isActive,
        read_aloud: {
          provider: form.aiProvider || null,
          model: form.aiModel || null,
          voice: form.aiVoice || null,
          prompt: form.generatedAudioUrl ? { url: form.generatedAudioUrl } : undefined,
        },
      };

      if (editId) {
        await api.updateSpeaking(editId, payload);
        showNotification('Speaking task updated.', 'success');
      } else {
        await api.createSpeaking(payload);
        showNotification('Speaking task created.', 'success');
        if (!editIdOverride) {
          navigate(`/admin/manage/speaking/${form._id}`);
        }
      }

      if (asDraft) {
        setForm((prev) => ({ ...prev, isActive: false }));
      }
      if (typeof onSaved === 'function') onSaved();
    } catch (submitErr) {
      setError(submitErr.message);
      showNotification(submitErr.message, 'error');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    await saveSpeaking({ asDraft: false });
  };

  const handleSaveDraft = async () => {
    await saveSpeaking({ asDraft: true });
  };

  if (loading) {
    return (
      <div className='min-h-[calc(100vh-70px)] bg-muted/30 p-4 md:p-6'>
        <Card className='mx-auto max-w-7xl border-border/70 shadow-sm'>
          <CardContent className='p-6 text-sm text-muted-foreground'>Loading...</CardContent>
        </Card>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className='min-h-[calc(100vh-70px)] bg-muted/30 p-4 md:p-6'>
        <Card className='mx-auto max-w-7xl border-border/70 shadow-sm'>
          <CardContent className='p-6 text-sm font-medium text-destructive'>{loadError}</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className='min-h-[calc(100vh-70px)] bg-muted/30'>
      <div className='mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-6'>
        <Card className='border-border/70 shadow-sm'>
          <CardHeader className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
            <div className='flex items-start gap-3'>
              <Button
                type='button'
                variant='outline'
                size='icon'
                onClick={() => {
                  if (typeof onCancel === 'function') onCancel();
                  else navigate('/admin/manage/speaking');
                }}
              >
                <X className='h-4 w-4' />
              </Button>
              <div className='space-y-1'>
                <CardTitle className='text-2xl tracking-tight'>{editId ? 'Edit Speaking Task' : 'Create Speaking Task'}</CardTitle>
                <CardDescription>IELTS speaking task editor with AI voice options.</CardDescription>
              </div>
            </div>
            <div className='flex flex-wrap items-center gap-3'>
              <div className='flex items-center gap-2 rounded-md border px-3 py-2'>
                <Switch checked={form.isActive} onCheckedChange={(checked) => updateForm('isActive', checked)} />
                <span className='text-sm'>{form.isActive ? 'Active' : 'Inactive'}</span>
              </div>
              <Button type='button' variant='outline' onClick={handleSaveDraft}>Save Draft</Button>
              <Button type='button' variant='outline' size='icon' onClick={() => setIsMetadataOpen(true)} aria-label='Open metadata'>
                <MoreVertical className='h-4 w-4' />
              </Button>
              <Button type='button' onClick={handleSubmit} disabled={submitLoading}>
                {submitLoading ? 'Saving...' : 'Save Speaking'}
              </Button>
            </div>
          </CardHeader>
        </Card>

        <Dialog open={isMetadataOpen} onOpenChange={setIsMetadataOpen}>
          <DialogContent className='sm:max-w-md'>
            <DialogHeader>
              <DialogTitle>Metadata</DialogTitle>
            </DialogHeader>
            <div className='space-y-3'>
              <div className='flex items-center justify-between text-sm'>
                <span className='text-muted-foreground'>Created</span>
                <span>{metadataDate}</span>
              </div>
              <div className='flex items-center justify-between text-sm'>
                <span className='text-muted-foreground'>Status</span>
                <Badge variant={form.isActive ? 'default' : 'secondary'}>{form.isActive ? 'Active' : 'Inactive'}</Badge>
              </div>
              <div className='flex items-center justify-between text-sm'>
                <span className='text-muted-foreground'>Speaking Part</span>
                <Badge variant='outline'>Part {form.part}</Badge>
              </div>
              <div className='flex items-center justify-between text-sm'>
                <span className='text-muted-foreground'>Follow-up Questions</span>
                <span>{form.sub_questions.length}</span>
              </div>
              <div className='flex items-center justify-between text-sm'>
                <span className='text-muted-foreground'>Keywords</span>
                <span>{form.keywords.length}</span>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {error ? (
          <Card className='border-destructive/30 shadow-sm'>
            <CardContent className='p-4 text-sm font-medium text-destructive'>{error}</CardContent>
          </Card>
        ) : null}

        <div className='grid gap-6 xl:grid-cols-12'>
          <div className='space-y-6 xl:col-span-12'>
            <Card className='border-border/70 shadow-sm'>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='space-y-2'>
                  <Label htmlFor='speaking-id'>Speaking ID</Label>
                  <Input
                    id='speaking-id'
                    value={form._id}
                    onChange={(event) => updateForm('_id', event.target.value)}
                    readOnly={Boolean(editId)}
                    placeholder='e.g., SPEAK_P2_001'
                  />
                </div>

                <div className='grid gap-4 md:grid-cols-2'>
                  <div className='space-y-2'>
                    <Label htmlFor='speaking-title'>{form.part === '2' ? 'Topic Category' : 'Title'}</Label>
                    <Input
                      id='speaking-title'
                      value={form.title}
                      onChange={(event) => updateForm('title', event.target.value)}
                      placeholder={form.part === '2' ? 'Education, Travel, Environment...' : 'Speaking title'}
                    />
                  </div>
                  <div className='space-y-2'>
                    <Label>Speaking Part</Label>
                    <Select value={form.part} onValueChange={(value) => updateForm('part', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder='Part' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='1'>Part 1 - Intro and interview</SelectItem>
                        <SelectItem value='2'>Part 2 - Cue card</SelectItem>
                        <SelectItem value='3'>Part 3 - Discussion</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {form.part === '2' ? (
                  <div className='space-y-2'>
                    <Label htmlFor='part2-title'>Part 2 Question Title</Label>
                    <Input
                      id='part2-title'
                      value={form.part2_question_title}
                      onChange={(event) => updateForm('part2_question_title', event.target.value)}
                      placeholder='Describe a teacher who influenced you'
                    />
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className='border-border/70 shadow-sm'>
              <CardHeader>
                <CardTitle>{form.part === '2' ? 'Cue Card' : 'Main Prompt'}</CardTitle>
              </CardHeader>
              <CardContent>
                {form.part === '2' ? (
                  <div className='space-y-2'>
                    <Label htmlFor='cue-card'>Cue Card Bullets</Label>
                    <Textarea
                      id='cue-card'
                      value={form.cue_card}
                      onChange={(event) => updateForm('cue_card', event.target.value)}
                      rows={8}
                      placeholder={'Describe a time you learned something new\nWhere it happened\nWho taught you\nWhy it was memorable'}
                    />
                  </div>
                ) : (
                  <div className='space-y-2'>
                    <Label htmlFor='main-prompt'>Main Prompt</Label>
                    <Textarea
                      id='main-prompt'
                      value={form.prompt}
                      onChange={(event) => updateForm('prompt', event.target.value)}
                      rows={8}
                      placeholder='What kind of music do you like to listen to?'
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className='border-border/70 shadow-sm'>
              <CardHeader className='flex flex-row items-center justify-between'>
                <CardTitle>Follow-up Questions</CardTitle>
                <Button type='button' size='sm' variant='outline' onClick={addSubQuestion}>+ Add Question</Button>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='flex flex-col gap-2 sm:flex-row'>
                  <Input
                    value={newSubQuestion}
                    onChange={(event) => setNewSubQuestion(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addSubQuestion();
                      }
                    }}
                    placeholder='Enter a follow-up question'
                  />
                  <Button type='button' variant='outline' onClick={addSubQuestion}>Add</Button>
                </div>

                {!form.sub_questions.length ? (
                  <div className='rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground'>No follow-up questions yet.</div>
                ) : (
                  <div className='space-y-2'>
                    {form.sub_questions.map((question, index) => (
                      <div key={`sq-${index}`} className='space-y-2 rounded-md border p-3'>
                        <div className='flex items-center justify-between'>
                          <Badge variant='outline'>Question {index + 1}</Badge>
                          <Button type='button' size='sm' variant='ghost' onClick={() => removeSubQuestion(index)}>Remove</Button>
                        </div>
                        <Textarea
                          value={question}
                          onChange={(event) => {
                            const next = [...form.sub_questions];
                            next[index] = event.target.value;
                            updateForm('sub_questions', next);
                          }}
                          rows={2}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className='border-border/70 shadow-sm'>
              <CardHeader>
                <CardTitle>AI Voice Settings</CardTitle>
                <CardDescription>Generate read-aloud audio for the main prompt.</CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='grid gap-4 md:grid-cols-3'>
                  <div className='space-y-2'>
                    <Label>Provider</Label>
                    <Select value={form.aiProvider} onValueChange={(value) => updateForm('aiProvider', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder='Provider' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='openai'>OpenAI</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className='space-y-2'>
                    <Label htmlFor='ai-model'>Model</Label>
                    <Input id='ai-model' value={form.aiModel} onChange={(event) => updateForm('aiModel', event.target.value)} />
                  </div>
                  <div className='space-y-2'>
                    <Label htmlFor='ai-voice'>Voice</Label>
                    <Input id='ai-voice' value={form.aiVoice} onChange={(event) => updateForm('aiVoice', event.target.value)} />
                  </div>
                </div>

                <Button type='button' onClick={handleGenerateAudio} disabled={generateAudioLoading}>
                  {generateAudioLoading ? 'Generating MP3...' : 'Generate Prompt Audio'}
                </Button>

                {form.generatedAudioUrl ? (
                  <div className='space-y-2 rounded-lg border bg-muted/20 p-3'>
                    <p className='text-xs font-medium text-muted-foreground'>Generated audio URL</p>
                    <p className='break-all text-sm'>{form.generatedAudioUrl}</p>
                    <audio controls src={form.generatedAudioUrl} className='w-full' />
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className='border-border/70 shadow-sm'>
              <CardHeader>
                <CardTitle>Keywords and Highlights</CardTitle>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='space-y-2'>
                  <Label>Keywords</Label>
                  <div className='flex flex-col gap-2 sm:flex-row'>
                    <Input
                      value={keywordInput}
                      onChange={(event) => setKeywordInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          addKeyword();
                        }
                      }}
                      placeholder='Type keyword and press Enter'
                    />
                    <Button type='button' variant='outline' onClick={addKeyword}>Add</Button>
                  </div>

                  {form.keywords.length ? (
                    <div className='mt-2 flex flex-wrap gap-2'>
                      {form.keywords.map((keyword, index) => (
                        <Badge key={`kw-${index}`} variant='secondary' className='gap-2'>
                          {keyword}
                          <button type='button' className='text-xs' onClick={() => removeKeyword(index)}>x</button>
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='sample-highlights'>Sample Highlights</Label>
                  <Textarea
                    id='sample-highlights'
                    value={form.sample_highlights}
                    onChange={(event) => updateForm('sample_highlights', event.target.value)}
                    rows={6}
                    placeholder='Provide key ideas for expected response...'
                  />
                </div>
              </CardContent>
            </Card>
          </div>

        </div>
      </div>
    </div>
  );
}
