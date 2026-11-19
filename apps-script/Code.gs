/** بک‌اند نوبت‌دهی درمانگاه فرهنگیان مهریز – Google Apps Script (متصل به همین Google Sheet) */
const TZ = 'Asia/Tehran';
const DAYS = ['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'];
const PH = '32529560 و 32531410';

/* ---------- ابزارها ---------- */
const norm = s => String(s == null ? '' : s).replace(/[\u200c\s]/g,'').replace(/ي/g,'ی').replace(/ك/g,'ک')
  .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
const memo = {};
function sh(name){ const n = norm(name); return SpreadsheetApp.getActive().getSheets().find(s => norm(s.getName()) === n); }
function rows(name){
  if (memo[name]) return memo[name];
  const s = sh(name);
  return memo[name] = (!s || s.getLastRow() < 2) ? [] : s.getRange(2,1,s.getLastRow()-1,s.getLastColumn()).getValues();
}
function hm(v){
  if (v instanceof Date) return Utilities.formatDate(v, SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'HH:mm');
  const m = norm(v).match(/^(\d{1,2}):(\d{2})/); return m ? m[1].padStart(2,'0') + ':' + m[2] : '';
}
const mins = t => { const a = t.split(':'); return +a[0]*60 + +a[1]; };
const fmt = m => String(Math.floor(m/60)).padStart(2,'0') + ':' + String(m%60).padStart(2,'0');
const today = () => Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
const nowMin = () => mins(Utilities.formatDate(new Date(), TZ, 'HH:mm'));
const addDays = (iso,n) => { const a = iso.split('-').map(Number); return new Date(Date.UTC(a[0],a[1]-1,a[2]+n)).toISOString().slice(0,10); };
const wd = iso => { const a = iso.split('-').map(Number); return (new Date(Date.UTC(a[0],a[1]-1,a[2])).getUTCDay() + 1) % 7; };
function g2j(gy,gm,gd){
  const g=[0,31,59,90,120,151,181,212,243,273,304,334]; let jy = gy<=1600?0:979; gy -= gy<=1600?621:1600;
  const gy2 = gm>2?gy+1:gy;
  let days = 365*gy + Math.floor((gy2+3)/4) - Math.floor((gy2+99)/100) + Math.floor((gy2+399)/400) - 80 + gd + g[gm-1];
  jy += 33*Math.floor(days/12053); days %= 12053; jy += 4*Math.floor(days/1461); days %= 1461;
  if (days > 365){ jy += Math.floor((days-1)/365); days = (days-1)%365; }
  const jm = days<186 ? 1+Math.floor(days/31) : 7+Math.floor((days-186)/30);
  const jd = 1 + (days<186 ? days%31 : (days-186)%30);
  return [jy,jm,jd];
}
function jal(iso){ const a = iso.split('-').map(Number), j = g2j(a[0],a[1],a[2]);
  return j[0] + '/' + String(j[1]).padStart(2,'0') + '/' + String(j[2]).padStart(2,'0'); }

/* ---------- داده‌ها ---------- */
function cfg(){ const r = rows('تنظیمات').map(x => +x[1]); return {slot:r[0]||15, cap:r[1]||1, ahead:r[2]||14, lead:r[3]||0, perDay:r[4]||1}; }
function doctors(){ return rows('پزشکان').filter(r => r[0] && norm(r[4]) === 'بله')
  .map(r => ({id:String(r[0]).trim(), name:r[1], type:r[2], specialty:r[3]})); }
