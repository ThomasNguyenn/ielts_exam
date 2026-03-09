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
const AddEditPassage = lazy(() => import('../components/AddEditPassage'));

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

const countQuestions = (passage) =>
  Number.isFinite(Number(passage?.question_count))
    ? Number(passage.question_count)
    : (passage?.question_groups || []).reduce((sum, group) => sum + (group?.questions?.length || 0), 0);
const getSortTimestamp = (item) => new Date(item?.updatedAt || item?.updated_at || item?.createdAt || item?.created_at || 0).getTime();

export default function ManagePassagesSinglePage() {
  const { id: routeEditId } = useParams();
  const isCreateRoute = routeEditId === 'new';
  const navigate = useNavigate();
  const { showNotification } = useNotification();

  const [passages, setPassages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState(routeEditId ? 'editor' : 'list');
  const [editingId, setEditingId] = useState(isCreateRoute ? null : (routeEditId || null));
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
    isDanger: false,
  });

  const loadPassages = async () => {
    setLoading(true);
    try {
      const res = await api.getPassages({ summary: 1 });
      setPassages(res.data || []);
    } catch (err) {
      showNotification(err.message || 'Failed to load passages', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPassages();
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

  const filteredPassages = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const matched = !query
      ? passages
      : passages.filter((item) =>
        String(item.title || '').toLowerCase().includes(query) ||
        String(item._id || '').toLowerCase().includes(query)
      );
    return [...matched].sort((a, b) => getSortTimestamp(b) - getSortTimestamp(a));
  }, [passages, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredPassages.length / ITEMS_PER_PAGE));
  const paginatedPassages = filteredPassages.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleDelete = (id) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Passage',
      message: 'Delete this passage? This cannot be undone.',
      isDanger: true,
      onConfirm: async () => {
        try {
          await api.deletePassage(id);
          showNotification('Passage deleted.', 'success');
          await loadPassages();
        } catch (err) {
          showNotification(err.message || 'Failed to delete passage', 'error');
        }
      },
    });
  };

  const openCreateTab = () => {
    setEditingId(null);
    setActiveTab('editor');
    navigate('/admin/manage/passages/new');
  };

  const openEditTab = (id) => {
    setEditingId(id);
    setActiveTab('editor');
    navigate(`/admin/manage/passages/${id}`);
  };

  const handleSaved = async () => {
    await loadPassages();
    setActiveTab('list');
    setEditingId(null);
    setCurrentPage(1);
    navigate('/admin/manage/passages');
  };

  const listStart = filteredPassages.length ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0;
  const listEnd = Math.min(currentPage * ITEMS_PER_PAGE, filteredPassages.length);

  return (
    <div className='space-y-4'>
      {activeTab === 'list' ? (
        <>
          <div className='flex flex-wrap items-center gap-2'>
            <Button type='button' variant='default' onClick={() => { setActiveTab('list'); setEditingId(null); navigate('/admin/manage/passages'); }}>
              Manage Passages
            </Button>
            <Button
              type='button'
              variant='outline'
              onClick={() => {
                if (editingId) {
                  setActiveTab('editor');
                  navigate(`/admin/manage/passages/${editingId}`);
                  return;
                }
                openCreateTab();
              }}
            >
              {editingId ? 'Edit Passage' : 'Add Passage'}
            </Button>
          </div>

          <Card className='border-border/70 shadow-sm'>
            <CardHeader className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
              <div>
                <CardTitle>Manage Passages</CardTitle>
                <CardDescription>{filteredPassages.length} items total</CardDescription>
              </div>
              <div className='flex w-full flex-col gap-2 sm:w-auto sm:flex-row'>
                <div className='relative min-w-[240px]'>
                  <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                  <Input
                    type='text'
                    className='pl-9'
                    placeholder='Search passages...'
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
                    <TableHead>Questions</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!loading && paginatedPassages.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className='text-center text-muted-foreground'>No passages found.</TableCell>
                    </TableRow>
                  ) : null}

                  {paginatedPassages.map((row) => (
                    <TableRow key={row._id}>
                      <TableCell className='font-medium'>{row.title || row._id}</TableCell>
                      <TableCell><Badge variant='secondary'>Reading</Badge></TableCell>
                      <TableCell>{countQuestions(row)}</TableCell>
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
                <span className='text-muted-foreground'>Showing {listStart}-{listEnd} of {filteredPassages.length}</span>
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
          <AddEditPassage
            editIdOverride={editingId}
            embedded
            hideExistingList
            onSaved={handleSaved}
            onCancel={() => {
              setActiveTab('list');
              setEditingId(null);
              navigate('/admin/manage/passages');
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
