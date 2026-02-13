export default function PaginationControls({
  pagination,
  onPageChange,
  loading = false,
  itemLabel = "items",
}) {
  if (!pagination) return null;

  const page = Number(pagination.page || 1);
  const totalPages = Math.max(1, Number(pagination.totalPages || 1));
  const totalItems = Number(pagination.totalItems || 0);
  const hasPrevPage = Boolean(pagination.hasPrevPage ?? page > 1);
  const hasNextPage = Boolean(pagination.hasNextPage ?? page < totalPages);

  const btnStyle = {
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    padding: "0.4rem 0.75rem",
    background: "white",
    color: "#334155",
    fontWeight: 600,
    cursor: "pointer",
  };

  const disabledStyle = {
    ...btnStyle,
    opacity: 0.5,
    cursor: "not-allowed",
  };

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", marginTop: "1rem", flexWrap: "wrap" }}>
      <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
        Page {page} / {totalPages} - {totalItems} {itemLabel}
      </span>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          type="button"
          disabled={loading || !hasPrevPage}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          style={loading || !hasPrevPage ? disabledStyle : btnStyle}
        >
          Prev
        </button>
        <button
          type="button"
          disabled={loading || !hasNextPage}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          style={loading || !hasNextPage ? disabledStyle : btnStyle}
        >
          Next
        </button>
      </div>
    </div>
  );
}
