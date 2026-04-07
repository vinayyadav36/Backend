const parsePagination = (query, opts = {}) => {
  const maxLimit = opts.maxLimit || 100;
  const defaultLimit = opts.defaultLimit || 10;

  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit) || defaultLimit));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

module.exports = { parsePagination };
