// Giao diện bổ sung cho kiến trúc SOA: thông báo (qua Event Bus) và trạng thái hệ thống (Registry + Event Bus).
(function () {
    const escapeHtml = (s) => String(s === null || s === undefined ? '' : s)
        .replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    const originalShow = window.showSection;
    window.showSection = function (id) {
        originalShow(id);
        if (id === 'notifications') loadNotifications();
        if (id === 'system') loadSystem();
    };

    async function loadNotifications() {
        const box = document.getElementById('notificationList');
        const res = await authFetch('/api/notifications');
        if (!res) return;
        const json = await res.json().catch(() => ({}));
        if (!res.ok) { box.innerHTML = `<p>${escapeHtml(json.message || 'Không tải được thông báo')}</p>`; return; }
        updateBadge(json.unread);
        if (!json.data.length) { box.innerHTML = '<p>Chưa có thông báo nào.</p>'; return; }
        box.innerHTML = json.data.map((n) => `
            <div class="notif-item ${n.is_read ? '' : 'unread'}" onclick="markNotificationRead(${Number(n.id)})">
                <strong>${escapeHtml(n.title)}</strong>
                ${escapeHtml(n.message)}<br>
                <small>${escapeHtml(String(n.created_at || '').replace('T', ' ').substring(0, 19))}</small>
            </div>`).join('');
    }

    async function markNotificationRead(id) {
        const res = await authFetch(`/api/notifications/${id}/read`, { method: 'PUT' });
        if (res && res.ok) loadNotifications();
    }

    function updateBadge(n) {
        const el = document.getElementById('notifBadge');
        if (!el) return;
        el.textContent = n;
        el.style.display = n > 0 ? 'inline-block' : 'none';
    }

    async function pollBadge() {
        if (!localStorage.getItem('token')) return updateBadge(0);
        try {
            const res = await fetch('/api/notifications', { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } });
            if (res.ok) updateBadge((await res.json()).unread);
        } catch { /* bỏ qua */ }
    }

    async function loadSystem() {
        const box = document.getElementById('systemBox');
        const [sys, dash] = await Promise.all([authFetch('/api/system/services'), authFetch('/api/dashboard')]);
        if (!sys || !dash) return;
        const s = (await sys.json().catch(() => ({}))).data;
        const d = (await dash.json().catch(() => ({}))).data;
        if (!s) { box.innerHTML = '<p>Không lấy được trạng thái hệ thống.</p>'; return; }

        const val = (v) => (v === null || v === undefined ? '—' : v);
        let html = '<div class="soa-cards">';
        if (d) {
            html += `<div class="soa-card"><b>${val(d.students)}</b>Sinh viên</div>
                     <div class="soa-card"><b>${val(d.topics)}</b>Đề tài</div>
                     <div class="soa-card"><b>${val(d.registrations)}</b>Đăng ký</div>`;
            for (const [k, v] of Object.entries(d.registrationsByStatus || {})) {
                html += `<div class="soa-card"><b>${v}</b>${escapeHtml(k)}</div>`;
            }
        }
        html += '</div>';
        if (d && d.degraded && d.degraded.length) {
            html += `<p class="status-bad">Đang suy giảm: ${escapeHtml(d.degraded.join(', '))} không phản hồi (hệ thống vẫn chạy phần còn lại).</p>`;
        }

        html += `<h3>Service Registry: <span class="${s.registry === 'UP' ? 'status-up' : 'status-bad'}">${escapeHtml(s.registry)}</span></h3>
                 <table><thead><tr><th>Dịch vụ</th><th>Địa chỉ</th><th>Phiên bản</th><th>Trạng thái</th><th>Heartbeat gần nhất</th></tr></thead><tbody>`;
        const names = Object.keys(s.services).sort();
        if (!names.length) html += '<tr><td colspan="5">Chưa có dịch vụ nào đăng ký</td></tr>';
        for (const name of names) {
            for (const i of s.services[name]) {
                html += `<tr><td>${escapeHtml(name)}</td><td>${escapeHtml(i.url)}</td><td>${escapeHtml(i.version)}</td>
                         <td class="${i.status === 'UP' ? 'status-up' : 'status-bad'}">${escapeHtml(i.status)}</td>
                         <td>${Math.round(i.lastHeartbeatAgoMs / 1000)}s trước</td></tr>`;
            }
        }
        html += '</tbody></table>';

        const b = s.eventBus;
        html += '<h3>Event Bus</h3>';
        if (!b) {
            html += '<p class="status-bad">Event Bus không phản hồi – sự kiện được giữ trong hàng đợi của từng dịch vụ và sẽ tự gửi lại.</p>';
        } else {
            html += `<div class="soa-cards">
                <div class="soa-card"><b>${b.delivered}</b>Đã giao</div>
                <div class="soa-card"><b>${b.pending}</b>Đang chờ giao</div>
                <div class="soa-card"><b>${b.deadLetters}</b>Dead-letter</div></div>
                <table><thead><tr><th>Subscriber</th><th>Chủ đề đăng ký</th></tr></thead><tbody>` +
                Object.entries(b.subscribers).map(([n, v]) => `<tr><td>${escapeHtml(n)}</td><td>${escapeHtml(v.topics.join(', '))}</td></tr>`).join('') +
                '</tbody></table>';
        }
        box.innerHTML = html;
    }

    const originalLogin = window.login;
    if (originalLogin) {
        window.login = async function () { await originalLogin.apply(this, arguments); pollBadge(); };
    }

    window.loadNotifications = loadNotifications;
    window.markNotificationRead = markNotificationRead;

    setInterval(() => {
        const sys = document.getElementById('system');
        if (sys && sys.classList.contains('active')) loadSystem();
    }, 5000);
    setInterval(pollBadge, 15000);
    document.addEventListener('DOMContentLoaded', pollBadge);
})();
