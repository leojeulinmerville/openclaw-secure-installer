---
name: mcp-sql-server
description: Use the MCP SQL server to read and explore SQLite databases. It provides tools to list tables, describe table schemas, and execute SELECT queries. Trigger this when the user asks to analyze or read data from a SQL/SQLite database.
---

# MCP SQL Server

This skill enables Gemini CLI to interact with SQLite databases using the Model Context Protocol (MCP).

## Overview

The MCP SQL server provides a set of tools to explore and query SQLite databases safely (read-only by default).

## Tools

### 1. `list_tables`
Returns a list of all tables in the database (excluding internal sqlite tables).

### 2. `describe_table(table: string)`
Returns the column information (name, type, nullability, etc.) for a specific table. Use this to understand the schema before querying.

### 3. `read_query(sql: string)`
Executes a `SELECT` SQL query and returns the results in JSON format. Only `SELECT` queries are allowed.

## Usage Patterns

When you need to read a database:
1. **Identify the database path**: Usually passed via `DATABASE_PATH` environment variable.
2. **List tables**: Start by listing available tables to get an overview.
3. **Describe tables**: For tables of interest, get their schema to know which columns to query.
4. **Query data**: Write targeted `SELECT` queries to extract the information needed.

## Example Workflow

- **User**: "What's in the 'users' table in my database?"
- **Agent**:
  1. Call `describe_table(table: "users")` to see columns.
  2. Call `read_query(sql: "SELECT * FROM users LIMIT 10")` to see sample data.

## Configuration

The server connects to the database specified by the `DATABASE_PATH` environment variable. If not set, it defaults to `database.sqlite` in the current working directory.

## Execution via mcporter

If `mcporter` is installed, you can call this server directly using:
\`\`\`bash
mcporter call --stdio "tsx packages/mcp-sql-server/src/index.ts" list_tables
\`\`\`
(Ensure `tsx` is available or the server is built).
