import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

export const isSupabaseConfigured = (): boolean => {
  return !!supabase;
};

// Check if a query to Supabase fails due to table not existing
export const isTableMissing = (error: any): boolean => {
  if (!error) return false;
  return error.code === 'PGRST205' || 
         (error.message && error.message.includes('relation') && error.message.includes('does not exist')) ||
         (error.message && error.message.includes('Could not find the table'));
};
