#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SintoniaApi } from './api.ts';
import { createServer } from './server.ts';

/**
 * Servidor MCP de Sintonía por stdio (Claude Desktop, Claude Code, el inspector…).
 * stdout es el canal del protocolo: los mensajes para personas van por stderr.
 */
const apiUrl = process.env.SINTONIA_API_URL ?? 'http://localhost:3001/api';
const webUrl = process.env.SINTONIA_WEB_URL ?? 'http://localhost:5173';
/** Persona anónima fija del MCP: sus gustos ("Mis gustos") se aplican a las listas. */
const userId = process.env.SINTONIA_USER_ID ?? '6d637000-5e17-4a1a-8000-000000000001';
const timeZone = process.env.SINTONIA_TIME_ZONE ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

const server = createServer({ api: new SintoniaApi({ baseUrl: apiUrl, userId, timeZone }), webUrl });
await server.connect(new StdioServerTransport());
console.error(`Sintonía MCP listo (API en ${apiUrl})`);
