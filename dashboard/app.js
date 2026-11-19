/* Token Radar dashboard: renders window.RADAR (written by main.ts) with no
   network. Board, detail view, live-token view and the model page. Hash
   routing: #detail=<slug> opens a protocol, #cat=<category> filters the
   board, #tab=live|model switches tabs. */
(function () {
  'use strict';
  var D = window.RADAR;
  if (!D) { document.body.innerHTML = '<p>Dashboard data is missing.</p>'; return; }
  var rows = D.rows, live = D.live;
  var watchSet = {};
  (D.watchlist || []).forEach(function (s) { watchSet[s] = true; });

  function $(id) { return document.getElementById(id); }
  function money(n) {
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  }
  function moneyFull(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function pct(n) {
    if (n === null || n === undefined) return '—';
    var s = (n > 0 ? '+' : '') + n.toFixed(1) + '%';
    return s;
  }
  function ageFmt(days) {
    if (days === null || days === undefined) return '—';
    if (days < 30) return days + 'd';
    if (days < 365) return Math.round(days / 30) + 'mo';
    return (days / 365).toFixed(1) + 'y';
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ---- header stats ---- */
  $('stats').innerHTML =
    stat(money(D.total_implied_usd), 'total implied value') +
    stat(D.board_size, 'protocols ranked') +
    stat(D.watchlist_size, 'on the watchlist') +
    stat(D.early_size, 'early finds') +
    stat(D.as_of, 'snapshot date');
  function stat(b, label) { return '<div class="stat"><b>' + esc(b) + '</b><span>' + esc(label) + '</span></div>'; }

  /* ---- filter controls ---- */
  var cats = {}, chains = {};
  rows.forEach(function (r) {
    if (r.category) cats[r.category] = 1;
    r.chains.forEach(function (c) { chains[c] = 1; });
  });
  fillSelect($('cat'), Object.keys(cats).sort());
  fillSelect($('chain'), Object.keys(chains).sort());
  function fillSelect(sel, values) {
    values.forEach(function (v) {
      var o = document.createElement('option');
      o.value = v; o.textContent = v; sel.appendChild(o);
    });
  }
  var scopeSel = $('scope');
  scopeSel.options[0].textContent = 'All ' + rows.length + ' rows';

  var sortKey = 'rank', sortDir = 1;
  function currentRows() {
    var q = $('q').value.trim().toLowerCase();
    var cat = $('cat').value, chain = $('chain').value, scope = scopeSel.value;
    var gainers = $('gainers').checked;
    var out = rows.filter(function (r) {
      if (q && (r.name + ' ' + r.slug + ' ' + (r.category || '')).toLowerCase().indexOf(q) === -1) return false;
      if (cat && r.category !== cat) return false;
      if (chain && r.chains.indexOf(chain) === -1) return false;
      if (scope === 'watchlist' && !watchSet[r.slug]) return false;
      if (scope === 'early' && watchSet[r.slug]) return false;
      if (gainers && !(r.change_7d !== null && r.change_7d > 0)) return false;
      return true;
    });
    var k = sortKey, d = sortDir;
    out.sort(function (a, b) {
      var va = val(a, k), vb = val(b, k);
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      if (typeof va === 'string') return d * va.localeCompare(vb);
      return d * (va - vb);
    });
    return out;
  }
  function val(r, k) {
    if (k === 'chains') return r.chains.join(', ');
    return r[k];
  }
  function renderBoard() {
    var list = currentRows();
    $('count').textContent = list.length + ' of ' + rows.length + ' protocols — ranked by implied value, highest first.';
    var html = '';
    list.forEach(function (r) {
      var chg = r.change_7d === null ? '<span>—</span>' :
        '<span class="' + (r.change_7d > 0 ? 'up' : r.change_7d < 0 ? 'down' : '') + '">' + pct(r.change_7d) + '</span>';
      html += '<tr data-slug="' + esc(r.slug) + '"><td class="num">' + r.rank + '</td>' +
        '<td><b>' + esc(r.name) + '</b><span class="sub">' + esc(r.slug) + '</span></td>' +
        '<td>' + esc(r.category || '—') + ' ' + (watchSet[r.slug] ? '<span class="pill wl">watchlist</span>' : '<span class="pill">early</span>') + '</td>' +
        '<td>' + esc(r.chains.slice(0, 2).join(', ') || '—') + (r.chains.length > 2 ? ' +' + (r.chains.length - 2) : '') + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num">' + chg + '</td>' +
        '<td class="num">' + ageFmt(r.age_days) + '</td>' +
        '<td class="num"><b>' + money(r.implied_value_usd) + '</b></td></tr>';
    });
    $('rows').innerHTML = html || '<tr><td colspan="8">No protocols match these filters.</td></tr>';
  }
  $('rows').addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-slug]');
    if (tr) openDetail(tr.getAttribute('data-slug'));
  });
  document.querySelectorAll('#board th').forEach(function (th) {
    th.addEventListener('click', function () {
      var k = th.getAttribute('data-k');
      if (sortKey === k) sortDir = -sortDir; else { sortKey = k; sortDir = k === 'name' || k === 'category' || k === 'chains' ? 1 : -1; }
      renderBoard();
    });
  });
  ['q', 'cat', 'chain', 'scope', 'gainers'].forEach(function (id) {
    $(id).addEventListener('input', renderBoard);
    $(id).addEventListener('change', renderBoard);
  });

  /* ---- detail view ---- */
  function openDetail(slug) {
    var r = null;
    rows.forEach(function (x) { if (x.slug === slug) r = x; });
    if (!r) return;
    var base = Math.round(r.tvl_usd * r.peer_multiple);
    var steps = r.farm_steps.map(function (s) {
      var parts = splitStep(s);
      return '<li>' + esc(parts.text) + '<span class="ct"><b>Cost:</b> ' + esc(parts.cost) + ' &nbsp;·&nbsp; <b>Time:</b> ' + esc(parts.time) + '</span></li>';
    }).join('');
    $('detail').innerHTML =
      '<div class="detail"><h2>' + esc(r.name) + '</h2>' +
      '<p class="meta">Rank #' + r.rank + ' · ' + esc(r.category || 'Uncategorised') + ' · ' + esc(r.chains.join(', ') || '—') +
      ' · ' + (watchSet[r.slug] ? 'on the watchlist' : 'early find below the $50M floor') +
      ' · records no token</p>' +
      '<div class="kv">' +
      kv(moneyFull(r.implied_value_usd), 'implied value') +
      kv(money(r.tvl_usd), 'TVL') +
      kv(pct(r.change_7d), 'TVL change, 7 days') +
      kv(ageFmt(r.age_days), 'tracked for') +
      kv('×' + r.peer_multiple.toFixed(2), 'peer multiple') +
      kv(r.peer_count ? r.peer_count + ' peers' : 'global median', 'calibration') +
      '</div>' +
      '<div class="math"><div class="row"><span>TVL × peer multiple (base)</span><span>' + money(r.tvl_usd) + ' × ' + r.peer_multiple.toFixed(2) + ' = <b>' + money(base) + '</b></span></div>' +
      '<div class="row"><span>Growth multiplier (7d ' + pct(r.change_7d) + ')</span><span>× ' + r.growth_multiplier.toFixed(2) + '</span></div>' +
      '<div class="row"><span>Maturity multiplier (' + ageFmt(r.age_days) + ' with no token)</span><span>× ' + r.maturity_multiplier.toFixed(2) + '</span></div>' +
      '<div class="row"><span><b>Implied value</b></span><span><b>' + moneyFull(r.implied_value_usd) + '</b></span></div></div>' +
      '<h3>How to farm it</h3><ol class="farm">' + steps + '</ol>' +
      '<p class="lede">This protocol records no token in the snapshot — that is the record, not proof it has none. The implied value is this radar\'s own claim, not a prediction that a token is issued.</p></div>';
    showPanel('detail');
    window.scrollTo(0, 0);
  }
  function kv(b, label) { return '<div><b>' + esc(b) + '</b><span>' + esc(label) + '</span></div>'; }
  function splitStep(s) {
    var m = s.match(/^(.*?)\s*Cost:\s*(.*?)\.\s*Time:\s*(.*?)\.\s*$/);
    if (!m) return { text: s, cost: '—', time: '—' };
    return { text: m[1], cost: m[2], time: m[3] };
  }
  $('back').addEventListener('click', function () { showPanel('board'); history.replaceState(null, '', '#'); });

  /* ---- live tokens ---- */
  var liveHtml = '';
  live.forEach(function (p) {
    var ratio = p.mcap_usd && p.tvl_usd ? (p.mcap_usd / p.tvl_usd).toFixed(2) + '×' : '—';
    liveHtml += '<tr><td><b>' + esc(p.name) + '</b><span class="sub">' + esc(p.slug) + '</span></td>' +
      '<td>' + esc(p.category || '—') + '</td><td>' + esc(p.chains.slice(0, 2).join(', ') || '—') + '</td>' +
      '<td class="num">' + money(p.tvl_usd) + '</td><td class="num">' + (p.mcap_usd ? money(p.mcap_usd) : '—') + '</td>' +
      '<td class="num">' + ratio + '</td><td class="num">' + pct(p.change_7d) + '</td></tr>';
  });
  $('liverows').innerHTML = liveHtml;

  /* ---- model page ---- */
  var peerHtml = '';
  D.peer_multiples.forEach(function (p) {
    peerHtml += '<tr><td>' + esc(p.category) + '</td><td class="num">×' + p.multiple.toFixed(2) + '</td><td class="num">' + p.peers + '</td></tr>';
  });
  $('peerrows').innerHTML = peerHtml;

  /* ---- tabs + hash routing ---- */
  function showPanel(name) {
    ['board', 'detail', 'live', 'model'].forEach(function (n) { $('panel-' + n).hidden = n !== name; });
    document.querySelectorAll('#tabs button').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-tab') === name || (name === 'detail' && b.getAttribute('data-tab') === 'board'));
    });
    if (name !== 'detail') { var h = name === 'board' ? '#' : '#tab=' + name; if (location.hash !== h) history.replaceState(null, '', h); }
  }
  document.querySelectorAll('#tabs button').forEach(function (b) {
    b.addEventListener('click', function () { showPanel(b.getAttribute('data-tab')); });
  });
  function route() {
    var h = location.hash.replace(/^#/, '');
    var params = {};
    h.split('&').forEach(function (pair) {
      var kv2 = pair.split('=');
      if (kv2[0]) params[decodeURIComponent(kv2[0])] = decodeURIComponent(kv2[1] || '');
    });
    if (params.detail) { openDetail(params.detail); return; }
    if (params.cat) { $('cat').value = params.cat; renderBoard(); }
    if (params.tab === 'live' || params.tab === 'model') { showPanel(params.tab); return; }
    showPanel('board');
  }
  window.addEventListener('hashchange', route);
  renderBoard();
  route();
})();
