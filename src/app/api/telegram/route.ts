import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

const COMMUNITIES = [
  '가족', '26하GBS', '기도후원자', '26엘더조', 
  '26한사랑국리더십', '26한사랑국운영팀', '직장'
];

async function sendTelegramMessage(chatId: number, text: string, replyMarkup?: any) {
  if (!TELEGRAM_BOT_TOKEN) return;
  const body: any = {
    chat_id: chatId,
    text: text,
  };
  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }
  
  await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function editTelegramMessageText(chatId: number, messageId: number, text: string) {
  if (!TELEGRAM_BOT_TOKEN) return;
  await fetch(`${TELEGRAM_API_URL}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text: text,
    }),
  });
}

function parsePrayerRequests(text: string, community: string) {
  // 텍스트를 빈 줄(\n\n 등) 기준으로 블록 단위로 쪼갬
  const blocks = text.split(/\n\s*\n/);
  const results = [];

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 2) continue; // 내용이 없는 타이틀은 건너뜀

    const firstLine = lines[0].trim();
    // 첫 줄에서 특수문자와 공백을 모두 제거 (예: '👑금동훈' -> '금동훈', '♡ 황윤미' -> '황윤미')
    const cleanName = firstLine.replace(/[^\w가-힣]/g, '').trim();
    
    // 이름이 2~5글자의 한글로만 이루어져 있다면 사람으로 인식
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
      const text = body.message.text;

      // 파싱이 가능한 형식인지 미리 테스트
      const dummyParsed = parsePrayerRequests(text, 'test');
      if (dummyParsed.length === 0) {
         await sendTelegramMessage(chatId, "이 텍스트에서는 기도제목 형식(기호 + 이름 + 줄바꿈 + 내용)을 찾지 못했습니다. 양식을 확인해주세요.");
         return NextResponse.json({ ok: true });
      }

      // 텍스트를 DB에 임시 저장 (pending_messages)
      const { data, error } = await supabase
        .from('pending_messages')
        .insert([{ chat_id: chatId.toString(), text: text }])
        .select('id')
        .single();

      if (error || !data) {
        console.error('Error saving pending message:', error);
        await sendTelegramMessage(chatId, "오류가 발생했습니다 (DB 임시 저장 실패).");
        return NextResponse.json({ ok: true });
      }

      // 인라인 키보드 생성 (콜백 데이터 길이 제한(64바이트)을 피하기 위해 짧은 id 사용)
      const keyboard = [];
      for (let i = 0; i < COMMUNITIES.length; i += 2) {
        const row = [];
        row.push({ text: COMMUNITIES[i], callback_data: `c:${data.id}:${COMMUNITIES[i]}` });
        if (COMMUNITIES[i+1]) {
          row.push({ text: COMMUNITIES[i+1], callback_data: `c:${data.id}:${COMMUNITIES[i+1]}` });
        }
        keyboard.push(row);
      }
      keyboard.push([{ text: '취소', callback_data: `c:${data.id}:cancel` }]);

      await sendTelegramMessage(chatId, "이 기도제목을 어느 공동체에 추가할까요?", {
        inline_keyboard: keyboard
      });
      return NextResponse.json({ ok: true });
    }

    // 2. 인라인 키보드 버튼(Callback Query) 클릭 시
    if (body.callback_query) {
      const callbackQuery = body.callback_query;
      const chatId = callbackQuery.message.chat.id;
      const messageId = callbackQuery.message.message_id;
      const dataStr = callbackQuery.data; // 예: "c:123:가족"

      if (dataStr.startsWith('c:')) {
        const parts = dataStr.split(':');
        const pendingId = parts[1];
        const community = parts[2];

        if (community === 'cancel') {
          await supabase.from('pending_messages').delete().eq('id', pendingId);
          await editTelegramMessageText(chatId, messageId, "작업이 취소되었습니다.");
          return NextResponse.json({ ok: true });
        }

        // 임시 저장된 텍스트 불러오기
        const { data: pendingData, error: pendingError } = await supabase
          .from('pending_messages')
          .select('text')
          .eq('id', pendingId)
          .single();

        if (pendingError || !pendingData) {
          await editTelegramMessageText(chatId, messageId, "이미 처리되었거나 만료된 요청입니다.");
          return NextResponse.json({ ok: true });
        }

        const textToParse = pendingData.text;
        const parsedRequests = parsePrayerRequests(textToParse, community);

        if (parsedRequests.length > 0) {
          // 파싱된 데이터를 prayer_requests 테이블에 저장
          const { error: insertError } = await supabase
            .from('prayer_requests')
            .insert(parsedRequests);

          if (insertError) {
            console.error('Insert error:', insertError);
            await editTelegramMessageText(chatId, messageId, "기도제목을 저장하는 중 오류가 발생했습니다.");
          } else {
             const names = parsedRequests.map(r => r.name).join(', ');
             await editTelegramMessageText(chatId, messageId, `✅ [${community}] 공동체에 총 ${parsedRequests.length}명의 기도제목이 저장되었습니다.\n(등록: ${names})`);
          }
        } else {
           await editTelegramMessageText(chatId, messageId, "기도제목 파싱에 실패했습니다. (이름 패턴 등을 확인해주세요)");
        }

        // 처리 완료 후 임시 메시지 삭제
        await supabase.from('pending_messages').delete().eq('id', pendingId);
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Webhook error:', err);
    return NextResponse.json({ ok: true });
  }
}

