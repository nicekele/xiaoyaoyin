/* ============================================================
   自绘图形验证码（纯前端，无外部依赖）
   用法：
     SimpleCaptcha.render(canvasEl)            → 生成并绘制，返回 4 位码（存在 canvas.dataset.code）
     SimpleCaptcha.verify(canvasEl, input)     → 比对输入，大小写不敏感；不匹配返回 false
   点击画布可刷新。仅用于后台登录/注册的轻量防机器人，非高安全场景。
   ============================================================ */
(function (global) {
    'use strict';
    /* 去掉易混淆字符：0/O、1/I/L */
    var CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    function rand(n) { return Math.floor(Math.random() * n); }
    function makeCode(len) {
        var s = '';
        for (var i = 0; i < len; i++) s += CHARS[rand(CHARS.length)];
        return s;
    }

    function render(canvas) {
        if (!canvas || !canvas.getContext) return null;
        var code = makeCode(4);
        var ctx = canvas.getContext('2d');
        var w = canvas.width, h = canvas.height;

        ctx.fillStyle = '#14120f';
        ctx.fillRect(0, 0, w, h);

        for (var i = 0; i < 50; i++) {
            ctx.fillStyle = 'rgba(' + (140 + rand(100)) + ',' + (110 + rand(90)) + ',' + (50 + rand(70)) + ',0.22)';
            ctx.fillRect(rand(w), rand(h), 1.6, 1.6);
        }
        for (var j = 0; j < 4; j++) {
            ctx.strokeStyle = 'rgba(201,169,97,' + (0.12 + Math.random() * 0.28).toFixed(2) + ')';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(rand(w), rand(h));
            ctx.quadraticCurveTo(rand(w), rand(h), rand(w), rand(h));
            ctx.stroke();
        }
        var palette = ['#e8d5a3', '#c9a961', '#f0e0b0', '#d4b876', '#b89a55'];
        for (var k = 0; k < code.length; k++) {
            ctx.save();
            ctx.font = 'bold ' + (20 + rand(7)) + 'px Georgia, "Times New Roman", serif';
            ctx.fillStyle = palette[rand(palette.length)];
            ctx.translate(12 + k * 25, 27 + rand(8) - 4);
            ctx.rotate((rand(36) - 18) * Math.PI / 180);
            ctx.fillText(code[k], 0, 0);
            ctx.restore();
        }
        canvas.dataset.code = code;
        return code;
    }

    function verify(canvas, input) {
        if (!canvas || !canvas.dataset.code) {
            render(canvas);
            return false;
        }
        return String(input || '').trim().toUpperCase() === canvas.dataset.code;
    }

    global.SimpleCaptcha = { render: render, verify: verify };
})(window);
