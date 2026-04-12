/**
 * HTTP client for the Datagate API.
 *
 * Thin wrapper around fetch — handles authentication and provides typed
 * methods for each endpoint the MCP server needs.
 */

export interface Dataset {
  id: string;
  seller_id: string;
  seller_name: string;
  name: string;
  description: string;
  price_per_chunk: string;
  currency: string;
  visibility: "public" | "private";
  metadata_schema: { name: string; type: string; description?: string }[] | null;
  queryable: boolean;
  subscribed: boolean;
  created_at: string;
  updated_at: string;
}

export interface QueryResult {
  dataset_id: string;
  id: string;
  score: number;
  metadata: Record<string, unknown>;
  embedding_model?: string;
}

export interface QueryResponse {
  query_id: string;
  results: QueryResult[];
  warnings?: string[];
}

export class DatagateClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.headers = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
  }

  async listDatasets(): Promise<Dataset[]> {
    const resp = await fetch(`${this.baseUrl}/v1/datasets/discover`, {
      headers: this.headers,
    });
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`GET /v1/datasets/discover failed (${resp.status}): ${body}`);
    }
    return resp.json() as Promise<Dataset[]>;
  }

  async query(
    datasetIds: string[],
    text: string,
    topK = 10,
    filters?: Record<string, unknown>,
  ): Promise<QueryResponse> {
    const body: Record<string, unknown> = {
      query: text,
      dataset_ids: datasetIds,
      top_k: topK,
    };
    if (filters !== undefined) {
      body.filters = filters;
    }

    const resp = await fetch(`${this.baseUrl}/v1/query`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      let errorMsg = await resp.text();
      try {
        const parsed = JSON.parse(errorMsg);
        if (parsed.error) errorMsg = parsed.error;
      } catch {
        // keep raw text
      }
      throw new Error(`Query failed (${resp.status}): ${errorMsg}`);
    }
    return resp.json() as Promise<QueryResponse>;
  }
}
