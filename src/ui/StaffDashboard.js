/* ============================================================
 * StaffDashboard.js
 * Full DOM overlay panel for the /staff page.
 * Tabs: Map Controls | Staff Directory | Live Stats | AI Alerts
 * ============================================================ */
import { pois } from '../map/mockStadiumMap.js';

const ROLE_COLORS = {
  SEC: '#ef4444', OPS: '#3b82f6', MED: '#10b981',
  STW: '#a855f7', MGR: '#f59e0b', MRC: '#ec4899',
  CLN: '#6b7280', TCH: '#06b6d4'
};

const SEV_CONFIG = {
  critical: { bg: 'rgba(239,68,68,0.12)', border: '#ef4444', dot: '#ef4444', label: 'CRITICAL' },
  warning:  { bg: 'rgba(245,158,11,0.12)', border: '#f59e0b', dot: '#f59e0b', label: 'WARNING'  },
  info:     { bg: 'rgba(59,130,246,0.12)', border: '#3b82f6', dot: '#3b82f6', label: 'INFO'     },
  resolved: { bg: 'rgba(16,185,129,0.12)', border: '#10b981', dot: '#10b981', label: 'RESOLVED' }
};

export default class StaffDashboard {
  /**
   * @param {object} opts
   *   staffMembers    – array from mockPeopleData
   *   alertTemplates  – array from mockPeopleData
   *   onFlyToStaff    – fn(staffMember) → moves camera to them
   *   onToggleFans    – fn(bool) → show/hide fan dots
   *   onToggleClusters – fn(bool) → show/hide cluster bubbles
   *   onFlyToLocation – fn(locationName) → pan camera to zone
   */
  constructor(opts = {}) {
    this.opts          = opts;
    this.staffMembers  = opts.staffMembers || [];
    this.pois          = pois || [];
    this.alertQueue    = [];
    this.resolvedSet   = new Set();
    this.activeTab     = 'map';
    this.showFans      = false;
    this.showClusters  = true;
    this.statsData     = {};

    // ── Responsive / bottom-sheet state ──
    this.mq            = window.matchMedia('(max-width: 768px)');
    this.isMobile      = this.mq.matches;
    this.sheetState    = 'peek';          // 'peek' | 'open'  (mobile only)
    this.PEEK_H        = 148;             // px visible in peek state
    this.DESKTOP_PANEL = 360;
    this.TOP_BAR       = 48;
    this.DESKTOP_BOT   = 44;

    this._buildPanel();
    this._startAlertTimer(opts.alertTemplates || []);
    this._startStatsTimer();
    this._applyResponsive();
  }

  // ── Build the panel DOM ──────────────────────────────────────────────────

  _buildPanel() {
    // Inject Google Font + keyframes
    this._injectStyles();

    // Sidebar wrapper
    this.panel = document.createElement('div');
    this.panel.id = 'staff-panel';
    this.panel.innerHTML = this._panelHTML();
    document.body.appendChild(this.panel);

    // Top bar (logo + header)
    this.topBar = document.createElement('div');
    this.topBar.id = 'staff-topbar';
    this.topBar.innerHTML = this._topBarHTML();
    document.body.appendChild(this.topBar);

    // Stat mini-bar fixed across bottom of map (desktop only)
    this.miniStats = document.createElement('div');
    this.miniStats.id = 'staff-ministats';
    this.miniStats.innerHTML = this._miniStatsHTML();
    document.body.appendChild(this.miniStats);

    this._wireEvents();
    this._renderStaffList();
    this._renderStats();
    this._updateAlertBadge();
  }

  // ── Responsive layout / bottom sheet ─────────────────────────────────────

  /**
   * Insets the map viewport must avoid, in CSS px.
   * Desktop: fixed right panel. Mobile: bottom sheet (height depends on state).
   * @returns {{top:number, right:number, bottom:number}}
   */
  getInsets() {
    if (this.isMobile) {
      const h = this.sheetState === 'open'
        ? Math.round(window.innerHeight * 0.68)
        : this.PEEK_H;
      return { top: this.TOP_BAR, right: 0, bottom: h };
    }
    return { top: this.TOP_BAR, right: this.DESKTOP_PANEL, bottom: this.DESKTOP_BOT };
  }

  /** (Re)apply mobile/desktop presentation and notify the scene. */
  _applyResponsive() {
    this.isMobile = this.mq.matches;
    document.body.classList.toggle('sp-mobile', this.isMobile);

    if (this.isMobile) {
      const safeBot = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sab') || '0');
      const openH = Math.round(window.innerHeight * 0.68) + safeBot;
      const h = this.sheetState === 'open' ? openH : this.PEEK_H;
      this.panel.style.setProperty('--sp-sheet-h', `${h}px`);
      this.panel.classList.toggle('sp-sheet-open', this.sheetState === 'open');
      // Hide mini-stats bar on mobile (peek state already shows key numbers in top bar)
      if (this.miniStats) this.miniStats.style.display = 'none';
    } else {
      this.panel.style.removeProperty('--sp-sheet-h');
      this.panel.classList.remove('sp-sheet-open');
      if (this.miniStats) this.miniStats.style.display = '';
    }
    this.opts.onLayoutChange?.();
  }

  _setSheet(state) {
    if (this.sheetState === state) return;
    this.sheetState = state;
    this._applyResponsive();
  }

  _toggleSheet() {
    this._setSheet(this.sheetState === 'open' ? 'peek' : 'open');
  }

