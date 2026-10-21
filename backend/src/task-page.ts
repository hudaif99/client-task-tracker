export const TASK_PAGE_SIZE = 50;

// Format explicitly before pg parses DATE values, keeping calendar days timezone-free.
export const taskPageQuery = `SELECT id, client_id, title, status, created_at,
    to_char(due_date::timestamp, 'YYYY-MM-DD') AS due_date
  FROM public.tasks
  WHERE client_id = $1 AND ($2::text IS NULL OR status = $2)
    AND ($3::integer IS NULL OR id < $3)
    AND EXISTS (SELECT 1 FROM public.clients WHERE id = $1 AND owner_id = $4)
  ORDER BY id DESC
  LIMIT 51`;

export function makeTaskPage<T extends { id: number }>(rows: T[]) {
  const data = rows.slice(0, TASK_PAGE_SIZE);
  return {
    data,
    pagination: {
      nextBeforeId: rows.length > TASK_PAGE_SIZE ? data[TASK_PAGE_SIZE - 1].id : null,
    },
  };
}
