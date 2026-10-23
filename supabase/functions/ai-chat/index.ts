// ============================================================
// Supabase Edge Function · ai-chat
// 部署位置：Supabase 控制台 → Edge Functions → 新建函数 ai-chat
// 密钥设置：函数页 → Secrets → 添加 DEEPSEEK_API_KEY = 你的DeepSeek密钥
// 本文件仅供参考粘贴，真正运行在 Supabase 云端
// ============================================================
// 说明：不需要 import edge-runtime，Supabase 运行时自带 Deno.serve

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

const SYSTEM_PROMPT = `你是「逍遥引」燕云十六声百业宗门官网的智能客服，回答访客问题。规则：
1. 用简体中文，友好、简洁，每次回答不超过150字。
2. 宗门常识：入群须改游戏名，格式「游戏名➕武学➕本职心法」，示例「李逍遥·鸣金·虹·无名心法」；社主微信 Mike_G-u；官网 https://nicekele.github.io/xiaoyaoyin/ 。
3. 奖励：周活3000+可抽6元红包（每周5份），周活5000+可抽30元月卡（每周3份）；月活20000+抽128（2份），24000+抽258（1份）；同类每周/月不重复。
4. 如果问题里提到活动时间/破军/派对/今天安排等，优先采用用户消息上下文中给出的 schedule（时间表）信息回答，schedule 是最新数据。
5. 不确定的事不要编造，统一引导：联系社主微信 Mike_G-u 咨询。
6. 拒答涉政、色情、违法等无关内容，礼貌说明只回答宗门相关问题。`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const { message, schedule, today } = await req.json();
    if (!message || typeof message !== "string") return json({ error: "message required" }, 400);

    const apiKey = Deno.env.get("DEEPSEEK_API_KEY");
    if (!apiKey) return json({ error: "server key missing" }, 500);

    const userContent =
      (today ? "今天是" + today + "。\n" : "") +
      (schedule ? "当前官网活动时间表JSON：\n" + JSON.stringify(schedule) + "\n\n" : "") +
      "访客问题：" + message;

    const resp = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + apiKey,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        max_tokens: 300,
        temperature: 0.5,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("deepseek error", resp.status, errText);
      return json({ error: "llm error " + resp.status }, 502);
    }
    const data = await resp.json();
    const reply = data?.choices?.[0]?.message?.content ?? "";
    return json({ reply });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
