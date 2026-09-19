import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

const COMMUNITIES = [
  '가족', '26하GBS', '기도후원자', '26엘더조', 
  '26한사랑국리더십', '26한사랑국운영팀', '직장'
];

// 서버 상태 확인용 GET 엔드포인트
export async function GET() {
  return NextResponse.json({ status: 'running' });
}

async function sendTelegramMessage(chatId: number, text: string, replyMarkup?: any) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN is not defined in environment variables.');
    return;
  }
  const body: any = {
    chat_id: chatId,
    text: text,
  };
  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }
  
  try {
    const res = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!data.ok) {
      console.error('Telegram sendMessage error:', data);
    }
  } catch (err) {
    console.error('Failed to send Telegram message:', err);
  }
}

async function editTelegramMessageText(chatId: number, messageId: number, text: string) {
  if (!TELEGRAM_BOT_TOKEN) return;
  try {
    const res = await fetch(`${TELEGRAM_API_URL}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text: text,
      }),
    });
    const data = await res.json();
    if (!data.ok) {
      console.error('Telegram editMessageText error:', data);
    }
  } catch (err) {
    console.error('Failed to edit Telegram message:', err);
  }
}

function parsePrayerRequests(text: string, community: string) {
  // 줄바꿈 정규화 (\r\n -> \n)
  const normalizedText = text.replace(/\r\n/g, '\n');
  const blocks = normalizedText.split(/\n\s*\n/);
  const results = [];

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 2) continue;

    const firstLine = lines[0].trim();
    // 첫 줄에서 특수문자와 공백을 모두 제거 (예: '👑금동훈' -> '금동훈', '♡ 황윤미' -> '황윤미')
    const cleanName = firstLine.replace(/[^\w가-힣]/g, '').trim();
    
    // 2~5글자의 한글로만 이루어져 있다면 이름으로 인식
    if (cleanName.length >= 2 && cleanName.length <= 5 && /^[가-힣]+$/.test(cleanName)) {
      const requests = lines.slice(1).join('\n').trim();
      if (requests) {
        results.push({
          community,
          name: cleanName,
          content: requests,
        });
      }
    }
  }
  return results;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 1. 일반 텍스트 메시지 수신 시
    if (body.message && body.message.text) {
      const chatId = body.message.chat.id;
      const text = body.message.text.trim();

      // /start 명령어 처리
      if (text === '/start' || text === '/help') {
        await sendTelegramMessage(
          chatId,
          "안녕하세요! 기도제목 아카이빙 봇입니다. 🙏\n\n기도제목 텍스트를 복사해서 보내주시면, 어느 공동체에 등록할지 선택할 수 있는 버튼을 띄워드립니다."
        );
        return NextResponse.json({ ok: true });
      }

      // 파싱 가능 여부 확인
      const dummyParsed = parsePrayerRequests(text, 'test');
      if (dummyParsed.length === 0) {
         await sendTelegramMessage(
           chatId, 
           "⚠️ 전송해주신 텍스트에서 [기호 + 이름] 형식의 기도제목을 찾지 못했습니다.\n\n예시:\n👑홍길동\n1. 기도제목 내용..."
         );
         return NextResponse.json({ ok: true });
      }

      // 텍스트를 DB에 임시 저장 (pending_messages)
      const { data, error } = await supabase
        .from('pending_messages')
        .insert([{ chat_id: chatId.toString(), text: text }])
        .select('id')
        .single();

      if (error || !data) {
        console.error('Error saving pending message to Supabase:', error);
        await sendTelegramMessage(
          chatId, 
          `❌ DB 저장 중 오류가 발생했습니다.\n(Supabase 테이블이나 권한 설정을 확인해주세요: ${error?.message || '알 수 없는 오류'})`
        );
        return NextResponse.json({ ok: true });
      }

      // 인라인 키보드 생성
      const keyboard = [];
      for (let i = 0; i < COMMUNITIES.length; i += 2) {
        const row = [];
        row.push({ text: COMMUNITIES[i], callback_data: `c:${data.id}:${COMMUNITIES[i]}` });
        if (COMMUNITIES[i+1]) {
          row.push({ text: COMMUNITIES[i+1], callback_data: `c:${data.id}:${COMMUNITIES[i+1]}` });
        }
        keyboard.push(row);
      }
      keyboard.push([{ text: '❌ 취소', callback_data: `c:${data.id}:cancel` }]);

      await sendTelegramMessage(chatId, `총 ${dummyParsed.length}명의 기도제목을 확인했습니다.\n어느 공동체에 추가할까요?`, {
        inline_keyboard: keyboard
      });
      return NextResponse.json({ ok: true });
    }

    // 2. 인라인 키보드 버튼 클릭 시 (callback_query)
    if (body.callback_query) {
      const callbackQuery = body.callback_query;
      const chatId = callbackQuery.message.chat.id;
      const messageId = callbackQuery.message.message_id;
      const dataStr = callbackQuery.data;

      if (dataStr && dataStr.startsWith('c:')) {
        const parts = dataStr.split(':');
        const pendingId = parts[1];
        const community = parts[2];

        if (community === 'cancel') {
          await supabase.from('pending_messages').delete().eq('id', pendingId);
          await editTelegramMessageText(chatId, messageId, "작업이 취소되었습니다.");
          return NextResponse.json({ ok: true });
        }

        const { data: pendingData, error: pendingError } = await supabase
          .from('pending_messages')
          .select('text')
          .eq('id', pendingId)
          .single();

        if (pendingError || !pendingData) {
          await editTelegramMessageText(chatId, messageId, "⚠️ 이미 처리되었거나 만료된 요청입니다.");
          return NextResponse.json({ ok: true });
        }

        const textToParse = pendingData.text;
        const parsedRequests = parsePrayerRequests(textToParse, community);

        if (parsedRequests.length > 0) {
          const { error: insertError } = await supabase
            .from('prayer_requests')
            .insert(parsedRequests);

          if (insertError) {
            console.error('Insert error in Supabase:', insertError);
            await editTelegramMessageText(chatId, messageId, `❌ 저장 실패: ${insertError.message}`);
          } else {
             const names = parsedRequests.map(r => r.name).join(', ');
             await editTelegramMessageText(chatId, messageId, `✅ [${community}] 공동체에 총 ${parsedRequests.length}명의 기도제목이 등록되었습니다!\n\n👥 등록된 사람: ${names}`);
          }
        } else {
           await editTelegramMessageText(chatId, messageId, "기도제목 파싱에 실패했습니다.");
        }

        await supabase.from('pending_messages').delete().eq('id', pendingId);
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Webhook error:', err);
    return NextResponse.json({ ok: true, error: err?.message });
  }
}
