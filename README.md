# @datagate/mcp

MCP server that gives AI agents access to datasets on the [Datagate](https://getdatagate.com) marketplace.

## Quick Start

1. Sign up at [getdatagate.com](https://getdatagate.com) and create an API key
2. Add the server to your MCP client:

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "datagate": {
      "command": "npx",
      "args": ["-y", "@datagate/mcp"],
      "env": {
        "DATAGATE_API_KEY": "dg_live_your_key_here"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add datagate -e DATAGATE_API_KEY=dg_live_your_key_here -- npx -y @datagate/mcp
```

### Custom TypeScript/Node Agent

```bash
npm install @datagate/mcp
```

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "npx",
  args: ["-y", "@datagate/mcp"],
  env: { DATAGATE_API_KEY: "dg_live_..." },
});

const client = new Client({ name: "my-agent", version: "1.0.0" });
await client.connect(transport);

const tools = await client.listTools();
const result = await client.callTool({ name: "list_datasets", arguments: {} });
```

## Tools

### `list_datasets`

Discover all datasets visible to your account — public marketplace datasets and private datasets you've been granted access to.

Returns for each dataset:
- Name, description, seller name
- Price per chunk and currency
- Whether it's queryable (has a connector wired)
- Whether you're subscribed
- Metadata schema — the filterable fields and their types

### `query`

Search across one or more datasets by natural language.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `dataset_ids` | `string[]` | Yes | — | Dataset IDs to search |
| `text` | `string` | Yes | — | Natural language query |
| `top_k` | `number` | No | 10 | Max results (up to 100) |
| `filters` | `object` | No | — | Per-dataset metadata filters (MongoDB-style) |

**Filter example** (maps each dataset ID to its own filter object):
```json
{
  "dataset-id-1": {"year": {"$gte": 2023}},
  "dataset-id-2": {"category": {"$eq": "research"}}
}
```

Datasets without an entry are queried unfiltered. Supported operators: `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$and`, `$or`.

Use `list_datasets` first to see what filter fields are available for each dataset.

## Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATAGATE_API_KEY` | Yes | — | Your Datagate API key (`dg_live_...`) |
| `DATAGATE_URL` | No | `https://api.getdatagate.com` | API base URL (set to `http://localhost:8080` for local dev) |

## Development

```bash
git clone https://github.com/keviny0320/datagate-mcp-typescript.git
cd datagate-mcp-typescript
npm install

# Test that it starts
DATAGATE_API_KEY=test npx tsx src/index.ts
```
