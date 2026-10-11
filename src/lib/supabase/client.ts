import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const hasSupabaseConfig = Boolean(url && anonKey && !url.includes('your-project-ref') && !anonKey.includes('your-public-anon-key'))

/** null in demo mode; anon key only. Never place a service-role key in VITE_* variables. */
export const supabase = hasSupabaseConfig ? createClient(url, anonKey) : null
