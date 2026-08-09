const PASSWORD = "BenjaminAguacateAI2026#";
2
 
3
function togglePassword(){
4
 
5
const p =
6
document.getElementById("password");
7
 
8
p.type =
9
p.type === "password"
10
? "text"
11
: "password";
12
 
13
}
14
 
15
async function login(){
16
 
17
const pass =
18
document.getElementById("password").value;
19
 
20
if(pass !== PASSWORD){
21
 
22
alert("Mot de passe incorrect");
23
 
24
return;
25
 
26
}
27
 
28
document.getElementById(
29
"login-screen"
30
).style.display="none";
31
 
32
document.getElementById(
33
"app"
34
).style.display="block";
35
 
36
let id =
37
localStorage.getItem("aguacate-id");
38
 
39
if(!id){
40
 
41
id =
42
Math.random()
43
.toString(36)
44
.substring(2,6)
45
.toUpperCase();
46
 
47
localStorage.setItem(
48
"aguacate-id",
49
id
50
);
51
 
52
}
53
 
54
document.getElementById(
55
"user-badge"
56
).innerText =
57
"🥑 Avocat #" + id;
58
 
59
}
60
 
61
async function send(){
62
 
63
const msg =
64
document.getElementById("prompt").value;
65
 
66
if(!msg) return;
67
 
68
const res =
69
await fetch("/chat",{
70
 
71
method:"POST",
72
 
73
headers:{
74
"Content-Type":"application/json"
75
},
76
 
77
body:JSON.stringify({
78
 
79
message:msg,
80
 
81
user:
82
localStorage.getItem(
83
"aguacate-id"
84
),
85
 
86
mode:
87
document.getElementById(
88
"mode"
89
).value
90
 
91
})
92
 
93
});
94
 
95
const data =
96
await res.json();
97
 
98
const messages =
99
document.getElementById("messages");
100
 
101
messages.innerHTML +=
102
`<div class="message-user">${msg}</div>`;
103
 
104
messages.innerHTML +=
105
`<div class="message-ai">${data.reply}</div>`;
106
 
107
document.getElementById(
108
"prompt"
109
).value = "";
110
 
111
}
