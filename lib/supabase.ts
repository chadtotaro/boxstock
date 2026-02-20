import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://xjlhmuryrckfecmpgqwa.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'sb_publishable_x49Ec6cXNSibutmjiw10Jw_Vs2cYtV8'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)