function openAdmin(){
2
 
3
document.getElementById(
4
"admin-panel"
5
).style.display="flex";
6
 
7
}
8
 
9
function closeAdmin(){
10
 
11
document.getElementById(
12
"admin-panel"
13
).style.display="none";
14
 
15
}
16
 
17
async function loadUsers(){
18
 
19
const res =
20
await fetch("/users");
21
 
22
const users =
23
await res.json();
24
 
25
const box =
26
document.getElementById(
27
"user-list"
28
);
29
 
30
box.innerHTML="";
31
 
32
users.forEach(user=>{
33
 
34
let dot="🟢";
35
 
36
if(user.role==="admin"){
37
dot="🟡";
38
}
39
 
40
if(user.role==="supreme"){
41
dot="⚫";
42
}
43
 
44
box.innerHTML += `
45
<p>
46
${dot}
47
Avocat #${user.id}
48
(⚠ ${user.warnings})
49
</p>
50
`;
51
 
52
});
53
 
54
}
