let selectedVoice = "female";
2
 
3
function setVoice(type){
4
selectedVoice = type;
5
}
6
 
7
function speak(text){
8
 
9
if(!("speechSynthesis" in window)){
10
return;
11
}
12
 
13
const utterance =
14
new SpeechSynthesisUtterance(text);
15
 
16
utterance.lang = "fr-FR";
17
 
18
const voices =
19
speechSynthesis.getVoices();
20
 
21
if(selectedVoice === "female"){
22
 
23
const female =
24
voices.find(v =>
25
v.name.toLowerCase().includes("female")
26
);
27
 
28
if(female){
29
utterance.voice = female;
30
}
31
 
32
} else {
33
 
34
const male =
35
voices.find(v =>
36
v.name.toLowerCase().includes("male")
37
);
38
 
39
if(male){
40
utterance.voice = male;
41
}
42
 
43
}
44
 
45
speechSynthesis.speak(utterance);
46
}
47
 
48
function startListening(){
49
 
50
const SpeechRecognition =
51
window.SpeechRecognition ||
52
window.webkitSpeechRecognition;
53
 
54
if(!SpeechRecognition){
55
alert("Reconnaissance vocale non disponible");
56
return;
57
}
58
 
59
const recognition =
60
new SpeechRecognition();
61
 
62
recognition.lang = "fr-FR";
63
 
64
recognition.onresult = e => {
65
 
66
document.getElementById(
67
"prompt"
68
).value =
69
e.results[0][0].transcript;
70
 
71
};
72
 
73
recognition.start();
74
}
