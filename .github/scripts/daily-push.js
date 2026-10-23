#!/usr/bin/env node
/* ============================================================
   每日活动微信推送（GitHub Actions 定时执行）
   - 从 Supabase 读取活动时间表
   - 按北京时间判断星期几，拼当天文案
   - 走 PushPlus 主题群发（配置了 topicId 则全员接收）
   ============================================================ */
const fs = require("fs");
const path = require("path");

const cfgText = fs.readFileSync(path.join(__dirname, "../../assets/config.js"), "utf8");
function pick(key) {
  const m = cfgText.match(new RegExp(key + '\\s*:\\s*"([^"]*)"'));
  return m ? m[1] : "";
}
const SUPABASE_URL = pick("SUPABASE_URL");
const SUPABASE_KEY = pick("SUPABASE_KEY");
const PUSH_TOKEN = pick("PUSHPLUS_TOKEN");
const PUSH_TOPIC = pick("PUSHPLUS_TOPIC");

const WD = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const SC_DEFAULT = {
  party: { time: "19:30" },
  days: [
    { type: "week", time: "19:30", boss: "", note: "组队开团" },
    { type: "pojun", time: "20:00-22:00", boss: "无相皇", note: "" },
    { type: "yijue", time: "20:00", boss: "", note: "" },
    { type: "pojun", time: "20:00-22:00", boss: "无相皇", note: "" },
    { type: "yijue", time: "20:00", boss: "", note: "" },
    { type: "weekend", time: "全 天", boss: "", note: "" },
    { type: "weekend", time: "全 天", boss: "", note: "" },
  ],
};

function beijingTodayIndex() {
  const now = new Date(Date.now() + 8 * 3600 * 1000); // UTC+8
  const wd = now.getUTCDay(); // 0=周日
  return (wd + 6) % 7;        // 0=周一
}

function buildText(sched) {
  const d = (sched && sched.days) ? sched : SC_DEFAULT;
  const partyT = (d.party && d.party.time) || "19:30";
  const idx = beijingTodayIndex();
  const day = d.days[idx] || {};
  const lines = [];
  lines.push("【逍遥引 · 燕云十六声】");
  lines.push("今天" + WD[idx] + "活动安排：");
  lines.push("");
  lines.push("🎭 每晚派对：" + partyT + " ·「燕语阁」准时集合");
  if (day.type === "pojun") {
    lines.push("🐉 破军杀将：" + (day.time || "时间待定") + (day.boss ? " · BOSS【" + day.boss + "】" : ""));
    lines.push("   到点燕语阁集合，勿迟到~");
  } else if (day.type === "yijue") {
    lines.push("🏆 一决高下：" + (day.time || "时间待定") + " · PVP竞技");
  } else if (day.type === "week") {
    lines.push("⚔ 百业侠境·周本：" + (day.time || "时间待定") + " · 组队开团");
  } else if (day.type === "weekend") {
    lines.push("⚔ 百叶本 / 百业战：" + (day.time || "全天") + " · 全员参战，燕语阁必进");
  } else {
    lines.push("🌙 今日无固定副本安排，派对照常~");
  }
  lines.push("");
  lines.push("—— 逍遥引宗门管理组");
  return lines.join("\n");
}

async function main() {
  if (!PUSH_TOKEN) throw new Error("缺少 PUSHPLUS_TOKEN");
  let sched = SC_DEFAULT;
  try {
    const r = await fetch(
      SUPABASE_URL + "/rest/v1/sect_content?id=eq.schedule&select=content",
      { headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY } }
    );
    const rows = await r.json();
    if (rows && rows[0] && rows[0].content) sched = rows[0].content;
  } catch (e) {
    console.warn("时间表读取失败，使用默认排期：", e.message);
  }

  const idx = beijingTodayIndex();
  const payload = {
    token: PUSH_TOKEN,
    title: "逍遥引 · " + WD[idx] + "活动提醒",
    content: buildText(sched),
    template: "txt",
  };
  if (PUSH_TOPIC) payload.topicId = PUSH_TOPIC;

  const res = await fetch("https://www.pushplus.plus/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const out = await res.json();
  console.log(JSON.stringify(out));
  if (out.code !== 200) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
