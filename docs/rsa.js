// The worksheet logic. Numbers stay small (p, q < 10000), but BigInt keeps
// everything exact without having to think about overflow.
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const B = (x) => BigInt(x);
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------------------------------------------------------------- math

  function isPrime(n) {
    if (n < 2) return false;
    for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
    return true;
  }

  function euclidRows(a, b) {
    const rows = [];
    while (b !== 0n) {
      rows.push({ a, b, q: a / b, r: a % b });
      [a, b] = [b, a % b];
    }
    return { rows, gcd: a };
  }

  // Extended Euclid as a table: each remainder r = x·φ + y·e.
  function extendedRows(phi, e) {
    const rows = [{ r: phi, x: 1n, y: 0n, q: null }, { r: e, x: 0n, y: 1n, q: null }];
    while (rows[rows.length - 1].r !== 0n) {
      const prev = rows[rows.length - 2], cur = rows[rows.length - 1];
      const q = prev.r / cur.r;
      rows.push({ r: prev.r - q * cur.r, x: prev.x - q * cur.x, y: prev.y - q * cur.y, q });
    }
    return rows;
  }

  const mod = (a, m) => ((a % m) + m) % m;

  function modPow(base, exp, m) {
    let result = 1n;
    base %= m;
    while (exp > 0n) {
      if (exp & 1n) result = (result * base) % m;
      base = (base * base) % m;
      exp >>= 1n;
    }
    return result;
  }

  function squareMultiplySteps(base, exp, m) {
    const steps = [];
    let result = 1n, power = base % m, k = 1n;
    for (const bit of exp.toString(2).split('').reverse()) {
      const used = bit === '1';
      if (used) result = (result * power) % m;
      steps.push({ k, power, used, result });
      power = (power * power) % m;
      k *= 2n;
    }
    return { steps, result, bits: exp.toString(2) };
  }

  // ---------------------------------------------------------------- display helpers

  const fmt = (x) => x.toLocaleString('en-US').replace('-', '−');
  // "+ 5 × e" or "− 5 × e" instead of "+ -5 × e".
  const plusTerm = (y, what) => `${y < 0n ? '−' : '+'} ${fmt(y < 0n ? -y : y)} × ${what}`;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const show = (ch) => (ch === ' ' ? '␣' : esc(ch));

  // Restart a CSS animation class on an element.
  function replay(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  // Set content, and briefly highlight it if it actually changed.
  function setHTML(id, html) {
    const el = $(id);
    if (el.innerHTML === html) return false;
    el.innerHTML = html;
    if (state.ready) replay(el, 'changed');
    return true;
  }

  // Tables build row by row (or column by column) when their contents change.
  const rowStyle = (i) => `style="--i:${i}"`;
  function setTable(id, html) {
    if (setHTML(id, html) && state.ready) replay($(id), 'build');
  }

  const state = { ready: false, crackTimer: null };

  // ---------------------------------------------------------------- the worksheet

  function setError(msg) {
    $('prime-error').textContent = msg || '';
    $('prime-error').hidden = !msg;
    $('rest').classList.toggle('faded', Boolean(msg));
  }

  function update() {
    stopCrack();
    const p = Number($('p').value), q = Number($('q').value);
    if (!Number.isInteger(p) || !Number.isInteger(q) || !isPrime(p) || !isPrime(q)) {
      const bad = [p, q].filter((x) => !isPrime(x));
      setError(`${bad.join(' and ')} ${bad.length === 1 ? "isn't" : "aren't"} prime. Try something like 61 and 53.`);
      return;
    }
    if (p === q) return setError('p and q need to be different primes.');
    if (p > 9999 || q > 9999) return setError('Keep them under 10,000 so the numbers stay readable.');
    if (p * q < 128) return setError(`n = ${p * q} is too small: it has to be bigger than every character code (up to 127). Try bigger primes.`);
    setError('');

    const P = B(p), Q = B(q), n = P * Q, phi = (P - 1n) * (Q - 1n);
    setHTML('n-line', `<i>n</i> = ${p} × ${q} = <b>${fmt(n)}</b>`);
    $('n-again').textContent = fmt(n);
    setHTML('phi-line', `φ(<i>n</i>) = (${p} − 1)(${q} − 1) = ${p - 1} × ${q - 1} = <b>${fmt(phi)}</b>`);

    // Step 4
    const eNum = Number($('e').value);
    const e = B(Number.isInteger(eNum) && eNum > 1 ? eNum : 3);
    const { rows, gcd } = euclidRows(phi, e);
    setTable('euclid', rows.map((r, i) =>
      `<tr ${rowStyle(i)}><td>${fmt(r.a)}</td><td>=</td><td>${fmt(r.q)} × ${fmt(r.b)}</td><td>+</td><td><b>${fmt(r.r)}</b></td></tr>`).join(''));
    const ok = gcd === 1n && e < phi;
    if (ok) {
      setHTML('gcd-verdict', `The last remainder before 0 is the gcd: <b>gcd(${fmt(phi)}, ${e}) = 1</b>. They share no factor, so <i>e</i> = ${e} works.`);
    } else {
      let suggestion = e + 1n;
      while (euclidRows(phi, suggestion).gcd !== 1n) suggestion += 1n;
      setHTML('gcd-verdict', e >= phi
        ? `<span class="error">e should be smaller than φ(n) = ${fmt(phi)}.</span> Try ${suggestion < phi ? suggestion : 3}.`
        : `<span class="error">gcd(${fmt(phi)}, ${e}) = ${gcd}, not 1.</span> They share the factor ${gcd}, so there's no matching d. Try <i>e</i> = ${suggestion}.`);
    }
    for (const id of ['d-step', 'enc-step', 'dec-step']) $(id).classList.toggle('faded', !ok);
    if (!ok) {
      for (const id of ['ext-euclid', 'd-line', 'pub-key', 'priv-key', 'enc-table', 'dec-table', 'decrypted', 'k-example', 'crack-result']) $(id).innerHTML = '';
      $('repeat-note').hidden = true;
      return;
    }

    // Step 5
    const ext = extendedRows(phi, e);
    setTable('ext-euclid', '<tr><th>remainder</th><th></th><th>= x × φ + y × e</th></tr>' +
      ext.slice(0, -1).map((r, i) =>
        `<tr ${rowStyle(i)} class="${r.r === 1n ? 'hit' : ''}"><td>${fmt(r.r)}</td><td>=</td><td>${fmt(r.x)} × ${fmt(phi)} ${plusTerm(r.y, e)}</td>${i >= 2 ? `<td class="aside">row above it, minus ${r.q} × the row above that</td>` : '<td></td>'}</tr>`).join(''));
    const last = ext[ext.length - 2];
    const d = mod(last.y, phi);
    setHTML('d-line', `The row with remainder 1 says ${e} × ${last.y < 0n ? `(${fmt(last.y)})` : fmt(last.y)} leaves remainder 1 when divided by ${fmt(phi)}` +
      (last.y < 0n ? `. We want a positive number, so add ${fmt(phi)}: ${fmt(last.y)} + ${fmt(phi)} = ${fmt(d)}` : '') +
      `. So <b><i>d</i> = ${fmt(d)}</b>.<br><span class="note">Check: ${e} × ${fmt(d)} = ${fmt(e * d)} = ${fmt((e * d) / phi)} × ${fmt(phi)} + 1 ✓</span>`);
    setHTML('pub-key', `n = ${fmt(n)}, e = ${e}`);
    setHTML('priv-key', `n = ${fmt(n)}, d = ${fmt(d)}`);
    const k = (e * d - 1n) / phi;
    $('k-example').textContent = `(here, ${e} × ${fmt(d)} = 1 + ${fmt(k)} × ${fmt(phi)})`;

    // Steps 6 and 7
    const text = [...$('msg').value].filter((ch) => ch.charCodeAt(0) < 128).join('') || 'HI';
    const codes = [...text].map((ch) => B(ch.charCodeAt(0)));
    const ciphers = codes.map((m) => modPow(m, e, n));
    const cells = (xs, f) => xs.map((x, i) => `<td ${rowStyle(i)}>${f(x)}</td>`).join('');
    setTable('enc-table',
      `<tr><th>letter</th>${cells([...text], show)}</tr>` +
      `<tr><th>as a number, <i>m</i></th>${cells(codes, String)}</tr>` +
      `<tr><th>locked, <i>m</i><sup>${e}</sup> mod ${fmt(n)}</th>${cells(ciphers, (c) => `<b>${fmt(c)}</b>`)}</tr>`);

    const seen = new Set();
    let repeat = null;
    for (const ch of text) { if (seen.has(ch) && !repeat) repeat = ch; seen.add(ch); }
    $('repeat-note').hidden = !repeat;
    if (repeat) {
      $('repeat-note').innerHTML = `Both "${show(repeat)}"s lock to the same number. Someone listening can't read the
        message, but they can see which letters repeat, and with enough text that's often enough to guess it (the same
        way you'd solve a cryptogram). Real RSA avoids this by adding random padding before locking.`;
    }

    const first = codes[0];
    const sm = squareMultiplySteps(first, e, n);
    $('sm-title').innerHTML = `${first}<sup>${e}</sup> mod ${fmt(n)}`;
    $('square-multiply').innerHTML = `<p>Multiplying ${first} by itself ${e} times would work, but with real keys the power has
        hundreds of digits. The trick: write ${e} in binary (<b>${sm.bits}</b>), keep squaring to get ${first}<sup>1</sup>,
        ${first}<sup>2</sup>, ${first}<sup>4</sup>, … (taking the remainder each time so nothing gets big), and multiply
        together the ones where the binary digit is 1:</p>
      <div class="work"><table>${sm.steps.map((s, i) =>
        `<tr ${rowStyle(i)} class="${s.used ? 'hit' : 'skip'}"><td>${first}<sup>${s.k}</sup> mod ${fmt(n)}</td><td>=</td><td>${fmt(s.power)}</td>
         <td class="aside">${s.used ? `digit is 1, so multiply it in → ${fmt(s.result)}` : 'digit is 0, skip'}</td></tr>`).join('')}</table></div>
      <p>That's ${sm.steps.length} squarings instead of ${e - 1n} multiplications. With a real key it's a few
      thousand steps instead of more than could ever finish.</p>`;

    const back = ciphers.map((c) => modPow(c, d, n));
    setTable('dec-table',
      `<tr><th>locked, <i>c</i></th>${cells(ciphers, fmt)}</tr>` +
      `<tr><th>unlocked, <i>c</i><sup>${fmt(d)}</sup> mod ${fmt(n)}</th>${cells(back, (m) => `<b>${m}</b>`)}</tr>` +
      `<tr><th>letter</th>${cells(back, (m) => show(String.fromCharCode(Number(m))))}</tr>`);
    setHTML('decrypted', esc(`"${back.map((m) => String.fromCharCode(Number(m))).join('')}"`));
    $('crack-result').innerHTML = '';
    $('crack-box').hidden = true;
  }

  // ---------------------------------------------------------------- watching trial division

  function stopCrack() {
    if (state.crackTimer) clearTimeout(state.crackTimer);
    state.crackTimer = null;
  }

  function crack() {
    stopCrack();
    const n = Number($('p').value) * Number($('q').value);
    let d = 2;
    const tried = [];
    while (n % d !== 0) { tried.push(d); d += d === 2 ? 1 : 2; }
    tried.push(d);
    $('crack-result').innerHTML = '';
    $('crack-box').hidden = false;

    const finish = () => {
      $('crack-progress').innerHTML = `${fmt(n)} ÷ ${d} = <b>${fmt(n / d)}</b> exactly ✓`;
      $('crack-result').innerHTML = `Found it after ${fmt(tried.length)} tries: <b>${fmt(n)} = ${d} × ${fmt(n / d)}</b>.
        With <i>p</i> and <i>q</i> known, steps 3 to 5 give <i>d</i>, and the lock is broken.`;
      replay($('crack-result'), 'changed');
    };
    if (calm) return finish();

    // Show every try, but keep the whole thing under about 4 seconds.
    const delay = Math.max(12, Math.min(160, 4000 / tried.length));
    let i = 0;
    const tick = () => {
      const t = tried[i];
      if (t === d) return finish();
      $('crack-progress').innerHTML = `${fmt(n)} ÷ ${t} = ${fmt(Math.floor(n / t))} remainder ${n % t} ✗
        <span class="note">(try ${i + 1})</span>`;
      i++;
      state.crackTimer = setTimeout(tick, delay);
    };
    tick();
  }

  function randomPrimes() {
    const primes = [];
    for (let x = 30; x < 400; x++) if (isPrime(x)) primes.push(x);
    // Only pick pairs that work with the current e, so step 4 doesn't fail.
    const e = B(Number($('e').value) || 17);
    const pick = () => primes[Math.floor(Math.random() * primes.length)];
    let p, q;
    do {
      p = pick();
      q = pick();
    } while (p === q || euclidRows(B(p - 1) * B(q - 1), e).gcd !== 1n);
    $('p').value = p;
    $('q').value = q;
    update();
  }

  // ---------------------------------------------------------------- the padlock story

  const CAPTIONS = [
    '1. Your friend has a padlock and the only key to it. They send you the padlock, wide open. It doesn\'t matter who else sees it.',
    '2. You put your message in a box and snap the padlock shut. Now nobody can open the box, not even you.',
    '3. The box travels over the internet. Someone listening sees it go by, but all they get is scrambled numbers.',
    '4. Your friend opens it with their key and reads the message.',
  ];

  function startScene() {
    const svg = $('scene');
    let stage = 0, paused = false, timer = null;
    const show = () => {
      svg.setAttribute('data-stage', String(stage));
      $('scene-caption').textContent = CAPTIONS[stage];
    };
    const advance = () => {
      stage = (stage + 1) % CAPTIONS.length;
      show();
      timer = setTimeout(advance, stage === 0 ? 3800 : 3400);
    };
    show();
    if (calm) {
      // No motion: show the captions as a list instead of animating.
      svg.setAttribute('data-stage', 'still');
      $('scene-caption').innerHTML = CAPTIONS.map((c) => `<span class="still-line">${esc(c)}</span>`).join('');
      $('scene-toggle').hidden = true;
      return;
    }
    timer = setTimeout(advance, 3800);
    $('scene-toggle').addEventListener('click', () => {
      paused = !paused;
      $('scene-toggle').textContent = paused ? 'play' : 'pause';
      svg.classList.toggle('paused', paused);
      if (paused) clearTimeout(timer);
      else timer = setTimeout(advance, 1500);
    });
  }

  // ---------------------------------------------------------------- the mod clock

  function drawClock(n, at, done) {
    const cx = 110, cy = 110, r = 84;
    const pos = (i) => {
      const a = (i / n) * 2 * Math.PI - Math.PI / 2;
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    };
    const parts = [`<circle class="face" cx="${cx}" cy="${cy}" r="${r + 16}"/>`];
    for (let i = 0; i < n; i++) {
      const [x, y] = pos(i);
      parts.push(`<circle class="spot ${i === at ? (done ? 'land' : 'here') : ''}" cx="${x}" cy="${y}" r="12"/>`);
      parts.push(`<text class="spot-label ${i === at ? 'on' : ''}" x="${x}" y="${y + 4}">${i}</text>`);
    }
    const [hx, hy] = pos(at);
    parts.push(`<line class="hand" x1="${cx}" y1="${cy}" x2="${cx + (hx - cx) * 0.72}" y2="${cy + (hy - cy) * 0.72}"/>`);
    parts.push(`<circle class="hub" cx="${cx}" cy="${cy}" r="4"/>`);
    $('clock').innerHTML = parts.join('');
  }

  let clockTimer = null;
  function runClock() {
    clearTimeout(clockTimer);
    const a = Math.max(0, Math.min(200, Math.floor(Number($('clock-a').value) || 0)));
    const n = Math.max(2, Math.min(24, Math.floor(Number($('clock-n').value) || 12)));
    const answer = a % n;
    const done = () => {
      drawClock(n, answer, true);
      $('clock-result').innerHTML = `${a} mod ${n} = <b>${answer}</b>` +
        (a >= n ? `<br><span class="note">${a} = ${Math.floor(a / n)} × ${n} + ${answer}, so ${Math.floor(a / n)} full lap${Math.floor(a / n) === 1 ? '' : 's'} and ${answer} more.</span>` : '');
      replay($('clock-result'), 'changed');
    };
    if (calm || a === 0) return done();
    const delay = Math.max(25, Math.min(220, 3000 / a));
    let count = 0;
    const tick = () => {
      count++;
      drawClock(n, count % n, false);
      $('clock-result').innerHTML = `counted ${count}…`;
      if (count >= a) return done();
      clockTimer = setTimeout(tick, delay);
    };
    drawClock(n, 0, false);
    clockTimer = setTimeout(tick, delay);
  }

  // ---------------------------------------------------------------- wiring

  for (const id of ['p', 'q', 'e', 'msg']) $(id).addEventListener('input', update);
  $('random-primes').addEventListener('click', randomPrimes);
  $('crack').addEventListener('click', crack);
  $('clock-go').addEventListener('click', runClock);
  update();
  state.ready = true;
  startScene();
  drawClock(12, 0, false);

  // Count out the clock the first time it scrolls into view.
  if ('IntersectionObserver' in window) {
    const seen = new IntersectionObserver((entries) => {
      if (entries.some((en) => en.isIntersecting)) { seen.disconnect(); runClock(); }
    }, { threshold: 0.6 });
    seen.observe($('clock'));
  } else {
    runClock();
  }
})();
