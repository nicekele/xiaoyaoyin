/* ============================================================
   百业·燕云十六声 —— 共享交互基座
   汉堡菜单 / 导航滚动 / 锚点滚动 / 滚动淡入 / Tab 切换 / 数字动画
   ============================================================ */
(function () {
    'use strict';

    var NAV_H = function () {
        var v = getComputedStyle(document.documentElement).getPropertyValue('--nav-h');
        return parseInt(v, 10) || 70;
    };

    /* ---------- 离开/关闭页面即自动退出登录 ----------
       防止忘记退号：关闭标签、刷新、跳到别的页面时清掉登录态，
       下次打开管理后台必须重新登录（含验证码）。 */
    function clearAuthStorage() {
        [window.localStorage, window.sessionStorage].forEach(function (store) {
            if (!store) return;
            try {
                Object.keys(store).forEach(function (k) {
                    if (k.indexOf('sb-') === 0 && k.indexOf('-auth-token') !== -1) {
                        store.removeItem(k);
                    }
                });
            } catch (e) { /* 隐私模式等场景忽略 */ }
        });
    }
    function initAutoLogout() {
        var fired = false;
        function hardLogout() {
            if (fired) return;
            fired = true;
            /* 先同步清本地存储：即使关页面导致网络请求被中断，登录态也已消失 */
            clearAuthStorage();
            if (window.DB && DB.client && DB.client.auth) {
                try { DB.client.auth.signOut().catch(function () {}); } catch (e) {}
            }
        }
        window.addEventListener('pagehide', hardLogout);
        window.addEventListener('beforeunload', hardLogout);
        /* 从往返缓存恢复的页面：登录态已在离开时清除，重载保持一致 */
        window.addEventListener('pageshow', function (e) {
            if (e.persisted) location.reload();
        });
    }

    /* ---------- 1. 汉堡菜单 ---------- */
    function initNavToggle() {
        var toggle = document.querySelector('.nav-toggle');
        var menu = document.querySelector('.nav-menu');
        if (!toggle || !menu) return;

        function close() {
            menu.classList.remove('is-open');
            toggle.setAttribute('aria-expanded', 'false');
        }

        toggle.addEventListener('click', function (e) {
            e.stopPropagation();
            var open = menu.classList.toggle('is-open');
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        });

        // 点击菜单项后收起
        menu.addEventListener('click', function (e) {
            if (e.target.closest('a')) close();
        });
        // 点击页面其它区域收起
        document.addEventListener('click', function (e) {
            if (!menu.contains(e.target) && !toggle.contains(e.target)) close();
        });
        // Esc 收起
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') close();
        });
        // 回到宽屏时清掉展开状态，避免菜单卡在 open
        var mq = window.matchMedia('(min-width: 1101px)');
        var onChange = function (ev) { if (ev.matches) close(); };
        mq.addEventListener ? mq.addEventListener('change', onChange) : mq.addListener(onChange);
    }

    /* ---------- 2. 导航栏滚动阴影（passive + rAF 节流） ---------- */
    function initNavScroll() {
        var nav = document.querySelector('.navbar');
        if (!nav) return;
        var ticking = false;
        function update() {
            nav.classList.toggle('is-scrolled', window.scrollY > 24);
            ticking = false;
        }
        window.addEventListener('scroll', function () {
            if (!ticking) {
                ticking = true;
                requestAnimationFrame(update);
            }
        }, { passive: true });
        update();
    }

    /* ---------- 3. 锚点平滑滚动（自动扣掉导航栏高度） ---------- */
    function initAnchorScroll() {
        document.addEventListener('click', function (e) {
            var a = e.target.closest('a[href*="#"]');
            if (!a) return;
            var href = a.getAttribute('href');
            var hash = href.indexOf('#') > -1 ? href.slice(href.indexOf('#')) : '';
            if (!hash || hash.length < 2) return;

            var id = hash.slice(1);
            var el;
            try { el = document.getElementById(id); } catch (_) { return; }
            if (!el) return;

            e.preventDefault();
            var top = el.getBoundingClientRect().top + window.scrollY - NAV_H() - 8;
            var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            window.scrollTo({ top: Math.max(0, top), behavior: reduce ? 'auto' : 'smooth' });
            history.replaceState(null, '', hash);
        });
    }

    /* ---------- 4. 滚动淡入 ---------- */
    function initReveal() {
        var items = document.querySelectorAll('.reveal');
        if (!items.length) return;

        var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        var supported = 'IntersectionObserver' in window;

        // 不支持或用户偏好减少动效 → 直接全部显示，绝不留白屏
        if (reduce || !supported) {
            items.forEach(function (el) { el.classList.add('is-in'); });
            return;
        }

        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                if (en.isIntersecting) {
                    en.target.classList.add('is-in');
                    io.unobserve(en.target);
                }
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

        items.forEach(function (el) { io.observe(el); });

        // 兜底：3 秒后仍未进入视口的元素强制显示（长页面/极端布局）
        setTimeout(function () {
            document.querySelectorAll('.reveal:not(.is-in)').forEach(function (el) {
                var r = el.getBoundingClientRect();
                if (r.top < window.innerHeight * 1.5) el.classList.add('is-in');
            });
        }, 3000);
    }

    /* ---------- 5. Tab 切换（同组互斥 + panel 显隐 + 派发事件） ----------
       用法：
         <div class="range-tabs" data-tab-group="period">
           <button class="range-tab active" data-tab="week">本周</button>
         </div>
         <div data-tab-panel="week" data-tab-group="period">…</div>
       监听：document.addEventListener('tabchange', e => { e.detail.group, e.detail.tab })
    ------------------------------------------------------------------ */
    function initTabs() {
        var groups = document.querySelectorAll('[data-tab-group]');
        groups.forEach(function (group) {
            var name = group.getAttribute('data-tab-group');
            var btns = group.querySelectorAll('[data-tab]');
            if (!btns.length) return;

            btns.forEach(function (btn) {
                btn.addEventListener('click', function () {
                    var tab = btn.getAttribute('data-tab');
                    btns.forEach(function (b) { b.classList.remove('active'); });
                    btn.classList.add('active');
                    btn.setAttribute('aria-selected', 'true');
                    btns.forEach(function (b) { if (b !== btn) b.setAttribute('aria-selected', 'false'); });

                    // 切换同组 panel（若存在）
                    document.querySelectorAll('[data-tab-panel][data-tab-group="' + name + '"]')
                        .forEach(function (p) {
                            p.hidden = p.getAttribute('data-tab-panel') !== tab;
                        });

                    document.dispatchEvent(new CustomEvent('tabchange', {
                        detail: { group: name, tab: tab, label: btn.textContent.trim() }
                    }));
                });
                btn.setAttribute('role', 'tab');
                btn.setAttribute('aria-selected', btn.classList.contains('active') ? 'true' : 'false');
            });
        });
    }

    /* ---------- 6. 数字递增动画 ---------- */
    function animateCount(el) {
        var raw = el.getAttribute('data-count');
        if (raw === null) return;
        var target = parseFloat(raw);
        if (isNaN(target)) return;

        var decimals = (raw.split('.')[1] || '').length;
        var prefix = el.getAttribute('data-count-prefix') || '';
        var suffix = el.getAttribute('data-count-suffix') || '';

        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            el.textContent = prefix + target.toLocaleString('en-US', {
                minimumFractionDigits: decimals, maximumFractionDigits: decimals
            }) + suffix;
            return;
        }

        var dur = 1100;
        var start = performance.now();
        function frame(now) {
            // 期间 data-count 被业务代码改过（切 Tab / 换范围）→ 立刻让位，
            // 否则旧动画会把刚写入的新值一路覆盖回去
            if (el.getAttribute('data-count') !== raw) return;
            var p = Math.min(1, (now - start) / dur);
            // easeOutCubic
            var e = 1 - Math.pow(1 - p, 3);
            var cur = target * e;
            el.textContent = prefix + cur.toLocaleString('en-US', {
                minimumFractionDigits: decimals, maximumFractionDigits: decimals
            }) + suffix;
            if (p < 1) requestAnimationFrame(frame);
            else el.textContent = prefix + target.toLocaleString('en-US', {
                minimumFractionDigits: decimals, maximumFractionDigits: decimals
            }) + suffix;
        }
        requestAnimationFrame(frame);
    }

    function initCounters() {
        var els = document.querySelectorAll('[data-count]');
        if (!els.length) return;
        if (!('IntersectionObserver' in window) ||
            window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            els.forEach(animateCount);
            return;
        }
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                if (en.isIntersecting) {
                    animateCount(en.target);
                    io.unobserve(en.target);
                }
            });
        }, { threshold: 0.4 });
        els.forEach(function (el) { io.observe(el); });
    }

    /* ---------- 7. 右侧锚点导航（参照官方专题页） ---------- */
    function initAnchorNav() {
        var nav = document.querySelector('.anchor-nav');
        if (!nav) return;
        document.documentElement.classList.add('has-anchor-nav');

        var links = [].slice.call(nav.querySelectorAll('a[href*="#"]'));
        var targets = links.map(function (a) {
            var id = (a.getAttribute('href') || '').split('#')[1];
            return id ? document.getElementById(id) : null;
        });

        function setOn(y) {
            nav.classList.toggle('is-on', y > 240);
        }
        var ticking = false;
        window.addEventListener('scroll', function () {
            if (!ticking) {
                ticking = true;
                requestAnimationFrame(function () { setOn(window.scrollY); ticking = false; });
            }
        }, { passive: true });
        setOn(window.scrollY);

        if (!('IntersectionObserver' in window)) return;

        // 视口中线附近的分区视为当前项
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                if (!en.isIntersecting) return;
                var id = en.target.id;
                links.forEach(function (a) {
                    a.classList.toggle('is-active',
                        (a.getAttribute('href') || '').split('#')[1] === id);
                });
            });
        }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });

        targets.forEach(function (t) { if (t) io.observe(t); });
    }

    /* ---------- 8. 返回顶部（各页自动注入，无需改各页 HTML） ---------- */
    function initToTop() {
        if (document.querySelector('.to-top')) return;
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'to-top';
        btn.setAttribute('aria-label', '返回顶部');
        document.body.appendChild(btn);

        var ticking = false;
        function update() {
            btn.classList.toggle('is-on', window.scrollY > 480);
            ticking = false;
        }
        window.addEventListener('scroll', function () {
            if (!ticking) { ticking = true; requestAnimationFrame(update); }
        }, { passive: true });
        update();

        btn.addEventListener('click', function () {
            var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
        });
    }

    /* ---------- 启动 ---------- */
    function boot() {
        initNavToggle();
        initNavScroll();
        initAnchorScroll();
        initReveal();
        initTabs();
        initCounters();
        initAnchorNav();
        initToTop();
        initAutoLogout();
        document.documentElement.classList.add('ready');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
