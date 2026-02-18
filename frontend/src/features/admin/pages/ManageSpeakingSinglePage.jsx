import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Filter, Pencil, Trash2 } from 'lucide-react';
import { api } from '@/shared/api/client';
import { useNotification } from '@/shared/context/NotificationContext';
import { useNavigate, useParams } from 'react-router-dom';
import AddSpeaking from './AddSpeaking';
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

export default function ManageSpeakingSinglePage() {
  const { id: routeEditId } = useParams();
  const navigate = useNavigate();
  const { showNotification } = useNotification();

  const [speakings, setSpeakings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState(routeEditId ? 'editor' : 'list');
  const [editingId, setEditingId] = useState(routeEditId || null);

  const loadSpeakings = async () => {
    setLoading(true);
    try {
      const res = await api.getSpeakings();
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
      setEditingId(routeEditId);
      setActiveTab('editor');
    }
  }, [routeEditId]);

  const filteredSpeakings = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return speakings;
    return speakings.filter((item) =>
      String(item.title || '').toLowerCase().includes(query) ||
      String(item._id || '').toLowerCase().includes(query) ||
      String(item.prompt || '').toLowerCase().includes(query)
    );
  }, [speakings, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredSpeakings.length / ITEMS_PER_PAGE));
  const paginatedSpeakings = filteredSpeakings.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this speaking topic? This cannot be undone.')) return;
    try {
      await api.deleteSpeaking(id);
      showNotification('Speaking topic deleted.', 'success');
      await loadSpeakings();
    } catch (err) {
      showNotification(err.message || 'Failed to delete speaking topic', 'error');
    }
  };

  const openCreateTab = () => {
    setEditingId(null);
    setActiveTab('editor');
    navigate('/manage/speaking');
  };

  const openEditTab = (id) => {
    setEditingId(id);
    setActiveTab('editor');
    navigate(`/manage/speaking/${id}`);
  };

  const handleSaved = async () => {
    await loadSpeakings();
    setActiveTab('list');
    setEditingId(null);
    setCurrentPage(1);
    navigate('/manage/speaking');
  };

  const listStart = filteredSpeakings.length ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0;
  const listEnd = Math.min(currentPage * ITEMS_PER_PAGE, filteredSpeakings.length);

  return (
    <div className="manage-main-content">
      <div className="manage-main-tabs">
        <button
          type="button"
          className={`manage-tab-btn ${activeTab === 'list' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('list');
            setEditingId(null);
            navigate('/manage/speaking');
          }}
        >
          Manage Speaking Topics
        </button>
        <button
          type="button"
          className={`manage-tab-btn ${activeTab === 'editor' ? 'active' : ''}`}
          onClick={() => setActiveTab('editor')}
        >
          {editingId ? 'Edit Speaking' : 'Add Speaking'}
        </button>
      </div>

      {activeTab === 'list' ? (
        <>
          <div className="manage-main-topbar">
            <div>
              <h1 className="manage-main-title">Manage Speaking Topics</h1>
              <p className="manage-main-subtitle">{filteredSpeakings.length} items total</p>
            </div>

            <div className="manage-main-controls">
              <div className="manage-main-search">
                <Search className="manage-main-search-icon" />
                <input
                  type="text"
                  placeholder="Search speaking topics..."
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
                  <th>Part</th>
                  <th>Questions</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {!loading && paginatedSpeakings.length === 0 && (
                  <tr>
                    <td colSpan={7} className="manage-main-empty">No speaking topics found.</td>
                  </tr>
                )}

                {paginatedSpeakings.map((row) => (
                  <tr key={row._id}>
                    <td className="manage-cell-title">{row.title || row._id}</td>
                    <td><span className="manage-pill skill-speaking">Speaking</span></td>
                    <td>Part {row.part || 1}</td>
                    <td>{Array.isArray(row.sub_questions) ? row.sub_questions.length : 0}</td>
                    <td><span className={`manage-pill ${row.is_active === false ? 'status-archived' : 'status-published'}`}>{row.is_active === false ? 'Archived' : 'Published'}</span></td>
                    <td>{formatDate(row.updatedAt || row.createdAt)}</td>
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
                Showing {listStart}-{listEnd} of {filteredSpeakings.length}
              </span>

              <div className="manage-main-pagination-buttons">
                <button type="button" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>Prev</button>
                <span>{currentPage}/{totalPages}</span>
                <button type="button" disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>Next</button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <AddSpeaking
          editIdOverride={editingId}
          embedded
          hideExistingList
          onSaved={handleSaved}
          onCancel={() => {
            setActiveTab('list');
            setEditingId(null);
            navigate('/manage/speaking');
          }}
        />
      )}
    </div>
  );
}