function shifts(id, iso){
  const j = norm(jal(iso)), d = norm(DAYS[wd(iso)]);
  let out = rows('برنامه هفتگی').filter(r => String(r[0]).trim() === id && norm(r[1]) === d).map(r => [hm(r[2]), hm(r[3])]);
  rows('استثناها').forEach(r => {
    if (String(r[1]).trim() !== id || norm(r[0]) !== j) return;
    const t = norm(r[2]);
    if (t === 'لغو') out = [];
    else if (t === 'اضافه') out.push([hm(r[3]), hm(r[4])]);
    else if (t === 'تغییرساعت') out = [[hm(r[3]), hm(r[4])]];
  });
  return out.filter(s => s[0] && s[1]);
}
function booked(){
  const m = {};
  rows('نوبت‌ها').forEach(r => { if (!r[0] || norm(r[8]) === 'لغو') return;
    const k = r[11] + '|' + r[10] + '|' + hm(r[4]); m[k] = (m[k]||0) + 1; });
  return m;
}
/** بازه‌های یک پزشک در یک روز؛ آخرین بازه هرگز از پایان شیفت بیرون نمی‌زند */
function slots(id, iso){
  const c = cfg(), b = booked(), isToday = iso === today(), n = nowMin(), out = [];
  shifts(id, iso).forEach(s => {
    for (let m = mins(s[0]); m + c.slot <= mins(s[1]); m += c.slot){
      const time = fmt(m); let free = (b[id+'|'+iso+'|'+time]||0) < c.cap;
      if (isToday && m < n + c.lead) free = false;
      out.push({time, free});
    }
  });
  return out;
}
function init(){
  const c = cfg(), ds = doctors(), days = [];
  const week = rows('برنامه هفتگی');
  ds.forEach(d => d.week = week.filter(r => String(r[0]).trim() === d.id).map(r => [r[1], hm(r[2]), hm(r[3])]));
  for (let i = 0; i <= c.ahead; i++){
    const iso = addDays(today(), i), docs = {};
    ds.forEach(d => { const s = slots(d.id, iso); if (s.length) docs[d.id] = s.filter(x => x.free).length; });
    days.push({iso, j:jal(iso), day:DAYS[wd(iso)], docs});
  }
  return {doctors:ds, days, slot:c.slot, phone:PH};
}

/* ---------- ورود با کد ایمیل ---------- */
const emailOf = p => String(p.email||'').trim().toLowerCase();
function sendCode(p){
  const em = emailOf(p); if (!/^\S+@\S+\.\S+$/.test(em)) throw new Error('ایمیل معتبر نیست');
  const ca = CacheService.getScriptCache(); if (ca.get('rl_'+em)) throw new Error('لطفاً یک دقیقه صبر کنید');
  const code = String(Math.floor(100000 + Math.random()*900000));
  ca.put('otp_'+em, code, 600); ca.put('rl_'+em, '1', 60); ca.remove('try_'+em);
  MailApp.sendEmail(em, 'کد ورود – درمانگاه فرهنگیان مهریز', 'کد ورود شما: ' + code + '\nاین کد تا ۱۰ دقیقه معتبر است.');
  return {ok:true};
}
function verify(p){
  const em = emailOf(p), ca = CacheService.getScriptCache(), t = +(ca.get('try_'+em)||0);
  if (t >= 5) throw new Error('تلاش بیش از حد؛ کد جدید بگیرید');
  ca.put('try_'+em, String(t+1), 600);
  if (!ca.get('otp_'+em) || String(norm(p.code)) !== ca.get('otp_'+em)) throw new Error('کد اشتباه یا منقضی است');
  const name = String(p.name||'').trim().slice(0,60), mob = norm(p.mobile);
  if (name.length < 3 || !/^09\d{9}$/.test(mob)) throw new Error('نام یا شمارهٔ موبایل معتبر نیست');
  ca.remove('otp_'+em);
  const token = Utilities.getUuid(); ca.put('tok_'+token, JSON.stringify({em, name, mob}), 21600);
  let S = sh('کاربران'); if (!S){ S = SpreadsheetApp.getActive().insertSheet('کاربران'); S.appendRow(['ایمیل','نام','موبایل','آخرین ورود']); }
  const stamp = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'), v = S.getDataRange().getValues();
  const i = v.findIndex((r,k) => k > 0 && String(r[0]).toLowerCase() === em);
  if (i > 0) S.getRange(i+1,2,1,3).setValues([[name, "'"+mob, stamp]]); else S.appendRow([em, name, "'"+mob, stamp]);
  return {token, name, email:em};
}
function session(p){
  const s = CacheService.getScriptCache().get('tok_' + p.token);
  if (!s) throw new Error('نشست منقضی شده؛ دوباره وارد شوید');
  return JSON.parse(s);
}

