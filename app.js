    // ─── Constants ───
    const BASIC_FIELD_IDS = ['total-3pm', 'total-10pm', 'total-7am'];
    const ADV_FIELD_IDS   = ['adv-3pm-s', 'adv-10pm-s', 'adv-7am-s', 'adv-3pm-l', 'adv-10pm-l', 'adv-7am-l'];
    const RATES = { effectiveDate: '2026-05-10', SP1_RATE: 66.6, SP2_RATE: 200, MEAL_RATE: 950, TAXI_SHORT: 950, TAXI_LONG: 2000 };
    const SP1_RATE = RATES.SP1_RATE;
    const SP2_RATE = RATES.SP2_RATE;
    const MEAL_RATE = RATES.MEAL_RATE;
    const TAXI_SHORT = RATES.TAXI_SHORT;
    const TAXI_LONG = RATES.TAXI_LONG;
    const SHIFT_HOURS    = { '7AM': 8, '3PM': 7, '10PM': 9 };
    const SHIFT_ORDER    = ['7AM', '3PM', '10PM'];
    const HOURS_THRESHOLD = 173.33;
    const HOLIDAY_MULT    = 2;
    const OVERTIME_MULT   = 1.5;
    const STORAGE_KEY_EXTRA = 'extraHours.v2';
    const STORAGE_KEY_BASIC = 'nsCalc.basicFields.v2';
    const STORAGE_KEY_ADV   = 'nsCalc.advFields.v2';
    const STORAGE_KEY_MODE  = 'nsCalc.mode.v1';
    const MOTION = { fast: 140, snap: 220, stage: 380 };

    function reducedMotion() {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    // ─── State ───
    let mode     = 'BASIC';
    let distance = 'SHORT';
    let prevPage = null;
    let infoReturnPage = null;
    let confirmCallback = null;
    let lastSnapshot = null;
    let lastIssues = [];
    let dayModalDate = null;

    // ─── Cached DOM references ───
    const basicFields = Object.fromEntries(BASIC_FIELD_IDS.map(id => [id, document.getElementById(id)]));
    const advFields   = Object.fromEntries(ADV_FIELD_IDS.map(id => [id, document.getElementById(id)]));
    const pageCalc       = document.getElementById('calculator-page');
    const pageRes        = document.getElementById('results-page');
    const pageAbout      = document.getElementById('about-page');
    const pageDisclaimer = document.getElementById('disclaimer-page');
    const pages          = [pageCalc, pageRes, pageAbout, pageDisclaimer];
    const calcBtn        = document.getElementById('calc-btn');
    const hintModal      = document.getElementById('hint-modal');
    const alertModal     = document.getElementById('alert-modal');
    const dayModal       = document.getElementById('day-modal');
    const copyBtn        = document.getElementById('copy-btn');
    const totalRow       = document.getElementById('total-row');
    const calBody        = document.getElementById('cal-body');
    const calTitle       = document.getElementById('cal-title');
    const calPrevBtn     = document.getElementById('cal-prev');
    const calNextBtn     = document.getElementById('cal-next');
    const basicSalaryInput = document.getElementById('basic-salary');
    const compAllowanceInput = document.getElementById('comp-allowance');
    const crosscheckEl   = document.getElementById('crosscheck');
    const crosscheckList = document.getElementById('crosscheck-list');

    const ratesEffectiveEl = document.getElementById('rates-effective');
    if (ratesEffectiveEl) ratesEffectiveEl.textContent = 'Rates effective: ' + RATES.effectiveDate;


    const modeSegmented   = document.getElementById('mode-segmented');
    const modeThumb       = document.getElementById('mode-thumb');
    const modeBasicBtn    = document.getElementById('mode-basic');
    const modeAdvancedBtn = document.getElementById('mode-advanced');
    const modeBlockBasic    = document.getElementById('mode-block-basic');
    const modeBlockAdvanced = document.getElementById('mode-block-advanced');

    const distSegmented = document.getElementById('distance-segmented');
    const distThumb     = document.getElementById('distance-thumb');
    const distShortBtn  = document.getElementById('dist-short');
    const distLongBtn   = document.getElementById('dist-long');

    const liveEls = {
      sp1:    document.getElementById('live-sp1'),
      sp2:    document.getElementById('live-sp2'),
      meal:   document.getElementById('live-meal'),
      taxi:   document.getElementById('live-taxi'),
      dist:   document.getElementById('live-distance'),
      basic:  document.getElementById('live-basic'),
      comp:   document.getElementById('live-comp'),
      totalHrs: document.getElementById('live-total-hrs'),
      holHrs: document.getElementById('live-hol-hrs'),
      nhHrs:  document.getElementById('live-nh-hrs'),
      overHrs: document.getElementById('live-over-hrs'),
      rate:   document.getElementById('live-rate'),
      holPay: document.getElementById('live-hol-pay'),
      otPay:  document.getElementById('live-ot-pay'),
      grand:  document.getElementById('live-grand-total')
    };

    const resEls = {
      eyebrow:   document.getElementById('res-eyebrow'),
      subtitle:  document.getElementById('res-subtitle'),
      sp1:       document.getElementById('r-sp1'),
      sp2:       document.getElementById('r-sp2'),
      meal:      document.getElementById('r-meal'),
      taxi:      document.getElementById('r-taxi'),
      distance:  document.getElementById('r-distance'),
      allowanceTotal: document.getElementById('r-allowance-total'),
      basic:     document.getElementById('r-basic'),
      comp:      document.getElementById('r-comp'),
      baseTotal: document.getElementById('r-base-total'),
      ehTotal:   document.getElementById('r-eh-total'),
      ehHol:     document.getElementById('r-eh-hol'),
      ehNh:      document.getElementById('r-eh-nh'),
      ehOver:    document.getElementById('r-eh-over'),
      ehRate:    document.getElementById('r-eh-rate'),
      ehHolPay:  document.getElementById('r-eh-hol-pay'),
      ehOtPay:   document.getElementById('r-eh-ot-pay'),
      ehTotalPay: document.getElementById('r-eh-total-pay'),
      grand:     document.getElementById('r-total'),
      crosscheck: document.getElementById('r-crosscheck'),
      crosscheckList: document.getElementById('r-crosscheck-list')
    };

    const dayModalTitle = document.getElementById('day-modal-title');
    const dayHolidayLbl = document.getElementById('day-holiday-label');
    const dayToggleEls  = {
      '7AM':  document.getElementById('day-toggle-7AM'),
      '3PM':  document.getElementById('day-toggle-3PM'),
      '10PM': document.getElementById('day-toggle-10PM'),
      'holiday': document.getElementById('day-toggle-holiday')
    };
    const dayDistEls = {
      '7AM':  document.getElementById('day-dist-7AM'),
      '3PM':  document.getElementById('day-dist-3PM'),
      '10PM': document.getElementById('day-dist-10PM')
    };

    // ─── Helpers ───
    function val(el) { return el ? (parseFloat(el.value) || 0) : 0; }
    function valById(id, map) { return val(map[id]); }
    function round2(n) { return Math.round(n * 100) / 100; }
    function fmt(n) { return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
    function fmtHrs(n) { return n.toFixed(2); }

    function safeGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
    function safeSet(key, value) { try { localStorage.setItem(key, value); } catch (e) {} }
    function safeRemove(key) { try { localStorage.removeItem(key); } catch (e) {} }

    function pad2(n) { return n < 10 ? '0' + n : '' + n; }
    function toYMD(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
    function fromYMD(s) { const p = s.split('-'); return new Date(parseInt(p[0],10), parseInt(p[1],10)-1, parseInt(p[2],10)); }
    function addDays(d, n) { const r = new Date(d.getFullYear(), d.getMonth(), d.getDate()); r.setDate(r.getDate()+n); return r; }
    function sameYMD(a, b) { return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }

    // ─── Migration: v1 storage → v2 ───
    function migrateStorage() {
      const oldEH = safeGet('extraHours.v1');
      if (oldEH && !safeGet(STORAGE_KEY_EXTRA)) {
        try {
          const data = JSON.parse(oldEH);
          if (data && data.days) {
            const newDays = {};
            Object.keys(data.days).forEach(function(ymd) {
              const entry = data.days[ymd];
              if (!entry || !entry.shifts) return;
              const newShifts = {};
              if (Array.isArray(entry.shifts)) {
                entry.shifts.forEach(function(code) { newShifts[code] = null; });
              } else if (typeof entry.shifts === 'object') {
                Object.keys(entry.shifts).forEach(function(code) { newShifts[code] = entry.shifts[code]; });
              }
              if (Object.keys(newShifts).length) newDays[ymd] = { shifts: newShifts };
            });
            data.days = newDays;
            safeSet(STORAGE_KEY_EXTRA, JSON.stringify(data));
          }
        } catch (e) {}
        safeRemove('extraHours.v1');
      }
      const oldB = safeGet('nsCalc.basicFields.v1');
      if (oldB && !safeGet(STORAGE_KEY_BASIC)) {
        safeSet(STORAGE_KEY_BASIC, oldB);
        safeRemove('nsCalc.basicFields.v1');
      }
      const oldA = safeGet('nsCalc.advFields.v1');
      if (oldA && !safeGet(STORAGE_KEY_ADV)) {
        safeSet(STORAGE_KEY_ADV, oldA);
        safeRemove('nsCalc.advFields.v1');
      }
    }
    migrateStorage();

    // ─── Validation ───
    function validateInputs(ids, map) {
      let valid = true;
      ids.forEach(function(id) {
        const el = map[id];
        if (!el) return;
        const n = parseFloat(el.value);
        const bad = el.value.trim() !== '' && (isNaN(n) || n < 0 || n > 99);
        el.classList.toggle('error', bad);
        if (bad) {
          if (!reducedMotion()) {
            el.classList.add('shake');
            setTimeout(function() { el.classList.remove('shake'); }, 300);
          }
          el.setAttribute('aria-invalid', 'true');
          valid = false;
        } else {
          el.removeAttribute('aria-invalid');
        }
      });
      return valid;
    }

    // ─── Custom modal (replaces native alert / confirm) ───
    function showAlert(message) {
      document.getElementById('alert-title').textContent = 'Notice';
      document.getElementById('alert-message').textContent = message;
      const actions = document.getElementById('alert-actions');
      actions.innerHTML = '';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'modal-close';
      btn.textContent = 'OK';
      btn.onclick = closeAlert;
      actions.appendChild(btn);
      alertModal.classList.add('open');
    }
    function showConfirm(message, callback, yesLabel) {
      document.getElementById('alert-title').textContent = 'Confirm';
      document.getElementById('alert-message').textContent = message;
      confirmCallback = callback;
      const actions = document.getElementById('alert-actions');
      actions.innerHTML = '';
      const yesBtn = document.createElement('button');
      yesBtn.type = 'button';
      yesBtn.className = 'modal-close';
      yesBtn.textContent = yesLabel || 'Confirm';
      yesBtn.onclick = function() { closeAlert(); if (confirmCallback) confirmCallback(); confirmCallback = null; };
      actions.appendChild(yesBtn);
      const noBtn = document.createElement('button');
      noBtn.type = 'button';
      noBtn.className = 'back-btn';
      noBtn.textContent = 'Cancel';
      noBtn.onclick = function() { closeAlert(); confirmCallback = null; };
      actions.appendChild(noBtn);
      alertModal.classList.add('open');
    }
    function closeAlert() { alertModal.classList.remove('open'); }
    function closeAlertOnOverlay(e) { if (e.target === alertModal) closeAlert(); }

    // ─── Hint modal ───
    function openHint()  { hintModal.classList.add('open'); }
    function closeHint() { hintModal.classList.remove('open'); }
    function closeHintOnOverlay(e) { if (e.target === hintModal) closeHint(); }

    // ─── Easter / holidays ───
    function computeEaster(year) {
      const a = year % 19;
      const b = Math.floor(year / 100);
      const c = year % 100;
      const d = Math.floor(b / 4);
      const e = b % 4;
      const f = Math.floor((b + 8) / 25);
      const g = Math.floor((b - f + 1) / 3);
      const h = (19 * a + b - d - g + 15) % 30;
      const i = Math.floor(c / 4);
      const k = c % 4;
      const L = (32 + 2 * e + 2 * i - h - k) % 7;
      const m = Math.floor((a + 11 * h + 22 * L) / 451);
      const month = Math.floor((h + L - 7 * m + 114) / 31);
      const day   = ((h + L - 7 * m + 114) % 31) + 1;
      return new Date(year, month - 1, day);
    }
    function thirdMondayOfOctober(year) {
      const oct1 = new Date(year, 9, 1);
      const offsetToFirstMon = (1 - oct1.getDay() + 7) % 7;
      return new Date(year, 9, 1 + offsetToFirstMon + 14);
    }
    const _holidayCache = new Map();
    function getHolidaysForYear(year) {
      if (_holidayCache.has(year)) return _holidayCache.get(year);
      const set = new Set();
      set.add(toYMD(new Date(year, 0, 1)));
      set.add(toYMD(new Date(year, 4, 23)));
      set.add(toYMD(new Date(year, 7, 1)));
      set.add(toYMD(new Date(year, 7, 6)));
      set.add(toYMD(new Date(year, 11, 25)));
      set.add(toYMD(new Date(year, 11, 26)));
      const easter = computeEaster(year);
      set.add(toYMD(addDays(easter, -46)));
      set.add(toYMD(addDays(easter, -2)));
      set.add(toYMD(addDays(easter, 1)));
      set.add(toYMD(thirdMondayOfOctober(year)));
      _holidayCache.set(year, set);
      return set;
    }
    function isBuiltInHoliday(ymd) {
      const year = parseInt(ymd.slice(0, 4), 10);
      return getHolidaysForYear(year).has(ymd);
    }
    function isHoliday(ymd) {
      if (Object.prototype.hasOwnProperty.call(extraHoursState.customHolidays, ymd)) {
        return !!extraHoursState.customHolidays[ymd];
      }
      return isBuiltInHoliday(ymd);
    }

    // ─── Pay periods ───
    function payPeriodStart(year, month) { return new Date(year, month, 16); }
    function payPeriodEnd(year, month)   { return new Date(year, month + 1, 15); }
    function currentPayPeriod(today) {
      const t = today || new Date();
      let m = t.getDate() <= 15 ? t.getMonth() - 1 : t.getMonth();
      let y = t.getFullYear();
      if (m < 0) { m += 12; y -= 1; }
      return { year: y, month: m };
    }
    function shiftPayPeriod(period, delta) {
      let m = period.month + delta;
      let y = period.year;
      while (m < 0)  { m += 12; y -= 1; }
      while (m > 11) { m -= 12; y += 1; }
      return { year: y, month: m };
    }
    const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    function payPeriodLabel(period) {
      const start = payPeriodStart(period.year, period.month);
      const end   = payPeriodEnd(period.year, period.month);
      const sameYear = start.getFullYear() === end.getFullYear();
      if (sameYear) {
        return '16 ' + MONTH_SHORT[start.getMonth()] + ' – 15 ' + MONTH_SHORT[end.getMonth()] + ' ' + start.getFullYear();
      }
      return '16 ' + MONTH_SHORT[start.getMonth()] + ' ' + start.getFullYear() + ' – 15 ' + MONTH_SHORT[end.getMonth()] + ' ' + end.getFullYear();
    }

    // ─── Extra Hours state ───
    let extraHoursState = {
      basicSalary: 0,
      compAllowance: 0,
      customHolidays: {},
      days: {},
      viewPeriod: currentPayPeriod()
    };

    function loadExtraHoursState() {
      const raw = safeGet(STORAGE_KEY_EXTRA);
      if (!raw) return;
      let data; try { data = JSON.parse(raw); } catch (e) { return; }
      if (!data || typeof data !== 'object') return;
      if (typeof data.basicSalary === 'number') extraHoursState.basicSalary = data.basicSalary;
      if (typeof data.compAllowance === 'number') extraHoursState.compAllowance = data.compAllowance;
      if (data.customHolidays && typeof data.customHolidays === 'object') extraHoursState.customHolidays = data.customHolidays;
      if (data.days && typeof data.days === 'object') {
        const days = {};
        Object.keys(data.days).forEach(function(ymd) {
          const entry = data.days[ymd];
          if (!entry || !entry.shifts) return;
          let shifts = {};
          if (Array.isArray(entry.shifts)) {
            entry.shifts.forEach(function(c) { shifts[c] = null; });
          } else if (typeof entry.shifts === 'object') {
            shifts = entry.shifts;
          }
          if (Object.keys(shifts).length) days[ymd] = { shifts: shifts };
        });
        extraHoursState.days = days;
      }
      if (data.viewPeriod && typeof data.viewPeriod.year === 'number' && typeof data.viewPeriod.month === 'number') {
        extraHoursState.viewPeriod = { year: data.viewPeriod.year, month: data.viewPeriod.month };
      }
    }
    let _ehSaveTimer = null;
    function saveExtraHoursState() {
      clearTimeout(_ehSaveTimer);
      _ehSaveTimer = setTimeout(function() { safeSet(STORAGE_KEY_EXTRA, JSON.stringify(extraHoursState)); }, 250);
    }

    // ─── Persistence: Basic / Advanced fields & Mode ───
    let _basicSaveTimer = null;
    function saveBasicFields() {
      clearTimeout(_basicSaveTimer);
      _basicSaveTimer = setTimeout(function() {
        const data = { distance: distance };
        BASIC_FIELD_IDS.forEach(function(id) { data[id] = basicFields[id].value; });
        safeSet(STORAGE_KEY_BASIC, JSON.stringify(data));
      }, 250);
    }
    function loadBasicFields() {
      const raw = safeGet(STORAGE_KEY_BASIC);
      if (!raw) return;
      let data; try { data = JSON.parse(raw); } catch (e) { return; }
      if (!data || typeof data !== 'object') return;
      BASIC_FIELD_IDS.forEach(function(id) {
        if (typeof data[id] === 'string') basicFields[id].value = data[id];
      });
      if (data.distance === 'SHORT' || data.distance === 'LONG') distance = data.distance;
    }
    let _advSaveTimer = null;
    function saveAdvFields() {
      clearTimeout(_advSaveTimer);
      _advSaveTimer = setTimeout(function() {
        const data = {};
        ADV_FIELD_IDS.forEach(function(id) { data[id] = advFields[id].value; });
        safeSet(STORAGE_KEY_ADV, JSON.stringify(data));
      }, 250);
    }
    function loadAdvFields() {
      const raw = safeGet(STORAGE_KEY_ADV);
      if (!raw) return;
      let data; try { data = JSON.parse(raw); } catch (e) { return; }
      if (!data || typeof data !== 'object') return;
      ADV_FIELD_IDS.forEach(function(id) {
        if (typeof data[id] === 'string') advFields[id].value = data[id];
      });
    }
    function loadMode() {
      const raw = safeGet(STORAGE_KEY_MODE);
      return (raw === 'BASIC' || raw === 'ADVANCED') ? raw : 'BASIC';
    }
    function saveMode() { safeSet(STORAGE_KEY_MODE, mode); }

    function syncTabState(btnA, btnB, activeA) {
      if (!btnA || !btnB) return;
      btnA.setAttribute('tabindex', activeA ? '0' : '-1');
      btnB.setAttribute('tabindex', activeA ? '-1' : '0');
    }

    // ─── Segmented control thumb positioning ───
    function positionSegmentedThumb(container, thumb, target, animate) {
      if (!container || !thumb || !target) return;
      const padLeft = parseFloat(getComputedStyle(container).paddingLeft) || 0;
      const offLeft = target.offsetLeft;
      const width   = target.offsetWidth;
      thumb.style.width = width + 'px';
      if (!animate || reducedMotion()) {
        const prev = thumb.style.transition;
        thumb.style.transition = 'none';
        thumb.style.transform = 'translateX(' + (offLeft - padLeft) + 'px)';
        void thumb.offsetWidth;
        thumb.style.transition = prev || '';
      } else {
        thumb.style.transform = 'translateX(' + (offLeft - padLeft) + 'px)';
      }
    }

    // ─── Mode toggle ───
    function setMode(m, animate) {
      if (m !== 'BASIC' && m !== 'ADVANCED') return;
      mode = m;
      modeBasicBtn.setAttribute('aria-selected', m === 'BASIC' ? 'true' : 'false');
      modeAdvancedBtn.setAttribute('aria-selected', m === 'ADVANCED' ? 'true' : 'false');
      syncTabState(modeBasicBtn, modeAdvancedBtn, m === 'BASIC');
      modeBlockBasic.classList.toggle('active', m === 'BASIC');
      modeBlockAdvanced.classList.toggle('active', m === 'ADVANCED');
      positionSegmentedThumb(modeSegmented, modeThumb, m === 'BASIC' ? modeBasicBtn : modeAdvancedBtn, animate);
      saveMode();
      if (dayModalDate) syncDayModalToggles();
      renderLive();
    }

    function setDistance(v, animate) {
      if (v !== 'SHORT' && v !== 'LONG') return;
      distance = v;
      distShortBtn.setAttribute('aria-selected', v === 'SHORT' ? 'true' : 'false');
      distLongBtn.setAttribute('aria-selected', v === 'LONG' ? 'true' : 'false');
      syncTabState(distShortBtn, distLongBtn, v === 'SHORT');
      positionSegmentedThumb(distSegmented, distThumb, v === 'SHORT' ? distShortBtn : distLongBtn, animate !== false);
      saveBasicFields();
      renderLive();
    }

    // ─── Calculation: allowance ───
    function gatherBasic() {
      return {
        all3:        valById('total-3pm', basicFields),
        all10:       valById('total-10pm', basicFields),
        all7:        valById('total-7am', basicFields)
      };
    }
    function gatherAdvanced() {
      return {
        s3:  valById('adv-3pm-s', advFields),
        s10: valById('adv-10pm-s', advFields),
        s7:  valById('adv-7am-s', advFields),
        l3:  valById('adv-3pm-l', advFields),
        l10: valById('adv-10pm-l', advFields),
        l7:  valById('adv-7am-l', advFields)
      };
    }

    function gatherCalendarAllowanceCounts() {
      const period = extraHoursState.viewPeriod;
      const start = payPeriodStart(period.year, period.month);
      const end   = payPeriodEnd(period.year, period.month);
      const counts = {
        total3: 0, total10: 0, total7: 0,
        short3: 0, short10: 0, short7: 0,
        long3: 0, long10: 0, long7: 0,
        inferredDoubleDaysTotal: 0,
        inferredDoubleDaysShort: 0,
        inferredDoubleDaysLong: 0
      };
      for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
        const ymd = toYMD(d);
        const entry = extraHoursState.days[ymd];
        if (!entry || !entry.shifts) continue;
        const has3 = ('3PM' in entry.shifts);
        const has10 = ('10PM' in entry.shifts);
        if (has3) counts.total3 += 1;
        if (has10) counts.total10 += 1;
        if ('7AM' in entry.shifts) counts.total7 += 1;
        if (entry.shifts['3PM'] === 'SHORT') counts.short3 += 1;
        if (entry.shifts['10PM'] === 'SHORT') counts.short10 += 1;
        if (entry.shifts['7AM'] === 'SHORT') counts.short7 += 1;
        if (entry.shifts['3PM'] === 'LONG') counts.long3 += 1;
        if (entry.shifts['10PM'] === 'LONG') counts.long10 += 1;
        if (entry.shifts['7AM'] === 'LONG') counts.long7 += 1;
        if (has3 && has10) {
          counts.inferredDoubleDaysTotal += 1;
          const d3 = entry.shifts['3PM'];
          const d10 = entry.shifts['10PM'];
          if (d3 === 'SHORT' && d10 === 'SHORT') counts.inferredDoubleDaysShort += 1;
          if (d3 === 'LONG' && d10 === 'LONG') counts.inferredDoubleDaysLong += 1;
        }
      }
      return counts;
    }

    function computeAllowance(modeArg) {
      const c = gatherCalendarAllowanceCounts();
      if (modeArg === 'BASIC') {
        const rSP1  = round2(c.total3 * SP1_RATE);
        const rSP2  = round2(c.total10 * SP2_RATE);
        const rMeal = round2((c.total3 + c.total10) * MEAL_RATE);
        const taxiUnits = Math.max(0, c.total3 + c.total10 - c.inferredDoubleDaysTotal * 2);
        const rTaxi = round2(taxiUnits * (distance === 'SHORT' ? TAXI_SHORT : TAXI_LONG));
        return { rSP1: rSP1, rSP2: rSP2, rMeal: rMeal, rTaxi: rTaxi, total: round2(rSP1 + rSP2 + rMeal + rTaxi), distLabel: distance === 'SHORT' ? 'Short' : 'Long' };
      }
      const rSP1  = round2((c.short3 + c.long3) * SP1_RATE);
      const rSP2  = round2((c.short10 + c.long10) * SP2_RATE);
      const rMeal = round2((c.short3 + c.long3 + c.short10 + c.long10) * MEAL_RATE);
      const shortTaxiUnits = Math.max(0, c.short3 + c.short10 - c.inferredDoubleDaysShort * 2);
      const longTaxiUnits = Math.max(0, c.long3 + c.long10 - c.inferredDoubleDaysLong * 2);
      const rTaxi = round2(shortTaxiUnits * TAXI_SHORT + longTaxiUnits * TAXI_LONG);
      return { rSP1: rSP1, rSP2: rSP2, rMeal: rMeal, rTaxi: rTaxi, total: round2(rSP1 + rSP2 + rMeal + rTaxi), distLabel: 'Short + Long' };
    }

    function hasShift(ymd, code) {
      const entry = extraHoursState.days[ymd];
      return !!(entry && entry.shifts && (code in entry.shifts));
    }

    function isExtraShift(ymd, code) {
      const d = fromYMD(ymd);
      if (code === '7AM') {
        const prevDay = toYMD(addDays(d, -1));
        return hasShift(prevDay, '10PM');
      }
      if (code === '3PM') {
        return hasShift(ymd, '7AM');
      }
      if (code === '10PM') {
        return hasShift(ymd, '3PM');
      }
      return false;
    }

    // ─── Calculation: extra hours ───
    function computeExtraHours() {
      const period = extraHoursState.viewPeriod;
      const start  = payPeriodStart(period.year, period.month);
      const end    = payPeriodEnd(period.year, period.month);
      const monthly = extraHoursState.basicSalary || 0;
      const rate = monthly > 0 ? monthly / HOURS_THRESHOLD : 0;
      let totalHours = 0;
      let holidayHours = 0;
      for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
        const dStr = toYMD(d);
        const entry = extraHoursState.days[dStr];
        if (!entry || !entry.shifts) continue;
        const codes = Object.keys(entry.shifts);
        for (let i = 0; i < codes.length; i++) {
          const code = codes[i];
          const extraShift = isExtraShift(dStr, code);
          if (code === '7AM') {
            totalHours += 8;
            if (extraShift && isHoliday(dStr)) holidayHours += 8;
          } else if (code === '3PM') {
            totalHours += 7;
            if (extraShift && isHoliday(dStr)) holidayHours += 7;
          } else if (code === '10PM') {
            if (d >= start && d <= end) {
              totalHours += 2;
              if (extraShift && isHoliday(dStr)) holidayHours += 2;
            }
          }
        }
      }
      const scanStart = addDays(start, -1);
      for (let d = new Date(scanStart); d <= end; d = addDays(d, 1)) {
        const dStr = toYMD(d);
        const entry = extraHoursState.days[dStr];
        if (!entry || !entry.shifts) continue;
        if (!('10PM' in entry.shifts)) continue;
        const next = addDays(d, 1);
        const nextStr = toYMD(next);
        if (next >= start && next <= end) {
          totalHours += 7;
          if (isExtraShift(dStr, '10PM') && isHoliday(nextStr)) holidayHours += 7;
        }
      }
      const nonHoliday = totalHours - holidayHours;
      const overHours  = Math.max(0, nonHoliday - HOURS_THRESHOLD);
      const holidayPay = holidayHours * rate * HOLIDAY_MULT;
      const overtimePay = overHours * rate * OVERTIME_MULT;
      return {
        totalHours: totalHours, holidayHours: holidayHours, nonHoliday: nonHoliday,
        overHours: overHours, rate: rate,
        holidayPay: holidayPay, overtimePay: overtimePay,
        totalPay: holidayPay + overtimePay
      };
    }

    // ─── Cross-check ───
    function crossCheck() {
      const period = extraHoursState.viewPeriod;
      const start = payPeriodStart(period.year, period.month);
      const end   = payPeriodEnd(period.year, period.month);
      const buckets = {
        '7AM':  { SHORT: 0, LONG: 0, ANY: 0, dates: { SHORT: [], LONG: [], ANY: [] } },
        '3PM':  { SHORT: 0, LONG: 0, ANY: 0, dates: { SHORT: [], LONG: [], ANY: [] } },
        '10PM': { SHORT: 0, LONG: 0, ANY: 0, dates: { SHORT: [], LONG: [], ANY: [] } }
      };
      for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
        const ymd = toYMD(d);
        const entry = extraHoursState.days[ymd];
        if (!entry || !entry.shifts) continue;
        Object.keys(entry.shifts).forEach(function(code) {
          if (!buckets[code]) return;
          buckets[code].ANY += 1;
          buckets[code].dates.ANY.push(ymd);
          const dist = entry.shifts[code];
          if (dist === 'SHORT' || dist === 'LONG') {
            buckets[code][dist] += 1;
            buckets[code].dates[dist].push(ymd);
          }
        });
      }
      const issues = [];
      if (mode === 'BASIC') {
        const map = { '7AM': 'total-7am', '3PM': 'total-3pm', '10PM': 'total-10pm' };
        SHIFT_ORDER.forEach(function(code) {
          const entered = valById(map[code], basicFields);
          const cal = buckets[code].ANY;
          if (entered !== cal) {
            issues.push({ code: code, scope: 'TOTAL', entered: entered, calendar: cal, fieldId: map[code], dates: buckets[code].dates.ANY });
          }
        });
      } else {
        const map = {
          '7AM':  { SHORT: 'adv-7am-s', LONG: 'adv-7am-l' },
          '3PM':  { SHORT: 'adv-3pm-s', LONG: 'adv-3pm-l' },
          '10PM': { SHORT: 'adv-10pm-s', LONG: 'adv-10pm-l' }
        };
        SHIFT_ORDER.forEach(function(code) {
          const enteredS = valById(map[code].SHORT, advFields);
          const enteredL = valById(map[code].LONG,  advFields);
          if (enteredS !== buckets[code].SHORT) {
            issues.push({ code: code, scope: 'SHORT', entered: enteredS, calendar: buckets[code].SHORT, fieldId: map[code].SHORT, dates: buckets[code].dates.SHORT });
          }
          if (enteredL !== buckets[code].LONG) {
            issues.push({ code: code, scope: 'LONG', entered: enteredL, calendar: buckets[code].LONG, fieldId: map[code].LONG, dates: buckets[code].dates.LONG });
          }
          const unassigned = buckets[code].ANY - buckets[code].SHORT - buckets[code].LONG;
          if (unassigned > 0) {
            const unDates = buckets[code].dates.ANY.filter(function(ymd) {
              const entry = extraHoursState.days[ymd];
              return entry && entry.shifts && entry.shifts[code] !== 'SHORT' && entry.shifts[code] !== 'LONG';
            });
            issues.push({ code: code, scope: 'UNASSIGNED', count: unassigned, dates: unDates });
          }
        });
      }
      return issues;
    }

    function describeIssue(issue) {
      const code = issue.code;
      if (issue.scope === 'TOTAL') {
        return '<strong>' + code + '</strong> &mdash; counted ' + issue.entered + ', calendar shows ' + issue.calendar + '.';
      }
      if (issue.scope === 'SHORT' || issue.scope === 'LONG') {
        return '<strong>' + code + ' ' + (issue.scope === 'SHORT' ? 'Short' : 'Long') + '</strong> &mdash; counted ' + issue.entered + ', calendar shows ' + issue.calendar + '.';
      }
      if (issue.scope === 'UNASSIGNED') {
        return '<strong>' + code + '</strong> &mdash; ' + issue.count + ' calendar shift' + (issue.count === 1 ? '' : 's') + ' missing a Short / Long flag.';
      }
      return '';
    }

    function renderCrossCheck(issues) {
      lastIssues = issues;
      const allInputs = BASIC_FIELD_IDS.concat(ADV_FIELD_IDS);
      allInputs.forEach(function(id) {
        const el = document.getElementById(id);
        if (el) el.classList.remove('field-input--warn');
      });
      if (!issues.length) {
        crosscheckEl.classList.remove('visible');
        crosscheckList.innerHTML = '';
        return;
      }
      crosscheckEl.classList.add('visible');
      crosscheckList.innerHTML = '';
      issues.forEach(function(issue) {
        const li = document.createElement('li');
        li.className = 'crosscheck-issue';
        li.innerHTML = describeIssue(issue);
        li.addEventListener('click', function() { highlightIssue(issue); });
        crosscheckList.appendChild(li);
        if (issue.fieldId) {
          const el = document.getElementById(issue.fieldId);
          if (el) el.classList.add('field-input--warn');
        }
      });
    }

    function highlightIssue(issue) {
      if (!issue.dates || !issue.dates.length) return;
      Array.prototype.forEach.call(document.querySelectorAll('.cal-day--warn-pulse'), function(el) {
        el.classList.remove('cal-day--warn-pulse');
      });
      issue.dates.forEach(function(ymd) {
        const cell = document.querySelector('.cal-day[data-ymd="' + ymd + '"]');
        if (cell) cell.classList.add('cal-day--warn-pulse');
      });
      const first = document.querySelector('.cal-day[data-ymd="' + issue.dates[0] + '"]');
      if (first) first.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' });
      setTimeout(function() {
        Array.prototype.forEach.call(document.querySelectorAll('.cal-day--warn-pulse'), function(el) {
          el.classList.remove('cal-day--warn-pulse');
        });
      }, 1700);
    }

    // ─── Number tween (write final value, pulse on change) ───
    const _tweenStates = new WeakMap();
    function tweenValue(el, to, formatter) {
      if (!el) return;
      const prev = _tweenStates.get(el);
      const from = prev ? prev.current : to;
      _tweenStates.set(el, { current: to });
      el.textContent = formatter(to);
      if (from === to || reducedMotion()) return;
      // Restart the pulse animation
      el.classList.remove('tween--pulse');
      void el.offsetWidth;
      el.classList.add('tween--pulse');
    }
    function tweenMoney(el, to) { tweenValue(el, to, function(v) { return fmt(v); }); }
    function tweenHours(el, to) { tweenValue(el, to, function(v) { return fmtHrs(v); }); }

    // ─── Live render ───
    function renderLive() {
      const a = computeAllowance(mode);
      const e = computeExtraHours();
      const basic = extraHoursState.basicSalary || 0;
      const comp  = extraHoursState.compAllowance || 0;
      tweenMoney(liveEls.sp1,  a.rSP1);
      tweenMoney(liveEls.sp2,  a.rSP2);
      tweenMoney(liveEls.meal, a.rMeal);
      tweenMoney(liveEls.taxi, a.rTaxi);
      liveEls.dist.textContent = a.distLabel;
      tweenMoney(liveEls.basic, basic);
      tweenMoney(liveEls.comp,  comp);
      tweenHours(liveEls.totalHrs, e.totalHours);
      tweenHours(liveEls.holHrs,   e.holidayHours);
      tweenHours(liveEls.nhHrs,    e.nonHoliday);
      tweenHours(liveEls.overHrs,  e.overHours);
      tweenMoney(liveEls.rate,    e.rate);
      tweenMoney(liveEls.holPay,  e.holidayPay);
      tweenMoney(liveEls.otPay,   e.overtimePay);
      tweenMoney(liveEls.grand,   round2(a.total + basic + comp + e.totalPay));
      const issues = crossCheck();
      renderCrossCheck(issues);
    }

    // ─── Calendar rendering ───
    function renderCalendar() {
      const period = extraHoursState.viewPeriod;
      calTitle.textContent = payPeriodLabel(period);
      const start = payPeriodStart(period.year, period.month);
      const end   = payPeriodEnd(period.year, period.month);
      const today = new Date();
      calBody.innerHTML = '';
      const months = [
        { year: start.getFullYear(), month: start.getMonth() },
        { year: end.getFullYear(),   month: end.getMonth()   }
      ];
      months.forEach(function(mObj) {
        const block = document.createElement('div');
        block.className = 'cal-month-block';
        const label = document.createElement('div');
        label.className = 'cal-monthlabel';
        label.textContent = MONTH_SHORT[mObj.month] + ' ' + mObj.year;
        block.appendChild(label);
        const wkdays = document.createElement('div');
        wkdays.className = 'cal-weekdays';
        ['S','M','T','W','T','F','S'].forEach(function(d) {
          const s = document.createElement('span');
          s.textContent = d;
          wkdays.appendChild(s);
        });
        block.appendChild(wkdays);
        const grid = document.createElement('div');
        grid.className = 'cal-grid';
        const firstOfMonth = new Date(mObj.year, mObj.month, 1);
        const daysInMonth  = new Date(mObj.year, mObj.month + 1, 0).getDate();
        const startWeekday = firstOfMonth.getDay();
        for (let i = 0; i < startWeekday; i++) {
          const blank = document.createElement('div');
          blank.className = 'cal-day cal-day--blank';
          grid.appendChild(blank);
        }
        for (let day = 1; day <= daysInMonth; day++) {
          const date = new Date(mObj.year, mObj.month, day);
          const inPeriod = date >= start && date <= end;
          grid.appendChild(renderDayCell(date, inPeriod, today));
        }
        block.appendChild(grid);
        calBody.appendChild(block);
      });
    }

    function renderDayCell(date, inPeriod, today) {
      const ymd = toYMD(date);
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cal-day';
      cell.setAttribute('data-ymd', ymd);
      if (!inPeriod) cell.classList.add('cal-day--out-of-period');
      if (today && sameYMD(date, today)) cell.classList.add('cal-day--today');
      const entry = extraHoursState.days[ymd];
      const shifts = (entry && entry.shifts) ? entry.shifts : {};
      const codes = Object.keys(shifts);
      if (codes.length) cell.classList.add('cal-day--has-shifts');
      if (isHoliday(ymd)) cell.classList.add('cal-day--holiday');
      const num = document.createElement('span');
      num.className = 'cal-day-num';
      num.textContent = date.getDate();
      cell.appendChild(num);
      const dots = document.createElement('span');
      dots.className = 'cal-dots';
      SHIFT_ORDER.forEach(function(code) {
        if (code in shifts) {
          const dot = document.createElement('span');
          dot.className = 'cal-dot cal-dot--' + code;
          dots.appendChild(dot);
        }
      });
      cell.appendChild(dots);
      cell.addEventListener('click', function() {
        if (!inPeriod) {
          extraHoursState.viewPeriod = currentPayPeriod(date);
          renderCalendar();
        }
        openDayModal(ymd);
      });
      return cell;
    }

    // ─── Day modal ───
    function openDayModal(ymd) {
      dayModalDate = ymd;
      const date = fromYMD(ymd);
      const dow = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][date.getDay()];
      dayModalTitle.textContent = dow + ', ' + date.getDate() + ' ' + MONTH_SHORT[date.getMonth()] + ' ' + date.getFullYear();
      const builtIn = isBuiltInHoliday(ymd);
      dayHolidayLbl.textContent = builtIn ? 'Public holiday (built-in)' : 'Public holiday';
      syncDayModalToggles();
      dayModal.classList.add('open');
      requestAnimationFrame(function() {
        SHIFT_ORDER.forEach(function(code) {
          const wrap = dayDistEls[code];
          if (wrap.hidden) return;
          const seg = wrap.querySelector('.segmented-control');
          const thumb = wrap.querySelector('.segmented-thumb');
          const sel = wrap.querySelector('.segmented-option[aria-selected="true"]') || wrap.querySelector('.segmented-option');
          positionSegmentedThumb(seg, thumb, sel, false);
        });
      });
    }
    function closeDayModal() { dayModal.classList.remove('open'); dayModalDate = null; }
    function closeDayModalOnOverlay(e) { if (e.target === dayModal) closeDayModal(); }

    function syncDayModalToggles() {
      const entry = extraHoursState.days[dayModalDate];
      const shifts = (entry && entry.shifts) ? entry.shifts : {};
      SHIFT_ORDER.forEach(function(code) {
        const on = code in shifts;
        const el = dayToggleEls[code];
        el.classList.toggle('active', on);
        el.textContent = on ? 'On' : 'Off';
        const distWrap = dayDistEls[code];
        if (on && mode === 'ADVANCED') {
          distWrap.hidden = false;
          const dist = shifts[code] === 'LONG' ? 'LONG' : 'SHORT';
          Array.prototype.forEach.call(distWrap.querySelectorAll('.segmented-option'), function(opt) {
            opt.setAttribute('aria-selected', opt.getAttribute('data-dist') === dist ? 'true' : 'false');
          });
          const seg = distWrap.querySelector('.segmented-control');
          const thumb = distWrap.querySelector('.segmented-thumb');
          const sel = distWrap.querySelector('.segmented-option[aria-selected="true"]');
          requestAnimationFrame(function() { positionSegmentedThumb(seg, thumb, sel, false); });
        } else {
          distWrap.hidden = true;
        }
      });
      const hol = isHoliday(dayModalDate);
      dayToggleEls.holiday.classList.toggle('active', hol);
      dayToggleEls.holiday.textContent = hol ? 'On' : 'Off';
    }

    SHIFT_ORDER.forEach(function(code) {
      dayToggleEls[code].addEventListener('click', function() {
        if (!dayModalDate) return;
        const entry = extraHoursState.days[dayModalDate] || { shifts: {} };
        if (code in entry.shifts) {
          delete entry.shifts[code];
        } else {
          entry.shifts[code] = mode === 'ADVANCED' ? 'SHORT' : null;
        }
        if (Object.keys(entry.shifts).length) extraHoursState.days[dayModalDate] = entry;
        else delete extraHoursState.days[dayModalDate];
        afterStateChange();
      });
      const wrap = dayDistEls[code];
      Array.prototype.forEach.call(wrap.querySelectorAll('.segmented-option'), function(opt) {
        opt.addEventListener('click', function() {
          if (!dayModalDate) return;
          const entry = extraHoursState.days[dayModalDate];
          if (!entry || !(code in entry.shifts)) return;
          entry.shifts[code] = opt.getAttribute('data-dist');
          afterStateChange();
        });
      });
    });

    dayToggleEls.holiday.addEventListener('click', function() {
      if (!dayModalDate) return;
      const builtIn = isBuiltInHoliday(dayModalDate);
      const next = !isHoliday(dayModalDate);
      if (next === builtIn) delete extraHoursState.customHolidays[dayModalDate];
      else extraHoursState.customHolidays[dayModalDate] = next;
      afterStateChange();
    });

    function clearDayInModal() {
      if (!dayModalDate) return;
      delete extraHoursState.days[dayModalDate];
      delete extraHoursState.customHolidays[dayModalDate];
      afterStateChange();
    }

    function afterStateChange() {
      saveExtraHoursState();
      syncDayModalToggles();
      renderCalendar();
      renderLive();
    }

    // ─── Snapshot / Calculate ───
    function submitCombined() {
      const ids = mode === 'BASIC' ? BASIC_FIELD_IDS : ADV_FIELD_IDS;
      const map = mode === 'BASIC' ? basicFields : advFields;
      if (!validateInputs(ids, map)) return;
      const allowance = computeAllowance(mode);
      const extra     = computeExtraHours();
      const issues    = crossCheck();
      const basePay   = { basic: extraHoursState.basicSalary || 0, comp: extraHoursState.compAllowance || 0 };
      lastSnapshot = { mode: mode, allowance: allowance, basePay: basePay, extra: extra, issues: issues, period: extraHoursState.viewPeriod, capturedAt: new Date() };
      renderResultsPage(lastSnapshot);
      prevPage = pageCalc;
      flashAndNavigate(calcBtn, pageRes, 'forward');
    }

    function renderResultsPage(snap) {
      resEls.eyebrow.textContent  = snap.mode === 'ADVANCED' ? 'Advanced snapshot' : 'Basic snapshot';
      resEls.subtitle.textContent = payPeriodLabel(snap.period);
      resEls.sp1.textContent  = fmt(snap.allowance.rSP1);
      resEls.sp2.textContent  = fmt(snap.allowance.rSP2);
      resEls.meal.textContent = fmt(snap.allowance.rMeal);
      resEls.taxi.textContent = fmt(snap.allowance.rTaxi);
      resEls.distance.textContent = snap.allowance.distLabel;
      resEls.allowanceTotal.textContent = fmt(snap.allowance.total);
      const baseBasic = (snap.basePay && snap.basePay.basic) || 0;
      const baseComp  = (snap.basePay && snap.basePay.comp)  || 0;
      resEls.basic.textContent     = fmt(baseBasic);
      resEls.comp.textContent      = fmt(baseComp);
      resEls.baseTotal.textContent = fmt(round2(baseBasic + baseComp));
      resEls.ehTotal.textContent  = fmtHrs(snap.extra.totalHours);
      resEls.ehHol.textContent    = fmtHrs(snap.extra.holidayHours);
      resEls.ehNh.textContent     = fmtHrs(snap.extra.nonHoliday);
      resEls.ehOver.textContent   = fmtHrs(snap.extra.overHours);
      resEls.ehRate.textContent   = fmt(round2(snap.extra.rate));
      resEls.ehHolPay.textContent = fmt(round2(snap.extra.holidayPay));
      resEls.ehOtPay.textContent  = fmt(round2(snap.extra.overtimePay));
      resEls.ehTotalPay.textContent = fmt(round2(snap.extra.totalPay));
      resEls.grand.textContent = fmt(round2(snap.allowance.total + baseBasic + baseComp + snap.extra.totalPay));
      if (totalRow) totalRow.style.opacity = '1';
      if (snap.issues && snap.issues.length) {
        resEls.crosscheck.classList.add('visible');
        resEls.crosscheckList.innerHTML = '';
        snap.issues.forEach(function(issue) {
          const li = document.createElement('li');
          li.className = 'crosscheck-issue';
          li.innerHTML = describeIssue(issue);
          resEls.crosscheckList.appendChild(li);
        });
      } else {
        resEls.crosscheck.classList.remove('visible');
        resEls.crosscheckList.innerHTML = '';
      }
    }

    function flashAndNavigate(btn, target, direction) {
      btn.classList.add('success');
      if (reducedMotion()) {
        btn.classList.remove('success');
        showPage(target, direction);
        return;
      }
      setTimeout(function() {
        btn.classList.remove('success');
        showPage(target, direction);
      }, 320);
    }

    // ─── Copy results ───
    function showCopied() {
      copyBtn.classList.add('copied');
      copyBtn.textContent = '✓ Copied';
      setTimeout(function() {
        copyBtn.classList.remove('copied');
        copyBtn.textContent = '⎘ Copy Results';
      }, 2000);
    }
    function fallbackCopy(text) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none;';
      document.body.appendChild(ta);
      ta.select();
      try { if (document.execCommand('copy')) showCopied(); } catch (e) {}
      document.body.removeChild(ta);
    }
    function copyResults() {
      const snap = lastSnapshot;
      if (!snap) return;
      const date = snap.capturedAt.toLocaleDateString('en-JM', { day: 'numeric', month: 'long', year: 'numeric' });
      const divider = '─'.repeat(34);
      const baseBasic = (snap.basePay && snap.basePay.basic) || 0;
      const baseComp  = (snap.basePay && snap.basePay.comp)  || 0;
      const baseTotal = round2(baseBasic + baseComp);
      const grandTotal = round2(snap.allowance.total + baseBasic + baseComp + snap.extra.totalPay);
      const lines = [
        'Night Shift — ' + date,
        'Pay period: ' + payPeriodLabel(snap.period),
        'Mode: ' + (snap.mode === 'ADVANCED' ? 'Advanced (Short + Long)' : 'Basic'),
        '',
        'Allowance',
        divider,
        'SP1            ' + fmt(snap.allowance.rSP1),
        'SP2            ' + fmt(snap.allowance.rSP2),
        'Meal           ' + fmt(snap.allowance.rMeal),
        'Taxi           ' + fmt(snap.allowance.rTaxi),
        'Distance       ' + snap.allowance.distLabel,
        'Subtotal       ' + fmt(snap.allowance.total),
        '',
        'Base Pay',
        divider,
        'Monthly Basic  ' + fmt(baseBasic),
        'Compulsory     ' + fmt(baseComp),
        'Subtotal       ' + fmt(baseTotal),
        '',
        'Extra Hours',
        divider,
        'Total hours    ' + fmtHrs(snap.extra.totalHours),
        'Holiday hours  ' + fmtHrs(snap.extra.holidayHours),
        'Non-holiday    ' + fmtHrs(snap.extra.nonHoliday),
        'Over 173.33    ' + fmtHrs(snap.extra.overHours),
        'Hourly rate    ' + fmt(round2(snap.extra.rate)),
        'Holiday pay    ' + fmt(round2(snap.extra.holidayPay)),
        'Overtime pay   ' + fmt(round2(snap.extra.overtimePay)),
        'Subtotal       ' + fmt(round2(snap.extra.totalPay)),
        '',
        divider,
        'Grand Total    ' + fmt(grandTotal)
      ];
      if (snap.issues && snap.issues.length) {
        lines.push('');
        lines.push('Cross-check warnings:');
        snap.issues.forEach(function(issue) {
          lines.push('  • ' + describeIssue(issue).replace(/<[^>]+>/g, '').replace(/&mdash;/g, '—'));
        });
      }
      const text = lines.join('\n');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(showCopied).catch(function() { fallbackCopy(text); });
      } else {
        fallbackCopy(text);
      }
    }

    // ─── Reset ───

    function exportData() {
      const payload = {
        basic: safeGet(STORAGE_KEY_BASIC), adv: safeGet(STORAGE_KEY_ADV), mode: safeGet(STORAGE_KEY_MODE), extra: safeGet(STORAGE_KEY_EXTRA), exportedAt: new Date().toISOString()
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'ns-calculator-backup.json';
      a.click();
      setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
    }

    function importDataFromFile(file) {
      const reader = new FileReader();
      reader.onload = function() {
        try {
          const d = JSON.parse(reader.result);
          if (d.basic) safeSet(STORAGE_KEY_BASIC, d.basic);
          if (d.adv) safeSet(STORAGE_KEY_ADV, d.adv);
          if (d.mode) safeSet(STORAGE_KEY_MODE, d.mode);
          if (d.extra) safeSet(STORAGE_KEY_EXTRA, d.extra);
          loadMode(); loadBasicFields(); loadAdvFields(); loadExtraHoursState();
          renderCalendar(); renderLive();
          showAlert('Import complete.');
        } catch (e) { showAlert('Import failed: invalid backup file.'); }
      };
      reader.readAsText(file);
    }

    function resetAll() {
      showConfirm('Clear ALL data: counts, distance, base pay, calendar, and holiday overrides?', function() {
        BASIC_FIELD_IDS.forEach(function(id) { basicFields[id].value = ''; basicFields[id].classList.remove('error', 'field-input--warn'); });
        ADV_FIELD_IDS.forEach(function(id)   { advFields[id].value   = ''; advFields[id].classList.remove('error', 'field-input--warn'); });
        setDistance('SHORT', true);
        extraHoursState = { basicSalary: 0, compAllowance: 0, customHolidays: {}, days: {}, viewPeriod: currentPayPeriod() };
        basicSalaryInput.value = '';
        compAllowanceInput.value = '';
        safeRemove(STORAGE_KEY_EXTRA);
        safeRemove(STORAGE_KEY_BASIC);
        safeRemove(STORAGE_KEY_ADV);
        renderCalendar();
        renderLive();
      }, 'Clear All');
    }

    // ─── Navigation ───
    function getCurrentActivePage() {
      for (let i = 0; i < pages.length; i++) if (pages[i].classList.contains('active')) return pages[i];
      return pageCalc;
    }
    function goBack() { showPage(prevPage || pageCalc, 'back'); }
    function goBackFromInfo() { showPage(infoReturnPage || pageCalc, 'back'); }
    function showPage(el, direction) {
      if (el === pageAbout || el === pageDisclaimer) infoReturnPage = getCurrentActivePage();
      pages.forEach(function(p) { p.classList.remove('active', 'page--enter-from-right', 'page--enter-from-left'); });
      if (!reducedMotion()) {
        if (direction === 'back') el.classList.add('page--enter-from-left');
        else if (direction === 'forward') el.classList.add('page--enter-from-right');
      }
      el.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'auto' });
    }

    // ─── Input handlers ───
    function attachInputHandlers(inputs) {
      inputs.forEach(function(el, i) {
        el.addEventListener('input', function() {
          const raw = el.value;
          const n = parseFloat(raw);
          el.classList.remove('error');
          if (!isNaN(n)) {
            const bounded = Math.min(99, Math.max(0, n));
            const normalized = Math.floor(bounded);
            if (String(normalized) !== raw) el.value = normalized;
          }
        });
        el.addEventListener('keydown', function(e) {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          const next = inputs[i + 1];
          if (next) next.focus(); else el.blur();
        });
      });
    }
    const basicInputs = BASIC_FIELD_IDS.map(function(id) { return basicFields[id]; });
    const advInputs   = ADV_FIELD_IDS.map(function(id) { return advFields[id]; });
    attachInputHandlers(basicInputs);
    attachInputHandlers(advInputs);
    basicInputs.forEach(function(el) { el.addEventListener('input', function() { saveBasicFields(); renderLive(); }); });
    advInputs.forEach(function(el)   { el.addEventListener('input', function() { saveAdvFields();   renderLive(); }); });

    modeBasicBtn.addEventListener('click', function() { setMode('BASIC', true); });
    modeAdvancedBtn.addEventListener('click', function() { setMode('ADVANCED', true); });
    distShortBtn.addEventListener('click', function() { setDistance('SHORT', true); });
    distLongBtn.addEventListener('click',  function() { setDistance('LONG', true);  });

    function onSegmentedNav(e, leftValue, rightValue, setter) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      setter(e.key === 'ArrowLeft' ? leftValue : rightValue, true);
    }

    modeBasicBtn.addEventListener('keydown', function(e) { onSegmentedNav(e, 'BASIC', 'ADVANCED', setMode); });
    modeAdvancedBtn.addEventListener('keydown', function(e) { onSegmentedNav(e, 'BASIC', 'ADVANCED', setMode); });
    distShortBtn.addEventListener('keydown', function(e) { onSegmentedNav(e, 'SHORT', 'LONG', setDistance); });
    distLongBtn.addEventListener('keydown', function(e) { onSegmentedNav(e, 'SHORT', 'LONG', setDistance); });

    basicSalaryInput.addEventListener('input', function() {
      const n = parseFloat(basicSalaryInput.value);
      extraHoursState.basicSalary = isNaN(n) ? 0 : Math.max(0, n);
      saveExtraHoursState();
      renderLive();
    });

    compAllowanceInput.addEventListener('input', function() {
      const n = parseFloat(compAllowanceInput.value);
      extraHoursState.compAllowance = isNaN(n) ? 0 : Math.max(0, n);
      saveExtraHoursState();
      renderLive();
    });

    calPrevBtn.addEventListener('click', function() {
      extraHoursState.viewPeriod = shiftPayPeriod(extraHoursState.viewPeriod, -1);
      saveExtraHoursState();
      renderCalendar();
      renderLive();
    });
    calNextBtn.addEventListener('click', function() {
      extraHoursState.viewPeriod = shiftPayPeriod(extraHoursState.viewPeriod, 1);
      saveExtraHoursState();
      renderCalendar();
      renderLive();
    });

    document.addEventListener('keydown', function(e) {
      if (e.key !== 'Escape') return;
      if (alertModal.classList.contains('open')) closeAlert();
      else if (hintModal.classList.contains('open')) closeHint();
      else if (dayModal.classList.contains('open')) closeDayModal();
    });

    const importInput = document.getElementById('import-data');
    if (importInput) importInput.addEventListener('change', function(e){ if (e.target.files && e.target.files[0]) importDataFromFile(e.target.files[0]); });

    window.addEventListener('resize', function() {
      requestAnimationFrame(function() {
        positionSegmentedThumb(modeSegmented, modeThumb, mode === 'BASIC' ? modeBasicBtn : modeAdvancedBtn, false);
        positionSegmentedThumb(distSegmented, distThumb, distance === 'SHORT' ? distShortBtn : distLongBtn, false);
      });
    });

    // ─── Init ───
    loadBasicFields();
    loadAdvFields();
    loadExtraHoursState();
    if (extraHoursState.basicSalary > 0) basicSalaryInput.value = extraHoursState.basicSalary;
    if (extraHoursState.compAllowance > 0) compAllowanceInput.value = extraHoursState.compAllowance;
    mode = loadMode();
    setMode(mode, false);
    setDistance(distance, false);
    renderCalendar();
    renderLive();
    requestAnimationFrame(function() {
      positionSegmentedThumb(modeSegmented, modeThumb, mode === 'BASIC' ? modeBasicBtn : modeAdvancedBtn, false);
      positionSegmentedThumb(distSegmented, distThumb, distance === 'SHORT' ? distShortBtn : distLongBtn, false);
    });

    // ─── Service worker registration ───
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(function(err) {
        console.warn('SW registration failed:', err);
      });
    }
  

    document.addEventListener('keydown', function(e){
      if (e.key !== 'Tab') return;
      const openModal = document.querySelector('.modal.open');
      if (!openModal) return;
      const focusables = openModal.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])');
      if (!focusables.length) return;
      const first = focusables[0], last = focusables[focusables.length-1];
      if (e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
    });
