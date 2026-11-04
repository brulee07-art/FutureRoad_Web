// Vercel Node.js Function. 심사 코드는 요청 본문으로만 전달하며 기록하지 않습니다.
const googleUrl = 'https://script.google.com/macros/s/AKfycbyGMVTUWwUaQmcOrkV8XALYSBpLLg1fFdy4dfPDu9K6hvHlPP7zXSqOyTh281tt29fXvg/exec';
const setupMessage = '홈페이지와 구글 심사실의 연결을 확인해 주세요. 운영자는 기존 Apps Script 웹 앱에 WebBridge를 추가하고 새 버전을 배포하세요.';
const uncertainSave = '저장 결과를 확인하지 못했습니다. 내 기록 다시 불러오기로 해당 팀의 저장 여부를 먼저 확인하세요.';

async function callGoogle(payload) {
  const signal = AbortSignal.timeout(25000);
  let response = await fetch(googleUrl, {
    method: 'POST',
    headers: {'Content-Type':'application/json', 'Accept':'application/json'},
    body: JSON.stringify(payload), redirect:'manual', signal
  });
  // Apps Script ContentService는 결과를 일회용 URL로 보냅니다. 코드를 다시 전송하지 않습니다.
  if ([301, 302, 303].includes(response.status)) {
    const resultUrl = new URL(response.headers.get('location'), googleUrl);
    if (resultUrl.origin !== 'https://script.googleusercontent.com') throw Error('unexpected redirect');
    response = await fetch(resultUrl, {method:'GET', redirect:'error', signal});
  }
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
    throw Error('unexpected response');
  }
  const envelope = await response.json();
  if (typeof envelope?.ok !== 'boolean' || (envelope.ok && !envelope.data) ||
      (!envelope.ok && typeof envelope.message !== 'string')) throw Error('invalid response');
  if (payload.action === 'status' && envelope.data?.service !== 'futureroad-judge-v1') throw Error('bridge not installed');
  return envelope;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  let payload;
  if (req.method === 'GET') {
    payload = {action:'status'};
  } else if (req.method === 'POST') {
    if (String(req.headers['content-type'] || '').split(';')[0].trim() !== 'application/json') {
      return res.status(415).json({ok:false, message:'지원하지 않는 요청 형식입니다.'});
    }
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!body || !['enterRoom','commitSection'].includes(body.action) ||
          typeof body.code !== 'string' || body.code.length > 64 ||
          !/^FR[A-F0-9]{20}$/.test(body.code.toUpperCase().replace(/[\s-]/g,''))) {
        return res.status(400).json({ok:false, message:'개인 코드와 요청 내용을 확인하세요.'});
      }
      payload = {action:body.action, code:body.code};
      if (body.action === 'commitSection') payload.ballot = body.ballot;
      if (Buffer.byteLength(JSON.stringify(payload)) > 16000) {
        return res.status(413).json({ok:false, message:'평가 내용의 길이를 확인하세요.'});
      }
    } catch {
      return res.status(400).json({ok:false, message:'평가 내용을 읽을 수 없습니다.'});
    }
  } else {
    res.setHeader('Allow','GET, POST');
    return res.status(405).json({ok:false, message:'지원하지 않는 요청입니다.'});
  }
  try {
    const result = await callGoogle(payload);
    return res.status(result.ok ? 200 : 400).json(result);
  } catch {
    return res.status(502).json({ok:false, message:payload.action === 'commitSection' ? uncertainSave : setupMessage});
  }
};
