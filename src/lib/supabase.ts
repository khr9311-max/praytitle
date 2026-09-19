import { createClient } from '@supabase/supabase-js';

const rawUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
// /rest/v1/ 또는 끝의 슬래시 제거하여 올바른 베이스 URL로 자동 보정
const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'placeholder';

export const supabase = createClient(supabaseUrl, supabaseKey);
