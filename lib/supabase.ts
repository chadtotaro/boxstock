import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://xjlhmuryrckfecmpgqwa.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqbGhtdXJ5cmNrZmVjbXBncXdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMDEwNzIsImV4cCI6MjA4Njg3NzA3Mn0.xfg4Gm5_99vmMs2P5ujeFHt9y-2GHEs1iFFNVj7HPiE'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)