import { ProjectsDoc } from '@nuvix/utils/types';
import { Client } from 'pg';

interface SetupDatabaseMeta {
  request?: NuvixRequest;
  res?: NuvixRes;
  project?: ProjectsDoc;
  extra?: Record<string, any>;
  extraPrefix?: string;
  client: Client;
}

export const setupDatabaseMeta = async ({
  client,
  request,
  extra,
  project,
  extraPrefix,
}: SetupDatabaseMeta) => {
  const escapeString = (value: string): string => {
    return `'${value.replace(/'/g, "''")}'`;
  };

  const sqlChunks: string[] = [];

  if (request) {
    const headers: Record<string, string | string[]> = {};
    for (const [k, v] of Object.entries(request.headers ?? {})) {
      headers[k.toLowerCase()] = v!;
    }
    sqlChunks.push(`
      SET "request.method" = ${escapeString(request.method?.toUpperCase() || 'GET')};
      SET "request.path" = ${escapeString(request.url || '')};
      SET "request.id" = ${escapeString(request.id || '')};
      SET "request.headers" = ${escapeString(JSON.stringify(headers))};
      SET "request.cookies" = ${escapeString(JSON.stringify(request.cookies ?? {}))};
      SET "request.ip" = ${escapeString(request.ip || '')};
    `);
  }

  if (project && !project.empty()) {
    const projectData = {
      id: project.getId(),
      name: project.get('name'),
    };
    sqlChunks.push(
      `SET app.project = ${escapeString(JSON.stringify(projectData))};`,
    );
  }

  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (key && value != null) {
        const fullKey = `${extraPrefix ? extraPrefix + '.' : ''}"${key}"`;
        sqlChunks.push(
          `SET LOCAL ${fullKey} = ${escapeString(String(value))};`,
        );
      }
    }
  }

  if (!sqlChunks.length) return;

  const finalSQL = `DO $$ BEGIN ${sqlChunks.join('\n')} END $$;`;
  await client.query(finalSQL);
};
