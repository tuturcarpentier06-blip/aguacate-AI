function openAdmin(){

document.getElementById(
"admin-panel"
).style.display="flex";

}

function closeAdmin(){

document.getElementById(
"admin-panel"
).style.display="none";

}

async function loadUsers(){

const res =
await fetch("/users");

const users =
await res.json();

const box =
document.getElementById(
"user-list"
);

box.innerHTML="";

users.forEach(user=>{

let dot="🟢";

if(user.role==="admin"){
dot="🟡";
}

if(user.role==="supreme"){
dot="⚫";
}

box.innerHTML += `
<p>
${dot}
Avocat #${user.id}
(⚠ ${user.warnings})
</p>
`;

});

}
