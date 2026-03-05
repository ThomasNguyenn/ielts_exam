import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';
import { api } from '@/shared/api/client';
import { useNotification } from '@/shared/context/NotificationContext';
import ConfirmationModal from '@/shared/components/ConfirmationModal';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const ITEMS_PER_PAGE = 6;
const AddSpeaking = lazy(() => import('./AddSpeaking'));

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};
const getSortTimestamp = (item) => new Date(item?.updatedAt || item?.updated_at || item?.createdAt || item?.created_at || 0).getTime();

export default function ManageSpeakingSinglePage() {
  const { id: routeEditId } = useParams();
  const isCreateRoute = routeEditId === 'new';
  const navigate = useNavigate();
  const { showNotification } = useNotification();

  const [speakings, setSpeakings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState(routeEditId ? 'editor' : 'list');
  const [editingId, setEditingId] = useState(isCreateRoute ? null : (routeEditId || null));
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    isDanger: false,
  });

  const loadSpeakings = async () => {
    setLoading(true);
    try {
      const res = await api.getSpeakings({ summary: 1 });
      setSpeakings(res.data || []);
    } catch (err) {
      showNotification(err.message || 'Failed to load speaking topics', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSpeakings();
  }, []);

  useEffect(() => {
    if (routeEditId) {
      setEditingId(routeEditId === 'new' ? null : routeEditId);
      setActiveTab('editor');
    } else {
      setEditingId(null);
      setActiveTab('list');
    }
  }, [routeEditId]);

  const filteredSpeakings = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const matched = !query
      ? speakings
      : speakings.filter((item) =>
      String(item.title || '').toLowerCase().includes(query) ||
      String(item._id || '').toLowerCase().includes(query) ||
      String(item.prompt || '').toLowerCase().includes(query) ||
      String(item.part2_question_title || '').toLowerCase().includes(query)
    );
    return [...matched].sort((a, b) => getSortTimestamp(b) - getSortTimestamp(a));
  }, [speakings, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredSpeakings.length / ITEMS_PER_PAGE));
  const paginatedSpeakings = filteredSpeakings.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleDelete = (id) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Speaking Topic',
      message: 'Delete this speaking topic? This cannot be undone.',
      isDanger: true,
      onConfirm: async () => {
        try {
          await api.deleteSpeaking(id);
          showNotification('Speaking topic deleted.', 'success');
          await loadSpeakings();
        } catch (err) {
          showNotification(err.message || 'Failed to delete speaking topic', 'error');
        }
      },
    });
  };

  const openCreateTab = () => {
    setEditingId(null);
    setActiveTab('editor');
    navigate('/admin/manage/speaking/new');
  };

  const openEditTab = (id) => {
    setEditingId(id);
    setActiveTab('editor');
    navigate(`/admin/manage/speaking/${id}`);
  };

  const handleSaved = async () => {
    await loadSpeakings();
    setActiveTab('list');
    setEditingId(null);
    setCurrentPage(1);
    navigate('/admin/manage/speaking');
  };

  const listStart = filteredSpeakings.length ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0;
  const listEnd = Math.min(currentPage * ITEMS_PER_PAGE, filteredSpeakings.length);

  return (
    <div className='space-y-4'>
      {activeTab === 'list' ? (
        <>
          <div className='flex flex-wrap items-center gap-2'>
            <Button type='button' variant='default' onClick={() => { setActiveTab('list'); setEditingId(null); navigate('/admin/manage/speaking'); }}>
              Manage Speaking Topics
            </Button>
            <Button
              type='button'
              variant='outline'
              onClick={() => {
                if (editingId) {
                  setActiveTab('editor');
                  navigate(`/admin/manage/speaking/${editingId}`);
                  return;
                }
                openCreateTab();
              }}
            >
              {editingId ? 'Edit Speaking' : 'Add Speaking'}
            </Button>
          </div>

          <Card className='border-border/70 shadow-sm'>
            <CardHeader className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
              <div>
                <CardTitle>Manage Speaking Topics</CardTitle>
                <CardDescription>{filteredSpeakings.length} items total</CardDescription>
              </div>
              <div className='flex w-full flex-col gap-2 sm:w-auto sm:flex-row'>
                <div className='relative min-w-[240px]'>
                  <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                  <Input
                    type='text'
                    className='pl-9'
                    placeholder='Search speaking topics...'
                    value={searchQuery}
                    onChange={(event) => {
                      setSearchQuery(event.target.value);
                      setCurrentPage(1);
                    }}
                  />
                </div>
                <Button type='button' onClick={openCreateTab}>
                  <Plus className='h-4 w-4' />
                  Add New
                </Button>
              </div>
            </CardHeader>
            <CardContent className='space-y-4'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Skill</TableHead>
                    <TableHead>Part</TableHead>
                    <TableHead>Questions</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!loading && paginatedSpeakings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className='text-center text-muted-foreground'>No speaking topics found.</TableCell>
                    </TableRow>
                  ) : null}

                  {paginatedSpeakings.map((row) => (
                    <TableRow key={row._id}>
                      <TableCell className='font-medium'>{row.title || row._id}</TableCell>
                      <TableCell><Badge variant='secondary'>Speaking</Badge></TableCell>
                      <TableCell>Part {row.part || 1}</TableCell>
                      <TableCell>{Number.isFinite(Number(row?.question_count)) ? Number(row.question_count) : (Array.isArray(row.sub_questions) ? row.sub_questions.length : 0)}</TableCell>
                      <TableCell>
                        <Badge variant={row.is_active === false ? 'outline' : 'default'}>
                          {row.is_active === false ? 'Archived' : 'Published'}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(row.updatedAt || row.updated_at || row.createdAt || row.created_at)}</TableCell>
                      <TableCell>
                        <div className='flex items-center gap-1'>
                          <Button type='button' size='icon' variant='ghost' onClick={() => openEditTab(row._id)} title='Edit'>
                            <Pencil className='h-4 w-4' />
                          </Button>
                          <Button type='button' size='icon' variant='ghost' className='text-destructive' onClick={() => handleDelete(row._id)} title='Delete'>
                            <Trash2 className='h-4 w-4' />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className='flex flex-col gap-2 border-t pt-3 text-sm sm:flex-row sm:items-center sm:justify-between'>
                <span className='text-muted-foreground'>Showing {listStart}-{listEnd} of {filteredSpeakings.length}</span>
                <div className='flex items-center gap-2'>
                  <Button type='button' size='sm' variant='outline' disabled={currentPage === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>Prev</Button>
                  <span>{currentPage}/{totalPages}</span>
                  <Button type='button' size='sm' variant='outline' disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>Next</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Suspense fallback={<Card className='border-border/70 shadow-sm'><CardContent className='p-6 text-sm text-muted-foreground'>Loading editor...</CardContent></Card>}>
          <AddSpeaking
            editIdOverride={editingId}
            embedded
            hideExistingList
            onSaved={handleSaved}
            onCancel={() => {
              setActiveTab('list');
              setEditingId(null);
              navigate('/admin/manage/speaking');
            }}
          />
        </Suspense>
      )}

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        isDanger={confirmModal.isDanger}
      />
    </div>
  );
}

