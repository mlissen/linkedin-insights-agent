import crypto from 'node:crypto';
import { getSupabase } from './supabase.js';
import { config } from './config.js';

export async function storeArtifact(runId: string, artifactType: string, content: string) {
  const supabase = getSupabase();
  const bytes = Buffer.byteLength(content, 'utf-8');
  const sha = crypto.createHash('sha256').update(content).digest('hex');
  const path = `${runId}/${artifactType}.md`;

  const { error: uploadError } = await supabase.storage
    .from(config.artifactBucket)
    .upload(path, content, { contentType: 'text/markdown', upsert: true });
  if (uploadError) throw uploadError;

  const { error: insertError } = await supabase.from('run_artifacts').insert({
    run_id: runId,
    artifact_type: artifactType,
    storage_path: path,
    content_sha256: sha,
    bytes,
  });
  if (insertError) throw insertError;
}
