function recipientMatches(result, chatId) {
  if (/^-?\d+$/.test(String(chatId))) return String(result?.chat?.id) === String(chatId);
  return String(chatId).startsWith('@') && String(result?.chat?.username ?? '').toLowerCase() === String(chatId).slice(1).toLowerCase();
}
export function dailyTelegram({ token, chatId, fetchImpl = fetch }) {
  if (!token || !chatId) return null;
  return { async edit({text,id}) {
    if(!/^[1-9][0-9]{0,15}$/.test(String(id)))throw new Error('INVALID_MESSAGE_ID');
    const response=await fetchImpl(`https://api.telegram.org/bot${token}/editMessageText`,{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({chat_id:chatId,message_id:Number(id),text,link_preview_options:{is_disabled:true}}),
      signal:AbortSignal.timeout(30000)});
    const body=await response.json();
    if(response.status>=500)throw new Error('TELEGRAM_EDIT_UNKNOWN');
    const unchanged=response.status===400&&body.error_code===400&&
      /^Bad Request: message is not modified(?:$|:)/.test(String(body.description));
    const accepted=unchanged||(response.ok&&body.ok===true&&recipientMatches(body.result,chatId)&&
      String(body.result?.message_id)===String(id)&&body.result?.text===text);
    const retry=body.parameters?.retry_after;
    return {accepted,retryable:response.status===429||body.error_code===429,
      retryAfter:Number.isInteger(retry)&&retry>0?Math.min(604800,retry):300};
  }, async send({ text }) {
    const response = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({chat_id:chatId,text,link_preview_options:{is_disabled:true},protect_content:true,allow_paid_broadcast:false}),
      signal:AbortSignal.timeout(60000),
    });
    const body = await response.json();
    if (response.status >= 500) throw new Error('TELEGRAM_OUTCOME_UNKNOWN');
    const result=body.result,accepted=response.ok && body.ok===true;
    if (accepted && (!Number.isSafeInteger(result?.message_id) || result.message_id<=0 ||
        !recipientMatches(result,chatId) || result.text!==text)) throw new Error('TELEGRAM_OUTCOME_UNKNOWN');
    const requested=body.parameters?.retry_after;
    return {accepted,id:result?.message_id,retryable:response.status===429||body.error_code===429,
      retryAfter:Number.isInteger(requested)&&requested>0?Math.min(604800,requested):300};
  }};
}
