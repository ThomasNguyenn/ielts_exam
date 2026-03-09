import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { GripVertical, MoreVertical, X } from 'lucide-react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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

function testToForm(test) {
  if (!test) {
    return {
      _id: '',
      title: '',
      category: '',
      type: 'reading',
      duration: 60,
      full_audio: '',
      is_active: true,
      is_real_test: false,
      reading_passages: [],
      listening_sections: [],
      writing_tasks: [],
      createdAt: null,
    };
  }

  const toId = (value) => (typeof value === 'object' && value?._id ? value._id : value);

  return {
    _id: test._id || '',
    title: test.title || '',
    category: test.category || '',
    type: test.type || 'reading',
    duration: Number(test.duration || (test.type === 'listening' ? 35 : test.type === 'writing' ? 60 : 60)),
    full_audio: test.full_audio || '',
    is_active: test.is_active ?? true,
    is_real_test: test.is_real_test ?? false,
    reading_passages: (test.reading_passages || []).map(toId),
    listening_sections: (test.listening_sections || []).map(toId),
    writing_tasks: (test.writing_tasks || []).map(toId),
    createdAt: test.created_at || test.createdAt || null,
  };
}

function SortableLinkedItem({ item, index, onRemove, accentClass }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-3 rounded-lg border p-3 ${accentClass}`}
    >
      <button type='button' {...attributes} {...listeners} className='cursor-grab text-muted-foreground' title='Drag to reorder'>
        <GripVertical className='h-4 w-4' />
      </button>
      <span className='w-7 text-center text-sm font-semibold'>{index + 1}</span>
      <div className='min-w-0 flex-1'>
        <p className='truncate text-sm font-medium'>{item.title}</p>
        <p className='truncate text-xs text-muted-foreground'>{item.id}</p>
      </div>
      <Button type='button' size='sm' variant='ghost' onClick={() => onRemove(item.id)}>Remove</Button>
    </div>
  );
}

export default function AddTest({ editIdOverride = null, embedded = false, onSaved = null, onCancel = null }) {
  const { id: routeEditId } = useParams();
  const normalizedRouteEditId = routeEditId === 'new' ? null : routeEditId;
  const editId = editIdOverride ?? normalizedRouteEditId;
  const navigate = useNavigate();
  const { showNotification } = useNotification();

  const [form, setForm] = useState(testToForm(null));
  const [passages, setPassages] = useState([]);
  const [sections, setSections] = useState([]);
  const [writings, setWritings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isMetadataOpen, setIsMetadataOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [passagesRes, sectionsRes, writingsRes, maybeTestRes] = await Promise.all([
          api.getPassages({ summary: 1 }),
          api.getSections({ summary: 1 }),
          api.getWritings({ summary: 1 }),
          editId ? api.getTestById(editId) : Promise.resolve(null),
        ]);

        setPassages(passagesRes.data || []);
        setSections(sectionsRes.data || []);
        setWritings(writingsRes.data || []);

        if (editId && maybeTestRes?.data) {
          setForm(testToForm(maybeTestRes.data));
        } else {
          setForm({
            ...testToForm(null),
            _id: `test-${Date.now()}`,
          });
        }
      } catch (loadErr) {
        setLoadError(loadErr.message);
        showNotification(`Error loading test editor: ${loadErr.message}`, 'error');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [editId, showNotification]);

  const updateForm = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const getMaxItems = () => {
    if (form.type === 'reading') return 3;
    if (form.type === 'listening') return 4;
    return 2;
  };

  const getCurrentItems = () => {
    if (form.type === 'reading') return passages;
    if (form.type === 'listening') return sections;
    return writings;
  };

  const getCurrentLinkedIds = () => {
    if (form.type === 'reading') return form.reading_passages;
    if (form.type === 'listening') return form.listening_sections;
    return form.writing_tasks;
  };

  const setCurrentLinkedIds = (ids) => {
    if (form.type === 'reading') updateForm('reading_passages', ids);
    else if (form.type === 'listening') updateForm('listening_sections', ids);
    else updateForm('writing_tasks', ids);
  };

  const linkedItems = useMemo(() => {
    const ids = getCurrentLinkedIds();
    const items = getCurrentItems();
    return ids.map((id) => items.find((item) => item._id === id)).filter(Boolean);
  }, [form.reading_passages, form.listening_sections, form.writing_tasks, form.type, passages, sections, writings]);

  const filteredSearchItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const linkedSet = new Set(getCurrentLinkedIds());
    const base = getCurrentItems().filter((item) => !linkedSet.has(item._id));

    if (!q) return base;
    return base.filter((item) => String(item.title || '').toLowerCase().includes(q) || String(item._id || '').toLowerCase().includes(q));
  }, [searchQuery, form.type, passages, sections, writings, form.reading_passages, form.listening_sections, form.writing_tasks]);

  const hasValidationError = linkedItems.length === 0 || linkedItems.length > getMaxItems();
  const accentClass = form.type === 'reading'
    ? 'border-indigo-200 bg-indigo-50/40'
    : form.type === 'listening'
      ? 'border-sky-200 bg-sky-50/40'
      : 'border-emerald-200 bg-emerald-50/40';

  const handleAddLinkedItem = (id) => {
    const ids = getCurrentLinkedIds();
    if (ids.includes(id)) return;
    if (ids.length >= getMaxItems()) return;
    setCurrentLinkedIds([...ids, id]);
    setSearchQuery('');
    setShowSearchResults(false);
  };

  const handleRemoveLinkedItem = (id) => {
    setCurrentLinkedIds(getCurrentLinkedIds().filter((itemId) => itemId !== id));
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!active || !over || active.id === over.id) return;

    const ids = getCurrentLinkedIds();
    const oldIndex = ids.indexOf(active.id);
    const newIndex = ids.indexOf(over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = [...ids];
    const [moved] = next.splice(oldIndex, 1);
    next.splice(newIndex, 0, moved);
    setCurrentLinkedIds(next);
  };

  const saveTest = async ({ asDraft = false } = {}) => {
    setError(null);

    if (!form._id.trim() || !form.title.trim() || !form.category.trim()) {
      showNotification('ID, title, and category are required.', 'error');
      return;
    }

    if (hasValidationError) {
      showNotification('Please add valid linked items before saving.', 'error');
      return;
    }

    setSubmitLoading(true);
    try {
      const payload = {
        _id: form._id.trim(),
        title: form.title.trim(),
        category: form.category.trim(),
        type: form.type,
        duration: Number(form.duration) || 60,
        full_audio: form.type === 'listening' ? (form.full_audio?.trim() || null) : null,
        is_active: asDraft ? false : form.is_active,
        is_real_test: form.is_real_test,
        reading_passages: form.type === 'reading' ? form.reading_passages : [],
        listening_sections: form.type === 'listening' ? form.listening_sections : [],
        writing_tasks: form.type === 'writing' ? form.writing_tasks : [],
      };

      let savedTestId = editId || payload._id;
      const actionLabel = asDraft ? 'draft saved' : (editId ? 'updated' : 'created');

      if (editId) {
        const updateRes = await api.updateTest(editId, payload);
        savedTestId = updateRes?.data?._id || savedTestId;
      } else {
        const createRes = await api.createTest(payload);
        savedTestId = createRes?.data?._id || savedTestId;
        if (!editIdOverride) {
          navigate(`/admin/manage/tests/${savedTestId}`);
        }
      }

      let renumberError = null;
      const shouldRenumberQuestions = form.type === 'reading' || form.type === 'listening';

      if (shouldRenumberQuestions && savedTestId) {
        try {
          await api.renumberTestQuestions(savedTestId);
        } catch (renumberErr) {
          renumberError = renumberErr;
        }
      }

      if (renumberError) {
        showNotification(`Test ${actionLabel}, but question auto-order failed: ${renumberError.message}`, 'warning');
      } else if (shouldRenumberQuestions) {
        showNotification(`Test ${actionLabel}. Question numbers were auto-reordered.`, 'success');
      } else {
        showNotification(`Test ${actionLabel}.`, 'success');
      }

      if (asDraft) {
        updateForm('is_active', false);
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
    await saveTest({ asDraft: false });
  };

  const handleSaveDraft = async () => {
    await saveTest({ asDraft: true });
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

  const metadataDate = form.createdAt
    ? new Date(form.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

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
                  else navigate('/admin/manage/tests');
                }}
              >
                <X className='h-4 w-4' />
              </Button>
              <div className='space-y-1'>
                <CardTitle className='text-2xl tracking-tight'>{editId ? 'Edit Full Test' : 'Create Full Test'}</CardTitle>
                <CardDescription>Compose a full test by linking passages, sections, or writing tasks.</CardDescription>
              </div>
            </div>

            <div className='flex flex-wrap items-center gap-3'>
              <div className='flex items-center gap-2 rounded-md border px-3 py-2'>
                <Switch checked={form.is_active} onCheckedChange={(checked) => updateForm('is_active', checked)} />
                <span className='text-sm'>{form.is_active ? 'Active' : 'Inactive'}</span>
              </div>
              <Button type='button' variant='outline' onClick={handleSaveDraft}>Save Draft</Button>
              <Button type='button' variant='outline' size='icon' onClick={() => setIsMetadataOpen(true)} aria-label='Open metadata'>
                <MoreVertical className='h-4 w-4' />
              </Button>
              <Button type='button' onClick={handleSubmit} disabled={submitLoading}>
                {submitLoading ? 'Saving...' : 'Save Test'}
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
                <Badge variant={form.is_active ? 'default' : 'secondary'}>{form.is_active ? 'Active' : 'Inactive'}</Badge>
              </div>
              <div className='flex items-center justify-between text-sm'>
                <span className='text-muted-foreground'>Linked Items</span>
                <Badge variant='outline'>{linkedItems.length} / {getMaxItems()}</Badge>
              </div>
              <div className='flex items-center justify-between text-sm'>
                <span className='text-muted-foreground'>Type</span>
                <span className='capitalize'>{form.type}</span>
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
                  <Label htmlFor='test-id'>Test ID</Label>
                  <Input
                    id='test-id'
                    value={form._id}
                    onChange={(event) => updateForm('_id', event.target.value)}
                    readOnly={Boolean(editId)}
                    placeholder='e.g., TEST_FULL_001'
                  />
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='test-title'>Title</Label>
                  <Input
                    id='test-title'
                    value={form.title}
                    onChange={(event) => updateForm('title', event.target.value)}
                    placeholder='e.g., Full Practice Test #12'
                  />
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='test-category'>Category</Label>
                  <Input
                    id='test-category'
                    value={form.category}
                    onChange={(event) => updateForm('category', event.target.value)}
                    placeholder='e.g., Cambridge 18'
                  />
                </div>

                <div className='grid gap-4 md:grid-cols-2'>
                  <div className='space-y-2'>
                    <Label>Test Type</Label>
                    <Select
                      value={form.type}
                      onValueChange={(nextType) => {
                        updateForm('type', nextType);
                        updateForm('duration', nextType === 'listening' ? 35 : nextType === 'writing' ? 60 : 60);
                        setSearchQuery('');
                        setShowSearchResults(false);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder='Type' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='reading'>Reading Test</SelectItem>
                        <SelectItem value='listening'>Listening Test</SelectItem>
                        <SelectItem value='writing'>Writing Test</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className='space-y-2'>
                    <Label htmlFor='duration'>Duration (minutes)</Label>
                    <Input id='duration' type='number' value={form.duration} onChange={(event) => updateForm('duration', event.target.value)} />
                  </div>
                </div>

                {form.type === 'listening' ? (
                  <div className='space-y-2'>
                    <Label htmlFor='full-audio'>Full Audio URL (Optional)</Label>
                    <Input
                      id='full-audio'
                      value={form.full_audio}
                      onChange={(event) => updateForm('full_audio', event.target.value)}
                      placeholder='https://example.com/full-listening.mp3'
                    />
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className='border-border/70 shadow-sm'>
              <CardHeader>
                <CardTitle>Linked Content</CardTitle>
                <CardDescription>Search and add content, then reorder with drag and drop.</CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                {hasValidationError ? (
                  <div className='rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive'>
                    {linkedItems.length === 0
                      ? 'Add at least one linked item to build this test.'
                      : `Too many linked items (${linkedItems.length}/${getMaxItems()}).`}
                  </div>
                ) : null}

                <div className='relative space-y-2'>
                  <Label htmlFor='linked-search'>Search and Add</Label>
                  <Input
                    id='linked-search'
                    value={searchQuery}
                    onChange={(event) => {
                      setSearchQuery(event.target.value);
                      setShowSearchResults(event.target.value.trim().length > 0);
                    }}
                    onFocus={() => setShowSearchResults(searchQuery.trim().length > 0)}
                    placeholder={`Search ${form.type} items...`}
                    disabled={linkedItems.length >= getMaxItems()}
                  />

                  {showSearchResults ? (
                    <div className='absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border bg-background shadow-lg'>
                      <div className='max-h-64 overflow-y-auto'>
                        {!filteredSearchItems.length ? (
                          <div className='px-3 py-2 text-sm text-muted-foreground'>No available items found.</div>
                        ) : (
                          filteredSearchItems.map((item) => (
                            <button
                              key={item._id}
                              type='button'
                              className='w-full border-b px-3 py-2 text-left hover:bg-muted/50'
                              onClick={() => handleAddLinkedItem(item._id)}
                            >
                              <p className='text-sm font-medium'>{item.title || item._id}</p>
                              <p className='text-xs text-muted-foreground'>{item._id}</p>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>

                {!linkedItems.length ? (
                  <div className='rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground'>No linked items yet.</div>
                ) : (
                  <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={linkedItems.map((item) => item._id)} strategy={verticalListSortingStrategy}>
                      <div className='space-y-2'>
                        {linkedItems.map((item, index) => (
                          <SortableLinkedItem
                            key={item._id}
                            item={{ id: item._id, title: item.title || item._id }}
                            index={index}
                            accentClass={accentClass}
                            onRemove={handleRemoveLinkedItem}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
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
                  <Label htmlFor='real-ielts-test'>Real IELTS Test</Label>
                  <Switch id='real-ielts-test' checked={form.is_real_test} onCheckedChange={(checked) => updateForm('is_real_test', checked)} />
                </div>
                <div className='flex items-center justify-between'>
                  <Label htmlFor='visible-to-students'>Visible to Students</Label>
                  <Switch id='visible-to-students' checked={form.is_active} onCheckedChange={(checked) => updateForm('is_active', checked)} />
                </div>
              </CardContent>
            </Card>

            <Card className='border-border/70 bg-gradient-to-br from-indigo-50 to-white shadow-sm'>
              <CardHeader>
                <CardTitle className='text-base'>Validation</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className='list-disc space-y-2 pl-5 text-sm text-muted-foreground'>
                  <li>{linkedItems.length > 0 ? 'Done' : 'Pending'}: at least 1 linked item.</li>
                  <li>{linkedItems.length <= getMaxItems() ? 'Done' : 'Pending'}: max {getMaxItems()} items for {form.type}.</li>
                  <li>Drag to reorder linked items.</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
