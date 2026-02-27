import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Filter, Pencil, Trash2 } from 'lucide-react';
import { api } from '@/shared/api/client';
import { useNotification } from '@/shared/context/NotificationContext';
import ConfirmationModal from '@/shared/components/ConfirmationModal';
import { useNavigate, useParams } from 'react-router-dom';
import AddSection from './AddSection';
import './Manage.css';

const ITEMS_PER_PAGE = 6;

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

const countQuestions = (section) =>
  (section?.question_groups || []).reduce((sum, group) => sum + (group?.questions?.length || 0), 0);
const getSortTimestamp = (item) => new Date(item?.updatedAt || item?.updated_at || item?.createdAt || item?.created_at || 0).getTime();

export default function ManageSectionsSinglePage() {
  const { id: routeEditId } = useParams();
  const isCreateRoute = routeEditId === 'new';
  const navigate = useNavigate();
  const { showNotification } = useNotification();

  const [sections, setSections] = useState([]);
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

  const loadSections = async () => {
    setLoading(true);
    try {
      const res = await api.getSections();
      setSections(res.data || []);
    } catch (err) {
      showNotification(err.message || 'Failed to load sections', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSections();
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

  const filteredSections = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const matched = !query
      ? sections
      : sections.filter((item) =>
      String(item.title || '').toLowerCase().includes(query) ||
      String(item._id || '').toLowerCase().includes(query)
    );
    return [...matched].sort((a, b) => getSortTimestamp(b) - getSortTimestamp(a));
  }, [sections, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredSections.length / ITEMS_PER_PAGE));
  const paginatedSections = filteredSections.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleDelete = (id) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Section',
      message: 'Delete this section? This cannot be undone.',
      isDanger: true,
      onConfirm: async () => {
        try {
          await api.deleteSection(id);
          showNotification('Section deleted.', 'success');
          await loadSections();
        } catch (err) {
          showNotification(err.message || 'Failed to delete section', 'error');
        }
      },
    });
  };

  const openCreateTab = () => {
    setEditingId(null);
    setActiveTab('editor');
    navigate('/manage/sections/new');
  };

  const openEditTab = (id) => {
    setEditingId(id);
    setActiveTab('editor');
    navigate(`/manage/sections/${id}`);
  };

  const handleSaved = async () => {
    await loadSections();
    setActiveTab('list');
    setEditingId(null);
    setCurrentPage(1);
    navigate('/manage/sections');
  };

  const listStart = filteredSections.length ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0;
  const listEnd = Math.min(currentPage * ITEMS_PER_PAGE, filteredSections.length);

  return (
    <div className="manage-main-content">
      {activeTab === 'list' && (
        <div className="manage-main-tabs">
          <button
            type="button"
            className={`manage-tab-btn ${activeTab === 'list' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('list');
              setEditingId(null);
              navigate('/manage/sections');
            }}
          >
            Manage Listening
          </button>
          <button
            type="button"
            className={`manage-tab-btn ${activeTab === 'editor' ? 'active' : ''}`}
            onClick={() => {
              if (editingId) {
                setActiveTab('editor');
                navigate(`/manage/sections/${editingId}`);
                return;
              }
              openCreateTab();
            }}
          >
            {editingId ? 'Edit Section' : 'Add Section'}
          </button>
        </div>
      )}

      {activeTab === 'list' ? (
        <>
          <div className="manage-main-topbar">
            <div>
              <h1 className="manage-main-title">Manage Listening Sections</h1>
              <p className="manage-main-subtitle">{filteredSections.length} items total</p>
            </div>

            <div className="manage-main-controls">
              <div className="manage-main-search">
                <Search className="manage-main-search-icon" />
                <input
                  type="text"
                  placeholder="Search sections..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>

              <button type="button" className="manage-main-filter-btn">
                <Filter size={16} />
                Filter
              </button>

              <button type="button" className="manage-main-add-btn" onClick={openCreateTab}>
                <Plus size={16} />
                Add New
              </button>
            </div>
          </div>

          <div className="manage-main-table-card">
            <table className="manage-main-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Skill</th>
                  <th>Difficulty</th>
                  <th>Questions</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {!loading && paginatedSections.length === 0 && (
                  <tr>
                    <td colSpan={7} className="manage-main-empty">No sections found.</td>
                  </tr>
                )}

                {paginatedSections.map((row) => (
                  <tr key={row._id}>
                    <td className="manage-cell-title">{row.title || row._id}</td>
                    <td><span className="manage-pill skill-listening">Listening</span></td>
                    <td>{row.difficulty || 'Medium'}</td>
                    <td>{countQuestions(row)}</td>
                    <td><span className={`manage-pill ${row.is_active === false ? 'status-archived' : 'status-published'}`}>{row.is_active === false ? 'Archived' : 'Published'}</span></td>
                    <td>{formatDate(row.updatedAt || row.updated_at || row.createdAt || row.created_at)}</td>
                    <td>
                      <div className="manage-row-actions">
                        <button type="button" className="icon-btn" onClick={() => openEditTab(row._id)} title="Edit">
                          <Pencil size={15} />
                        </button>
                        <button type="button" className="icon-btn danger" onClick={() => handleDelete(row._id)} title="Delete">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="manage-main-pagination">
              <span>
                Showing {listStart}-{listEnd} of {filteredSections.length}
              </span>

              <div className="manage-main-pagination-buttons">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </button>
                <span>{currentPage}/{totalPages}</span>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <AddSection
          editIdOverride={editingId}
          embedded
          hideExistingList
          onSaved={handleSaved}
          onCancel={() => {
            setActiveTab('list');
            setEditingId(null);
            navigate('/manage/sections');
          }}
        />
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
