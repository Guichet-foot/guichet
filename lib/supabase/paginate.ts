/**
 * Supabase silently truncates SELECT results at the server's max_rows setting
 * (default 1000). Client-side .limit() cannot exceed it.
 * This helper paginates with .range() until all rows are returned.
 */
export async function fetchAll<T>(
  queryFn: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const PAGE = 1000;
  const all: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await queryFn(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}
