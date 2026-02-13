const toPositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
};

export const parsePagination = (query = {}, options = {}) => {
  const defaultPage = options.defaultPage || 1;
  const defaultLimit = options.defaultLimit || 20;
  const maxLimit = options.maxLimit || 100;

  const page = toPositiveInteger(query.page, defaultPage);
  const requestedLimit = toPositiveInteger(query.limit, defaultLimit);
  const limit = Math.min(requestedLimit, maxLimit);
  const skip = (page - 1) * limit;

  return {
    page,
    limit,
    skip,
  };
};

export const buildPaginationMeta = ({ page, limit, totalItems }) => {
  const safeTotal = Math.max(0, totalItems || 0);
  const totalPages = Math.max(1, Math.ceil(safeTotal / limit));

  return {
    page,
    limit,
    totalItems: safeTotal,
    totalPages,
    hasPrevPage: page > 1,
    hasNextPage: page < totalPages,
  };
};
