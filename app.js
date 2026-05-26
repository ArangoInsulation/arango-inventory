// ============================================================
// ARANGO INSULATION — App principal
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Config Supabase ─────────────────────────────────────────
const SUPABASE_URL = 'https://elybdaocjkepznfzusdz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVseWJkYW9jamtlcHpuZnp1c2R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMjA0OTgsImV4cCI6MjA5NDY5NjQ5OH0.j34a-SS0jOxH2YFAizPFR0Ql-aeD_0m_suf3XvG0hjk'; const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Estado global ───────────────────────────────────────────
let STATE = {
  session: null,
  profile: null,
  bodega: 'Charlotte',
  page: 'dashboard',
};

// ── Inicialización ──────────────────────────────────────────
async function init() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    STATE.session = session;
    await loadProfile();
    showApp();
  } else {
    showLogin();
  }

  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN') {
      STATE.session = session;
      await loadProfile();
      showApp();
    } else if (event === 'SIGNED_OUT') {
      STATE.session = null;
      STATE.profile = null;
      showLogin();
    }
  });
}

async function loadProfile() {
  const { data } = await sb.from('profiles').select('*').eq('id', STATE.session.user.id).single();
  STATE.profile = data;
  if (data) {
    document.getElementById('user-name').textContent = data.full_name;
    document.getElementById('user-role').textContent = data.role;
    document.getElementById('user-avatar').textContent = data.full_name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase();
    if (data.bodega && data.bodega !== 'Ambas') {
      STATE.bodega = data.bodega;
    }
  }
  updateBodegaTags();
  updateNavForRole();
}

function showLogin() {
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('app-screen').classList.add('hidden');
}

function showApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('hidden');
  setupNav();
  navigateTo('dashboard');
}

// ── Auth ────────────────────────────────────────────────────
window.handleLogin = async function() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const btn = document.getElementById('login-btn');
  const err = document.getElementById('login-error');
  err.classList.add('hidden');
  btn.disabled = true;
  btn.innerHTML = '<i class="ti ti-loader-2 spin"></i> Entrando...';
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    err.textContent = 'Correo o contraseña incorrectos.';
    err.classList.remove('hidden');
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-login"></i> Iniciar sesión';
  }
};

window.handleLogout = async function() {
  await sb.auth.signOut();
};

// ── Navegación ──────────────────────────────────────────────
function setupNav() {
  document.querySelectorAll('.nav-item[data-page]').forEach(el => {
    el.addEventListener('click', () => {
      navigateTo(el.dataset.page);
      document.getElementById('sidebar').classList.remove('open');
    });
  });
}

function updateNavForRole() {
  const role = STATE.profile?.role;
  const bodega = STATE.profile?.bodega;

  // Hide nav items based on role
  document.querySelectorAll('[data-roles]').forEach(el => {
    const roles = el.dataset.roles.split(',');
    el.style.display = roles.includes(role) ? '' : 'none';
  });

  // Bodeguero: lock to their warehouse
  if (role === 'bodeguero' && bodega && bodega !== 'Ambas') {
    STATE.bodega = bodega;
    updateBodegaTags();
    // Hide bodega selector
    document.querySelector('.bodega-selector').style.display = 'none';
  }

  // Supervisor: hide action buttons (handled per page)
  // Jefe de bodega: show all bodegas
}

function canEdit() {
  const role = STATE.profile?.role;
  return ['admin','jefe_bodega','bodeguero'].includes(role);
}

function isAdmin() {
  return STATE.profile?.role === 'admin';
}

function isSupervisor() {
  return STATE.profile?.role === 'supervisor';
}

window.navigateTo = function(page) {
  STATE.page = page;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const activeNav = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (activeNav) activeNav.classList.add('active');
  const titles = {
    dashboard: 'Dashboard',
    bol: 'Nuevo Bill of Lading',
    recepcion: 'Recepción de material — IN',
    stock: 'Stock actual · ' + STATE.bodega,
    output: 'OUTPUT — Historial de salidas',
    'in-history': 'IN — Historial de entradas',
    usuarios: 'Gestión de usuarios',
    'materiales-admin': 'Catálogo de materiales',
    'proyectos-admin': 'Proyectos',
  };
  document.getElementById('page-title').textContent = titles[page] || page;
  document.getElementById('topbar-actions').innerHTML = '';
  const pages = { dashboard: renderDashboard, bol: renderBOL, recepcion: renderRecepcion, stock: renderStock, output: renderOutput, 'in-history': renderInHistory, usuarios: renderUsuarios, 'materiales-admin': renderMaterialesAdmin, 'proyectos-admin': renderProyectosAdmin };
  (pages[page] || renderDashboard)();
};

window.setBodega = function(b) {
  // Bodeguero can only see their own warehouse
  if (STATE.profile?.role === 'bodeguero' && STATE.profile?.bodega !== 'Ambas') {
    toast('Solo tienes acceso a la bodega ' + STATE.profile.bodega, 'error');
    return;
  }
  STATE.bodega = b;
  updateBodegaTags();
  navigateTo(STATE.page);
};

function updateBodegaTags() {
  ['Charlotte','Atlanta','Orlando','Tennessee'].forEach(n => {
    const el = document.getElementById('tag-' + n);
    if (el) el.className = 'bodega-tag' + (n === STATE.bodega ? ' active' : '');
  });
}

window.toggleSidebar = function() {
  document.getElementById('sidebar').classList.toggle('open');
};

// ── Toast ───────────────────────────────────────────────────
function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<i class="ti ti-${type === 'success' ? 'check' : 'alert-circle'}"></i> ${msg}`;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 3500);
}

function setContent(html) {
  document.getElementById('page-content').innerHTML = html;
}

function setTopbarActions(html) {
  document.getElementById('topbar-actions').innerHTML = html;
}

// ════════════════════════════════════════════════════════════
// PÁGINA: DASHBOARD
// ════════════════════════════════════════════════════════════
async function renderDashboard() {
  setContent(`<div class="loading-spinner"><i class="ti ti-loader-2 spin"></i> Cargando...</div>`);
  setTopbarActions(canEdit() ? `
    <button class="btn btn-primary" onclick="navigateTo('bol')"><i class="ti ti-plus"></i> Bill of Lading</button>
    <button class="btn btn-success" onclick="navigateTo('recepcion')"><i class="ti ti-arrow-down-left"></i> Entrada</button>
  ` : '');

  try {
    const stock = await getStockActual(STATE.bodega);
    const ok = stock.filter(i => i.estado_stock === 'ok').length;
    const low = stock.filter(i => i.estado_stock === 'bajo').length;
    const out = stock.filter(i => i.estado_stock === 'agotado').length;
    const alerts = stock.filter(i => i.estado_stock !== 'ok').slice(0, 8);

    const { data: recentBOL } = await sb.from('bill_of_lading')
      .select('fecha, driver, proyecto:proyectos(nombre), bol_items(cantidad, unidad, material:materiales(referencia))')
      .eq('bodega', STATE.bodega)
      .order('created_at', { ascending: false })
      .limit(5);

    setContent(`
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-label">Con stock</div><div class="stat-value green">${ok}</div></div>
        <div class="stat-card"><div class="stat-label">Stock bajo</div><div class="stat-value amber">${low}</div></div>
        <div class="stat-card"><div class="stat-label">Agotados</div><div class="stat-value red">${out}</div></div>
        <div class="stat-card"><div class="stat-label">Total materiales</div><div class="stat-value">${stock.length}</div></div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="card">
          <div class="section-title">Alertas de stock — ${STATE.bodega}</div>
          ${alerts.length === 0
            ? '<p style="font-size:13px;color:var(--text2)">Todo el inventario está en orden</p>'
            : alerts.map(i => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:0.5px solid var(--border)">
                <span style="font-size:12px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-right:8px">${i.referencia}</span>
                <span class="badge badge-${i.estado_stock === 'bajo' ? 'low' : 'out'}">${i.estado_stock === 'agotado' ? 'Agotado' : 'Bajo: ' + i.saldo_actual}</span>
              </div>`).join('')}
        </div>

        <div class="card">
          <div class="section-title">Últimos despachos</div>
          ${!recentBOL?.length
            ? '<p style="font-size:13px;color:var(--text2)">Sin despachos registrados aún</p>'
            : recentBOL.map(b => `
              <div style="padding:6px 0;border-bottom:0.5px solid var(--border)">
                <div style="display:flex;justify-content:space-between">
                  <span style="font-size:12px;font-weight:500">${b.proyecto?.nombre || '—'}</span>
                  <span style="font-size:11px;color:var(--text3)">${b.fecha}</span>
                </div>
                <div style="font-size:11px;color:var(--text2)">${b.driver} · ${b.bol_items?.length || 0} items</div>
              </div>`).join('')}
        </div>
      </div>
    `);
  } catch (e) {
    setContent(`<div class="alert alert-danger"><i class="ti ti-alert-circle"></i> Error cargando datos: ${e.message}</div>`);
  }
}

