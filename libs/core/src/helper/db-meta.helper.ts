import { Document } from '@nuvix/database';
import { Client } from 'pg';

interface SetupDatabaseMeta {
  request?: NuvixRequest;
  res?: NuvixRes;
  project?: Document;
  extra?: Record<string, any>;
  extraPrefix?: string;
  client: Client;
}

function escapeLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`; // escape single quotes
}

export const setupDatabaseMeta = async ({
  client,
  request,
  extra,
  project,
  extraPrefix,
}: SetupDatabaseMeta) => {
  const sqlChunks: string[] = [];

  if (request) {
    const headers: Record<string, string | string[]> = {};
    for (const [k, v] of Object.entries(request.headers ?? {})) {
      headers[k.toLowerCase()] = v;
    }

    const requestMeta: [string, any][] = [
      ['request.method', request.method?.toUpperCase() || 'GET'],
      ['request.path', request.url || ''],
      ['request.id', request.id || ''],
      ['request.headers', JSON.stringify(headers)],
      ['request.cookies', JSON.stringify(request.cookies ?? {})],
      ['request.ip', request.ip || ''],
    ];

    for (const [key, value] of requestMeta) {
      sqlChunks.push(`SET LOCAL ${key} = ${escapeLiteral(String(value))};`);
    }
  }

  if (project && !project.isEmpty()) {
    const projectData = {
      id: project.getId(),
      name: project.getAttribute('name'),
    };
    sqlChunks.push(
      `SET LOCAL app.project = ${escapeLiteral(JSON.stringify(projectData))};`,
    );
  }

  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (key && value != null) {
        const fullKey = `${extraPrefix ? extraPrefix + '.' : ''}${key}`;
        sqlChunks.push(
          `SET LOCAL ${fullKey} = ${escapeLiteral(String(value))};`,
        );
      }
    }
  }

  if (!sqlChunks.length) return;

  const finalSQL = sqlChunks.join(' ');
  await client.query(finalSQL);
};