/* ---------- نوبت ---------- */
function book(p){
  const u = session(p), c = cfg(), id = String(p.doctor), iso = String(p.date), time = String(p.time);
  const d = doctors().find(x => x.id === id); if (!d) throw new Error('پزشک نامعتبر است');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || iso < today() || iso > addDays(today(), c.ahead)) throw new Error('تاریخ نامعتبر است');
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  let res;
  try {
    const s = slots(id, iso).find(x => x.time === time);
    if (!s || !s.free) throw new Error('این زمان دیگر در دسترس نیست؛ زمان دیگری انتخاب کنید');
    const mine = rows('نوبت‌ها').filter(r => String(r[7]).toLowerCase() === u.em && String(r[11]) === id && String(r[10]) === iso && norm(r[8]) !== 'لغو').length;
    if (mine >= c.perDay) throw new Error('برای این پزشک در این روز قبلاً نوبت گرفته‌اید');
    const S = sh('نوبت‌ها'), pr = PropertiesService.getScriptProperties(), row = S.getLastRow() + 1;
    const n = +(pr.getProperty('n') || (S.getLastRow() - 1)) + 1; pr.setProperty('n', String(n));
    const code = 'MH-' + String(n).padStart(4,'0');
    if (!S.getRange('K1').getValue()) S.getRange('K1:L1').setValues([['تاریخ میلادی','کد پزشک']]);
    const rg = S.getRange(row,1,1,12); rg.setNumberFormat('@');
    rg.setValues([[code, jal(iso), DAYS[wd(iso)], d.name, time, u.name, u.mob, u.em, 'ثبت‌شده', Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'), iso, id]]);
    res = {code, doctor:d.name, j:jal(iso), day:DAYS[wd(iso)], time};
  } finally { lock.releaseLock(); }
  try {
    MailApp.sendEmail(u.em, 'تأیید نوبت – درمانگاه فرهنگیان مهریز',
      u.name + ' عزیز\nنوبت شما ثبت شد.\nکد پیگیری: ' + res.code + '\nپزشک: ' + res.doctor +
      '\nتاریخ: ' + res.j + ' (' + res.day + ')\nساعت حضور: ' + res.time +
      '\nمنشی درمانگاه برای هماهنگی با شما تماس می‌گیرد.\nتلفن: ' + PH);
  } catch (e) {}
  return res;
}
function my(p){
  const u = session(p), t = today();
  return {list: rows('نوبت‌ها').filter(r => String(r[7]).toLowerCase() === u.em && String(r[10]) >= t && norm(r[8]) === 'ثبتشده')
    .map(r => ({code:r[0], j:r[1], day:r[2], doctor:r[3], time:hm(r[4])}))};
}
function cancel(p){
  const u = session(p), S = sh('نوبت‌ها'), v = S.getDataRange().getValues();
  for (let i = 1; i < v.length; i++)
    if (v[i][0] === p.code && String(v[i][7]).toLowerCase() === u.em){ S.getRange(i+1, 9).setValue('لغو'); return {ok:true}; }
  throw new Error('نوبت پیدا نشد');
}

/* ---------- API ---------- */
function route(p){
  try {
    switch (p.a){
      case 'init': return init();
      case 'slots': return {slots: slots(String(p.doctor), String(p.date))};
      case 'code': return sendCode(p);
      case 'verify': return verify(p);
      case 'book': return book(p);
      case 'my': return my(p);
      case 'cancel': return cancel(p);
    }
    return {error:'درخواست نامعتبر'};
  } catch (err) { return {error: String(err.message || err)}; }
}
const out = o => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
function doGet(e){ return out(route(e.parameter || {})); }
function doPost(e){ let p = {}; try { p = JSON.parse(e.postData.contents); } catch (_) {} return out(route(p)); }
