// misskey-momo-watcher.js
const WebSocket = require('ws');
const dotenv = require('dotenv');

dotenv.config();

const CONFIG = {
  misskey: {
    host: 'https://misskey.resonite.love', // ← 変更
    token: process.env.MISSKEY_TOKEN,               // ← 変更
  },
  ollama: {
    host: 'http://192.168.0.36:11434',
    model: 'hoangquan456/qwen3-nothink:4b',
  },
};

const CLASSIFIER_PROMPT = `You are a classifier for an SNS agent AI named "モモちゃん".
**TASK:** Determine if this post needs AI processing.
**OUTPUT: Return ONLY one of these JSON objects:**
{"need_response": true}
{"need_response": false}
---
## EXAMPLES:
"モモちゃん、天気教えて" → {"need_response": true}
"牛乳買わなきゃ" → {"need_response": true}
"明日までにレポートやらないと" → {"need_response": true}
"今日やること うんち ごみだし しごと" → {"need_response": true}
"ワールドクラッシュして4時間分消えた… 復旧方法とかってありますか" → {"need_response": false}
"やはりDice throneを遊べるようにするべきか" → {"need_response": false}
"うどんおいしかった" → {"need_response": false}
"どうしようかな" → {"need_response": false}
"○○さんとご飯食べた" → {"need_response": false}
"データ消えた最悪…" → {"need_response": false}
---
## RULES:
**TRUE only when:**
- Contains "モモちゃん", "モモ", "@momo" AND requesting something
- User declares firm TODO: 〜なきゃ, 〜ないと, 〜しよう
- User lists tasks: 今日やること, やること, TODO
**FALSE when:**
- Venting/Complaining about problems (even with questions like ありますか)
- Thinking/Wondering: 〜べきか, 〜かな, 〜だろうか
- No "モモちゃん" AND no firm TODO pattern
- Talking about others or past events
---
**OUTPUT ONLY THE JSON. NO EXPLANATION. NO THINKING.**

Post: `;

async function classifyPost(text) {
  try {
    const res = await fetch(`${CONFIG.ollama.host}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: CONFIG.ollama.model,
        prompt: CLASSIFIER_PROMPT + `"${text}"`,
        stream: false,
        options: {
          num_ctx: 1000,
          temperature: 0.7,
        },
      }),
    });
    
    const data = await res.json();
    const response = data.response.trim();
    
    // JSONを抽出（thinking modeで余計な出力がある場合に対応）
    const match = response.match(/\{[^}]+\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return parsed.need_response === true;
    }
    return false;
  } catch (e) {
    console.error('Classification error:', e.message);
    return false;
  }
}

async function addReaction(noteId, reaction = ':wakatta:') {
  try {
    await fetch(`${CONFIG.misskey.host}/api/notes/reactions/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        i: CONFIG.misskey.token,
        noteId,
        reaction,
      }),
    });
    console.log(`✓ Reacted to ${noteId}`);
  } catch (e) {
    console.error('Reaction error:', e.message);
  }
}

function connectStream() {
  const ws = new WebSocket(`${CONFIG.misskey.host.replace('https', 'wss')}/streaming?i=${CONFIG.misskey.token}`);
  
  ws.on('open', () => {
    console.log('Connected to Misskey streaming');
    
    // LTL購読
    ws.send(JSON.stringify({
      type: 'connect',
      body: {
        channel: 'localTimeline',
        id: 'ltl',
      },
    }));
  });
  
  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      
      if (msg.type === 'channel' && msg.body.id === 'ltl' && msg.body.type === 'note') {
        const note = msg.body.body;
        const text = note.text;
        
        if (!text) return; // テキストなし（画像のみ等）はスキップ
        
        console.log(`[${note.user.username}] ${text.slice(0, 50)}...`);
        
        const needsResponse = await classifyPost(text);
        
        if (needsResponse) {
          console.log(`→ Need response detected!`);
          await addReaction(note.id);
        } else {
            console.log(`→ No response needed.`);
        }
      }
    } catch (e) {
      console.error('Message parse error:', e.message);
    }
  });
  
  ws.on('close', () => {
    console.log('Disconnected. Reconnecting in 5s...');
    setTimeout(connectStream, 5000);
  });
  
  ws.on('error', (e) => {
    console.error('WebSocket error:', e.message);
  });
}

// 起動
console.log('Starting Momo Watcher...');
connectStream();