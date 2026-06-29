export function paginationFrom(query) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

export function paginationMeta(total, page, limit) {
  return { page, limit, total, pages: Math.ceil(total / limit) };
}
