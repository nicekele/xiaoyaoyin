/* ============================================================
   武学门派 · 共享数据模型
   4 大类 / 11 分支 / 22 门心法
   描述文字全部来自宗门给定的原文，未作改写；
   缺失描述的分支（如「破竹·鸢」）desc 留空，渲染时自动隐藏。
   ============================================================ */
(function (global) {
    'use strict';

    var SCHOOLS = [
        {
            id: 'mingjin',
            name: '鸣金',
            en: 'MINGJIN',
            tag: '剑 · 枪',
            color: 'gold',
            branches: [
                { name: '虹', xinfa: ['无名剑法', '无名枪法'], desc: '开荒标配，耐力消耗低' },
                { name: '影', xinfa: ['积矩九剑', '九曲惊神枪'], desc: '叠流血引爆，剑枪里的输出天花板' },
            ],
        },
        {
            id: 'qiansi',
            name: '牵丝',
            en: 'QIANSI',
            tag: '远程、辅助',
            color: 'jade',
            branches: [
                { name: '霖', xinfa: ['明川药典', '千香引魂蛊'], desc: '扇和伞蛊，一个奶一个控' },
                { name: '玉', xinfa: ['青山执笔', '九重春色'], desc: '远程牵制，伞能当炮台用' },
                { name: '翊', xinfa: ['文动霓裳', '杏游草野'], desc: '比较新的那一对' },
            ],
        },
        {
            id: 'lieshi',
            name: '裂石',
            en: 'LIESHI',
            tag: '重武器、扛伤',
            color: 'red',
            branches: [
                { name: '威', xinfa: ['嗟夫刀法', '八方风雷枪'], desc: '刀法开盾，枪法嘲讽' },
                { name: '钧', xinfa: ['斩雪刀法', '十方破阵'], desc: '唐横刀配陌刀' },
            ],
        },
        {
            id: 'pozhu',
            name: '破竹',
            en: 'POZHU',
            tag: '双刀、拳、机关',
            color: 'violet',
            branches: [
                { name: '风', xinfa: ['泥犁三垢', '粟子游尘'], desc: '双刀贴身，绳镖拉扯敌人' },
                { name: '尘', xinfa: ['醉梦游春', '粟子行云'], desc: '伞和绳镖，群怪清场' },
                { name: '鸢', xinfa: ['天志垂象', '千机索天'], desc: '' },
                { name: '樽', xinfa: ['断水双诀', '悬身拳法'], desc: '醉拳加双刀，堆醉意爆发' },
            ],
        },
    ];

    /* 扁平索引：'鸣金·虹' -> 分支对象 */
    var FLAT = [];
    SCHOOLS.forEach(function (s) {
        s.branches.forEach(function (b) {
            FLAT.push({
                key: s.name + '·' + b.name,
                school: s.name,
                schoolId: s.id,
                schoolEn: s.en,
                color: s.color,
                name: b.name,
                full: s.name + '·' + b.name,
                xinfa: b.xinfa,
                desc: b.desc,
            });
        });
    });

    var BY_KEY = {};
    FLAT.forEach(function (b) { BY_KEY[b.key] = b; });

    global.YANYUN_SCHOOLS = SCHOOLS;
    global.YANYUN_BRANCHES = FLAT;
    global.YANYUN_BRANCH_BY_KEY = BY_KEY;
})(window);
