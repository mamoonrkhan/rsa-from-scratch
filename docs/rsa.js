// The worksheet logic. Numbers stay small (p, q < 10000), but BigInt keeps
// everything exact without having to think about overflow.
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const B = (x) => BigInt(x);

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

  // ---------------------------------------------------------------- rendering

  const fmt = (x) => x.toLocaleString('en-US').replace('-', '−');
  // "+ 5 × e" or "− 5 × e" instead of "+ -5 × e".
  const plusTerm = (y, what) => `${y < 0n ? '−' : '+'} ${fmt(y < 0n ? -y : y)} × ${what}`;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const show = (ch) => (ch === ' ' ? '␣' : esc(ch));

  function setError(msg) {
    $('prime-error').textContent = msg || '';
    $('prime-error').hidden = !msg;
    $('rest').classList.toggle('faded', Boolean(msg));
  }

  function update() {
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
    $('n-line').innerHTML = `<var>n</var> = ${p} × ${q} = <b>${fmt(n)}</b>`;
    $('n-again').textContent = fmt(n);
    $('phi-line').innerHTML = `φ(<var>n</var>) = (${p} − 1)(${q} − 1) = ${p - 1} × ${q - 1} = <b>${fmt(phi)}</b>`;

    // Step 4
    const eNum = Number($('e').value);
    const e = B(Number.isInteger(eNum) && eNum > 1 ? eNum : 3);
    const { rows, gcd } = euclidRows(phi, e);
    $('euclid').innerHTML = rows.map((r) =>
      `<tr><td>${fmt(r.a)}</td><td>=</td><td>${fmt(r.q)} × ${fmt(r.b)}</td><td>+</td><td><b>${fmt(r.r)}</b></td></tr>`).join('');
    const ok = gcd === 1n && e < phi;
    if (ok) {
      $('gcd-verdict').innerHTML = `The last non-zero remainder is the gcd: <b>gcd(${fmt(phi)}, ${e}) = 1</b>. They share no factor, so <var>e</var> = ${e} works.`;
    } else {
      let suggestion = e + 1n;
      while (euclidRows(phi, suggestion).gcd !== 1n) suggestion += 1n;
      $('gcd-verdict').innerHTML = e >= phi
        ? `<span class="error-text"><var>e</var> should be smaller than φ(<var>n</var>) = ${fmt(phi)}.</span> Try ${suggestion < phi ? suggestion : 3}.`
        : `<span class="error-text">gcd(${fmt(phi)}, ${e}) = ${gcd}, not 1.</span> They share the factor ${gcd}, so no inverse exists. Try <var>e</var> = ${suggestion}.`;
    }
    for (const id of ['d-step', 'enc-step', 'dec-step']) $(id).classList.toggle('faded', !ok);
    if (!ok) {
      for (const id of ['ext-euclid', 'd-line', 'pub-key', 'priv-key', 'enc-table', 'dec-table', 'decrypted', 'k-example', 'crack-result']) $(id).innerHTML = '';
      $('repeat-note').hidden = true;
      return;
    }

    // Step 5
    const ext = extendedRows(phi, e);
    $('ext-euclid').innerHTML = '<tr><th>remainder</th><th></th><th>= x × φ + y × e</th></tr>' +
      ext.slice(0, -1).map((r, i) =>
        `<tr class="${r.r === 1n ? 'hit' : ''}"><td>${fmt(r.r)}</td><td>=</td><td>${fmt(r.x)} × ${fmt(phi)} ${plusTerm(r.y, e)}</td>${i >= 2 ? `<td class="aside">previous two rows, top minus ${r.q} × bottom</td>` : '<td></td>'}</tr>`).join('');
    const last = ext[ext.length - 2];
    const d = mod(last.y, phi);
    $('d-line').innerHTML = `The row with remainder 1 says ${e} × ${last.y < 0n ? `(${fmt(last.y)})` : fmt(last.y)} ≡ 1 (mod ${fmt(phi)})` +
      (last.y < 0n ? `. Negative numbers wrap around, so add ${fmt(phi)}: ${fmt(last.y)} + ${fmt(phi)} = ${fmt(d)}` : '') +
      `. So <b><var>d</var> = ${fmt(d)}</b>.<br><small>Check: ${e} × ${fmt(d)} = ${fmt(e * d)} = ${fmt((e * d) / phi)} × ${fmt(phi)} + 1 ✓</small>`;
    $('pub-key').textContent = `(n = ${fmt(n)}, e = ${e})`;
    $('priv-key').textContent = `(n = ${fmt(n)}, d = ${fmt(d)})`;
    const k = (e * d - 1n) / phi;
    $('k-example').textContent = `(here, ${e} × ${fmt(d)} = 1 + ${fmt(k)} × ${fmt(phi)})`;

    // Step 6 and 7
    const text = [...$('msg').value].filter((ch) => ch.charCodeAt(0) < 128).join('') || 'HI';
    const codes = [...text].map((ch) => B(ch.charCodeAt(0)));
    const ciphers = codes.map((m) => modPow(m, e, n));
    $('enc-table').innerHTML =
      `<tr><th>character</th>${[...text].map((ch) => `<td>${show(ch)}</td>`).join('')}</tr>` +
      `<tr><th><var>m</var></th>${codes.map((m) => `<td>${m}</td>`).join('')}</tr>` +
      `<tr><th><var>c</var> = <var>m</var><sup>${e}</sup> mod ${fmt(n)}</th>${ciphers.map((c) => `<td><b>${fmt(c)}</b></td>`).join('')}</tr>`;

    const seen = new Map();
    let repeat = null;
    [...text].forEach((ch) => { if (seen.has(ch) && !repeat) repeat = ch; seen.set(ch, true); });
    $('repeat-note').hidden = !repeat;
    if (repeat) {
      $('repeat-note').innerHTML = `Notice that both "${show(repeat)}"s encrypt to the same number. An eavesdropper can't read
        the message, but they can see the pattern, and with enough text that's enough to crack it like a newspaper puzzle.
        Real RSA fixes this by adding random padding to each message before encrypting.`;
    }

    const first = codes[0];
    const sm = squareMultiplySteps(first, e, n);
    $('sm-title').innerHTML = `${first}<sup>${e}</sup> mod ${fmt(n)}`;
    $('square-multiply').innerHTML = `<p>Write ${e} in binary: <b>${sm.bits}</b>. Then square repeatedly to get ${first}<sup>1</sup>,
        ${first}<sup>2</sup>, ${first}<sup>4</sup>, … (taking the remainder each time so nothing gets big), and multiply together the
        ones where the bit is 1:</p>
      <table class="work">${sm.steps.map((s) =>
        `<tr class="${s.used ? 'hit' : 'skip'}"><td>${first}<sup>${s.k}</sup> mod ${fmt(n)}</td><td>=</td><td>${fmt(s.power)}</td>
         <td class="aside">${s.used ? `bit is 1: multiply in → ${fmt(s.result)}` : 'bit is 0: skip'}</td></tr>`).join('')}</table>
      <p>${sm.steps.length} squarings instead of ${e - 1n} multiplications. For real keys, where <var>e</var> or <var>d</var>
      has hundreds of digits, this is the difference between microseconds and never finishing.</p>`;

    const back = ciphers.map((c) => modPow(c, d, n));
    $('dec-table').innerHTML =
      `<tr><th><var>c</var></th>${ciphers.map((c) => `<td>${fmt(c)}</td>`).join('')}</tr>` +
      `<tr><th><var>c</var><sup>${fmt(d)}</sup> mod ${fmt(n)}</th>${back.map((m) => `<td><b>${m}</b></td>`).join('')}</tr>` +
      `<tr><th>character</th>${back.map((m) => `<td>${show(String.fromCharCode(Number(m)))}</td>`).join('')}</tr>`;
    $('decrypted').innerHTML = `“${esc(back.map((m) => String.fromCharCode(Number(m))).join(''))}”`;
    $('crack-result').innerHTML = '';
  }

  function crack() {
    const n = Number($('p').value) * Number($('q').value);
    let d = 2, tries = 0;
    const t0 = performance.now();
    while (n % d !== 0) { d += d === 2 ? 1 : 2; tries++; }
    const ms = performance.now() - t0;
    $('crack-result').innerHTML = `${fmt(n)} = ${d} × ${fmt(n / d)}, found after ${fmt(tries + 1)} tries
      (${ms < 1 ? 'under a millisecond' : `${ms.toFixed(1)} ms`}). From here, the attacker repeats steps 3 to 5 and has your private key.`;
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

  for (const id of ['p', 'q', 'e', 'msg']) $(id).addEventListener('input', update);
  $('random-primes').addEventListener('click', randomPrimes);
  $('crack').addEventListener('click', crack);
  update();
})();
