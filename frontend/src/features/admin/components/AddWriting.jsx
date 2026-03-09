import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MoreVertical, X } from 'lucide-react';
import { api } from '@/shared/api/client';
import { useNotification } from '@/shared/context/NotificationContext';
import { getWritingTaskTypeOptions } from '@/shared/constants/writingTaskTypes';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

function writingToForm(writing) {
  if (!writing) {
    return {
      _id: '',
      title: '',
      type: 'academic',
      task_type: 'task1',
      writing_task_type: '',
      prompt: '',
      image_url: '',
      word_limit: 150,
      essay_word_limit: 250,
      time_limit: 20,
      sample_answer: '',
      band_score: '7.0',
      isActive: true,
      is_real_test: false,
      isSinglePart: false,
      createdAt: null,
    };
  }

  return {
    _id: writing._id || '',
    title: writing.title || '',
    type: writing.type || 'academic',
    task_type: writing.task_type || 'task1',
    writing_task_type: writing.writing_task_type || '',
    prompt: writing.prompt || '',
    image_url: writing.image_url || '',
    word_limit: writing.word_limit ?? 150,
    essay_word_limit: writing.essay_word_limit ?? 250,
    time_limit: writing.time_limit ?? 20,
    sample_answer: writing.sample_answer || '',
    band_score: String(writing.band_score ?? '7.0'),
    isActive: writing.is_active ?? true,
    is_real_test: writing.is_real_test ?? false,
    isSinglePart: writing.isSinglePart ?? false,
    createdAt: writing.created_at || writing.createdAt || null,
  };
}

