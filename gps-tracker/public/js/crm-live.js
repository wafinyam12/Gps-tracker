(function () {
    'use strict';

    const script = document.currentScript;
    const root = document.querySelector('[data-crm-live-root]');
    if (!script || !root) return;

    let appliedVersion = null;
    let lastPageFetchAt = 0;
    let busy = false;

    function status(message) {
        const label = root.querySelector('[data-crm-live-status]');
        if (label) label.textContent = message;
    }

    function hasUnsavedInput() {
        return Boolean(root.querySelector('form[data-crm-dirty="true"]'));
    }

    document.addEventListener('input', function (event) {
        const form = event.target.closest('[data-crm-live-root] form');
        if (form) form.dataset.crmDirty = 'true';
    });
    document.addEventListener('change', function (event) {
        const form = event.target.closest('[data-crm-live-root] form');
        if (form) form.dataset.crmDirty = 'true';
    });
    document.addEventListener('click', function (event) {
        if (event.target.closest('[data-photo-point]')) {
            const form = root.querySelector('[data-coordinate-form]');
            if (form) form.dataset.crmDirty = 'true';
        }
    });

    async function checkForChanges() {
        if (busy || document.hidden) return;
        busy = true;

        try {
            const versionResponse = await fetch(script.dataset.versionUrl, {
                credentials: 'same-origin',
                cache: 'no-store',
                headers: { Accept: 'application/json' },
            });
            if (!versionResponse.ok) throw new Error('version');
            const { version } = await versionResponse.json();
            if (!version || (version === appliedVersion && Date.now() - lastPageFetchAt < 120000)) return;
            if (hasUnsavedInput()) {
                status('Data baru tersedia; selesaikan perubahan formulir Anda');
                return;
            }

            const pageResponse = await fetch(window.location.pathname + window.location.search, {
                credentials: 'same-origin',
                cache: 'no-store',
                headers: { Accept: 'text/html' },
            });
            if (!pageResponse.ok) throw new Error('page');
            lastPageFetchAt = Date.now();
            const page = new DOMParser().parseFromString(await pageResponse.text(), 'text/html');
            const freshRoot = page.querySelector('[data-crm-live-root]');
            if (!freshRoot) throw new Error('session');

            const activeTab = root.querySelector('[data-crm-tab].is-active')?.dataset.crmTab;
            const openVisitIds = new Set(Array.from(root.querySelectorAll('details[data-visit-id][open]'))
                .map((detail) => detail.dataset.visitId));
            const scrollX = window.scrollX;
            const scrollY = window.scrollY;

            root.innerHTML = freshRoot.innerHTML;
            root.querySelectorAll('details[data-visit-id]').forEach((detail) => {
                detail.open = openVisitIds.has(detail.dataset.visitId);
            });
            if (activeTab && typeof window.crmActivateTab === 'function') {
                window.crmActivateTab(activeTab);
            }
            window.requestAnimationFrame(() => window.scrollTo(scrollX, scrollY));
            appliedVersion = version;
            status('Data terbaru · ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
        } catch (error) {
            status(error.message === 'session'
                ? 'Sesi berakhir; silakan masuk kembali'
                : 'Koneksi terputus; mencoba lagi otomatis');
        } finally {
            busy = false;
        }
    }

    checkForChanges();
    const interval = window.setInterval(checkForChanges, 20000);
    document.addEventListener('visibilitychange', function () {
        if (!document.hidden) checkForChanges();
    });
    window.addEventListener('pagehide', () => window.clearInterval(interval), { once: true });
})();
