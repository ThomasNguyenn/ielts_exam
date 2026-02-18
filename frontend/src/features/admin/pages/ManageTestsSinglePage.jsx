import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Filter, Pencil, Trash2 } from 'lucide-react';
import { api } from '@/shared/api/client';
import { useNotification } from '@/shared/context/NotificationContext';
import { useNavigate, useParams } from 'react-router-dom';
import AddTest from './AddTest';
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

const getSkillType = (test) => String(test?.type || 'reading').toLowerCase();

const countItems = (test) => {
  const type = getSkillType(test);
  if (type === 'listening') return (test?.listening_sections || []).length;
  if (type === 'writing') return (test?.writing_tasks || []).length;
  return (test?.reading_passages || []).length;
};

export default function ManageTestsSinglePage() {
  const { id: routeEditId } = useParams();
  const isCreateRoute = routeEditId === 'new';
  const navigate = useNavigate();
  const { showNotification } = useNotification();

  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState(routeEditId ? 'editor' : 'list');
  const [editingId, setEditingId] = useState(isCreateRoute ? null : (routeEditId || null));

  const loadTests = async () => {
    setLoading(true);
    try {
      const res = await api.getTests();
      setTests(res.data || []);
    } catch (err) {
      showNotification(err.message || 'Failed to load tests', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTests();
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

  const filteredTests = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return tests;
    return tests.filter((item) =>
      String(item.title || '').toLowerCase().includes(query) ||
      String(item._id || '').toLowerCase().includes(query) ||
      String(item.category || '').toLowerCase().includes(query)
    );
  }, [tests, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredTests.length / ITEMS_PER_PAGE));
  const paginatedTests = filteredTests.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this test? This cannot be undone.')) return;
    try {
      await api.deleteTest(id);
      showNotification('Test deleted.', 'success');
      await loadTests();
    } catch (err) {
      showNotification(err.message || 'Failed to delete test', 'error');
    }
  };

  const openCreateTab = () => {
    setEditingId(null);
    setActiveTab('editor');
    navigate('/manage/tests/new');
  };

  const openEditTab = (id) => {
    setEditingId(id);
    setActiveTab('editor');
    navigate(`/manage/tests/${id}`);
  };

  const handleSaved = async () => {
    await loadTests();
    setActiveTab('list');
    setEditingId(null);
    setCurrentPage(1);
    navigate('/manage/tests');
  };

  const listStart = filteredTests.length ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0;
  const listEnd = Math.min(currentPage * ITEMS_PER_PAGE, filteredTests.length);

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
              navigate('/manage/tests');
            }}
          >
            Manage Full Tests
          </button>
          <button
            type="button"
            className={`manage-tab-btn ${activeTab === 'editor' ? 'active' : ''}`}
            onClick={() => {
              if (editingId) {
                setActiveTab('editor');
                navigate(`/manage/tests/${editingId}`);
                return;
              }
              openCreateTab();
            }}
          >
            {editingId ? 'Edit Test' : 'Add Test'}
          </button>
        </div>
      )}

      {activeTab === 'list' ? (
        <>
          <div className="manage-main-topbar">
            <div>
              <h1 className="manage-main-title">Manage Full Tests</h1>
              <p className="manage-main-subtitle">{filteredTests.length} items total</p>
            </div>

            <div className="manage-main-controls">
              <div className="manage-main-search">
                <Search className="manage-main-search-icon" />
                <input
                  type="text"
                  placeholder="Search tests..."
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
                  <th>Items</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {!loading && paginatedTests.length === 0 && (
                  <tr>
                    <td colSpan={7} className="manage-main-empty">No tests found.</td>
                  </tr>
                )}

                {paginatedTests.map((row) => {
                  const type = getSkillType(row);
                  const skillClass = type === 'listening' ? 'skill-listening' : type === 'writing' ? 'skill-writing' : 'skill-reading';
                  return (
                    <tr key={row._id}>
                      <td className="manage-cell-title">{row.title || row._id}</td>
                      <td><span className={`manage-pill ${skillClass}`}>{type.charAt(0).toUpperCase() + type.slice(1)}</span></td>
                      <td>{row.category || 'Mixed'}</td>
                      <td>{countItems(row)}</td>
                      <td><span className="manage-pill status-published">Published</span></td>
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
                  );
                })}
              </tbody>
            </table>

            <div className="manage-main-pagination">
              <span>
                Showing {listStart}-{listEnd} of {filteredTests.length}
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
        <AddTest
          editIdOverride={editingId}
          embedded
          hideExistingList
          onSaved={handleSaved}
          onCancel={() => {
            setActiveTab('list');
            setEditingId(null);
            navigate('/manage/tests');
          }}
        />
      )}
    </div>
  );
}
