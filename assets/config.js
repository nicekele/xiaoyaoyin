/* ============================================================
   站点配置
   SUPABASE_KEY 使用 publishable key（可公开，写入网页属正常做法），
   数据安全由数据库端的 RLS 权限策略保护。
   绝对不要把 sb_secret_ 开头的 service key 放进任何前端文件。
   ============================================================ */
window.APP_CONFIG = {
    SUPABASE_URL: "https://mliezotascinddwtzenj.supabase.co",
    SUPABASE_KEY: "sb_publishable_VoedQoI7GYOhUXdb2SMGLQ_9zT0Vnm4",
    /* PushPlus 微信推送 token（管理后台「微信推送」使用） */
    PUSHPLUS_TOKEN: "541bcf96416a41a08e94c7f7e0892d54",
};