export default function AddWriting({ editIdOverride = null, embedded = false, onSaved = null, onCancel = null }) {
  const { id: routeEditId } = useParams();
  const normalizedRouteEditId = routeEditId === 'new' ? null : routeEditId;
  const editId = editIdOverride ?? normalizedRouteEditId;
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const showNotificationRef = useRef(showNotification);

  const [form, setForm] = useState(writingToForm(null));
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isMetadataOpen, setIsMetadataOpen] = useState(false);

  const isTask1 = form.task_type === 'task1';

  useEffect(() => {
    showNotificationRef.current = showNotification;
  }, [showNotification]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        if (editId) {
          const response = await api.getWritingById(editId);
          setForm(writingToForm(response.data));
        } else {
          setForm({
            ...writingToForm(null),
            _id: `writing-${Date.now()}`,
          });
        }
      } catch (loadErr) {
        setLoadError(loadErr.message);
        showNotificationRef.current?.(`Error loading writing task: ${loadErr.message}`, 'error');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [editId]);

  const metadataDate = useMemo(() => {
    if (form.createdAt) {
      return new Date(form.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }, [form.createdAt]);

  const updateForm = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const response = await api.uploadImage(formData);
      if (response?.success && response?.data?.url) {
        updateForm('image_url', response.data.url);
        showNotification('Image uploaded successfully.', 'success');
      }
    } catch (uploadErr) {
      showNotification(uploadErr.message || 'Image upload failed', 'error');
    } finally {
      setUploadLoading(false);
      event.target.value = '';
    }
  };

  const saveWriting = async ({ asDraft = false } = {}) => {
    setError(null);

    if (!form._id.trim() || !form.title.trim() || !form.prompt.trim()) {
      showNotification('ID, title, and prompt are required.', 'error');
      return;
    }

    setSubmitLoading(true);
    try {
      const payload = {
        _id: form._id.trim(),
        title: form.title.trim(),
        type: form.type,
        task_type: form.task_type,
        writing_task_type: form.writing_task_type?.trim() || null,
        prompt: form.prompt.trim(),
        image_url: form.image_url?.trim() || '',
        word_limit: Number(form.word_limit) || 150,
        essay_word_limit: Number(form.essay_word_limit) || 250,
        time_limit: Number(form.time_limit) || (form.task_type === 'task1' ? 20 : 40),
        sample_answer: form.sample_answer?.trim() || '',
        band_score: Number(form.band_score) || undefined,
        is_active: asDraft ? false : form.isActive,
        is_real_test: form.is_real_test,
        isSinglePart: Boolean(form.isSinglePart),
      };

      if (editId) {
        await api.updateWriting(editId, payload);
        showNotification(asDraft ? 'Draft saved.' : 'Writing task updated.', 'success');
      } else {
        await api.createWriting(payload);
        showNotification(asDraft ? 'Draft saved.' : 'Writing task created.', 'success');
        if (!editIdOverride) {
          navigate(`/admin/manage/writings/${form._id}`);
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
    event?.preventDefault?.();
    await saveWriting({ asDraft: false });
  };

  const handleSaveDraft = async () => {
    await saveWriting({ asDraft: true });
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
                  else navigate('/admin/manage/writings');
                }}
              >
                <X className='h-4 w-4' />
              </Button>
              <div className='space-y-1'>
                <CardTitle className='text-2xl tracking-tight'>{editId ? 'Edit Writing Task' : 'Create Writing Task'}</CardTitle>
                <CardDescription>IELTS Writing Task 1 or Task 2 editor.</CardDescription>
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
                {submitLoading ? 'Saving...' : 'Save Task'}
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
                <span className='text-muted-foreground'>Mode</span>
                <span>{form.type === 'academic' ? 'Academic' : 'General'}</span>
              </div>
              <div className='flex items-center justify-between text-sm'>
                <span className='text-muted-foreground'>Task</span>
                <span>{form.task_type === 'task1' ? 'Task 1' : 'Task 2'}</span>
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
          <div className='space-y-6 xl:col-span-8'>
            <Card className='border-border/70 shadow-sm'>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='space-y-2'>
                  <Label htmlFor='writing-id'>Writing Task ID</Label>
                  <Input
                    id='writing-id'
                    value={form._id}
                    onChange={(event) => updateForm('_id', event.target.value)}
                    readOnly={Boolean(editId)}
                    placeholder='e.g., WRITE_AC_T1_001'
                  />
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='writing-title'>Title</Label>
                  <Input
                    id='writing-title'
                    value={form.title}
                    onChange={(event) => updateForm('title', event.target.value)}
                    placeholder='Enter task title'
                  />
                </div>

                <div className='grid gap-4 md:grid-cols-3'>
                  <div className='space-y-2'>
                    <Label>Type</Label>
                    <Select value={form.type} onValueChange={(value) => updateForm('type', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder='Type' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='academic'>Academic</SelectItem>
                        <SelectItem value='general'>General Training</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className='space-y-2'>
                    <Label>Task Type</Label>
                    <Select
                      value={form.task_type}
                      onValueChange={(nextTaskType) => {
                        setForm((prev) => {
                          const options = getWritingTaskTypeOptions(nextTaskType);
                          const currentValid = options.some((option) => option.value === prev.writing_task_type);
                          return {
                            ...prev,
                            task_type: nextTaskType,
                            writing_task_type: currentValid ? prev.writing_task_type : '',
                            word_limit: nextTaskType === 'task1' ? 150 : 250,
                            time_limit: nextTaskType === 'task1' ? 20 : 40,
                          };
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder='Task type' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='task1'>Task 1</SelectItem>
                        <SelectItem value='task2'>Task 2</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className='space-y-2'>
                    <Label>Task Variant</Label>
                    <Select value={form.writing_task_type || '__none__'} onValueChange={(value) => updateForm('writing_task_type', value === '__none__' ? '' : value)}>
                      <SelectTrigger>
                        <SelectValue placeholder='Select variant' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='__none__'>No variant</SelectItem>
                        {getWritingTaskTypeOptions(form.task_type).map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className='border-border/70 shadow-sm'>
              <CardHeader>
                <CardTitle>Task Prompt</CardTitle>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='space-y-2'>
                  <Label htmlFor='writing-prompt'>Prompt Text</Label>
                  <Textarea
                    id='writing-prompt'
                    value={form.prompt}
                    onChange={(event) => updateForm('prompt', event.target.value)}
                    rows={7}
                    placeholder={isTask1
                      ? 'The chart below shows ... Summarise the information by selecting and reporting the main features.'
                      : 'Some people believe that ... To what extent do you agree or disagree?'}
                  />
                </div>

                {isTask1 ? (
                  <div className='space-y-3'>
                    <div className='space-y-2'>
                      <Label htmlFor='writing-image-url'>Visual URL (Task 1)</Label>
                      <Input
                        id='writing-image-url'
                        value={form.image_url}
                        onChange={(event) => updateForm('image_url', event.target.value)}
                        placeholder='https://example.com/chart.png'
                      />
                    </div>
                    <div className='flex flex-wrap items-center gap-3'>
                      <Input type='file' accept='image/*' onChange={handleImageUpload} disabled={uploadLoading} className='max-w-sm' />
                      {uploadLoading ? <span className='text-sm text-muted-foreground'>Uploading...</span> : null}
                    </div>
                    {form.image_url ? (
                      <div className='overflow-hidden rounded-lg border'>
                        <img src={form.image_url} alt='Task visual' className='max-h-[280px] w-full object-contain bg-muted/20' />
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className='grid gap-4 md:grid-cols-3'>
                  <div className='space-y-2'>
                    <Label htmlFor='word-limit'>Word Limit</Label>
                    <Input id='word-limit' type='number' value={form.word_limit} onChange={(event) => updateForm('word_limit', event.target.value)} />
                  </div>
                  <div className='space-y-2'>
                    <Label htmlFor='essay-word-limit'>Essay Word Limit</Label>
                    <Input
                      id='essay-word-limit'
                      type='number'
                      value={form.essay_word_limit}
                      onChange={(event) => updateForm('essay_word_limit', event.target.value)}
                    />
                  </div>
                  <div className='space-y-2'>
                    <Label htmlFor='time-limit'>Time Limit (minutes)</Label>
                    <Input id='time-limit' type='number' value={form.time_limit} onChange={(event) => updateForm('time_limit', event.target.value)} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className='border-border/70 shadow-sm'>
              <CardHeader>
                <CardTitle>Sample Answer</CardTitle>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='space-y-2'>
                  <Label htmlFor='sample-answer'>Sample Response</Label>
                  <Textarea
                    id='sample-answer'
                    value={form.sample_answer}
                    onChange={(event) => updateForm('sample_answer', event.target.value)}
                    rows={10}
                    placeholder='Enter sample answer (optional)...'
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='band-score'>Band Score</Label>
                  <Input
                    id='band-score'
                    type='number'
                    min={0}
                    max={9}
                    step={0.5}
                    value={form.band_score}
                    onChange={(event) => updateForm('band_score', event.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className='space-y-6 xl:col-span-4'>
            <Card className='border-border/70 shadow-sm'>
              <CardHeader>
                <CardTitle>Settings</CardTitle>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='flex items-center justify-between'>
                  <Label htmlFor='standalone'>Standalone Part</Label>
                  <Switch id='standalone' checked={form.isSinglePart} onCheckedChange={(checked) => updateForm('isSinglePart', checked)} />
                </div>
                <div className='flex items-center justify-between'>
                  <Label htmlFor='real-test'>Real IELTS Test</Label>
                  <Switch id='real-test' checked={form.is_real_test} onCheckedChange={(checked) => updateForm('is_real_test', checked)} />
                </div>
                <div className='flex items-center justify-between'>
                  <Label htmlFor='visible-students'>Visible to Students</Label>
                  <Switch id='visible-students' checked={form.isActive} onCheckedChange={(checked) => updateForm('isActive', checked)} />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
