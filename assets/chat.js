/* ============================================================
   在线客服（首页页脚「客服中心」打开）
   - 关键词自动回复；活动相关问题实时读取时间表
   - 访客匿名，用 localStorage 里的随机 ID 标识
   - 聊天记录写入 Supabase chat_logs，管理后台「客服记录」可回看
   ============================================================ */
(function (global) {
    'use strict';

    var visitorId = null;
    try {
        visitorId = localStorage.getItem('xy_visitor_id');
        if (!visitorId) {
            visitorId = 'v_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
            localStorage.setItem('xy_visitor_id', visitorId);
        }
    } catch (e) {
        visitorId = 'v_anon';
    }

    /* ---------- 样式 ---------- */
    var CSS = [
        '.chat-fab{position:fixed;right:22px;bottom:22px;z-index:1300;width:52px;height:52px;border-radius:50%;',
        'background:linear-gradient(180deg,#c9a961,#a68a4a);color:#1a140a;border:none;cursor:pointer;',
        'font-size:22px;box-shadow:0 8px 24px rgba(0,0,0,.45);display:none;align-items:center;justify-content:center;}',
        '.chat-fab:hover{filter:brightness(1.08);}',
        '.chat-win{position:fixed;right:22px;bottom:86px;z-index:1301;width:min(360px,calc(100vw - 32px));',
        'height:min(480px,calc(100vh - 130px));display:none;flex-direction:column;',
        'background:#121014;border:1px solid rgba(201,169,97,.45);border-radius:12px;overflow:hidden;',
        'box-shadow:0 20px 60px rgba(0,0,0,.6);}',
        '.chat-win.is-open{display:flex;}',
        '.chat-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;',
        'background:linear-gradient(180deg,#1b1812,#14110c);border-bottom:1px solid rgba(201,169,97,.25);}',
        '.chat-head .t{color:#f0e6cf;font-size:14px;letter-spacing:2px;font-weight:600;}',
        '.chat-head .s{color:#8f8877;font-size:11px;margin-top:2px;}',
        '.chat-close{background:none;border:none;color:#8f8877;font-size:20px;cursor:pointer;padding:0 4px;}',
        '.chat-close:hover{color:var(--gold,#c9a961);}',
        '.chat-msgs{flex:1;overflow-y:auto;padding:14px 12px;display:flex;flex-direction:column;gap:10px;}',
        '.cm{max-width:82%;padding:9px 12px;border-radius:10px;font-size:13px;line-height:1.65;',
        'letter-spacing:.5px;white-space:pre-wrap;word-break:break-word;}',
        '.cm.user{align-self:flex-end;background:#3a2f18;color:#f0e6cf;border:1px solid rgba(201,169,97,.35);}',
        '.cm.bot{align-self:flex-start;background:#1c1a20;color:#d8d2c4;border:1px solid rgba(255,255,255,.08);}',
        '.cm.bot a{color:#c9a961;}',
        '.chat-quick{display:flex;flex-wrap:wrap;gap:6px;padding:0 12px 8px;}',
        '.chat-quick button{background:none;border:1px solid rgba(201,169,97,.35);color:#c9a961;',
        'font-size:12px;padding:4px 10px;border-radius:999px;cursor:pointer;letter-spacing:1px;}',
        '.chat-quick button:hover{background:rgba(201,169,97,.12);}',
        '.chat-input{display:flex;gap:8px;padding:10px 12px;border-top:1px solid rgba(201,169,97,.2);background:#0e0c10;}',
        '.chat-input input{flex:1;background:#17151c;border:1px solid rgba(201,169,97,.3);color:#ece6d6;',
        'padding:9px 12px;border-radius:8px;font-size:13px;outline:none;}',
        '.chat-input input:focus{border-color:rgba(201,169,97,.6);}',
        '.chat-input button{background:#c9a961;color:#1a140a;border:none;border-radius:8px;padding:0 16px;',
        'font-size:13px;font-weight:700;cursor:pointer;letter-spacing:1px;}',
    ].join('');

    /* ---------- DOM ---------- */
    function el(tag, cls, html) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (html != null) n.innerHTML = html;
        return n;
    }

    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var fab = el('button', 'chat-fab', '💬');
    fab.title = '客服中心';
    fab.setAttribute('aria-label', '打开客服');
    document.body.appendChild(fab);

    var win = el('div', 'chat-win');
    win.innerHTML =
        '<div class="chat-head">' +
        '<div><div class="t">逍遥引 · 在线客服</div><div class="s">自动回复 · 无法解答请联系社主</div></div>' +
        '<button class="chat-close" aria-label="关闭">&times;</button>' +
        '</div>' +
        '<div class="chat-msgs"></div>' +
        '<div class="chat-quick">' +
        '<button type="button" data-q="怎么加入宗门？">怎么入宗</button>' +
        '<button type="button" data-q="今天有什么活动？">今日活动</button>' +
        '<button type="button" data-q="社主微信多少？">联系社主</button>' +
        '<button type="button" data-q="有什么奖励？">奖励机制</button>' +
        '</div>' +
        '<div class="chat-input">' +
        '<input type="text" placeholder="输入问题，如：怎么入宗" maxlength="200">' +
        '<button type="button">发送</button>' +
        '</div>';
    document.body.appendChild(win);

    var msgs = win.querySelector('.chat-msgs');
    var input = win.querySelector('.chat-input input');
    var sendBtn = win.querySelector('.chat-input button');

    /* ---------- 记录入库（失败不阻断对话） ---------- */
    function saveLog(role, text) {
        if (!global.DB) return;
        global.DB.client.from('chat_logs').insert({
            visitor_id: visitorId,
            role: role,
            message: String(text).slice(0, 1000),
        }).then(function () { /* 静默 */ }).catch(function () { /* 静默 */ });
    }

    /* ---------- 本地历史（游客自己这台设备可见） ---------- */
    var localKey = 'xy_chat_hist';
    function loadHist() {
        try { return JSON.parse(localStorage.getItem(localKey) || '[]'); } catch (e) { return []; }
    }
    function pushHist(role, text) {
        var h = loadHist();
        h.push({ role: role, text: text });
        if (h.length > 60) h = h.slice(-60);
        try { localStorage.setItem(localKey, JSON.stringify(h)); } catch (e) {}
    }

    function addMsg(role, text, save) {
        var n = el('div', 'cm ' + role);
        n.textContent = text;
        msgs.appendChild(n);
        msgs.scrollTop = msgs.scrollHeight;
        if (save !== false) {
            pushHist(role, text);
            saveLog(role, text);
        }
        return n;
    }

    /* ---------- 时间表助手 ---------- */
    var WD = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    var SCHED_FALLBACK = null; // index.html 里若有 SCHED_DEFAULT 可复用
    function todayIndex() { return (new Date().getDay() + 6) % 7; }

    function getSchedule() {
        var local = (global.SCHED_DEFAULT && global.SCHED_DEFAULT.days) ? global.SCHED_DEFAULT : null;
        if (!global.DB) return Promise.resolve(local);
        return global.DB.listSect().then(function (rows) {
            var row = (rows || []).find(function (r) { return r.id === 'schedule'; });
            return (row && row.content && row.content.days) ? row.content : local;
        }).catch(function () { return local; });
    }

    function dayLine(sched) {
        if (!sched) return '今天的活动安排请关注群通知~';
        var d = sched.days[todayIndex()] || {};
        var party = (sched.party && sched.party.time) || '19:30';
        var lines = ['🎭 每晚派对：' + party + ' ·「燕语阁」'];
        if (d.type === 'pojun') {
            lines.push('🐉 破军杀将：' + (d.time || '待定') + (d.boss ? '，BOSS【' + d.boss + '】' : ''));
        } else if (d.type === 'yijue') {
            lines.push('🏆 一决高下：' + (d.time || '待定'));
        } else if (d.type === 'week') {
            lines.push('⚔ 百业侠境·周本：' + (d.time || '待定'));
        } else if (d.type === 'weekend') {
            lines.push('⚔ 百叶本 / 百业战：' + (d.time || '全天'));
        } else {
            lines.push('🌙 今日无固定副本安排');
        }
        return lines.join('\n');
    }

    /* ---------- 关键词回复 ---------- */
    var RULES = [
        {
            keys: ['入群', '加入', '怎么进', '入宗', '申请', '门槛', '规矩', '改名', '格式', '招收'],
            reply: function () {
                return '入宗流程：\n1. 游戏名改成：游戏名➕武学➕本职心法\n   示例：李逍遥·鸣金·虹·无名心法\n2. 联系社主微信安排入宗（页脚「联系社主」可扫码）';
            },
        },
        {
            keys: ['破军', 'boss', '无相', '讨伐', '杀将'],
            reply: function (s) {
                var d = s && s.days ? s.days[todayIndex()] : null;
                if (d && d.type === 'pojun') {
                    return '今天有破军杀将：' + (d.time || '时间待定') + (d.boss ? '\nBOSS：【' + d.boss + '】' : '') + '\n到点燕语阁集合~';
                }
                var found = null;
                if (s && s.days) {
                    for (var i = 0; i < 7; i++) {
                        if (s.days[i] && s.days[i].type === 'pojun') {
                            found = (found || '') + WD[i] + ' ' + (s.days[i].time || '') + (s.days[i].boss ? '（' + s.days[i].boss + '）' : '') + '\n';
                        }
                    }
                }
                return found ? '本周破军杀将安排：\n' + found : '本周破军安排请留意群通知或首页时间表~';
            },
        },
        {
            keys: ['派对', '燕语阁'],
            reply: function (s) {
                var t = (s && s.party && s.party.time) || '19:30';
                return '每晚 ' + t + ' 燕语阁派对，宗门成员准时进入，交流互动增进情谊~';
            },
        },
        {
            keys: ['活动', '时间', '几点', '安排', '日程', '今天', '本周', '周末'],
            reply: function (s) {
                return '今天是' + WD[todayIndex()] + '：\n' + dayLine(s) + '\n完整安排见官网首页「活动时间表」。';
            },
        },
        {
            keys: ['周本', '侠境', '打本', '副本'],
            reply: function () {
                return '百业侠境·周本通常在周一 19:30 组队开团，每周一人最多 5 次，未赶上的可以找社主安排补车。';
            },
        },
        {
            keys: ['一决', 'pvp', '竞技', '对决'],
            reply: function (s) {
                var out = [];
                if (s && s.days) {
                    s.days.forEach(function (d, i) {
                        if (d.type === 'yijue') out.push(WD[i] + ' ' + (d.time || ''));
                    });
                }
                return out.length ? '一决高下周程：\n' + out.join('\n') : '一决高下安排见首页时间表，一般是 PVP 竞技对决~';
            },
        },
        {
            keys: ['奖励', '抽奖', '月卡', '红包', '福利', '活跃'],
            reply: function () {
                return '周奖励：周活 3000+ 可得 6 元红包（每周 5 份），周活 5000+ 可得 30 元月卡（每周 3 份）。\n月奖励：月活 20000+ 抽 128（2 份），24000+ 抽 258（1 份）。\n同类奖品每周/月不重复，由管理在后台自动抽奖。';
            },
        },
        {
            keys: ['社主', '微信', '客服', '联系', '加好友', '二维码'],
            reply: function () {
                return '社主微信：Mike_G-u\n也可点页脚「联系社主」扫码添加，备注：游戏名➕武学➕本职心法';
            },
        },
        {
            keys: ['成员', '名录', '名单', '有人', '多少人'],
            reply: function () {
                return '宗门成员名录在官网「成员管理」页面，数据实时同步；游戏ID出于隐私默认打码，完整ID仅管理可见。';
            },
        },
        {
            keys: ['你好', '您好', '在吗', 'hi', 'hello', '哈喽', '嗨'],
            reply: function () {
                return '你好，我是逍遥引智能客服~\n可以问我：怎么入宗 / 今天活动 / 破军BOSS / 奖励机制 / 社主微信';
            },
        },
        {
            keys: ['官网', '网址', '网站', '页面'],
            reply: function () {
                return '官网：https://nicekele.github.io/xiaoyaoyin/\n首页有世界介绍、时间表、成员名录与宗门法规。';
            },
        },
    ];

    var FALLBACK = '这个问题我记下了，智能客服还不太懂~\n你可以换个问法，或直接点首页页脚「联系社主」加微信人工咨询。';

    /* ---------- AI 问答（Supabase Edge Function → DeepSeek）失败时回退关键词 ---------- */
    function botReply(text) {
        var t = (text || '').toLowerCase();
        for (var i = 0; i < RULES.length; i++) {
            for (var j = 0; j < RULES[i].keys.length; j++) {
                if (t.indexOf(RULES[i].keys[j]) !== -1) return RULES[i];
            }
        }
        return null;
    }

    function aiReply(text, sched) {
        var cfg = global.APP_CONFIG || {};
        if (!cfg.SUPABASE_URL || !cfg.SUPABASE_KEY) return Promise.resolve(null);
        if (typeof AbortController === 'undefined') return Promise.resolve(null);
        var ctrl = new AbortController();
        var timer = setTimeout(function () { ctrl.abort(); }, 15000);
        return fetch(cfg.SUPABASE_URL + '/functions/v1/ai-chat', {
            method: 'POST',
            signal: ctrl.signal,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + cfg.SUPABASE_KEY,
                'apikey': cfg.SUPABASE_KEY,
            },
            body: JSON.stringify({
                message: text,
                today: WD[todayIndex()],
                schedule: sched || null,
            }),
        }).then(function (r) { return r.json(); }).then(function (j) {
            clearTimeout(timer);
            return (j && j.reply) ? j.reply : null;
        }).catch(function () {
            clearTimeout(timer);
            return null;
        });
    }

    function ruleReply(text, sched) {
        var rule = botReply(text);
        if (!rule) return FALLBACK;
        if (['破军', '派对', '活动', '一决'].indexOf(rule.keys[0]) !== -1) {
            return rule.reply(sched);
        }
        return rule.reply();
    }

    function reply(text) {
        var typing = addMsg('bot', '正在输入…', false);
        getSchedule().then(function (sched) {
            return aiReply(text, sched).then(function (ai) {
                typing.remove();
                if (ai) { addMsg('bot', ai); return; }
                addMsg('bot', ruleReply(text, sched));
            });
        }).catch(function () {
            typing.remove();
            addMsg('bot', ruleReply(text, null));
        });
    }

    function send(text) {
        text = (text || '').trim();
        if (!text) return;
        addMsg('user', text);
        input.value = '';
        reply(text);
    }

    sendBtn.addEventListener('click', function () { send(input.value); });
    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') send(input.value);
    });
    win.querySelector('.chat-quick').addEventListener('click', function (e) {
        var b = e.target.closest('[data-q]');
        if (b) send(b.getAttribute('data-q'));
    });

    function openChat() {
        win.classList.add('is-open');
        fab.style.display = 'none';
        if (!msgs.children.length) {
            addMsg('bot', '你好，我是逍遥引在线客服（自动回复）。\n入宗、活动、奖励、社主联系方式都可以问我~');
        }
        input.focus();
    }
    function closeChat() {
        win.classList.remove('is-open');
        fab.style.display = 'flex';
    }
    fab.addEventListener('click', openChat);
    win.querySelector('.chat-close').addEventListener('click', closeChat);

    /* 页脚「客服中心」入口：存在则用页脚；否则悬浮球常驻 */
    var footLink = null;
    var links = document.querySelectorAll('footer a');
    for (var i = 0; i < links.length; i++) {
        if ((links[i].textContent || '').indexOf('客服中心') !== -1) { footLink = links[i]; break; }
    }
    if (footLink) {
        footLink.setAttribute('href', 'javascript:void(0)');
        footLink.addEventListener('click', function (e) { e.preventDefault(); openChat(); });
    }
    /* 悬浮球：滚过首屏后出现，方便路人随时点 */
    var shown = false;
    window.addEventListener('scroll', function () {
        if (!shown && window.scrollY > 400) { fab.style.display = 'flex'; shown = true; }
    }, { passive: true });

    global.XYChat = { open: openChat, close: closeChat };
})(window);
