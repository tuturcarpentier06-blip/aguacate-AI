document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const state = { token:null, id:null, role:'user', conversations:[], activeId:null, litres:0 };
  const mode = $('mode');
  const messages = $('messages');
  const api = async (url, opt={}) => {
    opt.headers = { ...(opt.headers||{}), Authorization:`Bearer ${state.token}` };
    const r = await fetch(url,opt); let j={}; try{j=await r.json()}catch{}
    if(!r.ok) { if(r.status===403 && ['banned','unauthenticated'].includes(j.error)) handleSessionError(j); throw new Error(j.message||j.error||`HTTP ${r.status}`); }
    return j;
  };
  const toast = t => { const e=$('toast'); e.textContent=t; e.classList.add('show'); clearTimeout(window.__toast); window.__toast=setTimeout(()=>e.classList.remove('show'),2800); };
  function deviceId(){ let id=localStorage.getItem('aguacate-id'); if(!id){ id=''; localStorage.setItem('aguacate-id',id); } return id; }
  function handleSessionError(j){ if(j.error==='banned'){ localStorage.removeItem('aguacate-token'); toast('⛔ Accès suspendu pendant 24 heures.'); } }
  function updateEco(l){
    state.litres=Math.max(0,Number(l)||0); const max=24.8, p=Math.min(100,state.litres/max*100); let color;
    if(p<=40){const t=p/40;color=`rgb(${Math.round(46+100*t)},${Math.round(204+4*t)},${Math.round(113-33*t)})`}
    else if(p<=60){const t=(p-40)/20;color=`rgb(${Math.round(146+95*t)},${Math.round(208-12*t)},${Math.round(80-65*t)})`}
    else if(p<=80){const t=(p-60)/20;color=`rgb(${Math.round(241+14*t)},${Math.round(196-37*t)},${Math.round(15+52*t)})`}
    else {const t=(p-80)/20;color=`rgb(${Math.round(255-24*t)},${Math.round(159-83*t)},${Math.round(67-7*t)})`}
    $('eco-litres').textContent=state.litres.toFixed(1).replace('.',','); $('eco-pct').textContent=Math.round(p)+'%';
    $('eco-avocado-fill').style.fill=color; $('eco-bar-fill').style.height=p+'%'; $('eco-bar-fill').style.background=color; $('eco-marker').style.bottom=p+'%'; $('eco-marker').style.boxShadow=`0 0 18px ${color}`;
    const status=state.litres<=10?'Excellent 🌿':state.litres<=15?'Bon équilibre 🌱':state.litres<=20?'À surveiller ⚠️':'Consommation élevée 🔴'; $('eco-status').textContent=status; $('eco-status').style.color=color; $('avocado-glow').style.background=color;
  }
  function renderConversations(){ const box=$('conversation-list'); box.innerHTML=''; state.conversations.forEach(c=>{const b=document.createElement('button');b.className='conversation-item'+(c.id===state.activeId?' active':'');b.textContent=c.title;b.onclick=()=>{state.activeId=c.id;renderConversations();renderMessages(c.messages)};box.appendChild(b)}); }
  function renderMessages(ms=[]){messages.innerHTML='';ms.forEach(m=>addMessage(m.role==='user'?'user':'ai',m.content));messages.scrollTop=messages.scrollHeight;}
  function addMessage(type,text){const e=document.createElement('div');e.className=`bubble ${type}`;e.textContent=text;messages.appendChild(e);return e;}
  async function login(){
    const old=localStorage.getItem('aguacate-token');
    let j;
    if(old){ state.token=old; try { j=await api('/heartbeat'); } catch { state.token=null; } }
    if(!state.token){ const r=await fetch('/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({deviceId:deviceId()})}); j=await r.json(); if(!r.ok) throw new Error(j.message||j.error||'Connexion impossible'); state.token=j.token; localStorage.setItem('aguacate-token',state.token); }
    if(!j?.id){ const r=await fetch('/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({deviceId:deviceId()})}); j=await r.json(); state.token=j.token; localStorage.setItem('aguacate-token',state.token); }
    localStorage.setItem('aguacate-id',j.id); state.id=j.id; state.role=j.role||'user'; state.litres=j.consumptionLitres||0; $('user-badge').textContent='🥑 Aguacate AI #'+j.id; updateEco(state.litres); updateRoleUI(); await loadConversations();
  }
  function updateRoleUI(){ $('role-badge').textContent=state.role==='admin'?'ADMIN':state.role==='professeur'?'PROFESSEUR':'UTILISATEUR'; $('role-badge').className='role-badge '+state.role; }
  async function loadConversations(){ const j=await api('/conversations'); state.conversations=j; state.activeId=state.activeId||j.at(-1)?.id; renderConversations(); if(state.activeId){const c=j.find(x=>x.id===state.activeId);renderMessages(c?.messages||[]);} }
  async function send(text){
    const input=$('prompt'), msg=(text||input.value).trim(); if(!msg)return; addMessage('user',msg);input.value='';messages.scrollTop=messages.scrollHeight;const loading=addMessage('ai','🥑 Aguacate réfléchit…');loading.classList.add('typing');document.body.classList.add('ai-thinking');
    try{const j=await api('/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:msg,mode:mode.value})});loading.remove();addMessage('ai',j.reply);updateEco(j.consumptionLitres);await loadConversations();}catch(e){loading.textContent='🥑 '+e.message;toast(e.message)}finally{document.body.classList.remove('ai-thinking')}
  }
  $('send-btn').onclick=()=>send(); $('prompt').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}; document.querySelectorAll('[data-prompt]').forEach(b=>b.onclick=()=>send(b.dataset.prompt));
  async function newConversation(){try{const j=await api('/newConversation',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});state.conversations=j.conversations;state.activeId=j.id;renderConversations();renderMessages([]);toast('Nouvelle conversation créée ✨')}catch(e){toast(e.message)}}
  async function renameConversation(){if(!state.activeId)return toast('Aucune conversation sélectionnée');const c=state.conversations.find(x=>x.id===state.activeId);const title=prompt('Nouveau nom :',c?.title||'');if(!title)return;try{await api('/renameConversation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({conversationId:state.activeId,title})});await loadConversations();toast('Conversation renommée ✨')}catch(e){toast(e.message)}}
  $('new-chat-btn').onclick=newConversation; $('rename-btn').onclick=renameConversation;
  async function scan(file){if(!file)return;const fd=new FormData();fd.append('file',file);fd.append('question',$('prompt').value.trim()||'Résume ce fichier et donne-moi les informations importantes.');$('file-preview').classList.remove('hidden');$('file-preview').textContent='📄 '+file.name+' — analyse en cours…';try{const j=await api('/scan-and-ask',{method:'POST',body:fd});$('file-preview').textContent='📄 '+j.fileName+' — '+j.characters+' caractères extraits';addMessage('ai',j.reply);await loadConversations();toast('Fichier analysé ✨')}catch(e){$('file-preview').textContent='❌ '+e.message;toast(e.message)}}
  $('attach-btn').onclick=()=>$('file-input').click();$('file-tool-btn').onclick=()=>$('file-input').click();$('file-input').onchange=e=>scan(e.target.files[0]);
  $('theme-btn').onclick=()=>{document.body.classList.toggle('light');localStorage.setItem('aguacate-theme',document.body.classList.contains('light')?'light':'dark')};if(localStorage.getItem('aguacate-theme')==='light')document.body.classList.add('light');$('sidebar-toggle').onclick=()=>document.body.classList.toggle('sidebar-collapsed');

  async function verifyMode(target){
    if(target==='Kids'||target==='Collégien'){mode.value=target;return;}
    const password=prompt(`Mot de passe ${target} :`); if(password===null){mode.value=state.role==='admin'?'Admin':state.role==='professeur'?'Professeur':'Collégien';return;}
    try{const j=await api('/modes/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:target,password})});if(!j.ok)throw new Error('Mot de passe incorrect');state.role=j.role;updateRoleUI();mode.value=target;toast(`Accès ${target} activé 🔐`);if(target==='Admin')openUsers();}catch(e){mode.value=state.role==='admin'?'Admin':state.role==='professeur'?'Professeur':'Collégien';toast('🔒 '+e.message)}}
  mode.onchange=()=>verifyMode(mode.value);

  function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
  async function requireAdmin(){if(state.role==='admin')return true;const p=prompt('Mot de passe administrateur :');if(p===null)return false;try{const j=await api('/modes/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'Admin',password:p})});if(!j.ok)throw new Error('Mot de passe incorrect');state.role='admin';mode.value='Admin';updateRoleUI();return true}catch(e){toast('🔒 '+e.message);return false}}
  async function loadAdmin(){
    if(!await requireAdmin())return;
    try{
      const [users,online,recent,convs]=await Promise.all([api('/users'),api('/users/online'),api('/users/recent'),api('/admin/conversations')]);
      $('admin-summary').innerHTML=`<div><b>${online.length}</b><small>en ligne</small></div><div><b>${recent.length}</b><small>vus en 24 h</small></div><div><b>${users.length}</b><small>utilisateurs</small></div>`;
      $('online-list').innerHTML=online.map(u=>userCard(u)).join('')||'<p>Aucun utilisateur en ligne.</p>';
      $('recent-list').innerHTML=recent.map(u=>userCard(u)).join('')||'<p>Aucun utilisateur récent.</p>';
      $('all-users-list').innerHTML=users.map(u=>userCard(u)).join('')||'<p>Aucun utilisateur.</p>';
      $('conversation-admin-list').innerHTML=convs.map(x=>`<div class="admin-conv-user"><b>🥑 #${esc(x.userId)}</b>${x.conversations.map(c=>`<button onclick="viewAdminConversation('${esc(x.userId)}','${esc(c.id)}')">${esc(c.title)}</button>`).join('')}</div>`).join('')||'<p>Aucune conversation.</p>';
      $('admin-panel').style.display='flex';
    }catch(e){toast('Administration : '+e.message)}
  }
  function userCard(u){const last=u.lastSeen?new Date(u.lastSeen).toLocaleString('fr-FR'):'jamais';const banned=u.bannedUntil&&u.bannedUntil>Date.now();return `<div class="admin-user-row"><div><b>🥑 #${esc(u.id)}</b><span>${esc(u.role)}</span><small>${u.online?'🟢 En ligne':'⚪ Hors ligne'} · dernière connexion : ${last} · ${u.warnings?.length||0} avertissement(s)}${banned?' · ⛔ BANNI':''}</small></div><div class="admin-user-actions"><button onclick="addWarning('${esc(u.id)}')">⚠️ + avert.</button><button onclick="removeLastWarning('${esc(u.id)}')">➖ avert.</button>${banned?`<button onclick="unbanUser('${esc(u.id)}')">♻️ Débannir</button>`:`<button onclick="banUser('${esc(u.id)}')">⛔ 24 h</button>`}<button onclick="disconnectUser('${esc(u.id)}')">🔌 Déconnecter</button></div></div>`}
  window.showAdminTab=(name)=>{document.querySelectorAll('.admin-tab').forEach(x=>x.classList.add('hidden'));const el=$('admin-tab-'+name);if(el)el.classList.remove('hidden');};
  window.openUsers=loadAdmin; window.openAdmin=loadAdmin; window.closeUsers=()=>{$('users-panel').style.display='none'}; window.closeAdmin=()=>{$('admin-panel').style.display='none'}; window.closeMailbox=()=>{$('mailbox-panel').style.display='none'};
  window.addWarning=async id=>{const reason=prompt('Motif de l’avertissement :');if(!reason)return;try{const j=await api(`/users/${id}/warnings`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reason})});toast(j.bannedUntil?'⛔ 3 avertissements ou plus : bannissement 24 h.':'⚠️ Avertissement ajouté.');loadAdmin()}catch(e){toast(e.message)}};
  window.removeLastWarning=async id=>{try{const users=await api('/users');const u=users.find(x=>x.id===id);const w=u?.warnings?.at(-1);if(!w)return toast('Aucun avertissement à retirer.');await api(`/users/${id}/warnings/${w.id}`,{method:'DELETE'});toast('Avertissement retiré.');loadAdmin()}catch(e){toast(e.message)}};
  window.banUser=async id=>{if(!confirm('Bannir cet utilisateur pendant 24 heures ?'))return;try{await api(`/users/${id}/ban`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reason:'Bannissement manuel'})});toast('Utilisateur banni 24 h.');loadAdmin()}catch(e){toast(e.message)}};
  window.unbanUser=async id=>{try{await api(`/users/${id}/unban`,{method:'POST'});toast('Utilisateur débanni.');loadAdmin()}catch(e){toast(e.message)}};
  window.disconnectUser=async id=>{if(!confirm('Déconnecter cet utilisateur maintenant ?'))return;try{await api(`/users/${id}/disconnect`,{method:'POST'});toast('Utilisateur déconnecté.');loadAdmin()}catch(e){toast(e.message)}};
  window.viewAdminConversation=async(userId,convId)=>{try{const arr=await api(`/admin/conversations/${userId}`);const c=arr.find(x=>x.id===convId);$('admin-conversation-view').innerHTML=`<h3>🥑 #${esc(userId)} — ${esc(c?.title||'Conversation')}</h3>`+(c?.messages||[]).map(m=>`<div class="admin-msg ${m.role}"><b>${m.role==='user'?'Utilisateur':'Aguacate AI'}</b><p>${esc(m.content)}</p></div>`).join('');$('admin-conversation-view').classList.remove('hidden');$('admin-conversation-view').style.display='block'}catch(e){toast(e.message)}};
  $('admin-refresh').onclick=loadAdmin;
  window.openMailbox=async()=>{if(!await requireAdmin())return;try{const logs=await api('/adminlogs');$('mailbox-list').innerHTML=logs.map(l=>`<div class="log-row"><b>${esc(l.type)}</b><span>${l.user?'#'+esc(l.user):''}</span><small>${new Date(l.date).toLocaleString('fr-FR')}${l.reason?' · '+esc(l.reason):''}</small></div>`).join('')||'📭 Aucun événement.';$('mailbox-panel').style.display='flex'}catch(e){toast(e.message)}};

  setInterval(()=>{if(state.token)api('/heartbeat').catch(()=>{});},30000);
  login().catch(e=>toast('Connexion impossible : '+e.message));
});
