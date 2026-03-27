import apiClient from "./client";

/**
 * Convert a plain-English question into a PostgreSQL SELECT query.
 * @param {string} question
 * @returns {Promise<{ sql: string, question: string }>}
 */
export async function generateSQL(question) {
  const { data } = await apiClient.post("/api/search/nl2sql", { question });
  return data;
}

/**
 * Execute a validated SELECT query and return tabular results.
 * @param {string} sql
 * @returns {Promise<{ columns: string[], rows: (string|null)[][], row_count: number, truncated: boolean }>}
 */
export async function executeSQL(sql) {
  const { data } = await apiClient.post("/api/search/execute", { sql });
  return data;
}
