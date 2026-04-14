#!/usr/bin/env npx tsx

/**
 * Datagate MCP server — exposes list_datasets and query as tools for AI agents.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { DatagateClient, DatagateError } from "datagate";

// ---------------------------------------------------------------------------
// Read config from environment
// ---------------------------------------------------------------------------

const apiKey = process.env.DATAGATE_API_KEY;
if (!apiKey) {
  console.error(
    "DATAGATE_API_KEY environment variable is required.\n" +
      "Get your API key at https://datagate.dev",
  );
  process.exit(1);
}

const baseUrl = process.env.DATAGATE_URL ?? "https://api.datagate.dev";
const client = new DatagateClient({ apiKey, baseUrl });

// ---------------------------------------------------------------------------
// MCP server
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "datagate",
  version: "0.1.0",
});

// ---------------------------------------------------------------------------
// Tool: list_datasets
// ---------------------------------------------------------------------------

server.tool(
  "list_datasets",
  "List all datasets available on Datagate. " +
    "Returns each dataset's name, description, price per chunk, currency, " +
    "metadata schema (for constructing query filters), and status flags: " +
    "queryable (whether wired to a vector DB) and subscribed (whether you have access). " +
    "Call this before querying to find dataset IDs and learn what metadata filters are available.",
  {},
  async () => {
    try {
      const datasets = await client.listDatasets();

      if (datasets.length === 0) {
        return { content: [{ type: "text" as const, text: "No datasets available." }] };
      }

      const lines: string[] = [`Found ${datasets.length} dataset(s):\n`];

      for (const ds of datasets) {
        let line =
          `--- ${ds.name} ---\n` +
          `  ID: ${ds.id}\n` +
          `  Seller: ${ds.seller_name}\n` +
          `  Description: ${ds.description || "(none)"}\n` +
          `  Price: ${ds.price_per_chunk} ${ds.currency} per chunk\n` +
          `  Visibility: ${ds.visibility}\n` +
          `  Queryable: ${ds.queryable ? "yes" : "no (no connector wired)"}\n` +
          `  Subscribed: ${ds.subscribed ? "yes" : "no"}\n`;

        if (ds.metadata_schema && ds.metadata_schema.length > 0) {
          line += "  Filterable fields:\n";
          for (const field of ds.metadata_schema) {
            const desc = field.description ? ` — ${field.description}` : "";
            line += `    - ${field.name} (${field.type})${desc}\n`;
          }
        }

        lines.push(line);
      }

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    } catch (err) {
      const message = err instanceof DatagateError ? `${err.statusCode}: ${err.message}` :
        err instanceof Error ? err.message : String(err);
      return { content: [{ type: "text" as const, text: `Error listing datasets: ${message}` }] };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: query
// ---------------------------------------------------------------------------

server.tool(
  "query",
  "Query across one or more Datagate datasets. " +
    "Returns the most relevant chunks ranked by similarity score. " +
    "Each query charges per chunk returned (see list_datasets for pricing). " +
    "Use list_datasets first to find dataset IDs and available metadata filters. " +
    "Supported filter operators: $eq, $ne, $gt, $gte, $lt, $lte, $in, $and, $or. " +
    "Filters are per-dataset — maps each dataset ID to its own filter object. " +
    'Example: {"dataset-id-1": {"year": {"$gte": 2023}}, "dataset-id-2": {"category": {"$eq": "research"}}}. ' +
    "Datasets without an entry are queried unfiltered.",
  {
    dataset_ids: z.array(z.string()).describe("Dataset IDs to search (get these from list_datasets)"),
    text: z.string().describe("Natural language search query"),
    top_k: z.number().default(10).describe("Maximum number of results to return (default 10, max 100)"),
    filters: z
      .record(z.unknown())
      .optional()
      .describe("Per-dataset metadata filters — maps dataset ID to a filter object using MongoDB-style operators"),
  },
  async ({ dataset_ids, text, top_k, filters }) => {
    try {
      const result = await client.query({
        text,
        datasetIds: dataset_ids,
        topK: top_k,
        filters,
      });

      const lines: string[] = [`Query ID: ${result.query_id}`, `Results: ${result.results.length}\n`];

      if (result.warnings.length > 0) {
        lines.push("Warnings:");
        for (const w of result.warnings) {
          lines.push(`  - ${w}`);
        }
        lines.push("");
      }

      for (let i = 0; i < result.results.length; i++) {
        const r = result.results[i];
        let line = `[${i + 1}] Score: ${r.score.toFixed(4)} | Dataset: ${r.dataset_id}\n`;
        line += `    ID: ${r.id}\n`;
        if (r.metadata && Object.keys(r.metadata).length > 0) {
          line += `    Metadata: ${JSON.stringify(r.metadata)}\n`;
        }
        lines.push(line);
      }

      if (result.results.length === 0) {
        lines.push("No results found.");
      }

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    } catch (err) {
      const message = err instanceof DatagateError ? `${err.statusCode}: ${err.message}` :
        err instanceof Error ? err.message : String(err);
      return { content: [{ type: "text" as const, text: `Query failed: ${message}` }] };
    }
  },
);

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Failed to start MCP server:", err);
  process.exit(1);
});
