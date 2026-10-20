const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function receiptTarget(location){
 const url=new URL(String(location),'https://www.autofixkorea.com'),params=new URLSearchParams(url.hash.slice(1)||url.search);
 if(!params.has('source')&&!params.has('id'))return null;
 if(params.getAll('source').length!==1||params.getAll('id').length!==1||!['accident','consultation','email','telegram'].includes(params.get('source'))||!uuid.test(params.get('id')||''))throw Error('접수 링크가 올바르지 않습니다. 전체 접수함에서 확인해 주세요.');
 return {source:params.get('source'),id:params.get('id')};
}
export async function enterReceiptWorkspace({location,gateway,login,authorized,openDetail,refresh}){
 const target=receiptTarget(location);
 if(!gateway.hasSession())return login();
 const user=await gateway.request('me');
 if(user.role!=='admin'){login();throw Error('관리자 계정으로 로그인해 주세요.');}
 authorized(target);
 return target?openDetail(target):refresh();
}
export function watchReceiptNavigation(host,listener){
 host.addEventListener('hashchange',listener);return ()=>host.removeEventListener('hashchange',listener);
}