  _wireGrabber() {
    const grab = this.panel.querySelector('#sp-grabber');
    if (!grab) return;

    let startY = 0, startH = 0, dragging = false, moved = false;

    const onDown = (e) => {
      if (!this.isMobile) return;
      dragging = true; moved = false;
      startY = (e.touches ? e.touches[0].clientY : e.clientY);
      startH = this.panel.getBoundingClientRect().height;
      this.panel.style.transition = 'none';
    };
    const onMove = (e) => {
      if (!dragging) return;
      const y = (e.touches ? e.touches[0].clientY : e.clientY);
      const dy = startY - y;
      if (Math.abs(dy) > 4) moved = true;
      const min = this.PEEK_H;
      const max = Math.round(window.innerHeight * 0.82);
      const h = Math.max(min, Math.min(max, startH + dy));
      this.panel.style.setProperty('--sp-sheet-h', `${h}px`);
      if (e.cancelable) e.preventDefault();
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      this.panel.style.transition = '';
      if (!moved) { this._toggleSheet(); return; }
      // Snap to nearest of peek / open based on current height
      const h = this.panel.getBoundingClientRect().height;
      const openH = Math.round(window.innerHeight * 0.62);
      const mid = (this.PEEK_H + openH) / 2;
      this._setSheet(h >= mid ? 'open' : 'peek');
    };

    grab.addEventListener('mousedown', onDown);
    grab.addEventListener('touchstart', onDown, { passive: true });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
    this._grabberCleanup = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
    };
  }

  _panelHTML() {
    return `
      <div class="sp-grabber" id="sp-grabber"><span class="sp-grabber-bar"></span></div>
      <div class="sp-header">
        <div class="sp-logo">
          <div class="sp-logo-icon">⚽</div>
          <div>
            <div class="sp-logo-title">Staff Portal</div>
            <div class="sp-logo-sub">Stadium Navigator</div>
          </div>
        </div>
        <div class="sp-live-badge"><span class="sp-live-dot"></span>LIVE</div>
      </div>

      <div class="sp-search-wrap">
        <div class="sp-search-inner">
          <span class="sp-search-icon">🔍</span>
          <input id="sp-search" type="text" placeholder="Search staff, gates, food, medical…" autocomplete="off" />
          <button id="sp-search-clear" class="sp-search-clear" hidden>✕</button>
        </div>
        <ul id="sp-autocomplete" class="sp-autocomplete hidden"></ul>
      </div>

      <nav class="sp-tabs">
        <button class="sp-tab active" data-tab="map">🗺️ Map</button>
        <button class="sp-tab" data-tab="staff">👥 Staff</button>
        <button class="sp-tab" data-tab="stats">📊 Stats</button>
        <button class="sp-tab" data-tab="alerts">🤖 AI <span id="sp-alert-badge" class="sp-badge hidden">0</span></button>
      </nav>

      <div class="sp-body">
        <!-- MAP TAB -->
        <div class="sp-pane active" data-pane="map">
          <div class="sp-section-title">SELF LOCATOR (GPS)</div>
          <div class="sp-gps-box">
            <div class="sp-gps-row">
              <div class="sp-gps-status-dot" id="sp-gps-dot"></div>
              <span id="sp-gps-status-txt" class="sp-gps-status-txt">GPS inactive</span>
            </div>
            <div class="sp-gps-actions">
              <button id="sp-gps-toggle" class="sp-gps-btn sp-gps-btn-start">📍 Start GPS</button>
              <button id="sp-center-me" class="sp-gps-btn sp-gps-btn-center">⊙ Center Me</button>
            </div>
            <div class="sp-gps-calib">
              <select id="sp-calib-poi" class="sp-calib-select">
                ${pois.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
              </select>
              <button id="sp-calib-set" class="sp-calib-btn">📌 I am here</button>
              <button id="sp-calib-clear" class="sp-calib-clear">Clear</button>
            </div>
            <div class="sp-calib-hint">Mark 2 known locations for accurate tracking</div>
          </div>

          <div class="sp-section-title" style="margin-top:14px">MAP OVERLAYS</div>
          <div class="sp-toggle-row">
            <div class="sp-toggle-info">
              <div class="sp-toggle-label">👥 Show All Fans</div>
              <div class="sp-toggle-desc">Display ~500 fan positions on map</div>
            </div>
            <label class="sp-switch">
              <input type="checkbox" id="tog-fans" />
              <span class="sp-slider"></span>
            </label>
          </div>
          <div class="sp-toggle-row">
            <div class="sp-toggle-info">
              <div class="sp-toggle-label">🔵 Cluster Bubbles</div>
              <div class="sp-toggle-desc">Show crowd counts per section when zoomed out</div>
            </div>
            <label class="sp-switch">
              <input type="checkbox" id="tog-clusters" checked />
              <span class="sp-slider"></span>
            </label>
          </div>
          <div class="sp-toggle-row">
            <div class="sp-toggle-info">
              <div class="sp-toggle-label">🌡️ Heatmap</div>
              <div class="sp-toggle-desc">Overlay crowd density heat colours</div>
            </div>
            <label class="sp-switch">
              <input type="checkbox" id="tog-heatmap" />
              <span class="sp-slider"></span>
            </label>
          </div>

          <div class="sp-section-title" style="margin-top:18px">QUICK FLY-TO</div>
          <div id="sp-flyto-grid" class="sp-flyto-grid"></div>
        </div>

        <!-- STAFF TAB -->
        <div class="sp-pane" data-pane="staff">
          <div class="sp-section-title">ALL STAFF <span id="sp-staff-count" class="sp-count-badge">30</span></div>
          <div class="sp-filter-row">
            <button class="sp-filter-chip active" data-role="ALL">All</button>
            <button class="sp-filter-chip" data-role="SEC">🔴 Security</button>
            <button class="sp-filter-chip" data-role="MED">🟢 Medical</button>
            <button class="sp-filter-chip" data-role="OPS">🔵 Operations</button>
            <button class="sp-filter-chip" data-role="STW">🟣 Steward</button>
            <button class="sp-filter-chip" data-role="MGR">🟡 Manager</button>
          </div>
          <ul id="sp-staff-list" class="sp-staff-list"></ul>
        </div>

        <!-- STATS TAB -->
        <div class="sp-pane" data-pane="stats">
          <div class="sp-section-title">LIVE OVERVIEW</div>
          <div id="sp-stat-cards" class="sp-stat-cards"></div>
          <div class="sp-section-title" style="margin-top:18px">SECTION OCCUPANCY</div>
          <div id="sp-section-bars" class="sp-section-bars"></div>
          <div class="sp-section-title" style="margin-top:18px">GATE FLOW (ppl/min)</div>
          <div id="sp-gate-flow" class="sp-gate-flow"></div>
        </div>

        <!-- ALERTS TAB -->
        <div class="sp-pane" data-pane="alerts">
          <div class="sp-alerts-header">
            <div class="sp-section-title">AI ALERTS</div>
            <button id="sp-clear-resolved" class="sp-ghost-btn">Clear Resolved</button>
          </div>
          <div id="sp-alert-list" class="sp-alert-list">
            <div class="sp-empty-state">No active alerts. System monitoring…</div>
          </div>
        </div>
      </div>
    `;
  }

  _topBarHTML() {
    return `
      <div class="stb-left">
        <div class="stb-indicator"></div>
        <span class="stb-label">Staff</span>
        <span class="stb-sep stb-sep-hide">|</span>
        <span id="stb-total-count" class="stb-count">Loading…</span>
      </div>
      <div class="stb-center">FIFA WORLD CUP 2026 — STADIUM A</div>
      <div class="stb-right">
        <span id="stb-clock" class="stb-clock"></span>
        <a href="/" class="stb-fan-link">Fan →</a>
      </div>
    `;
  }

  _miniStatsHTML() {
    return `
      <div class="ms-item"><span class="ms-icon">👥</span><span id="ms-total">—</span><span class="ms-label">Total</span></div>
      <div class="ms-sep"></div>
      <div class="ms-item"><span class="ms-icon">🔥</span><span id="ms-hot">—</span><span class="ms-label">Busiest</span></div>
      <div class="ms-sep"></div>
      <div class="ms-item"><span class="ms-icon">⚠️</span><span id="ms-alerts">0</span><span class="ms-label">Alerts</span></div>
      <div class="ms-sep"></div>
      <div class="ms-item"><span class="ms-icon">🌡️</span><span id="ms-avg">—</span><span class="ms-label">Avg Occ.</span></div>
    `;
  }

  // ── Wire events ──────────────────────────────────────────────────────────

  _wireEvents() {
    // Tab switching
    this.panel.querySelectorAll('.sp-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this.panel.querySelectorAll('.sp-tab').forEach(b => b.classList.remove('active'));
        this.panel.querySelectorAll('.sp-pane').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        this.activeTab = btn.dataset.tab;
        this.panel.querySelector(`[data-pane="${this.activeTab}"]`).classList.add('active');
        // On mobile, tapping a tab expands the sheet so its content is visible.
        if (this.isMobile) this._setSheet('open');
      });
    });

    // ── Bottom-sheet grabber (mobile): tap to toggle, drag to resize ──
    this._wireGrabber();

    // React to viewport width class changes + orientation/resize
    const onMq = () => { this.sheetState = 'peek'; this._applyResponsive(); };
    if (this.mq.addEventListener) this.mq.addEventListener('change', onMq);
    else this.mq.addListener?.(onMq);
    this._onResize = () => this._applyResponsive();
    window.addEventListener('resize', this._onResize);

    // Search
    const inp = this.panel.querySelector('#sp-search');
    const ac  = this.panel.querySelector('#sp-autocomplete');
    const clr = this.panel.querySelector('#sp-search-clear');

    inp.addEventListener('input', () => {
      const q = inp.value.trim().toLowerCase();
      clr.hidden = q === '';
      if (!q) { ac.classList.add('hidden'); return; }
      const matches = this.staffMembers.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.roleLabel.toLowerCase().includes(q) ||
        s.zone.toLowerCase().includes(q)
      ).slice(0, 8);
      if (!matches.length) { ac.classList.add('hidden'); return; }
      ac.innerHTML = matches.map(s => `
        <li class="sp-ac-item" data-id="${s.id}">
          <span class="sp-ac-badge" style="background:${ROLE_COLORS[s.role] || '#6b7280'}">${s.role}</span>
          <div>
            <div class="sp-ac-name">${s.name}</div>
            <div class="sp-ac-zone">${s.zone}</div>
          </div>
          <button class="sp-ac-go" data-id="${s.id}">Navigate</button>
        </li>
      `).join('');
      ac.classList.remove('hidden');
    });

    clr.addEventListener('click', () => {
      inp.value = '';
      ac.classList.add('hidden');
      clr.hidden = true;
    });

    document.addEventListener('click', e => {
      if (!this.panel.querySelector('.sp-search-wrap').contains(e.target)) {
        ac.classList.add('hidden');
      }
    });

    ac.addEventListener('click', e => {
      const btn = e.target.closest('[data-id]');
      if (!btn) return;
      const id = btn.dataset.id;
      const member = this.staffMembers.find(s => s.id === id);
      if (member) this._flyToStaff(member);
      ac.classList.add('hidden');
      inp.value = '';
      clr.hidden = true;
    });

    // Toggles
    this.panel.querySelector('#tog-fans').addEventListener('change', e => {
      this.showFans = e.target.checked;
      this.opts.onToggleFans?.(this.showFans);
    });
    this.panel.querySelector('#tog-clusters').addEventListener('change', e => {
      this.showClusters = e.target.checked;
      this.opts.onToggleClusters?.(this.showClusters);
    });
    this.panel.querySelector('#tog-heatmap').addEventListener('change', e => {
      this.opts.onToggleHeatmap?.(e.target.checked);
    });

    // ── GPS self-locator box ──────────────────────────────────────────────
    this.gpsActive = false;
    const gpsToggle = this.panel.querySelector('#sp-gps-toggle');
    gpsToggle.addEventListener('click', () => {
      if (this.gpsActive) {
        this.opts.onStopGps?.();
      } else {
        this.opts.onStartGps?.();
      }
    });
    this.panel.querySelector('#sp-center-me').addEventListener('click', () => {
      this.opts.onCenterSelf?.();
    });
    this.panel.querySelector('#sp-calib-set').addEventListener('click', () => {
      const poiId = this.panel.querySelector('#sp-calib-poi').value;
      this.opts.onCalibrate?.(poiId);
    });
    this.panel.querySelector('#sp-calib-clear').addEventListener('click', () => {
      this.opts.onClearCalib?.();
    });

    // Staff filter chips
    this.panel.querySelector('.sp-filter-row').addEventListener('click', e => {
      const chip = e.target.closest('.sp-filter-chip');
      if (!chip) return;
      this.panel.querySelectorAll('.sp-filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      this._renderStaffList(chip.dataset.role);
    });

    // Fly-to grid
    this._buildFlyToGrid();

    // Clear resolved alerts
    this.panel.querySelector('#sp-clear-resolved').addEventListener('click', () => {
      this.alertQueue = this.alertQueue.filter(a => a.status !== 'resolved');
      this._renderAlerts();
      this._updateAlertBadge();
    });

    // Clock
    this._tickClock();
    setInterval(() => this._tickClock(), 1000);
  }

  _tickClock() {
    const now = new Date();
    const el = document.getElementById('stb-clock');
    if (el) el.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  _buildFlyToGrid() {
    const zones = [
      { label: 'North Gate', icon: '🚪', tileX: 24, tileY: 5  },
      { label: 'South Gate', icon: '🚪', tileX: 24, tileY: 32 },
      { label: 'West Gate',  icon: '🚪', tileX: 3,  tileY: 18 },
      { label: 'East Gate',  icon: '🚪', tileX: 46, tileY: 18 },
      { label: 'Field',      icon: '⚽', tileX: 24, tileY: 18 },
      { label: 'N Medical',  icon: '🏥', tileX: 22, tileY: 4  },
    ];
    const grid = this.panel.querySelector('#sp-flyto-grid');
    grid.innerHTML = zones.map(z => `
      <button class="sp-flyto-btn" data-tx="${z.tileX}" data-ty="${z.tileY}">
        ${z.icon} ${z.label}
      </button>
    `).join('');
    grid.addEventListener('click', e => {
      const btn = e.target.closest('.sp-flyto-btn');
      if (!btn) return;
      this.opts.onFlyToTile?.(+btn.dataset.tx, +btn.dataset.ty);
    });
  }

  // ── Staff list rendering ─────────────────────────────────────────────────

  _renderStaffList(roleFilter = 'ALL') {
    const list = this.panel.querySelector('#sp-staff-list');
    const filtered = roleFilter === 'ALL'
      ? this.staffMembers
      : this.staffMembers.filter(s => s.role === roleFilter);

    this.panel.querySelector('#sp-staff-count').textContent = filtered.length;

    list.innerHTML = filtered.map(s => `
      <li class="sp-staff-item" data-id="${s.id}">
        <div class="sp-staff-avatar" style="background:${ROLE_COLORS[s.role] || '#6b7280'}">
          ${s.role}
        </div>
        <div class="sp-staff-info">
          <div class="sp-staff-name">${s.name}</div>
          <div class="sp-staff-meta">
            <span class="sp-staff-role">${s.roleLabel}</span>
            <span class="sp-staff-zone">📍 ${s.zone}</span>
          </div>
        </div>
        <div class="sp-staff-actions">
          <button class="sp-ico-btn sp-navigate-btn" title="Navigate to" data-id="${s.id}">🎯</button>
          <button class="sp-ico-btn sp-contact-btn" title="Contact" data-phone="${s.phone}">📞</button>
        </div>
      </li>
    `).join('');

    list.querySelectorAll('.sp-navigate-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const member = this.staffMembers.find(s => s.id === btn.dataset.id);
        if (member) this._flyToStaff(member);
      });
    });

    list.querySelectorAll('.sp-contact-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        this._showContactModal(btn.dataset.phone);
      });
    });

    list.querySelectorAll('.sp-staff-item').forEach(item => {
      item.addEventListener('click', () => {
        const member = this.staffMembers.find(s => s.id === item.dataset.id);
        if (member) this._flyToStaff(member);
      });
    });
  }

  _flyToStaff(member) {
    this.opts.onFlyToStaff?.(member);
    this._showToast(`Navigating to ${member.name}`, '🎯');
  }

  _showContactModal(phone) {
    const existing = document.getElementById('sp-contact-modal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'sp-contact-modal';
    modal.innerHTML = `
      <div class="sp-modal-backdrop"></div>
      <div class="sp-modal-box">
        <div class="sp-modal-icon">📞</div>
        <div class="sp-modal-title">Contact Staff</div>
        <div class="sp-modal-phone">${phone}</div>
        <div class="sp-modal-btns">
          <a href="tel:${phone}" class="sp-modal-call">Call Now</a>
          <button class="sp-modal-close" id="sp-modal-close">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('#sp-modal-close').onclick = () => modal.remove();
    modal.querySelector('.sp-modal-backdrop').onclick = () => modal.remove();
  }

  // ── Stats rendering ──────────────────────────────────────────────────────

  _renderStats() {
    const stats = this.opts.getStats ? this.opts.getStats() : {};
    this.statsData = stats;

    const totalFans  = Object.values(stats).reduce((s, v) => s + (v.count || 0), 0);
    const totalStaff = this.staffMembers.length;
    const total      = totalFans + totalStaff;

    // Top stat cards
    const sortedSecs = Object.values(stats).sort((a, b) => b.pct - a.pct);
    const hotSec     = sortedSecs[0] || { name: '—', pct: 0 };
    const predSec    = sortedSecs[1] || { name: '—', pct: 0 };
    const avgPct     = sortedSecs.length
      ? Math.round(sortedSecs.reduce((s, v) => s + v.pct, 0) / sortedSecs.length)
      : 0;

    const cards = this.panel.querySelector('#sp-stat-cards');
    cards.innerHTML = `
      <div class="sp-stat-card sp-stat-total">
        <div class="sp-stat-icon">👥</div>
        <div class="sp-stat-value" id="sc-total">${total.toLocaleString()}</div>
        <div class="sp-stat-label">People in Stadium</div>
        <div class="sp-stat-sub">${totalFans} fans · ${totalStaff} staff</div>
      </div>
      <div class="sp-stat-card sp-stat-hot">
        <div class="sp-stat-icon">🔥</div>
        <div class="sp-stat-value">${hotSec.name}</div>
        <div class="sp-stat-label">Most Crowded</div>
        <div class="sp-stat-sub">${hotSec.pct}% capacity</div>
      </div>
      <div class="sp-stat-card sp-stat-pred">
        <div class="sp-stat-icon">📈</div>
        <div class="sp-stat-value">${predSec.name}</div>
        <div class="sp-stat-label">Predicted Next</div>
        <div class="sp-stat-sub">Est. ${Math.min(100, predSec.pct + 8)}% in 15 min</div>
      </div>
      <div class="sp-stat-card sp-stat-avg">
        <div class="sp-stat-icon">🌡️</div>
        <div class="sp-stat-value">${avgPct}%</div>
        <div class="sp-stat-label">Avg Occupancy</div>
        <div class="sp-stat-sub">Across all sections</div>
      </div>
    `;

    // Section bars
    const barsEl = this.panel.querySelector('#sp-section-bars');
    barsEl.innerHTML = sortedSecs.map(sec => {
      const color = sec.pct > 85 ? '#ef4444' : sec.pct > 60 ? '#f59e0b' : '#10b981';
      return `
        <div class="sp-bar-row">
          <div class="sp-bar-label">${sec.name}</div>
          <div class="sp-bar-track">
            <div class="sp-bar-fill" style="width:${sec.pct}%;background:${color}"></div>
          </div>
          <div class="sp-bar-pct" style="color:${color}">${sec.pct}%</div>
        </div>
      `;
    }).join('');

    // Gate flow (simulated)
    const gates = [
      { name: 'Gate 1', flow: 34 + Math.floor(Math.random() * 12) },
      { name: 'Gate 4', flow: 29 + Math.floor(Math.random() * 18) },
      { name: 'Gate 5', flow: 22 + Math.floor(Math.random() * 10) },
      { name: 'Gate 10', flow: 58 + Math.floor(Math.random() * 20) },
      { name: 'Gate 12', flow: 41 + Math.floor(Math.random() * 15) },
    ];
    const gateEl = this.panel.querySelector('#sp-gate-flow');
    gateEl.innerHTML = gates.map(g => {
      const max = 80;
      const w = Math.round((g.flow / max) * 100);
      const color = g.flow > 55 ? '#ef4444' : g.flow > 35 ? '#f59e0b' : '#10b981';
      return `
        <div class="sp-gate-row">
          <div class="sp-gate-name">${g.name}</div>
          <div class="sp-bar-track">
            <div class="sp-bar-fill" style="width:${w}%;background:${color}"></div>
          </div>
          <div class="sp-gate-val" style="color:${color}">${g.flow}/min</div>
        </div>
      `;
    }).join('');

    // Update mini stats bar
    const ms = n => document.getElementById(`ms-${n}`);
    if (ms('total')) ms('total').textContent = total.toLocaleString();
    if (ms('hot'))   ms('hot').textContent   = hotSec.name.replace(' Concourse','');
    if (ms('avg'))   ms('avg').textContent   = `${avgPct}%`;

    // Top bar
    const tc = document.getElementById('stb-total-count');
    if (tc) tc.textContent = `${total.toLocaleString()} people inside`;
  }

  _startStatsTimer() {
    setInterval(() => this._renderStats(), 12000);
  }

  // ── AI Alerts ────────────────────────────────────────────────────────────

  _startAlertTimer(templates) {
    templates.forEach(tpl => {
      setTimeout(() => {
        this.alertQueue.unshift({ ...tpl, status: 'active', ts: Date.now() });
        this._renderAlerts();
        this._updateAlertBadge();
        if (this.activeTab !== 'alerts') {
          this._showToast(tpl.title, tpl.icon, tpl.severity);
        }
        // Update mini alert count
        const ma = document.getElementById('ms-alerts');
        if (ma) ma.textContent = this.alertQueue.filter(a => a.status === 'active').length;
      }, tpl.delay);
    });
  }

  _renderAlerts() {
    const list = this.panel.querySelector('#sp-alert-list');
    if (!this.alertQueue.length) {
      list.innerHTML = `<div class="sp-empty-state">No active alerts. System monitoring…</div>`;
      return;
    }
    list.innerHTML = this.alertQueue.map(alert => {
      const cfg = SEV_CONFIG[alert.status === 'resolved' ? 'resolved' : alert.severity] || SEV_CONFIG.info;
      const timeAgo = this._timeAgo(alert.ts);
      return `
        <div class="sp-alert-card" data-id="${alert.id}" style="background:${cfg.bg};border-color:${cfg.border}">
          <div class="sp-alert-top">
            <span class="sp-alert-icon">${alert.icon}</span>
            <div class="sp-alert-head">
              <div class="sp-alert-title">${alert.title}</div>
              <div class="sp-alert-meta">
                <span class="sp-alert-sev" style="color:${cfg.dot}">${cfg.label}</span>
                <span>·</span>
                <span class="sp-alert-loc">📍 ${alert.location}</span>
                <span>·</span>
                <span class="sp-alert-time">${timeAgo}</span>
              </div>
            </div>
            ${alert.status !== 'resolved' ? `<div class="sp-alert-pulse" style="background:${cfg.dot}"></div>` : ''}
          </div>
          <div class="sp-alert-msg">${alert.message}</div>
          ${alert.status !== 'resolved' ? `
            <div class="sp-alert-btns">
              <button class="sp-alert-act-btn" data-id="${alert.id}" style="border-color:${cfg.border};color:${cfg.dot}">${alert.actionLabel}</button>
              <button class="sp-alert-nav-btn" data-id="${alert.id}">Navigate</button>
            </div>
          ` : `<div class="sp-resolved-label">✅ Resolved</div>`}
        </div>
      `;
    }).join('');

    list.querySelectorAll('.sp-alert-act-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const a = this.alertQueue.find(x => x.id === btn.dataset.id);
        if (a) { a.status = 'resolved'; this._renderAlerts(); this._updateAlertBadge(); }
      });
    });
    list.querySelectorAll('.sp-alert-nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const a = this.alertQueue.find(x => x.id === btn.dataset.id);
        if (a) this.opts.onFlyToLocation?.(a.location);
      });
    });
  }

  _updateAlertBadge() {
    const active = this.alertQueue.filter(a => a.status === 'active').length;
    const badge  = this.panel.querySelector('#sp-alert-badge');
    if (!badge) return;
    badge.textContent = active;
    badge.classList.toggle('hidden', active === 0);
    const ma = document.getElementById('ms-alerts');
    if (ma) ma.textContent = active;
  }

  _timeAgo(ts) {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  }

  // ── GPS status (driven by the scene) ─────────────────────────────────────

  /** Toggle the Start/Stop GPS button state. */
  setGpsActive(active) {
    this.gpsActive = active;
    const btn = this.panel?.querySelector('#sp-gps-toggle');
    if (!btn) return;
    btn.textContent = active ? '⏹ Stop GPS' : '📍 Start GPS';
    btn.classList.toggle('sp-gps-btn-start', !active);
    btn.classList.toggle('sp-gps-btn-stop', active);
    const dot = this.panel.querySelector('#sp-gps-dot');
    if (dot) dot.classList.toggle('sp-gps-dot-live', active);
  }

  /**
   * Update the GPS status line + dot colour.
   * @param {string} msg
   * @param {'idle'|'ok'|'warn'} state
   */
  setGpsStatus(msg, state = 'ok') {
    const txt = this.panel?.querySelector('#sp-gps-status-txt');
    const dot = this.panel?.querySelector('#sp-gps-dot');
    if (txt) txt.textContent = msg;
    if (dot) {
      dot.classList.remove('sp-gps-dot-live', 'sp-gps-dot-warn');
      if (state === 'ok')   dot.classList.add('sp-gps-dot-live');
      if (state === 'warn') dot.classList.add('sp-gps-dot-warn');
    }
  }

  // ── Toast notification ───────────────────────────────────────────────────

  _showToast(msg, icon = '🔔', severity = 'info') {
    let toastWrap = document.getElementById('sp-toast-wrap');
    if (!toastWrap) {
      toastWrap = document.createElement('div');
      toastWrap.id = 'sp-toast-wrap';
      document.body.appendChild(toastWrap);
    }
    const t = document.createElement('div');
    const color = severity === 'critical' ? '#ef4444' : severity === 'warning' ? '#f59e0b' : '#3b82f6';
    t.className = 'sp-toast';
    t.style.borderLeftColor = color;
    t.innerHTML = `<span>${icon}</span><span>${msg}</span>`;
    toastWrap.prepend(t);
    setTimeout(() => t.classList.add('sp-toast-hide'), 3500);
    setTimeout(() => t.remove(), 4000);
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────

  destroy() {
    this._grabberCleanup?.();
    if (this._onResize) window.removeEventListener('resize', this._onResize);
    document.body.classList.remove('sp-mobile');
    this.panel?.remove();
    this.topBar?.remove();
    this.miniStats?.remove();
    document.getElementById('sp-toast-wrap')?.remove();
    document.getElementById('sp-contact-modal')?.remove();
  }

  // ── CSS injection ────────────────────────────────────────────────────────

  _injectStyles() {
    const style = document.createElement('style');
    style.id = 'sp-styles';
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap');

      *, *::before, *::after { box-sizing: border-box; }
      body { margin: 0; font-family: 'Outfit', system-ui, sans-serif; background: #0f172a; color: #f1f5f9; overflow: hidden; }

      /* ── Top bar ── */
      #staff-topbar {
        position: fixed; top: 0; left: 0; right: 360px; height: 40px; z-index: 1100;
        background: rgba(15,23,42,0.95); border-bottom: 1px solid rgba(59,130,246,0.3);
        display: flex; align-items: center; justify-content: space-between;
        padding: 0 16px; font-size: 12px; gap: 12px;
        backdrop-filter: blur(12px);
      }
      .stb-left { display: flex; align-items: center; gap: 8px; font-weight: 600; color: #e78a53; }
      .stb-indicator { width: 8px; height: 8px; border-radius: 50%; background: #10b981; animation: sp-pulse 2s infinite; }
      .stb-sep { color: #334155; }
      #stb-total-count { color: #f1f5f9; font-weight: 500; }
      .stb-center { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; color: #64748b; text-transform: uppercase; }
      .stb-right { display: flex; align-items: center; gap: 12px; }
      #stb-clock { font-variant-numeric: tabular-nums; font-weight: 600; color: #94a3b8; }
      .stb-fan-link { color: #e78a53; text-decoration: none; font-weight: 600; padding: 4px 10px; border: 1px solid rgba(231,138,83,0.3); border-radius: 6px; transition: all 0.2s; }
      .stb-fan-link:hover { background: rgba(231,138,83,0.15); }

      /* ── Mini stats bar ── */
      #staff-ministats {
        position: fixed; bottom: 0; left: 0; right: 360px; height: 44px; z-index: 1100;
        background: rgba(15,23,42,0.95); border-top: 1px solid rgba(59,130,246,0.2);
        display: flex; align-items: center; justify-content: center; gap: 0;
        backdrop-filter: blur(12px);
      }
      .ms-item { display: flex; align-items: center; gap: 6px; padding: 0 20px; font-size: 12px; }
      .ms-icon { font-size: 14px; }
      .ms-item span:nth-child(2) { font-weight: 700; font-size: 14px; color: #f1f5f9; }
      .ms-label { color: #64748b; font-size: 11px; }
      .ms-sep { width: 1px; height: 20px; background: rgba(100,116,139,0.3); }

      /* ── Sidebar panel ── */
      #staff-panel {
        position: fixed; top: 40px; right: 0; bottom: 44px; width: 360px; z-index: 1050;
        background: rgba(15,23,42,0.97); border-left: 1px solid rgba(231,138,83,0.2);
        display: flex; flex-direction: column;
        backdrop-filter: blur(20px); overflow: hidden;
      }
      .sp-header { padding: 16px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(59,130,246,0.15); flex-shrink: 0; }
      .sp-logo { display: flex; align-items: center; gap: 10px; }
      .sp-logo-icon { font-size: 24px; }
      .sp-logo-title { font-size: 16px; font-weight: 800; color: #f1f5f9; line-height: 1.1; }
      .sp-logo-sub { font-size: 10px; color: #64748b; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; }
      .sp-live-badge { display: flex; align-items: center; gap: 5px; font-size: 10px; font-weight: 700; color: #10b981; letter-spacing: 0.1em; padding: 4px 10px; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3); border-radius: 20px; }
      .sp-live-dot { width: 6px; height: 6px; border-radius: 50%; background: #10b981; animation: sp-pulse 1.4s infinite; }

      /* ── Search ── */
      .sp-search-wrap { padding: 12px 12px 0; position: relative; flex-shrink: 0; }
      .sp-search-inner { display: flex; align-items: center; gap: 8px; background: rgba(30,41,59,0.8); border: 1px solid rgba(231,138,83,0.2); border-radius: 10px; padding: 10px 14px; transition: border 0.2s; }
      .sp-search-inner:focus-within { border-color: rgba(231,138,83,0.6); }
      .sp-search-icon { font-size: 14px; }
      #sp-search { background: none; border: none; outline: none; color: #f1f5f9; font-size: 13px; flex: 1; font-family: inherit; }
      #sp-search::placeholder { color: #64748b; }
      .sp-search-clear { background: none; border: none; color: #64748b; cursor: pointer; font-size: 12px; padding: 0; line-height: 1; }
      .sp-autocomplete { list-style: none; margin: 4px 0 0; padding: 4px; background: rgba(15,23,42,0.98); border: 1px solid rgba(231,138,83,0.25); border-radius: 10px; max-height: 260px; overflow-y: auto; box-shadow: 0 8px 32px rgba(0,0,0,0.5); position: absolute; left: 12px; right: 12px; z-index: 200; }
      .sp-autocomplete.hidden { display: none; }
      .sp-ac-item { display: flex; align-items: center; gap: 10px; padding: 10px; border-radius: 8px; cursor: pointer; transition: background 0.15s; }
      .sp-ac-item:hover { background: rgba(231,138,83,0.1); }
      .sp-ac-badge { padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; color: #fff; flex-shrink: 0; }
      .sp-ac-name { font-size: 13px; font-weight: 600; color: #f1f5f9; }
      .sp-ac-zone { font-size: 11px; color: #64748b; }
      .sp-ac-go { margin-left: auto; padding: 4px 10px; background: rgba(231,138,83,0.15); border: 1px solid rgba(231,138,83,0.3); border-radius: 6px; color: #e78a53; font-size: 11px; font-weight: 600; cursor: pointer; font-family: inherit; flex-shrink: 0; }

      /* ── Tabs ── */
      .sp-tabs { display: flex; padding: 10px 12px 0; gap: 4px; flex-shrink: 0; }
      .sp-tab { flex: 1; padding: 8px 4px; background: transparent; border: 1px solid transparent; border-radius: 8px; color: #64748b; font-size: 11px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.2s; white-space: nowrap; touch-action: manipulation; }
      .sp-tab.active { background: rgba(231,138,83,0.15); border-color: rgba(231,138,83,0.35); color: #e78a53; }
      .sp-tab:hover:not(.active) { color: #94a3b8; background: rgba(255,255,255,0.04); }
      .sp-badge { display: inline-flex; align-items: center; justify-content: center; min-width: 16px; height: 16px; background: #ef4444; border-radius: 8px; font-size: 9px; font-weight: 700; color: white; padding: 0 4px; margin-left: 3px; }
      .sp-badge.hidden { display: none; }

      /* ── Body / panes ── */
      .sp-body { flex: 1; overflow: hidden; position: relative; }
      .sp-pane { display: none; flex-direction: column; height: 100%; overflow-y: auto; padding: 14px 12px; gap: 12px; }
      .sp-pane.active { display: flex; }
      .sp-pane::-webkit-scrollbar { width: 4px; }
      .sp-pane::-webkit-scrollbar-track { background: transparent; }
      .sp-pane::-webkit-scrollbar-thumb { background: rgba(100,116,139,0.3); border-radius: 2px; }
      .sp-section-title { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #475569; margin-bottom: 6px; }

      /* ── Toggles ── */
      .sp-toggle-row { display: flex; align-items: center; justify-content: space-between; background: rgba(30,41,59,0.6); border: 1px solid rgba(100,116,139,0.15); border-radius: 10px; padding: 12px 14px; gap: 12px; }
      .sp-toggle-info { flex: 1; }
      .sp-toggle-label { font-size: 13px; font-weight: 600; color: #e2e8f0; }
      .sp-toggle-desc { font-size: 11px; color: #64748b; margin-top: 2px; }
      .sp-switch { position: relative; display: inline-block; width: 38px; height: 22px; flex-shrink: 0; }
      .sp-switch input { opacity: 0; width: 0; height: 0; }
      .sp-slider { position: absolute; inset: 0; background: #334155; border-radius: 22px; cursor: pointer; transition: background 0.2s; }
      .sp-slider::before { content: ''; position: absolute; width: 16px; height: 16px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: transform 0.2s; }
      .sp-switch input:checked + .sp-slider { background: #e78a53; }
      .sp-switch input:checked + .sp-slider::before { transform: translateX(16px); }

      /* ── GPS self-locator box ── */
      .sp-gps-box { background: rgba(30,41,59,0.6); border: 1px solid rgba(100,116,139,0.15); border-radius: 10px; padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }
      .sp-gps-row { display: flex; align-items: center; gap: 8px; }
      .sp-gps-status-dot { width: 8px; height: 8px; border-radius: 50%; background: #475569; flex-shrink: 0; transition: background 0.2s; }
      .sp-gps-status-dot.sp-gps-dot-live { background: #10b981; animation: sp-pulse 1.6s infinite; }
      .sp-gps-status-dot.sp-gps-dot-warn { background: #f59e0b; animation: sp-pulse 1.6s infinite; }
      .sp-gps-status-txt { font-size: 12px; font-weight: 600; color: #94a3b8; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .sp-gps-actions { display: flex; gap: 8px; }
      .sp-gps-btn { flex: 1; padding: 8px; border-radius: 8px; border: 1px solid; font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit; transition: all 0.2s; }
      .sp-gps-btn-start { background: rgba(59,130,246,0.15); border-color: rgba(59,130,246,0.4); color: #60a5fa; }
      .sp-gps-btn-start:hover { background: rgba(59,130,246,0.25); }
      .sp-gps-btn-stop { background: rgba(239,68,68,0.15); border-color: rgba(239,68,68,0.4); color: #f87171; }
      .sp-gps-btn-stop:hover { background: rgba(239,68,68,0.25); }
      .sp-gps-btn-center { background: rgba(30,41,59,0.8); border-color: rgba(100,116,139,0.3); color: #94a3b8; }
      .sp-gps-btn-center:hover { background: rgba(96,165,250,0.12); border-color: rgba(96,165,250,0.35); color: #60a5fa; }
      .sp-gps-calib { display: flex; gap: 6px; align-items: center; }
      .sp-calib-select { flex: 1; min-width: 0; background: #1e293b; border: 1px solid #334155; border-radius: 6px; color: #f1f5f9; padding: 6px 8px; font-size: 11px; font-family: inherit; }
      .sp-calib-btn { padding: 6px 10px; background: #e78a53; border: none; border-radius: 6px; color: #fff; font-size: 11px; font-weight: 700; cursor: pointer; font-family: inherit; white-space: nowrap; transition: background 0.2s; }
      .sp-calib-btn:hover { background: #d87943; }
      .sp-calib-clear { padding: 6px 10px; background: rgba(30,41,59,0.8); border: 1px solid #334155; border-radius: 6px; color: #94a3b8; font-size: 11px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.2s; }
      .sp-calib-clear:hover { background: rgba(100,116,139,0.2); color: #e2e8f0; }
      .sp-calib-hint { font-size: 10px; color: #475569; text-align: center; }

      /* ── Fly-to grid ── */
      .sp-flyto-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .sp-flyto-btn { padding: 10px; background: rgba(30,41,59,0.7); border: 1px solid rgba(100,116,139,0.2); border-radius: 8px; color: #94a3b8; font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.2s; text-align: left; }
      .sp-flyto-btn:hover { background: rgba(96,165,250,0.1); border-color: rgba(96,165,250,0.3); color: #60a5fa; }

      /* ── Staff list ── */
      .sp-filter-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 4px; }
      .sp-filter-chip { padding: 4px 10px; background: transparent; border: 1px solid rgba(100,116,139,0.25); border-radius: 20px; color: #64748b; font-size: 11px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.2s; }
      .sp-filter-chip.active { background: rgba(231,138,83,0.15); border-color: #e78a53; color: #e78a53; }
      .sp-count-badge { display: inline-flex; align-items: center; justify-content: center; min-width: 20px; height: 18px; background: rgba(231,138,83,0.15); border-radius: 10px; font-size: 10px; color: #e78a53; padding: 0 5px; margin-left: 6px; font-weight: 700; }
      .sp-staff-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
      .sp-staff-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: rgba(30,41,59,0.5); border: 1px solid rgba(100,116,139,0.12); border-radius: 10px; cursor: pointer; transition: all 0.15s; }
      .sp-staff-item:hover { background: rgba(96,165,250,0.08); border-color: rgba(96,165,250,0.2); }
      .sp-staff-avatar { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; color: white; flex-shrink: 0; letter-spacing: 0.03em; }
      .sp-staff-info { flex: 1; min-width: 0; }
      .sp-staff-name { font-size: 13px; font-weight: 600; color: #e2e8f0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .sp-staff-meta { display: flex; gap: 8px; margin-top: 2px; flex-wrap: wrap; }
      .sp-staff-role { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
      .sp-staff-zone { font-size: 10px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .sp-staff-actions { display: flex; gap: 4px; flex-shrink: 0; }
      .sp-ico-btn { width: 30px; height: 30px; border-radius: 8px; border: 1px solid rgba(100,116,139,0.2); background: rgba(30,41,59,0.7); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; transition: all 0.2s; }
      .sp-ico-btn:hover { background: rgba(231,138,83,0.15); border-color: rgba(231,138,83,0.35); }

      /* ── Stats ── */
      .sp-stat-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .sp-stat-card { background: rgba(30,41,59,0.7); border: 1px solid rgba(100,116,139,0.15); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 4px; }
      .sp-stat-icon { font-size: 18px; }
      .sp-stat-value { font-size: 16px; font-weight: 800; color: #f1f5f9; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .sp-stat-label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; }
      .sp-stat-sub { font-size: 10px; color: #475569; }
      .sp-stat-total { border-color: rgba(96,165,250,0.25); }
      .sp-stat-hot { border-color: rgba(239,68,68,0.25); }
      .sp-stat-pred { border-color: rgba(245,158,11,0.25); }
      .sp-stat-avg { border-color: rgba(16,185,129,0.25); }
      .sp-section-bars { display: flex; flex-direction: column; gap: 8px; }
      .sp-bar-row { display: grid; grid-template-columns: 110px 1fr 40px; gap: 8px; align-items: center; }
      .sp-bar-label { font-size: 11px; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .sp-bar-track { height: 6px; background: rgba(30,41,59,0.8); border-radius: 3px; overflow: hidden; }
      .sp-bar-fill { height: 100%; border-radius: 3px; transition: width 0.8s ease; }
      .sp-bar-pct { font-size: 11px; font-weight: 700; text-align: right; }
      .sp-gate-flow { display: flex; flex-direction: column; gap: 8px; }
      .sp-gate-row { display: grid; grid-template-columns: 60px 1fr 52px; gap: 8px; align-items: center; }
      .sp-gate-name { font-size: 11px; color: #94a3b8; }
      .sp-gate-val { font-size: 11px; font-weight: 700; text-align: right; white-space: nowrap; }

      /* ── AI Alerts ── */
      .sp-alerts-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
      .sp-ghost-btn { background: none; border: 1px solid rgba(100,116,139,0.2); border-radius: 6px; color: #64748b; font-size: 11px; font-weight: 600; padding: 4px 10px; cursor: pointer; font-family: inherit; transition: all 0.2s; }
      .sp-ghost-btn:hover { color: #94a3b8; border-color: rgba(100,116,139,0.4); }
      .sp-alert-list { display: flex; flex-direction: column; gap: 10px; }
      .sp-empty-state { color: #475569; font-size: 13px; text-align: center; padding: 32px 16px; }
      .sp-alert-card { border: 1px solid; border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 10px; transition: all 0.3s; animation: sp-slide-in 0.3s ease; }
      .sp-alert-top { display: flex; align-items: flex-start; gap: 10px; }
      .sp-alert-icon { font-size: 20px; flex-shrink: 0; margin-top: 1px; }
      .sp-alert-head { flex: 1; min-width: 0; }
      .sp-alert-title { font-size: 13px; font-weight: 700; color: #f1f5f9; line-height: 1.3; }
      .sp-alert-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 5px; margin-top: 3px; font-size: 10px; color: #64748b; }
      .sp-alert-sev { font-weight: 700; letter-spacing: 0.05em; }
      .sp-alert-pulse { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; animation: sp-pulse 1.5s infinite; }
      .sp-alert-msg { font-size: 12px; color: #94a3b8; line-height: 1.5; }
      .sp-alert-btns { display: flex; gap: 8px; }
      .sp-alert-act-btn { flex: 1; padding: 8px; border-radius: 8px; border: 1px solid; background: transparent; font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit; transition: all 0.2s; }
      .sp-alert-act-btn:hover { filter: brightness(1.2); }
      .sp-alert-nav-btn { padding: 8px 14px; border-radius: 8px; border: 1px solid rgba(100,116,139,0.2); background: rgba(30,41,59,0.7); color: #94a3b8; font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.2s; }
      .sp-alert-nav-btn:hover { background: rgba(96,165,250,0.1); color: #60a5fa; border-color: rgba(96,165,250,0.3); }
      .sp-resolved-label { font-size: 11px; color: #10b981; font-weight: 600; }

      /* ── Contact modal ── */
      #sp-contact-modal { position: fixed; inset: 0; z-index: 3000; display: flex; align-items: center; justify-content: center; }
      .sp-modal-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,0.7); }
      .sp-modal-box { position: relative; background: #1e293b; border: 1px solid rgba(96,165,250,0.3); border-radius: 20px; padding: 32px; text-align: center; min-width: 260px; box-shadow: 0 24px 64px rgba(0,0,0,0.6); }
      .sp-modal-icon { font-size: 36px; margin-bottom: 12px; }
      .sp-modal-title { font-size: 16px; font-weight: 700; color: #f1f5f9; margin-bottom: 8px; }
      .sp-modal-phone { font-size: 20px; font-weight: 800; color: #60a5fa; margin-bottom: 20px; letter-spacing: 0.04em; }
      .sp-modal-btns { display: flex; gap: 10px; }
      .sp-modal-call { flex: 1; padding: 12px; background: #3b82f6; color: white; font-size: 14px; font-weight: 700; border-radius: 10px; text-decoration: none; transition: all 0.2s; }
      .sp-modal-call:hover { background: #2563eb; }
      .sp-modal-close { flex: 1; padding: 12px; background: rgba(30,41,59,0.8); border: 1px solid rgba(100,116,139,0.3); color: #94a3b8; font-size: 14px; font-weight: 700; border-radius: 10px; cursor: pointer; font-family: inherit; transition: all 0.2s; }
      .sp-modal-close:hover { background: rgba(100,116,139,0.2); }

      /* ── Toasts ── */
      #sp-toast-wrap { position: fixed; top: 50px; right: 370px; z-index: 2000; display: flex; flex-direction: column; gap: 8px; pointer-events: none; max-width: calc(100vw - 380px); }
      .sp-toast { background: rgba(15,23,42,0.95); border: 1px solid rgba(100,116,139,0.3); border-left: 3px solid #3b82f6; border-radius: 10px; padding: 10px 14px; display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; color: #f1f5f9; max-width: 280px; backdrop-filter: blur(12px); animation: sp-slide-in 0.25s ease; transition: opacity 0.4s, transform 0.4s; box-shadow: 0 4px 20px rgba(0,0,0,0.4); }
      .sp-toast.sp-toast-hide { opacity: 0; transform: translateX(20px); }

      /* ── Animations ── */
      @keyframes sp-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      @keyframes sp-slide-in { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }

      /* ── Grabber ── */
      #sp-grabber {
        display: none;
        justify-content: center;
        align-items: center;
        padding: 10px 0 6px;
        cursor: grab;
        flex-shrink: 0;
        touch-action: none;
        -webkit-tap-highlight-color: transparent;
      }
      #sp-grabber:active { cursor: grabbing; }
      .sp-grabber-bar {
        display: block;
        width: 36px;
        height: 4px;
        background: rgba(100,116,139,0.45);
        border-radius: 2px;
        transition: background 0.2s, width 0.2s;
      }
      #sp-grabber:hover .sp-grabber-bar,
      #sp-grabber:active .sp-grabber-bar {
        background: rgba(96,165,250,0.6);
        width: 44px;
      }

      /* ─────────────────────────────────────────────────────────────────
         Mobile layout — driven by both:
           • CSS media query  (real device / DevTools narrow viewport)
           • body.sp-mobile   (JS matchMedia — works at any CSS viewport)
         ───────────────────────────────────────────────────────────────── */
      @media (max-width: 768px), body.sp-mobile { /* fallback selector trick */
        /* intentionally empty — real rules below under both selectors */
      }

      /* Top bar full-width, taller */
      @media (max-width: 768px) { #staff-topbar { right: 0; height: 48px; padding: 0 12px; } }
      body.sp-mobile #staff-topbar  { right: 0; height: 48px; padding: 0 12px; }

      /* Hide centre text & clock — at 480px (landscape phones) and below */
      @media (max-width: 480px) { .stb-center, .stb-sep-hide, .stb-clock { display: none; } }
      /* Hide at 768px too (desktop panel collapses) */
      @media (max-width: 768px) { .stb-center, .stb-sep-hide, .stb-clock { display: none; } }
      body.sp-mobile .stb-center,
      body.sp-mobile .stb-sep-hide,
      body.sp-mobile .stb-clock { display: none; }

      body.sp-mobile .stb-fan-link { font-size: 11px; padding: 5px 10px; }
      @media (max-width: 768px) { .stb-fan-link { font-size: 11px; padding: 5px 10px; } }

      /* Hide mini-stats bar completely on mobile */
      @media (max-width: 768px) { #staff-ministats { display: none !important; } }
      body.sp-mobile #staff-ministats { display: none !important; }

      /* ── Panel becomes a bottom sheet ── */
      @media (max-width: 768px) {
        #staff-panel {
          top: auto !important;
          left: 0;
          right: 0;
          bottom: 0;
          width: 100% !important;
          height: var(--sp-sheet-h, 148px) !important;
          max-height: 92vh;
          border-left: none;
          border-top: 1px solid rgba(231,138,83,0.25);
          border-radius: 20px 20px 0 0;
          transition: height 0.32s cubic-bezier(0.4,0,0.2,1);
          box-shadow: 0 -8px 40px rgba(0,0,0,0.55);
          padding-bottom: env(safe-area-inset-bottom, 0px);
        }
      }
      body.sp-mobile #staff-panel {
        top: auto !important;
        left: 0;
        right: 0;
        bottom: 0;
        width: 100% !important;
        height: var(--sp-sheet-h, 148px) !important;
        max-height: 92vh;
        border-left: none;
        border-top: 1px solid rgba(231,138,83,0.25);
        border-radius: 20px 20px 0 0;
        transition: height 0.32s cubic-bezier(0.4,0,0.2,1);
        box-shadow: 0 -8px 40px rgba(0,0,0,0.55);
        padding-bottom: env(safe-area-inset-bottom, 0px);
      }

      /* Show grabber */
      @media (max-width: 768px) { #sp-grabber { display: flex; } }
      body.sp-mobile #sp-grabber { display: flex; }

      /* Tabs — larger touch targets */
      @media (max-width: 768px) {
        .sp-tabs { padding: 0 10px; gap: 3px; }
        .sp-tab  { padding: 10px 4px; font-size: 12px; border-radius: 10px; min-height: 44px; }
      }
      body.sp-mobile .sp-tabs { padding: 0 10px; gap: 3px; }
      body.sp-mobile .sp-tab  { padding: 10px 4px; font-size: 12px; border-radius: 10px; min-height: 44px; }

      /* Header compact */
      @media (max-width: 768px) { .sp-header { padding: 10px 14px; } .sp-logo-title { font-size: 14px; } .sp-logo-icon { font-size: 20px; } }
      body.sp-mobile .sp-header      { padding: 10px 14px; }
      body.sp-mobile .sp-logo-title  { font-size: 14px; }
      body.sp-mobile .sp-logo-icon   { font-size: 20px; }

      /* Body / pane padding */
      @media (max-width: 768px) { .sp-pane { padding: 10px 12px 24px; } }
      body.sp-mobile .sp-pane { padding: 10px 12px 24px; }

      /* Peek state: hide content, show only grabber + tabs */
      @media (max-width: 768px) {
        #staff-panel:not(.sp-sheet-open) .sp-header     { display: none; }
        #staff-panel:not(.sp-sheet-open) .sp-search-wrap{ display: none; }
        #staff-panel:not(.sp-sheet-open) .sp-body       { display: none; }
        #staff-panel:not(.sp-sheet-open) .sp-tabs       { padding-top: 4px; }
      }
      body.sp-mobile #staff-panel:not(.sp-sheet-open) .sp-header      { display: none; }
      body.sp-mobile #staff-panel:not(.sp-sheet-open) .sp-search-wrap { display: none; }
      body.sp-mobile #staff-panel:not(.sp-sheet-open) .sp-body        { display: none; }
      body.sp-mobile #staff-panel:not(.sp-sheet-open) .sp-tabs        { padding-top: 4px; }

      /* GPS calib wraps */
      @media (max-width: 768px) { .sp-gps-calib { flex-wrap: wrap; } .sp-calib-select { min-width: 100%; } }
      body.sp-mobile .sp-gps-calib    { flex-wrap: wrap; }
      body.sp-mobile .sp-calib-select { min-width: 100%; }

      /* Stat cards */
      @media (max-width: 768px) { .sp-stat-cards { gap: 6px; } .sp-stat-card { padding: 10px 12px; } .sp-stat-value { font-size: 14px; } }
      body.sp-mobile .sp-stat-cards { gap: 6px; }
      body.sp-mobile .sp-stat-card  { padding: 10px 12px; }
      body.sp-mobile .sp-stat-value { font-size: 14px; }

      /* Bar rows */
      @media (max-width: 768px) { .sp-bar-row { grid-template-columns: 80px 1fr 36px; gap: 6px; } .sp-gate-row { grid-template-columns: 52px 1fr 48px; gap: 6px; } }
      body.sp-mobile .sp-bar-row  { grid-template-columns: 80px 1fr 36px; gap: 6px; }
      body.sp-mobile .sp-gate-row { grid-template-columns: 52px 1fr 48px; gap: 6px; }

      /* Toasts */
      @media (max-width: 768px) { #sp-toast-wrap { right: 10px; left: 10px; top: 58px; align-items: flex-end; } .sp-toast { max-width: 100%; } }
      body.sp-mobile #sp-toast-wrap { right: 10px; left: 10px; top: 58px; align-items: flex-end; }
      body.sp-mobile .sp-toast      { max-width: 100%; }

      /* Filter chips */
      @media (max-width: 768px) { .sp-filter-row { flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch; padding-bottom: 4px; scrollbar-width: none; } .sp-filter-row::-webkit-scrollbar { display: none; } .sp-filter-chip { flex-shrink: 0; } }
      body.sp-mobile .sp-filter-row  { flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch; padding-bottom: 4px; scrollbar-width: none; }
      body.sp-mobile .sp-filter-chip { flex-shrink: 0; }

      /* Fly-to grid */
      @media (max-width: 768px) { .sp-flyto-grid { grid-template-columns: 1fr 1fr 1fr; gap: 6px; } .sp-flyto-btn { font-size: 11px; padding: 8px 6px; } }
      body.sp-mobile .sp-flyto-grid { grid-template-columns: 1fr 1fr 1fr; gap: 6px; }
      body.sp-mobile .sp-flyto-btn  { font-size: 11px; padding: 8px 6px; }

      /* Alerts */
      @media (max-width: 768px) { .sp-alert-card { padding: 12px; } .sp-alert-btns { flex-wrap: wrap; } .sp-alert-act-btn, .sp-alert-nav-btn { min-height: 40px; } }
      body.sp-mobile .sp-alert-card    { padding: 12px; }
      body.sp-mobile .sp-alert-btns    { flex-wrap: wrap; }
      body.sp-mobile .sp-alert-act-btn,
      body.sp-mobile .sp-alert-nav-btn { min-height: 40px; }

      /* Staff items */
      @media (max-width: 768px) { .sp-staff-item { padding: 12px; } .sp-ico-btn { width: 36px; height: 36px; font-size: 16px; } }
      body.sp-mobile .sp-staff-item { padding: 12px; }
      body.sp-mobile .sp-ico-btn    { width: 36px; height: 36px; font-size: 16px; }

      /* Contact modal */
      @media (max-width: 768px) { .sp-modal-box { min-width: unset; width: calc(100vw - 40px); } }
      body.sp-mobile .sp-modal-box { min-width: unset; width: calc(100vw - 40px); }

      /* Landscape phone */
      @media (max-width: 768px) and (orientation: landscape) {
        #staff-panel { max-height: 80vh; }
        #staff-panel.sp-sheet-open { height: 70vh; }
      }
    `;
    document.head.appendChild(style);
  }
}
