// Categorized PostgreSQL persistence. No fallback to stale legacy KV data.
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
const client = () => {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Supabase server configuration is missing.");
  return createClient(url, key);
};
async function rpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await client().rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}
export const get = async (key: string): Promise<any> => (await rpc("casemate_read_entry", { p_key: key })) ?? undefined;
export const set = async (key: string, value: any): Promise<void> => { await rpc("casemate_write_entry", { p_key: key, p_value: value }); };
export const del = async (key: string): Promise<void> => { await rpc("casemate_delete_entry", { p_key: key }); };
export const mget = async (keys: string[]): Promise<any[]> => (await Promise.all(keys.map(get))).filter((value) => value !== undefined);
export const mset = async (keys: string[], values: any[]): Promise<void> => { for (let i = 0; i < keys.length; i++) await set(keys[i], values[i]); };
export const mdel = async (keys: string[]): Promise<void> => { for (const key of keys) await del(key); };
export const getByPrefix = async (prefix: string): Promise<any[]> => {
  const entries = await rpc("casemate_scan_entries", { p_prefix: prefix });
  return (entries || []).map((entry: { value: unknown }) => entry.value);
};
