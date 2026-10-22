/* ============================================================
   Supabase 数据访问层（全站唯一数据入口）
   页面通过 window.DB 读写数据，保证五个页面永远读写同一份数据，
   杜绝「一个地方改了别处没变」的分叉问题。
   ============================================================ */
(function (global) {
    'use strict';

    var cfg = global.APP_CONFIG;
    if (!cfg || !global.supabase) {
        console.warn('[db] Supabase 未初始化：请先加载 vendor/supabase.min.js 与 config.js');
        global.DB = null;
        return;
    }

    var client = global.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY);

    function throwIf(error, action) {
        if (error) {
            console.error('[db]', action, error.message || error);
            var e = new Error(error.message || String(error));
            e.code = error.code;
            e.status = error.status;
            throw e;
        }
    }

    var DB = {
        client: client,
        auth: client.auth,

        /* ---------- 会话 ---------- */
        session: function () {
            return client.auth.getSession().then(function (r) { return r.data.session; });
        },
        user: function () {
            return client.auth.getUser().then(function (r) { return r.data.user || null; });
        },

        /* ---------- 认证 ---------- */
        signIn: function (email, password) {
            return client.auth.signInWithPassword({ email: email, password: password })
                .then(function (r) { throwIf(r.error, '登录'); return r.data; });
        },
        signUp: function (email, password, username, extraMeta) {
            var data = { username: username || email };
            if (extraMeta) {
                Object.keys(extraMeta).forEach(function (k) { data[k] = extraMeta[k]; });
            }
            return client.auth.signUp({
                email: email,
                password: password,
                options: { data: data },
            }).then(function (r) { throwIf(r.error, '注册'); return r.data; });
        },
        signOut: function () {
            return client.auth.signOut().then(function (r) { throwIf(r.error, '退出'); return true; });
        },
        /* 发送密码重置邮件（链接跳回本后台页） */
        resetPassword: function (email) {
            var redirect = location.href.split('#')[0];
            return client.auth.resetPasswordForEmail(email, { redirectTo: redirect })
                .then(function (r) { throwIf(r.error, '发送重置邮件'); return true; });
        },
        /* 在重置会话中设置新密码 */
        updatePassword: function (password) {
            return client.auth.updateUser({ password: password })
                .then(function (r) { throwIf(r.error, '重置密码'); return r.data; });
        },

        /* 当前用户档案（含 role）；未登录返回 null */
        me: function () {
            return DB.user().then(function (u) {
                if (!u) return null;
                return client.from('profiles')
                    .select('id,username,role')
                    .eq('id', u.id)
                    .maybeSingle()
                    .then(function (r) {
                        throwIf(r.error, '读取档案');
                        return r.data || { id: u.id, role: 'member' };
                    });
            });
        },
        /* 是否管理员（管理员才能注册他人、增删成员、发布内容） */
        isAdmin: function () {
            return DB.me().then(function (p) { return !!p && p.role === 'admin'; });
        },

        /* ---------- 成员 ---------- */
        listMembers: function () {
            return client.from('members')
                .select('*')
                .order('id', { ascending: true })
                .then(function (r) { throwIf(r.error, '读取成员'); return r.data || []; });
        },
        addMember: function (row) {
            return client.from('members').insert(row).select().single()
                .then(function (r) { throwIf(r.error, '新增成员'); return r.data; });
        },
        updateMember: function (id, patch) {
            return client.from('members').update(patch).eq('id', id).select().single()
                .then(function (r) { throwIf(r.error, '更新成员'); return r.data; });
        },
        deleteMember: function (id) {
            return client.from('members').delete().eq('id', id)
                .then(function (r) { throwIf(r.error, '删除成员'); return true; });
        },

        /* ---------- 新闻 / 公告 / 活动 ---------- */
        listPosts: function () {
            return client.from('posts')
                .select('*')
                .order('id', { ascending: false })
                .then(function (r) { throwIf(r.error, '读取公告'); return r.data || []; });
        },
        addPost: function (row) {
            return client.from('posts').insert(row).select().single()
                .then(function (r) { throwIf(r.error, '发布公告'); return r.data; });
        },
        deletePost: function (id) {
            return client.from('posts').delete().eq('id', id)
                .then(function (r) { throwIf(r.error, '删除公告'); return true; });
        },

        /* ---------- 宗门规矩 / 时间表 / 奖励 ---------- */
        listSect: function () {
            return client.from('sect_content')
                .select('*')
                .order('id', { ascending: true })
                .then(function (r) { throwIf(r.error, '读取宗门内容'); return r.data || []; });
        },
        saveSect: function (rows) {
            return client.from('sect_content')
                .upsert(rows, { onConflict: 'id' })
                .then(function (r) { throwIf(r.error, '保存宗门内容'); return true; });
        },

        /* ---------- 抽奖记录（仅管理员，受 RLS 保护） ---------- */
        listLotteryWins: function (weekKey) {
            var q = client.from('lottery_wins').select('*').order('id', { ascending: false });
            if (weekKey) q = q.eq('week_key', weekKey);
            return q.then(function (r) { throwIf(r.error, '读取抽奖记录'); return r.data || []; });
        },
        addLotteryWin: function (row) {
            return client.from('lottery_wins').insert(row).select().single()
                .then(function (r) { throwIf(r.error, '记录抽奖结果'); return r.data; });
        },
        deleteLotteryWin: function (id) {
            return client.from('lottery_wins').delete().eq('id', id)
                .then(function (r) { throwIf(r.error, '撤销抽奖记录'); return true; });
        },
    };

    global.DB = DB;
})(window);
