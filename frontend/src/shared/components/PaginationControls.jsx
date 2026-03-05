export default function PaginationControls({
  pagination,
  onPageChange,
  loading = false,
  itemLabel = "items",
  variant = "default",
  className = "",
}) {
  if (!pagination) return null;

  const page = Number(pagination.page || 1);
  const totalPages = Math.max(1, Number(pagination.totalPages || 1));
  const totalItems = Number(pagination.totalItems || 0);
  const hasPrevPage = Boolean(pagination.hasPrevPage ?? page > 1);
  const hasNextPage = Boolean(pagination.hasNextPage ?? page < totalPages);
  const isCompactAdmin = variant === "compact-admin";

  const btnStyle = isCompactAdmin
    ? {
      border: "1px solid #dbe4f4",
      borderRadius: "10px",
      padding: "0.45rem 0.8rem",
      background: "white",
      color: "#334155",
      fontWeight: 700,
      fontSize: "0.8rem",
      cursor: "pointer",
      transition: "all 0.2s ease",
    }
    : {
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

  const containerStyle = isCompactAdmin
    ? {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: "0.85rem",
      flexWrap: "wrap",
      marginTop: "0.25rem",
      paddingTop: "0.85rem",
      borderTop: "1px solid #eef2ff",
    }
    : {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: "1rem",
      marginTop: "1rem",
      flexWrap: "wrap",
    };

  const infoStyle = isCompactAdmin
    ? { fontSize: "0.8rem", color: "#64748b", fontWeight: 600 }
    : { fontSize: "0.85rem", color: "#64748b" };

  return (
    <div className={className} style={containerStyle}>
      <span style={infoStyle}>
        {isCompactAdmin
          ? `Page ${page} of ${totalPages} | ${totalItems} ${itemLabel}`
          : `Page ${page} / ${totalPages} - ${totalItems} ${itemLabel}`}
      </span>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          type="button"
          disabled={loading || !hasPrevPage}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          style={loading || !hasPrevPage ? disabledStyle : btnStyle}
        >
          {isCompactAdmin ? "Previous" : "Prev"}
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