// ════════════════════════════════════════════════════════════
// PÁGINA: STOCK ACTUAL
// ════════════════════════════════════════════════════════════
async function renderStock() {
  setContent(`<div class="loading-spinner"><i class="ti ti-loader-2 spin"></i> Cargando...</div>`);
  setTopbarActions(`
    <input type="search" placeholder="Buscar material..." style="width:180px" oninput="filterStock(this.value)">
    <button class="btn btn-success" onclick="navigateTo('recepcion')"><i class="ti ti-plus"></i> Nueva entrada</button>
  `);
  try {
    const data = await getStockActual(STATE.bodega);
    setContent(`
      <div class="tbl-wrap">
        <table id="stock-table">
          <thead><tr>
            <th style="width:35%">Referencia</th>
            <th style="text-align:right">Inicial</th>
            <th style="text-align:right;color:var(--green-text)">Entradas</th>
            <th style="text-align:right;color:var(--red-text)">Salidas</th>
            <th style="text-align:right">Saldo</th>
            <th style="text-align:right">Mín.</th>
            <th>Estado</th>
          </tr></thead>
          <tbody id="stock-body">
            ${data.map(i => `<tr>
              <td title="${i.referencia}">${i.referencia}</td>
              <td style="text-align:right">${i.stock_inicial}</td>
              <td style="text-align:right;color:var(--green-text);font-weight:500">+${i.total_entradas}</td>
              <td style="text-align:right;color:var(--red-text);font-weight:500">-${i.total_salidas}</td>
              <td style="text-align:right;font-weight:500;color:${i.saldo_actual < 0 ? 'var(--red)' : i.saldo_actual < i.stock_minimo ? 'var(--amber)' : 'inherit'}">${i.saldo_actual}</td>
              <td style="text-align:right">${i.stock_minimo}</td>
              <td><span class="badge badge-${i.estado_stock === 'ok' ? 'ok' : i.estado_stock === 'bajo' ? 'low' : 'out'}">${i.estado_stock === 'ok' ? 'OK' : i.estado_stock === 'bajo' ? 'Bajo' : 'Agotado'}</span></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    `);
  } catch (e) {
    setContent(`<div class="alert alert-danger"><i class="ti ti-alert-circle"></i> ${e.message}</div>`);
  }
}

window.filterStock = function(q) {
  document.querySelectorAll('#stock-body tr').forEach(r => {
    r.style.display = r.cells[0]?.textContent.toLowerCase().includes(q.toLowerCase()) ? '' : 'none';
  });
};

// ════════════════════════════════════════════════════════════
// PÁGINA: BILL OF LADING
// ════════════════════════════════════════════════════════════
let bolItems = [];

async function renderBOL() {
  bolItems = [];
  setContent(`<div class="loading-spinner"><i class="ti ti-loader-2 spin"></i> Cargando...</div>`);
  setTopbarActions(`<button class="btn" onclick="printBOL()"><i class="ti ti-printer"></i> Imprimir</button>`);

  try {
    const [materiales, proyectos] = await Promise.all([
      getMateriales(),
      getProyectos(STATE.bodega),
    ]);
    const instaladores = await getInstaladores(STATE.bodega);

    // Store projects globally for autocomplete
    window._proyectosData = proyectos;

    setContent(`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div>
        <div class="section-title">Datos del despacho</div>
        <div class="grid2">
          <div class="field" style="grid-column:1/-1"><label>Proyecto</label>
            <select id="b-proj" onchange="autocompleteBOL(this)">
              <option value="">Seleccionar...</option>
              ${proyectos.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('')}
            </select>
          </div>
          <div class="field"><label>Project Manager</label>
            <input type="text" id="b-pm-text" placeholder="Se autocompleta" readonly style="background:var(--bg2)">
            <input type="hidden" id="b-pm">
          </div>
          <div class="field"><label>Compañía</label>
            <input type="text" id="b-compania" placeholder="Se autocompleta" readonly style="background:var(--bg2)">
          </div>
          <div class="field"><label>Ciudad</label>
            <input type="text" id="b-ciudad" placeholder="Se autocompleta" readonly style="background:var(--bg2)">
          </div>
          <div class="field"><label>Estado</label>
            <input type="text" id="b-estado" placeholder="Se autocompleta" readonly style="background:var(--bg2)">
          </div>
          <div class="field"><label>WO #</label><input type="text" id="b-wo" placeholder="ej. 3073180"></div>
          <div class="field"><label>Tracking #</label><input type="text" id="b-tracking" placeholder="ej. 163"></div>
          <div class="field"><label>Driver / Installer</label>
            <select id="b-driver">
              <option value="">Seleccionar...</option>
              ${instaladores.map(i => `<option>${i}</option>`).join('')}
            </select>
          </div>
          <div class="field"><label>Fecha</label><input type="date" id="b-fecha" value="${new Date().toISOString().slice(0,10)}"></div>
          <div class="field"><label>Working Hours</label><input type="text" id="b-working-hours" placeholder="ej. 8"></div>
          <div class="field"><label>Payment Labor</label><input type="text" id="b-payment-labor" placeholder="ej. 4"></div>
        </div>

        <div class="section-title" style="margin-top:4px">Items del despacho</div>
        <div style="display:flex;gap:6px;margin-bottom:8px">
          <select id="b-mat" style="flex:2">
            <option value="">Material...</option>
            ${materiales.map(m => `<option value="${m.id}" data-ref="${m.referencia}">${m.referencia}</option>`).join('')}
          </select>
          <input type="number" id="b-qty" placeholder="Qty" min="1" style="width:65px">
          <select id="b-um" style="width:85px">
            <option>BUNDLE</option><option>BAG</option><option>UNIT</option><option>PACK</option><option>BOX</option>
          </select>
          <button class="btn btn-primary" onclick="addBolItem()" style="flex:none"><i class="ti ti-plus"></i></button>
        </div>
        <div id="bol-items-list"></div>
        <button class="btn btn-primary" style="margin-top:10px;width:100%" onclick="saveBOL()">
          <i class="ti ti-device-floppy"></i> Guardar — actualiza OUTPUT e inventario
        </button>
      </div>

      <div>
        <div class="section-title">Vista previa</div>
        <div id="bol-preview" style="border:0.5px solid var(--border);border-radius:var(--radius);padding:16px;font-size:12px;background:var(--bg2)">
          <div style="text-align:center;font-size:15px;font-weight:500;margin-bottom:12px">BILL OF LADING</div>
          <div style="display:flex;justify-content:space-between;margin-bottom:10px">
            <div>
              <div style="font-size:10px;color:var(--text2);font-weight:500">PICKUP FROM</div>
              <div style="font-weight:500">ARANGO INSULATION INC.</div>
              <div style="color:var(--text2);font-size:11px">${STATE.bodega === 'Charlotte' ? '13827 Carowinds Blvd, Charlotte NC' : STATE.bodega === 'Atlanta' ? '149 North 85 Pkwy, Fayetteville GA' : STATE.bodega === 'Orlando' ? 'Orlando, FL' : 'Tennessee'}</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:10px;color:var(--text2)">Date</div>
              <div id="p-fecha">${new Date().toISOString().slice(0,10)}</div>
            </div>
          </div>
          <div style="border-top:0.5px solid var(--border);padding-top:10px;margin-bottom:10px">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
              <div>
                <div style="font-size:10px;color:var(--text2);font-weight:500">DELIVER TO</div>
                <div id="p-proj" style="font-weight:500">—</div>
                <div id="p-compania" style="color:var(--text2);font-size:11px">—</div>
                <div id="p-direccion" style="color:var(--text2);font-size:11px">—</div>
              </div>
              <div>
                <div style="font-size:10px;color:var(--text2);font-weight:500">DRIVER</div>
                <div id="p-driver" style="font-weight:500">—</div>
                <div style="color:var(--text2);font-size:11px">WO: <span id="p-wo">—</span></div>
                <div style="font-size:10px;color:var(--text2);font-weight:500;margin-top:6px">PM</div>
                <div id="p-pm-preview" style="font-size:11px">—</div>
              </div>
            </div>
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:11px">
            <thead><tr>
              <th style="text-align:left;padding:4px;border-bottom:0.5px solid var(--border)">QTY</th>
              <th style="text-align:left;padding:4px;border-bottom:0.5px solid var(--border)">U/M</th>
              <th style="text-align:left;padding:4px;border-bottom:0.5px solid var(--border)">Material</th>
            </tr></thead>
            <tbody id="p-items"><tr><td colspan="3" style="padding:4px;color:var(--text3);font-style:italic">Sin items</td></tr></tbody>
          </table>
          <div style="margin-top:12px;display:flex;justify-content:space-between;font-size:10px;color:var(--text2)">
            <span>Warehouse: _______________</span>
            <span>Driver: _______________</span>
          </div>
        </div>
      </div>
    </div>
    `);

    ['b-proj','b-wo','b-tracking','b-driver','b-fecha'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', updateBOLPreview);
    });
  } catch (e) {
    setContent(`<div class="alert alert-danger"><i class="ti ti-alert-circle"></i> ${e.message}</div>`);
  }
}

window.autocompleteBOL = function(sel) {
  const id = sel.value;
  const proy = (window._proyectosData || []).find(p => p.id === id);
  if (!proy) return;
  const s = (elId, val) => { const e = document.getElementById(elId); if(e) e.value = val || ''; };
  const st = (elId, val) => { const e = document.getElementById(elId); if(e) e.textContent = val || '—'; };
  s('b-pm-text', proy.pm_nombre || '');
  s('b-compania', proy.compania || '');
  s('b-ciudad', proy.ciudad || '');
  s('b-estado', proy.estado || '');
  st('p-proj', proy.nombre);
  st('p-compania', proy.compania);
  st('p-direccion', proy.direccion || (proy.ciudad ? proy.ciudad + ', ' + proy.estado : ''));
  st('p-pm-preview', proy.pm_nombre);
  updateBOLPreview();
};

window.addBolItem = function() {
  const matEl = document.getElementById('b-mat');
  const matId = matEl.value;
  const matRef = matEl.options[matEl.selectedIndex]?.dataset?.ref;
  const qty = parseInt(document.getElementById('b-qty').value) || 0;
  const um = document.getElementById('b-um').value;
  if (!matId || qty < 1) { toast('Selecciona un material y cantidad', 'error'); return; }
  const ex = bolItems.findIndex(i => i.material_id === matId);
  if (ex >= 0) bolItems[ex].cantidad += qty;
  else bolItems.push({ material_id: matId, referencia: matRef, cantidad: qty, unidad: um });
  matEl.value = ''; document.getElementById('b-qty').value = '';
  renderBolItemsList();
  updateBOLPreview();
};

function renderBolItemsList() {
  const el = document.getElementById('bol-items-list');
  if (!el) return;
  el.innerHTML = bolItems.map((it, i) => `
    <div class="item-row">
      <div style="flex:1;font-size:12px"><span style="font-weight:500">${it.cantidad} ${it.unidad}</span> · ${it.referencia}</div>
      <button class="btn-icon" onclick="bolItems.splice(${i},1);renderBolItemsList();updateBOLPreview()"><i class="ti ti-x"></i></button>
    </div>`).join('');
}

function updateBOLPreview() {
  const g = id => { const e = document.getElementById(id); return e ? e.value : ''; };
  const s = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v || '—'; };
  const projSel = document.getElementById('b-proj');
  const projName = projSel?.options[projSel.selectedIndex]?.text || '—';
  s('p-proj', projName !== 'Seleccionar...' ? projName : '—');
  s('p-driver', g('b-driver'));
  s('p-wo', g('b-wo'));
  s('p-fecha', g('b-fecha'));
  s('p-compania', g('b-compania'));
  s('p-pm-preview', g('b-pm-text'));
  const ciudad = g('b-ciudad');
  const estado = g('b-estado');
  s('p-direccion', ciudad && estado ? ciudad + ', ' + estado : '');
  const tb = document.getElementById('p-items');
  if (tb) tb.innerHTML = bolItems.length
    ? bolItems.map(it => `<tr><td style="padding:3px 4px">${it.cantidad}</td><td style="padding:3px 4px">${it.unidad}</td><td style="padding:3px 4px;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${it.referencia}</td></tr>`).join('')
    : '<tr><td colspan="3" style="padding:4px;color:var(--text3);font-style:italic">Sin items</td></tr>';
}

window.saveBOL = async function() {
  const proj = document.getElementById('b-proj').value;
  const driver = document.getElementById('b-driver').value;
  const wo = document.getElementById('b-wo').value;
  const tracking = document.getElementById('b-tracking').value;
  const fecha = document.getElementById('b-fecha').value;
  const pm_text = document.getElementById('b-pm-text').value;
  if (!proj || !driver || bolItems.length === 0) {
    toast('Completa proyecto, driver y agrega materiales', 'error'); return;
  }
  try {
    const { data: bol, error } = await sb.from('bill_of_lading')
      .insert({ bodega: STATE.bodega, fecha, proyecto_id: proj, wo_number: wo, tracking, driver, notas: pm_text, registrado_por: STATE.profile.id })
      .select().single();
    if (error) throw error;
    const items = bolItems.map(i => ({ bol_id: bol.id, material_id: i.material_id, cantidad: i.cantidad, unidad: i.unidad }));
    const { error: ie } = await sb.from('bol_items').insert(items);
    if (ie) throw ie;
    bolItems = [];
    toast('Bill of Lading guardado. Inventario actualizado.');
    setContent(`
      <div style="text-align:center;padding:40px">
        <div style="width:56px;height:56px;border-radius:50%;background:var(--green-light);display:flex;align-items:center;justify-content:center;margin:0 auto 14px;font-size:24px;color:var(--green-text)"><i class="ti ti-check"></i></div>
        <div style="font-size:16px;font-weight:500;margin-bottom:6px">Bill of Lading guardado</div>
        <div style="font-size:13px;color:var(--text2);margin-bottom:20px">OUTPUT e inventario de ${STATE.bodega} actualizados.</div>
        <div style="display:flex;gap:8px;justify-content:center">
          <button class="btn btn-primary" onclick="navigateTo('bol')"><i class="ti ti-plus"></i> Nuevo BOL</button>
          <button class="btn" onclick="navigateTo('stock')"><i class="ti ti-package"></i> Ver stock</button>
          <button class="btn" onclick="navigateTo('output')"><i class="ti ti-arrow-up-right"></i> Ver OUTPUT</button>
        </div>
      </div>`);
  } catch (e) { toast(e.message, 'error'); }
};

window.printBOL = function() {
  const projSel = document.getElementById('b-proj');
  const proy = (window._proyectosData || []).find(p => p.id === projSel?.value) || {};
  const fecha = document.getElementById('b-fecha')?.value || new Date().toISOString().slice(0,10);
  const fechaFmt = new Date(fecha + 'T12:00:00').toLocaleDateString('en-US', {weekday:'long', year:'numeric', month:'long', day:'numeric'});
  const bodega = STATE.bodega;
  const addresses = {
    Charlotte: '13827 Carowinds Blvd, Charlotte, NC',
    Atlanta: '149 North 85 Parkway, Fayetteville, GA',
    Orlando: 'Orlando, FL',
    Tennessee: 'Tennessee'
  };

  const itemsHTML = bolItems.length
    ? bolItems.map(it => `<tr><td style="text-align:center;border:1px solid #ccc;padding:4px">${it.cantidad}</td><td style="text-align:center;border:1px solid #ccc;padding:4px">${it.unidad}</td><td style="border:1px solid #ccc;padding:4px">${it.referencia}</td><td style="border:1px solid #ccc;padding:4px"></td></tr>`).join('')
    : '';

  // Fill empty rows to have at least 15
  const emptyRows = Math.max(0, 15 - bolItems.length);
  const emptyHTML = Array(emptyRows).fill('<tr><td style="border:1px solid #ccc;padding:4px;height:22px"></td><td style="border:1px solid #ccc;padding:4px"></td><td style="border:1px solid #ccc;padding:4px"></td><td style="border:1px solid #ccc;padding:4px"></td></tr>').join('');

  const modal = document.createElement('div');
  modal.id = 'bol-modal';
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9999;overflow-y:auto;padding:20px';
  modal.innerHTML = `
    <div style="max-width:900px;margin:0 auto;background:#fff;padding:16px;border-radius:8px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <span style="font-size:14px;font-weight:500;color:#333">Bill of Lading — Vista previa</span>
        <div style="display:flex;gap:8px">
          <button onclick="window.print()" style="background:#2B2B7B;color:#fff;border:none;padding:8px 18px;cursor:pointer;border-radius:6px;font-size:13px">🖨 Imprimir / Guardar PDF</button>
          <button onclick="document.getElementById('bol-modal').remove()" style="background:#eee;border:none;padding:8px 14px;cursor:pointer;border-radius:6px;font-size:13px">✕ Cerrar</button>
        </div>
      </div>
      <div id="bol-print-content" style="font-family:Arial,sans-serif;font-size:11px;color:#000">

        <!-- HEADER -->
        <table style="width:100%;border-collapse:collapse;border:1px solid #2B2B7B;margin-bottom:0">
          <tr>
            <td style="width:220px;padding:8px 12px;border-right:1px solid #2B2B7B;vertical-align:middle">
              <div style="display:flex;align-items:center;gap:10px">
                <div style="background:#2B2B7B;color:#fff;font-size:22px;font-weight:bold;font-style:italic;padding:6px 12px;border-radius:6px;font-family:Georgia,serif">AI</div>
                <div style="font-size:14px;font-style:italic;font-weight:bold;color:#2B2B7B;line-height:1.3">Arango<br>Insulation</div>
              </div>
            </td>
            <td style="text-align:center;padding:8px;vertical-align:middle">
              <div style="font-size:22px;font-weight:bold;letter-spacing:3px">BILL OF LADING</div>
            </td>
            <td style="width:160px;padding:8px 12px;border-left:1px solid #2B2B7B;text-align:right;vertical-align:middle">
              <div style="font-size:10px;color:#666">Date:</div>
              <div style="font-weight:bold;font-size:11px">${fechaFmt}</div>
            </td>
          </tr>
        </table>

        <!-- PICKUP / ADDITIONAL INFO -->
        <table style="width:100%;border-collapse:collapse;border:1px solid #2B2B7B;border-top:none;margin-bottom:0">
          <tr>
            <td style="width:50%;border-right:1px solid #2B2B7B;vertical-align:top">
              <div style="background:#2B2B7B;color:#fff;font-weight:bold;padding:4px 8px;text-align:center;letter-spacing:1px;font-size:11px">PICKUP FROM</div>
              <div style="padding:8px">
                <div style="font-weight:bold;font-size:13px;margin-bottom:4px">ARANGO INSULATION INC.</div>
                <div style="color:#444;font-size:11px">${addresses[bodega]||''}</div>
              </div>
            </td>
            <td style="width:50%;vertical-align:top">
              <div style="background:#2B2B7B;color:#fff;font-weight:bold;padding:4px 8px;text-align:center;letter-spacing:1px;font-size:11px">ADDITIONAL INFORMATION</div>
              <div style="padding:8px">
                <table style="width:100%;border-collapse:collapse;font-size:11px">
                  <tr>
                    <td style="padding:2px 0"><b style="color:#2B2B7B">CARRIER:</b> Arango Insulation INC</td>
                    <td style="padding:2px 0"><b style="color:#2B2B7B">PRO#:</b> WAREHOUSE</td>
                  </tr>
                  <tr>
                    <td style="padding:2px 0;border-bottom:0.5px solid #ccc"><b style="color:#2B2B7B">TRACKING:</b> ${document.getElementById('b-tracking')?.value||''}</td>
                    <td style="padding:2px 0;border-bottom:0.5px solid #ccc"><b style="color:#2B2B7B">WO#:</b> ${document.getElementById('b-wo')?.value||''}</td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>
        </table>

        <!-- DELIVER TO / DRIVER -->
        <table style="width:100%;border-collapse:collapse;border:1px solid #2B2B7B;border-top:none;margin-bottom:0">
          <tr>
            <td style="width:50%;border-right:1px solid #2B2B7B;vertical-align:top">
              <div style="background:#2B2B7B;color:#fff;font-weight:bold;padding:4px 8px;text-align:center;letter-spacing:1px;font-size:11px">DELIVER TO</div>
              <div style="padding:8px">
                ${[
                  ['JOB NAME', proy.nombre||''],
                  ['ADDRESS', proy.direccion||''],
                  ['PROJECT MANAGER', proy.pm_nombre||document.getElementById('b-pm-text')?.value||''],
                  ['COMPANY', proy.compania||document.getElementById('b-compania')?.value||''],
                  ['STATUS', proy.estado||document.getElementById('b-estado')?.value||''],
                  ['CITY', proy.ciudad||document.getElementById('b-ciudad')?.value||''],
                ].map(([l,v])=>`<div style="display:flex;align-items:flex-start;margin-bottom:4px;font-size:11px">
                  <span style="font-weight:bold;color:#2B2B7B;min-width:120px;font-size:10px">${l}:</span>
                  <span style="flex:1;border-bottom:0.5px solid #999;padding-bottom:1px">${v}</span>
                </div>`).join('')}
              </div>
            </td>
            <td style="width:50%;vertical-align:top">
              <div style="background:#2B2B7B;color:#fff;font-weight:bold;padding:4px 8px;text-align:center;letter-spacing:1px;font-size:11px">DRIVER TO / INSTALLER</div>
              <div style="padding:8px">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
                  <div>
                    <div style="font-size:10px;color:#666;margin-bottom:2px">Driver / Installer</div>
                    <div style="font-weight:bold;font-size:13px">${document.getElementById('b-driver')?.value||''}</div>
                  </div>
                  <div>
                    <div style="font-size:10px;color:#666;margin-bottom:2px">Supervisor / PM</div>
                    <div style="font-size:12px">${proy.pm_nombre||document.getElementById('b-pm-text')?.value||''}</div>
                  </div>
                </div>
                <div style="display:flex;align-items:center;margin-bottom:6px;font-size:11px">
                  <span style="font-weight:bold;color:#2B2B7B;min-width:120px">WORKING HOURS:</span>
                  <span style="flex:1;border-bottom:0.5px solid #999">${document.getElementById('b-working-hours')?.value||''}</span>
                </div>
                <div style="display:flex;align-items:center;font-size:11px">
                  <span style="font-weight:bold;color:#2B2B7B;min-width:120px">PAYMENT LABOR:</span>
                  <span style="flex:1;border-bottom:0.5px solid #999">${document.getElementById('b-payment-labor')?.value||''}</span>
                </div>
              </div>
            </td>
          </tr>
        </table>

        <!-- ITEMS TABLE -->
        <table style="width:100%;border-collapse:collapse;border:1px solid #2B2B7B;border-top:none">
          <thead>
            <tr style="background:#2B2B7B;color:#fff">
              <th style="padding:5px;text-align:center;border:1px solid #2B2B7B;width:60px">QTY</th>
              <th style="padding:5px;text-align:center;border:1px solid #2B2B7B;width:70px">U/M</th>
              <th style="padding:5px;text-align:left;border:1px solid #2B2B7B">ITEM / DESCRIPTION</th>
              <th style="padding:5px;text-align:left;border:1px solid #2B2B7B;width:150px">OBSERVATION</th>
            </tr>
          </thead>
          <tbody>${itemsHTML}${emptyHTML}</tbody>
        </table>

        <!-- LEGAL -->
        <table style="width:100%;border-collapse:collapse;border:1px solid #2B2B7B;border-top:none">
          <tr>
            <td style="width:50%;padding:6px 8px;font-size:9px;line-height:1.4;border-right:1px solid #2B2B7B;vertical-align:top">
              This is to certify that the above named materials are properly classified, described, packaged, marked and labeled, and are in proper condition for transportation according to the applicable regulations of the U.S. DOT.
            </td>
            <td style="width:50%;padding:6px 8px;font-size:9px;line-height:1.4;vertical-align:top">
              Carrier acknowledges receipt of packages and required placards. Carrier certifies emergency response information was made available and/or carrier has the U.S. DOT emergency response guidebook or equivalent documentation in the vehicle. Property described above is received in good order, except as noted.
            </td>
          </tr>
        </table>

        <!-- SIGNATURES -->
        <table style="width:100%;border-collapse:collapse;border:1px solid #2B2B7B;border-top:none">
          <tr>
            <td style="width:50%;border-right:1px solid #2B2B7B;vertical-align:top">
              <div style="background:#2B2B7B;color:#fff;font-weight:bold;padding:4px 8px;text-align:center;font-size:11px;margin-bottom:8px">WAREHOUSE</div>
              <div style="padding:6px 10px">
                ${['Date','Time','Warehouse Clerk Name'].map(l=>`
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;font-size:11px">
                  <span style="font-weight:bold;color:#2B2B7B;min-width:130px">${l}:</span>
                  <span style="flex:1;border-bottom:1px solid #000;min-height:18px;display:block"></span>
                </div>`).join('')}
              </div>
            </td>
            <td style="width:50%;vertical-align:top">
              <div style="background:#2B2B7B;color:#fff;font-weight:bold;padding:4px 8px;text-align:center;font-size:11px;margin-bottom:8px">DRIVER / INSTALLER</div>
              <div style="padding:6px 10px">
                ${['Time of arrival at the project','Driver Name','Unloading Time','Signature of Receipt'].map(l=>`
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;font-size:11px">
                  <span style="font-weight:bold;color:#2B2B7B;min-width:160px">${l}:</span>
                  <span style="flex:1;border-bottom:1px solid #000;min-height:18px;display:block"></span>
                </div>`).join('')}
              </div>
            </td>
          </tr>
        </table>

      </div>
    </div>
    <style>
      @media print {
        body > *:not(#bol-modal) { display: none !important; }
        #bol-modal { position:static !important; background:white !important; padding:0 !important; }
        #bol-modal > div > div:first-child { display:none !important; }
        #bol-modal > div { border-radius:0 !important; padding:8px !important; }
      }
    </style>
  `;
  document.body.appendChild(modal);
};

// ════════════════════════════════════════════════════════════
// PÁGINA: RECEPCIÓN IN
// ════════════════════════════════════════════════════════════
let inItems = [];

async function renderRecepcion() {
  inItems = [];
  setContent(`<div class="loading-spinner"><i class="ti ti-loader-2 spin"></i> Cargando...</div>`);
  setTopbarActions('');
  const materiales = await getMateriales();

  setContent(`
    <div style="max-width:560px">
      <div class="alert alert-info"><i class="ti ti-info-circle"></i> Al guardar, el inventario de ${STATE.bodega} se actualiza automáticamente.</div>
      <div class="card">
        <div class="section-title">Datos del pedido</div>
        <div class="grid2">
          <div class="field"><label>Fecha de llegada</label><input type="date" id="i-fecha" value="${new Date().toISOString().slice(0,10)}"></div>
          <div class="field"><label>PO Number <span style="color:var(--red-text)">*</span></label>
            <input type="text" id="i-po" placeholder="ej. AIC-21349" style="border-color:var(--border2)">
          </div>
          <div class="field"><label>Proveedor</label>
            <select id="i-sup">
              ${['JM','Rockwool','Appalachian','RIS','IDI','Airgas','Sherwin Williams','Cam Ashley connect','Warehouse Atlanta','Warehouse Charlotte','Otro'].map(s => `<option>${s}</option>`).join('')}
            </select>
          </div>
          <div class="field"><label>Estado</label>
            <select id="i-status"><option>Complete</option><option>Incomplete</option><option>Pending</option></select>
          </div>
          <div class="field"><label>Tracking</label><input type="text" id="i-track" placeholder="Opcional"></div>
        </div>
        <div class="field" style="margin-top:4px">
          <label>Observaciones</label>
          <textarea id="i-obs" placeholder="Ingresa cualquier observación relevante sobre esta entrada..." style="width:100%;min-height:80px;padding:8px 10px;border:0.5px solid var(--border2);border-radius:var(--border-radius-md);background:var(--bg);color:var(--text);font-size:13px;font-family:var(--font);resize:vertical"></textarea>
        </div>
      </div>
      <div class="card">
        <div class="section-title">Materiales recibidos</div>
        <div style="display:flex;gap:6px;margin-bottom:8px">
          <select id="i-mat" style="flex:2">
            <option value="">Material...</option>
            ${materiales.map(m => `<option value="${m.id}" data-ref="${m.referencia}">${m.referencia}</option>`).join('')}
          </select>
          <input type="number" id="i-qty" placeholder="Qty" min="1" style="width:65px">
          <select id="i-um" style="width:85px"><option>BUNDLE</option><option>BAG</option><option>UNIT</option><option>PACK</option></select>
          <button class="btn btn-primary" onclick="addInItem()" style="flex:none"><i class="ti ti-plus"></i></button>
        </div>
        <div id="in-items-list"></div>
      </div>
      <button class="btn btn-primary btn-full" onclick="saveIN()">
        <i class="ti ti-device-floppy"></i> Guardar entrada — actualiza inventario
      </button>
    </div>
  `);
}

window.addInItem = function() {
  const matEl = document.getElementById('i-mat');
  const matId = matEl.value;
  const matRef = matEl.options[matEl.selectedIndex]?.dataset?.ref;
  const qty = parseInt(document.getElementById('i-qty').value) || 0;
  const um = document.getElementById('i-um').value;
  if (!matId || qty < 1) { toast('Selecciona un material y cantidad', 'error'); return; }
  const ex = inItems.findIndex(i => i.material_id === matId);
  if (ex >= 0) inItems[ex].cantidad += qty;
  else inItems.push({ material_id: matId, referencia: matRef, cantidad: qty, unidad: um });
  matEl.value = ''; document.getElementById('i-qty').value = '';
  const el = document.getElementById('in-items-list');
  if (el) el.innerHTML = inItems.map((it, i) => `
    <div class="item-row">
      <div style="flex:1;font-size:12px"><span style="font-weight:500">+${it.cantidad} ${it.unidad}</span> · ${it.referencia}</div>
      <button class="btn-icon" onclick="inItems.splice(${i},1);document.getElementById('in-items-list').innerHTML=inItems.map((it,j)=>'<div class=item-row><div style=flex:1;font-size:12px><span style=font-weight:500>+'+it.cantidad+' '+it.unidad+'</span> · '+it.referencia+'</div><button class=btn-icon onclick=inItems.splice('+j+',1)><i class=ti.ti-x></i></button></div>').join('')"><i class="ti ti-x"></i></button>
    </div>`).join('');
};

window.saveIN = async function() {
  if (inItems.length === 0) { toast('Agrega al menos un material', 'error'); return; }
  const fecha = document.getElementById('i-fecha').value;
  const po = document.getElementById('i-po').value.trim();
  const sup = document.getElementById('i-sup').value;
  const status = document.getElementById('i-status').value;
  const track = document.getElementById('i-track').value;
  const obs = document.getElementById('i-obs').value;

  // PO is required
  if (!po) {
    const poEl = document.getElementById('i-po');
    poEl.style.borderColor = 'var(--red)';
    poEl.focus();
    toast('El PO Number es obligatorio', 'error');
    return;
  }

  try {
    const { data: entrada, error } = await sb.from('entradas')
      .insert({ bodega: STATE.bodega, fecha, po_number: po, supplier: sup, status, tracking: track, observaciones: obs, registrado_por: STATE.profile.id })
      .select().single();
    if (error) throw error;
    const items = inItems.map(i => ({ entrada_id: entrada.id, material_id: i.material_id, cantidad: i.cantidad, unidad: i.unidad }));
    const { error: ie } = await sb.from('entradas_items').insert(items);
    if (ie) throw ie;
    toast('Entrada registrada. Inventario actualizado.');
    inItems = [];
    setContent(`
      <div style="text-align:center;padding:40px">
        <div style="width:56px;height:56px;border-radius:50%;background:var(--green-light);display:flex;align-items:center;justify-content:center;margin:0 auto 14px;font-size:24px;color:var(--green-text)"><i class="ti ti-check"></i></div>
        <div style="font-size:16px;font-weight:500;margin-bottom:6px">Entrada registrada</div>
        <div style="font-size:13px;color:var(--text2);margin-bottom:20px">Inventario de ${STATE.bodega} actualizado.</div>
        <div style="display:flex;gap:8px;justify-content:center">
          <button class="btn btn-primary" onclick="renderRecepcion()"><i class="ti ti-plus"></i> Nueva entrada</button>
          <button class="btn" onclick="navigateTo('stock')"><i class="ti ti-package"></i> Ver stock</button>
        </div>
      </div>`);
  } catch (e) { toast(e.message, 'error'); }
};

// ════════════════════════════════════════════════════════════
// PÁGINA: OUTPUT — historial de salidas
// ════════════════════════════════════════════════════════════
async function renderOutput() {
  let page = 0; const PG = 50;
  setTopbarActions(`
    <input type="search" placeholder="Buscar..." style="width:160px" oninput="filterTable('output-body', this.value)">
    <button class="btn btn-success" onclick="exportOutputExcel()"><i class="ti ti-file-spreadsheet"></i> Exportar Excel</button>
  `);

  async function load() {
    setContent(`<div class="loading-spinner"><i class="ti ti-loader-2 spin"></i> Cargando...</div>`);
    const { data, count } = await sb.from('bill_of_lading')
      .select(`
        fecha, wo_number, tracking, driver, notas, created_at,
        registrado_por:profiles!registrado_por(full_name),
        proyecto:proyectos(nombre, ciudad, estado, compania, pm_nombre, direccion),
        bol_items(cantidad, unidad, es_devolucion, material:materiales(referencia))
      `, { count: 'exact' })
      .eq('bodega', STATE.bodega)
      .order('fecha', { ascending: false })
      .range(page * PG, (page + 1) * PG - 1);

    const rows = [];
    (data || []).forEach(b => {
      (b.bol_items || []).forEach(it => {
        rows.push({
          fecha: b.fecha,
          wo: b.wo_number || '—',
          proyecto: b.proyecto?.nombre || '—',
          pm: b.proyecto?.pm_nombre || b.notas || '—',
          compania: b.proyecto?.compania || '—',
          estado: b.proyecto?.estado || '—',
          ciudad: b.proyecto?.ciudad || '—',
          qty: it.cantidad,
          um: it.unidad,
          mat: it.material?.referencia || '—',
          pro: 'WAREHOUSE',
          tracking: b.tracking || '—',
          driver: b.driver || '—',
          registrado: b.registrado_por?.full_name || '—',
          devolucion: it.es_devolucion ? 'Sí' : 'No'
        });
      });
    });

    // Store for export
    window._outputRows = rows;

    setContent(`
      <div class="stats-grid" style="grid-template-columns:repeat(4,1fr)">
        <div class="stat-card"><div class="stat-label">Registros (pág.)</div><div class="stat-value">${rows.length}</div></div>
        <div class="stat-card"><div class="stat-label">Despachos totales</div><div class="stat-value">${count || 0}</div></div>
        <div class="stat-card"><div class="stat-label">Unidades (pág.)</div><div class="stat-value">${rows.reduce((s,r)=>s+r.qty,0)}</div></div>
        <div class="stat-card"><div class="stat-label">Bodega</div><div class="stat-value" style="font-size:14px">${STATE.bodega}</div></div>
      </div>
      <div class="tbl-wrap">
        <table style="font-size:11px">
          <thead><tr>
            <th>Fecha</th>
            <th>WO</th>
            <th style="min-width:140px">Proyecto</th>
            <th style="min-width:120px">Project Manager</th>
            <th style="min-width:130px">Compañía</th>
            <th>Estado</th>
            <th>Ciudad</th>
            <th style="text-align:right">Qty</th>
            <th>U/M</th>
            <th style="min-width:160px">Material</th>
            <th>PRO</th>
            <th>Tracking</th>
            <th style="min-width:130px">Driver / Installer</th>
            <th style="min-width:120px">Registrado por</th>
            <th>Devolución</th>
          </tr></thead>
          <tbody id="output-body">
            ${rows.map(r=>`<tr>
              <td>${r.fecha}</td>
              <td>${r.wo}</td>
              <td title="${r.proyecto}">${r.proyecto}</td>
              <td title="${r.pm}">${r.pm}</td>
              <td title="${r.compania}">${r.compania}</td>
              <td>${r.estado}</td>
              <td>${r.ciudad}</td>
              <td style="text-align:right;font-weight:500">${r.qty}</td>
              <td>${r.um}</td>
              <td title="${r.mat}">${r.mat}</td>
              <td>${r.pro}</td>
              <td>${r.tracking}</td>
              <td title="${r.driver}">${r.driver}</td>
              <td title="${r.registrado}">${r.registrado}</td>
              <td>${r.devolucion}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="pager">
        <button class="btn" ${page===0?'disabled':''} onclick="page=Math.max(0,page-1);load()"><i class="ti ti-chevron-left"></i></button>
        <span>Pág ${page+1} · ${count||0} despachos totales</span>
        <button class="btn" onclick="page++;load()"><i class="ti ti-chevron-right"></i></button>
        <span style="margin-left:auto;font-size:11px;color:var(--text3)">Mostrando ${page*PG+1}–${Math.min((page+1)*PG,count||0)}</span>
      </div>`);
  }
  load();
}

window.exportOutputExcel = function() {
  const rows = window._outputRows || [];
  if (!rows.length) { toast('No hay datos para exportar', 'error'); return; }

  const headers = ['Fecha','WO','Proyecto','Project Manager','Compañía','Estado','Ciudad','Qty','U/M','Material','PRO','Tracking','Driver / Installer','Registrado por','Devolución'];
  const csvRows = [headers.join(',')];
  rows.forEach(r => {
    csvRows.push([
      r.fecha, r.wo,
      `"${r.proyecto}"`, `"${r.pm}"`, `"${r.compania}"`,
      r.estado, r.ciudad, r.qty, r.um,
      `"${r.mat}"`, r.pro, r.tracking,
      `"${r.driver}"`, `"${r.registrado}"`, r.devolucion
    ].join(','));
  });

  const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `OUTPUT_${STATE.bodega}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Archivo exportado correctamente');
};

// ════════════════════════════════════════════════════════════
// PÁGINA: IN — historial de entradas
// ════════════════════════════════════════════════════════════
async function renderInHistory() {
  const today = new Date().toISOString().slice(0,10);
  const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10);

  setTopbarActions(`
    <input type="date" id="in-desde" value="${firstDay}" style="width:130px">
    <span style="font-size:12px;color:var(--text2)">a</span>
    <input type="date" id="in-hasta" value="${today}" style="width:130px">
    <button class="btn btn-primary" onclick="loadInHistory()"><i class="ti ti-search"></i> Buscar</button>
    <button class="btn btn-success" onclick="exportInExcel()"><i class="ti ti-file-spreadsheet"></i> Exportar</button>
    <button class="btn" onclick="navigateTo('recepcion')"><i class="ti ti-plus"></i> Nueva entrada</button>
  `);

  setContent(`<div class="loading-spinner"><i class="ti ti-loader-2 spin"></i> Cargando...</div>`);
  await loadInHistory();
}

window.loadInHistory = async function() {
  const desde = document.getElementById('in-desde')?.value || '';
  const hasta = document.getElementById('in-hasta')?.value || '';

  setContent(`<div class="loading-spinner"><i class="ti ti-loader-2 spin"></i> Cargando...</div>`);

  let query = sb.from('entradas')
    .select(`fecha, po_number, supplier, status, tracking, observaciones, registrado_por:profiles!registrado_por(full_name), entradas_items(cantidad, unidad, material:materiales(referencia))`)
    .eq('bodega', STATE.bodega)
    .order('fecha', { ascending: false });

  if (desde) query = query.gte('fecha', desde);
  if (hasta) query = query.lte('fecha', hasta);

  const { data } = await query;

  const rows = [];
  (data || []).forEach(e => {
    (e.entradas_items || []).forEach(it => {
      rows.push({
        fecha: e.fecha,
        po: e.po_number || '—',
        supplier: e.supplier,
        status: e.status,
        tracking: e.tracking || '—',
        obs: e.observaciones || '—',
        qty: it.cantidad,
        um: it.unidad,
        mat: it.material?.referencia || '—',
        registrado: e.registrado_por?.full_name || '—'
      });
    });
  });

  window._inRows = rows;

  const statusBadge = s => {
    const map = { Complete: 'ok', Incomplete: 'out', Pending: 'low' };
    return `<span class="badge badge-${map[s]||'low'}">${s}</span>`;
  };

  setContent(`
    <div class="stats-grid" style="grid-template-columns:repeat(4,1fr)">
      <div class="stat-card"><div class="stat-label">Líneas registradas</div><div class="stat-value">${rows.length}</div></div>
      <div class="stat-card"><div class="stat-label">Recepciones</div><div class="stat-value">${data?.length||0}</div></div>
      <div class="stat-card"><div class="stat-label">Total unidades</div><div class="stat-value">${rows.reduce((s,r)=>s+r.qty,0)}</div></div>
      <div class="stat-card"><div class="stat-label">Bodega</div><div class="stat-value" style="font-size:14px">${STATE.bodega}</div></div>
    </div>
    ${rows.length === 0 ? `<div style="text-align:center;padding:40px;color:var(--text2)">
      <i class="ti ti-archive" style="font-size:32px;display:block;margin-bottom:8px;color:var(--text3)"></i>
      Sin entradas en el rango seleccionado.
    </div>` : `
    <div class="tbl-wrap">
      <table style="font-size:12px">
        <thead><tr>
          <th>Fecha</th><th>PO Number</th><th>Proveedor</th><th>Estado</th>
          <th>Tracking</th><th style="text-align:right">Qty</th><th>U/M</th>
          <th style="min-width:160px">Material</th><th style="min-width:180px">Observaciones</th>
          <th>Registrado por</th>
        </tr></thead>
        <tbody>
          ${rows.map(r=>`<tr>
            <td>${r.fecha}</td>
            <td style="font-weight:500">${r.po}</td>
            <td>${r.supplier}</td>
            <td>${statusBadge(r.status)}</td>
            <td>${r.tracking}</td>
            <td style="text-align:right;font-weight:500;color:var(--green-text)">+${r.qty}</td>
            <td>${r.um}</td>
            <td title="${r.mat}">${r.mat}</td>
            <td title="${r.obs}" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.obs}</td>
            <td>${r.registrado}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`}
  `);
};

window.exportInExcel = function() {
  const rows = window._inRows || [];
  if (!rows.length) { toast('No hay datos para exportar', 'error'); return; }
  const headers = ['Fecha','PO Number','Proveedor','Estado','Tracking','Qty','U/M','Material','Observaciones','Registrado por'];
  const csvRows = [headers.join(',')];
  rows.forEach(r => {
    csvRows.push([
      r.fecha, `"${r.po}"`, `"${r.supplier}"`, r.status, r.tracking,
      r.qty, r.um, `"${r.mat}"`, `"${r.obs}"`, `"${r.registrado}"`
    ].join(','));
  });
  const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const desde = document.getElementById('in-desde')?.value || '';
  const hasta = document.getElementById('in-hasta')?.value || '';
  a.download = `IN_${STATE.bodega}_${desde}_${hasta}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Archivo exportado correctamente');
};

// ════════════════════════════════════════════════════════════
// PÁGINA: USUARIOS (solo admin)
// ════════════════════════════════════════════════════════════
async function renderUsuarios() {
  if (STATE.profile?.role !== 'admin') { setContent(`<div class="alert alert-danger">Acceso restringido</div>`); return; }
  setContent(`<div class="loading-spinner"><i class="ti ti-loader-2 spin"></i> Cargando...</div>`);
  setTopbarActions(`<button class="btn btn-primary" onclick="showAddUser()"><i class="ti ti-plus"></i> Nuevo usuario</button>`);

  const { data: users } = await sb.from('profiles').select('*').order('full_name');

  const roleBadge = r => {
    const map = { admin: 'badge-admin', jefe_bodega: 'b-blue', bodeguero: 'badge-bodeguero', supervisor: 'b-low' };
    const labels = { admin: 'Admin', jefe_bodega: 'Jefe Bodega', bodeguero: 'Bodeguero', supervisor: 'Supervisor' };
    return `<span class="badge ${map[r]||'b-blue'}">${labels[r]||r}</span>`;
  };

  setContent(`
    <div id="user-form-area"></div>
    <div class="tbl-wrap">
      <table>
        <thead><tr>
          <th>Nombre</th><th>Correo</th><th>Rol</th><th>Bodega</th><th>Estado</th><th>Acciones</th>
        </tr></thead>
        <tbody>
          ${(users||[]).map(u=>`<tr style="${u.activo===false?'opacity:0.5':''}">
            <td style="font-weight:500">${u.full_name}</td>
            <td>${u.email}</td>
            <td>${roleBadge(u.role)}</td>
            <td>${u.bodega||'—'}</td>
            <td><span class="badge ${u.activo===false?'b-out':'b-ok'}">${u.activo===false?'Inactivo':'Activo'}</span></td>
            <td>
              <div style="display:flex;gap:6px">
                <button class="btn" style="padding:3px 8px;font-size:11px" onclick="showEditUser('${u.id}','${u.full_name.replace(/'/g,"\\'")}','${u.email}','${u.role}','${u.bodega||''}')">
                  <i class="ti ti-edit"></i> Editar
                </button>
                <button class="btn ${u.activo===false?'btn-success':'btn-danger'}" style="padding:3px 8px;font-size:11px" onclick="toggleUserActivo('${u.id}',${u.activo!==false})">
                  ${u.activo===false?'<i class="ti ti-player-play"></i> Activar':'<i class="ti ti-player-stop"></i> Desactivar'}
                </button>
                ${u.id !== STATE.profile.id ? `
                <button class="btn" style="padding:3px 8px;font-size:11px;color:var(--red-text);border-color:var(--red-text)" onclick="confirmDeleteUser('${u.id}','${u.full_name.replace(/'/g,"\\'")}')">
                  <i class="ti ti-trash"></i>
                </button>` : '<span style="font-size:11px;color:var(--text3);padding:3px 6px">Tu cuenta</span>'}
              </div>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `);
}

window.showEditUser = function(id, name, email, role, bodega) {
  const el = document.getElementById('user-form-area');
  if (!el) return;
  el.innerHTML = `
    <div class="card" style="max-width:520px;margin-bottom:16px">
      <div class="section-title">Editar usuario — ${name}</div>
      <input type="hidden" id="eu-id" value="${id}">
      <div class="grid2">
        <div class="field"><label>Nombre completo</label><input type="text" id="eu-name" value="${name}"></div>
        <div class="field"><label>Correo</label><input type="email" id="eu-email" value="${email}"></div>
        <div class="field"><label>Rol</label>
          <select id="eu-role">
            <option value="bodeguero" ${role==='bodeguero'?'selected':''}>Bodeguero</option>
            <option value="jefe_bodega" ${role==='jefe_bodega'?'selected':''}>Jefe de Bodega</option>
            <option value="supervisor" ${role==='supervisor'?'selected':''}>Supervisor</option>
            <option value="admin" ${role==='admin'?'selected':''}>Admin</option>
          </select>
        </div>
        <div class="field"><label>Bodega</label>
          <select id="eu-bodega">
            <option value="Charlotte" ${bodega==='Charlotte'?'selected':''}>Charlotte</option>
            <option value="Atlanta" ${bodega==='Atlanta'?'selected':''}>Atlanta</option>
            <option value="Orlando" ${bodega==='Orlando'?'selected':''}>Orlando</option>
            <option value="Tennessee" ${bodega==='Tennessee'?'selected':''}>Tennessee</option>
            <option value="Ambas" ${bodega==='Ambas'?'selected':''}>Todas (Ambas)</option>
          </select>
        </div>
        <div class="field" style="grid-column:1/-1"><label>Nueva contraseña <span style="color:var(--text3);font-weight:400">(dejar vacío para no cambiar)</span></label>
          <input type="password" id="eu-pass" placeholder="Mínimo 8 caracteres">
        </div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary" onclick="updateUser()"><i class="ti ti-device-floppy"></i> Guardar cambios</button>
        <button class="btn" onclick="document.getElementById('user-form-area').innerHTML=''">Cancelar</button>
      </div>
    </div>`;
  el.scrollIntoView({ behavior: 'smooth' });
};

window.updateUser = async function() {
  const id = document.getElementById('eu-id').value;
  const name = document.getElementById('eu-name').value.trim();
  const email = document.getElementById('eu-email').value.trim();
  const role = document.getElementById('eu-role').value;
  const bodega = document.getElementById('eu-bodega').value;
  if (!name || !email) { toast('Nombre y correo son obligatorios', 'error'); return; }
  const { error } = await sb.from('profiles').update({ full_name: name, email, role, bodega }).eq('id', id);
  if (error) { toast(error.message, 'error'); return; }
  toast('Usuario actualizado correctamente');
  renderUsuarios();
};

window.toggleUserActivo = async function(id, activo) {
  const { error } = await sb.from('profiles').update({ activo: !activo }).eq('id', id);
  if (error) { toast(error.message, 'error'); return; }
  toast(activo ? 'Usuario desactivado' : 'Usuario activado');
  renderUsuarios();
};

window.confirmDeleteUser = function(id, name) {
  const modal = document.createElement('div');
  modal.id = 'confirm-modal';
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center';
  modal.innerHTML = `
    <div style="background:var(--bg);border-radius:var(--radius-lg);padding:28px;max-width:380px;width:90%;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,0.2)">
      <div style="font-size:36px;margin-bottom:12px">⚠️</div>
      <div style="font-size:15px;font-weight:500;margin-bottom:8px">¿Eliminar usuario?</div>
      <div style="font-size:13px;color:var(--text2);margin-bottom:20px">Estás a punto de eliminar a <strong>${name}</strong>.<br>Esta acción no se puede deshacer.</div>
      <div style="display:flex;gap:8px;justify-content:center">
        <button class="btn btn-danger" onclick="deleteUser('${id}')"><i class="ti ti-trash"></i> Sí, eliminar</button>
        <button class="btn" onclick="document.getElementById('confirm-modal').remove()">Cancelar</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
};

window.deleteUser = async function(id) {
  document.getElementById('confirm-modal')?.remove();
  const { error } = await sb.from('profiles').delete().eq('id', id);
  if (error) { toast(error.message, 'error'); return; }
  toast('Usuario eliminado');
  renderUsuarios();
};

window.showAddUser = function() {
  const el = document.getElementById('user-form-area');
  if (!el) return;
  el.innerHTML = `
    <div class="card" style="max-width:520px;margin-bottom:16px">
      <div class="section-title">Nuevo usuario</div>
      <div class="grid2">
        <div class="field"><label>Nombre completo</label><input type="text" id="nu-name" placeholder="ej. Juan Pérez"></div>
        <div class="field"><label>Correo electrónico</label><input type="email" id="nu-email" placeholder="usuario@arangoinsulation.com"></div>
        <div class="field"><label>Contraseña temporal</label><input type="password" id="nu-pass" placeholder="Mínimo 8 caracteres"></div>
        <div class="field"><label>Rol</label>
          <select id="nu-role">
            <option value="bodeguero">Bodeguero</option>
            <option value="jefe_bodega">Jefe de Bodega</option>
            <option value="supervisor">Supervisor</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div class="field"><label>Bodega</label>
          <select id="nu-bodega">
            <option value="Charlotte">Charlotte</option>
            <option value="Atlanta">Atlanta</option>
            <option value="Orlando">Orlando</option>
            <option value="Tennessee">Tennessee</option>
            <option value="Ambas">Todas (Ambas)</option>
          </select>
        </div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary" onclick="createUser()"><i class="ti ti-user-plus"></i> Crear usuario</button>
        <button class="btn" onclick="document.getElementById('user-form-area').innerHTML=''">Cancelar</button>
      </div>
      <p style="font-size:11px;color:var(--text3);margin-top:8px">El usuario podrá iniciar sesión inmediatamente con estas credenciales.</p>
    </div>`;
  el.scrollIntoView({ behavior: 'smooth' });
};

window.createUser = async function() {
  const name = document.getElementById('nu-name').value.trim();
  const email = document.getElementById('nu-email').value.trim();
  const pass = document.getElementById('nu-pass').value;
  const role = document.getElementById('nu-role').value;
  const bodega = document.getElementById('nu-bodega').value;
  if (!name || !email || pass.length < 8) { toast('Completa todos los campos (contraseña mínimo 8 caracteres)', 'error'); return; }

  const btn = document.querySelector('#user-form-area .btn-primary');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader-2 spin"></i> Creando...'; }

  try {
    const { data: { session } } = await sb.auth.getSession();
    const res = await fetch('https://elybdaocjkepznfzusdz.supabase.co/functions/v1/create-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ email, password: pass, full_name: name, role, bodega })
    });
    const result = await res.json();
    if (result.error) throw new Error(result.error);
    toast('✅ Usuario creado exitosamente');
    document.getElementById('user-form-area').innerHTML = '';
    renderUsuarios();
  } catch (e) {
    toast('Error: ' + e.message, 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-user-plus"></i> Crear usuario'; }
  }
};

// ════════════════════════════════════════════════════════════
// PÁGINA: MATERIALES (admin)
// ════════════════════════════════════════════════════════════
async function renderMaterialesAdmin() {
  if (STATE.profile?.role !== 'admin') { setContent(`<div class="alert alert-danger">Acceso restringido</div>`); return; }
  setContent(`<div class="loading-spinner"><i class="ti ti-loader-2 spin"></i> Cargando...</div>`);
  setTopbarActions(`<button class="btn btn-primary" onclick="showAddMaterial()"><i class="ti ti-plus"></i> Nuevo material</button>`);
  const mats = await getMateriales();
  setContent(`
    <div id="mat-form-area"></div>
    <div class="tbl-wrap">
      <table>
        <thead><tr><th>Referencia</th><th>Unidad</th><th style="text-align:right">Stock mínimo</th><th>Estado</th></tr></thead>
        <tbody>
          ${mats.map(m=>`<tr>
            <td style="font-weight:500">${m.referencia}</td>
            <td>${m.unidad_base}</td>
            <td style="text-align:right">${m.stock_minimo}</td>
            <td><span class="badge badge-ok">Activo</span></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`);
}

window.showAddMaterial = function() {
  const el = document.getElementById('mat-form-area');
  if (!el) return;
  el.innerHTML = `
    <div class="card" style="max-width:480px;margin-bottom:16px">
      <div class="section-title">Agregar material</div>
      <div class="grid2">
        <div class="field" style="grid-column:1/-1"><label>Referencia</label><input type="text" id="nm-ref" placeholder="ej. R-21 UF Batt 15 x 105"></div>
        <div class="field"><label>Unidad base</label><select id="nm-unit"><option>BUNDLE</option><option>BAG</option><option>UNIT</option><option>PACK</option><option>BOX</option></select></div>
        <div class="field"><label>Stock mínimo</label><input type="number" id="nm-min" value="20" min="0"></div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary" onclick="saveMaterial()"><i class="ti ti-device-floppy"></i> Guardar</button>
        <button class="btn" onclick="document.getElementById('mat-form-area').innerHTML=''">Cancelar</button>
      </div>
    </div>`;
};

window.saveMaterial = async function() {
  const ref = document.getElementById('nm-ref').value.trim();
  const unit = document.getElementById('nm-unit').value;
  const min = parseInt(document.getElementById('nm-min').value) || 0;
  if (!ref) { toast('Ingresa la referencia del material', 'error'); return; }
  const { error } = await sb.from('materiales').insert({ referencia: ref, unidad_base: unit, stock_minimo: min });
  if (error) { toast(error.message, 'error'); return; }
  toast('Material agregado');
  renderMaterialesAdmin();
};

// ════════════════════════════════════════════════════════════
// PÁGINA: PROYECTOS (admin)
// ════════════════════════════════════════════════════════════
async function renderProyectosAdmin() {
  if (STATE.profile?.role !== 'admin') { setContent(`<div class="alert alert-danger">Acceso restringido</div>`); return; }
  setContent(`<div class="loading-spinner"><i class="ti ti-loader-2 spin"></i> Cargando...</div>`);
  setTopbarActions(`<button class="btn btn-primary" onclick="showAddProyecto()"><i class="ti ti-plus"></i> Nuevo proyecto</button>`);

  const { data: proyectos } = await sb.from('proyectos').select('*, pm:profiles!pm_id(full_name)').order('nombre');
  const pms = await getPMs();

  const bodegaBadge = b => {
    const map = { Charlotte: 'b-blue', Atlanta: 'b-ok', Orlando: 'b-low', Tennessee: 'badge-admin', Ambas: 'b-low' };
    return `<span class="badge ${map[b]||'b-blue'}">${b||'Global'}</span>`;
  };

  setContent(`
    <div id="proy-form-area"></div>
    <div style="display:flex;gap:8px;margin-bottom:12px;align-items:center">
      <input type="search" placeholder="Buscar proyecto..." style="width:220px" oninput="filterTable('proy-body',this.value)">
      <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer">
        <input type="checkbox" id="show-inactive" onchange="toggleInactive()" style="width:auto"> Mostrar inactivos
      </label>
    </div>
    <div class="tbl-wrap">
      <table>
        <thead><tr>
          <th>Nombre</th><th>Ciudad</th><th>Estado</th><th>Bodega</th><th>PM</th><th>Estado</th><th>Acciones</th>
        </tr></thead>
        <tbody id="proy-body">
          ${(proyectos||[]).map(p=>`<tr data-activo="${p.activo}" style="${!p.activo?'opacity:0.5':''}">
            <td style="font-weight:500" title="${p.nombre}">${p.nombre}</td>
            <td>${p.ciudad||'—'}</td>
            <td>${p.estado||'—'}</td>
            <td>${bodegaBadge(p.bodega)}</td>
            <td>${p.pm?.full_name||'—'}</td>
            <td><span class="badge ${p.activo?'b-ok':'b-out'}">${p.activo?'Activo':'Inactivo'}</span></td>
            <td>
              <button class="btn" style="padding:3px 8px;font-size:11px" onclick="editProyecto('${p.id}','${p.nombre.replace(/'/g,"\\'")}','${p.ciudad||''}','${p.estado||''}','${p.bodega||''}','${p.pm_id||''}')">
                <i class="ti ti-edit"></i>
              </button>
              <button class="btn ${p.activo?'btn-danger':''}" style="padding:3px 8px;font-size:11px" onclick="toggleProyecto('${p.id}',${p.activo})">
                ${p.activo?'<i class="ti ti-player-stop"></i> Desactivar':'<i class="ti ti-player-play"></i> Activar'}
              </button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `);

  // Hide inactive by default
  document.querySelectorAll('#proy-body tr[data-activo="false"]').forEach(r => r.style.display = 'none');
}

window.toggleInactive = function() {
  const show = document.getElementById('show-inactive').checked;
  document.querySelectorAll('#proy-body tr[data-activo="false"]').forEach(r => {
    r.style.display = show ? '' : 'none';
  });
};

window.toggleProyecto = async function(id, activo) {
  const { error } = await sb.from('proyectos').update({ activo: !activo }).eq('id', id);
  if (error) { toast(error.message, 'error'); return; }
  toast(activo ? 'Proyecto desactivado' : 'Proyecto activado');
  renderProyectosAdmin();
};

window.showAddProyecto = async function() {
  const pms = await getPMs();
  const el = document.getElementById('proy-form-area');
  if (!el) return;
  el.innerHTML = `
    <div class="card" style="max-width:560px;margin-bottom:16px">
      <div class="section-title">Nuevo proyecto</div>
      <div class="grid2">
        <div class="field" style="grid-column:1/-1"><label>Nombre del proyecto</label><input type="text" id="np-nombre" placeholder="ej. Alexan Mallard Creek"></div>
        <div class="field"><label>Ciudad</label><input type="text" id="np-ciudad" placeholder="ej. Charlotte"></div>
        <div class="field"><label>Estado</label><input type="text" id="np-estado" placeholder="ej. NC"></div>
        <div class="field"><label>Dirección</label><input type="text" id="np-dir" placeholder="Opcional"></div>
        <div class="field"><label>Compañía</label><input type="text" id="np-comp" placeholder="ej. C Herman"></div>
        <div class="field"><label>Bodega principal</label>
          <select id="np-bodega">
            <option value="">Global (todas las bodegas)</option>
            <option value="Charlotte">Charlotte</option>
            <option value="Atlanta">Atlanta</option>
            <option value="Orlando">Orlando</option>
            <option value="Tennessee">Tennessee</option>
          </select>
        </div>
        <div class="field"><label>Project Manager</label>
          <select id="np-pm">
            <option value="">Sin asignar</option>
            ${pms.map(p=>`<option value="${p.id}">${p.full_name}</option>`).join('')}
          </select>
        </div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary" onclick="saveProyecto()"><i class="ti ti-device-floppy"></i> Guardar</button>
        <button class="btn" onclick="document.getElementById('proy-form-area').innerHTML=''">Cancelar</button>
      </div>
    </div>`;
};

window.editProyecto = async function(id, nombre, ciudad, estado, bodega, pm_id) {
  const pms = await getPMs();
  const el = document.getElementById('proy-form-area');
  if (!el) return;
  el.innerHTML = `
    <div class="card" style="max-width:560px;margin-bottom:16px">
      <div class="section-title">Editar proyecto</div>
      <input type="hidden" id="ep-id" value="${id}">
      <div class="grid2">
        <div class="field" style="grid-column:1/-1"><label>Nombre</label><input type="text" id="ep-nombre" value="${nombre}"></div>
        <div class="field"><label>Ciudad</label><input type="text" id="ep-ciudad" value="${ciudad}"></div>
        <div class="field"><label>Estado</label><input type="text" id="ep-estado" value="${estado}"></div>
        <div class="field"><label>Bodega principal</label>
          <select id="ep-bodega">
            <option value="">Global (todas las bodegas)</option>
            <option value="Charlotte" ${bodega==='Charlotte'?'selected':''}>Charlotte</option>
            <option value="Atlanta" ${bodega==='Atlanta'?'selected':''}>Atlanta</option>
            <option value="Orlando" ${bodega==='Orlando'?'selected':''}>Orlando</option>
            <option value="Tennessee" ${bodega==='Tennessee'?'selected':''}>Tennessee</option>
          </select>
        </div>
        <div class="field"><label>Project Manager</label>
          <select id="ep-pm">
            <option value="">Sin asignar</option>
            ${pms.map(p=>`<option value="${p.id}" ${p.id===pm_id?'selected':''}>${p.full_name}</option>`).join('')}
          </select>
        </div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary" onclick="updateProyecto()"><i class="ti ti-device-floppy"></i> Actualizar</button>
        <button class="btn" onclick="document.getElementById('proy-form-area').innerHTML=''">Cancelar</button>
      </div>
    </div>`;
};

window.saveProyecto = async function() {
  const nombre = document.getElementById('np-nombre').value.trim();
  const ciudad = document.getElementById('np-ciudad').value.trim();
  const estado = document.getElementById('np-estado').value.trim();
  const dir = document.getElementById('np-dir').value.trim();
  const comp = document.getElementById('np-comp').value.trim();
  const bodega = document.getElementById('np-bodega').value;
  const pm_id = document.getElementById('np-pm').value || null;
  if (!nombre) { toast('El nombre del proyecto es obligatorio', 'error'); return; }
  const { error } = await sb.from('proyectos').insert({ nombre, ciudad, estado, direccion: dir, compania: comp, bodega, pm_id, activo: true });
  if (error) { toast(error.message, 'error'); return; }
  toast('Proyecto creado');
  renderProyectosAdmin();
};

window.updateProyecto = async function() {
  const id = document.getElementById('ep-id').value;
  const nombre = document.getElementById('ep-nombre').value.trim();
  const ciudad = document.getElementById('ep-ciudad').value.trim();
  const estado = document.getElementById('ep-estado').value.trim();
  const bodega = document.getElementById('ep-bodega').value;
  const pm_id = document.getElementById('ep-pm').value || null;
  if (!nombre) { toast('El nombre es obligatorio', 'error'); return; }
  const { error } = await sb.from('proyectos').update({ nombre, ciudad, estado, bodega, pm_id }).eq('id', id);
  if (error) { toast(error.message, 'error'); return; }
  toast('Proyecto actualizado');
  renderProyectosAdmin();
};

// ── Helpers de datos ────────────────────────────────────────
async function getStockActual(bodega) {
  const { data, error } = await sb.from('stock_actual').select('*').eq('bodega', bodega).order('referencia');
  if (error) throw error;
  return data || [];
}

async function getMateriales() {
  const { data } = await sb.from('materiales').select('*').eq('activo', true).order('referencia');
  return data || [];
}

async function getProyectos(bodega) {
  const { data } = await sb.from('proyectos').select('*').eq('activo', true).order('nombre');
  return data || [];
}

async function getPMs() {
  const { data } = await sb.from('profiles').select('id, full_name').eq('role', 'pm').order('full_name');
  return data || [];
}

async function getInstaladores(bodega) {
  const listas = {
    Charlotte: ['Braulio Pulido','Daniel Hernadez','Jorge Gutierrez','Noe Navarro','Paul Espinoza','Roany Marin'],
    Atlanta: ['Alberto Reyes Lara','Carlos chateing','Cesar Gonzalez','Ismael Mercado Saldana','Ivan Escobar Quiroz','Lucio Hernandez','Martin Reyes Lara'],
    Orlando: ['Mario Ivan Diaz Lopez','David Arango'],
    Tennessee: []
  };
  return listas[bodega] || [];
}

window.filterTable = function(tbodyId, q) {
  document.querySelectorAll(`#${tbodyId} tr`).forEach(r => {
    r.style.display = Array.from(r.cells).some(c => c.textContent.toLowerCase().includes(q.toLowerCase())) ? '' : 'none';
  });
};

// ── Arranque ─────────────────────────────────────────────────
init();
