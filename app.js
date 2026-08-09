// ======================
2
// CONFIG
3
// ======================
4
 
5
const PASSWORD = "BenjaminAguacateAI2026#";
6
 
7
let currentConversation = null;
8
let currentVoice = "female";
9
let liveMode = false;
10
let currentRole = "user";
11
 
12
// ======================
13
// MOT DE PASSE
14
// ======================
15
 
16
function togglePassword() {
17
 
18
const input =
19
document.getElementById("password");
20
 
21
input.type =
22
input.type === "password"
23
? "text"
24
: "password";
25
 
26
}
27
 
28
// ======================
29
// ID APPAREIL PERMANENT
30
// ======================
31
 
32
function getDeviceId() {
33
 
34
let id =
35
localStorage.getItem(
36
"aguacate-id"
37
);
38
 
39
if (!id) {
40
 
41
id =
42
Math.random()
43
.toString(36)
44
.substring(2, 6)
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
return id;
55
 
56
}
57
 
58
// ======================
59
// LOGIN
60
// ======================
61
 
62
async function login() {
63
 
64
const password =
65
document.getElementById(
66
"password"
67
).value;
68
 
69
const deviceId =
70
getDeviceId();
71
 
72
const res =
73
await fetch("/login", {
74
 
75
method: "POST",
76
 
77
headers: {
78
"Content-Type":
79
"application/json"
80
},
81
 
82
body: JSON.stringify({
83
 
84
password,
85
deviceId
86
 
87
})
88
 
89
});
90
 
91
const data =
92
await res.json();
93
 
94
if (!data.ok) {
95
 
96
alert(
97
"Mot de passe incorrect"
98
);
99
 
100
return;
101
 
102
}
103
 
104
currentRole =
105
data.role;
106
 
107
document
108
.getElementById(
109
"login-screen"
110
)
111
.style.display =
112
"none";
113
 
114
document
115
.getElementById(
116
"app"
117
)
118
.style.display =
119
"flex";
120
 
121
document
122
.getElementById(
123
"user-badge"
124
)
125
.innerText =
126
"🥑 Avocat #" + data.id;
127
 
128
loadConversations();
129
 
130
}
131
 
132
// ======================
133
// AVATAR
134
// ======================
135
 
136
function thinkingAvocado() {
137
 
138
const mouth =
139
document.getElementById(
140
"mouth"
141
);
142
 
143
if (!mouth) return;
144
 
145
mouth.style.width =
146
"14px";
147
 
148
mouth.style.height =
149
"14px";
150
 
151
mouth.style.borderRadius =
152
"50%";
153
 
154
}
155
 
156
function talkingAvocado() {
157
 
158
const mouth =
159
document.getElementById(
160
"mouth"
161
);
162
 
163
if (!mouth) return;
164
 
165
let open = false;
166
 
167
const anim =
168
setInterval(() => {
169
 
170
if (open) {
171
 
172
mouth.style.height =
173
"8px";
174
 
175
} else {
176
 
177
mouth.style.height =
178
"24px";
179
 
180
}
181
 
182
open = !open;
183
 
184
}, 120);
185
 
186
setTimeout(() => {
187
 
188
clearInterval(anim);
189
 
190
mouth.style.height =
191
"8px";
192
 
193
mouth.style.width =
194
"32px";
195
 
196
}, 2500);
197
 
198
}
199
 
200
// ======================
201
// CHAT
202
// ======================
203
 
204
async function send() {
205
 
206
const input =
207
document.getElementById(
208
"prompt"
209
);
210
 
211
const msg =
212
input.value.trim();
213
 
214
if (!msg) return;
215
 
216
const messages =
217
document.getElementById(
218
"messages"
219
);
220
 
221
messages.innerHTML += `
222
<div class="message-user">
223
${msg}
224
</div>`;
225
 
226
input.value = "";
227
 
228
thinkingAvocado();
229
 
230
const res =
231
await fetch("/chat", {
232
 
233
method: "POST",
234
 
235
headers: {
236
"Content-Type":
237
"application/json"
238
},
239
 
240
body: JSON.stringify({
241
 
242
message: msg,
243
 
244
user: getDeviceId(),
245
 
246
mode:
247
document
248
.getElementById(
249
"mode"
250
)
251
.value
252
 
253
})
254
 
255
});
256
 
257
const data =
258
await res.json();
259
 
260
talkingAvocado();
261
 
262
messages.innerHTML += `
263
<div class="message-ai">
264
${data.reply}
265
</div>`;
266
 
267
messages.scrollTop =
268
messages.scrollHeight;
269
 
270
if (liveMode) {
271
speak(data.reply);
272
}
273
 
274
}
275
 
276
// ======================
277
// CONVERSATIONS
278
// ======================
279
 
280
async function newConversation() {
281
 
282
const res =
283
await fetch(
284
"/newConversation",
285
{
286
 
287
method: "POST",
288
 
289
headers: {
290
"Content-Type":
291
"application/json"
292
},
293
 
294
body: JSON.stringify({
295
 
296
user:
297
getDeviceId()
298
 
299
})
300
 
301
}
302
);
303
 
304
const data =
305
await res.json();
306
 
307
currentConversation =
308
data.id;
309
 
310
loadConversations();
311
 
312
}
313
 
314
async function loadConversations() {
315
 
316
const user =
317
getDeviceId();
318
 
319
const res =
320
await fetch(
321
"/conversations/" +
322
user
323
);
324
 
325
const list =
326
await res.json();
327
 
328
const box =
329
document.querySelector(
330
".conversations"
331
);
332
 
333
if (!box) return;
334
 
335
box.innerHTML = "";
336
 
337
list.forEach(conv => {
338
 
339
box.innerHTML += `
340
<div class="conversation"
341
onclick="selectConversation('${conv.id}')">
342
${conv.title}
343
</div>`;
344
 
345
});
346
 
347
}
348
 
349
function selectConversation(id) {
350
 
351
currentConversation =
352
id;
353
 
354
}
355
 
356
// ======================
357
// RENOMMER
358
// ======================
359
 
360
async function renameConversation() {
361
 
362
if (
363
!currentConversation
364
)
365
return;
366
 
367
const name =
368
prompt(
369
"Nouveau nom"
370
);
371
 
372
if (!name) return;
373
 
374
await fetch(
375
"/renameConversation",
376
{
377
 
378
method: "POST",
379
 
380
headers: {
381
"Content-Type":
382
"application/json"
383
},
384
 
385
body: JSON.stringify({
386
 
387
user:
388
getDeviceId(),
389
 
390
conversationId:
391
currentConversation,
392
 
393
title: name
394
 
395
})
396
 
397
}
398
);
399
 
400
loadConversations();
401
 
402
}
403
 
404
// ======================
405
// VOIX
406
// ======================
407
 
408
function setVoice(type) {
409
 
410
currentVoice =
411
type;
412
 
413
alert(
414
"Voix : " + type
415
);
416
 
417
}
418
 
419
function speak(text) {
420
 
421
if (
422
!(
423
"speechSynthesis" in
424
window
425
)
426
)
427
return;
428
 
429
const utterance =
430
new SpeechSynthesisUtterance(
431
text
432
);
433
 
434
utterance.lang =
435
"fr-FR";
436
 
437
speechSynthesis.speak(
438
utterance
439
);
440
 
441
}
442
 
443
function toggleLive() {
444
 
445
liveMode =
446
!liveMode;
447
 
448
alert(
449
liveMode
450
? "🎤 Mode Live activé"
451
: "🎤 Mode Live désactivé"
452
);
453
 
454
}
455
 
456
// ======================
457
// ADMIN
458
// ======================
459
 
460
function openAdmin() {
461
 
462
const panel =
463
document.getElementById(
464
"admin-panel"
465
);
466
 
467
if (panel) {
468
 
469
panel.style.display =
470
"flex";
471
 
472
}
473
 
474
}
475
 
476
function openUsers() {
477
 
478
const panel =
479
document.getElementById(
480
"users-panel"
481
);
482
 
483
if (panel) {
484
 
485
panel.style.display =
486
"flex";
487
 
488
}
489
 
490
loadUsers();
491
 
492
}
493
 
494
function openMailbox() {
495
 
496
const panel =
497
document.getElementById(
498
"mailbox-panel"
499
);
500
 
501
if (panel) {
502
 
503
panel.style.display =
504
"flex";
505
 
506
}
507
 
508
loadMailbox();
509
 
510
}
511
 
512
// ======================
513
// USERS
514
// ======================
515
 
516
async function loadUsers() {
517
 
518
const res =
519
await fetch(
520
"/users"
521
);
522
 
523
const users =
524
await res.json();
525
 
526
const box =
527
document.getElementById(
528
"user-list"
529
);
530
 
531
if (!box) return;
532
 
533
box.innerHTML = "";
534
 
535
users.forEach(user => {
536
 
537
let dot = "🟢";
538
 
539
if (
540
user.role ===
541
"admin"
542
) {
543
dot = "🟡";
544
}
545
 
546
if (
547
user.role ===
548
"supreme"
549
) {
550
dot = "⚫";
551
}
552
 
553
box.innerHTML += `
554
<p>
555
${dot}
556
Avocat #${user.id}
557
(⚠ ${user.warnings})
558
</p>`;
559
 
560
});
561
 
562
}
563
 
564
// ======================
565
// MAILBOX
566
// ======================
567
 
568
async function loadMailbox() {
569
 
570
const res =
571
await fetch(
572
"/adminlogs"
573
);
574
 
575
const logs =
576
await res.json();
577
 
578
const box =
579
document.getElementById(
580
"mailbox-list"
581
);
582
 
583
if (!box) return;
584
 
585
box.innerHTML = "";
586
 
587
logs.forEach(log => {
588
 
589
box.innerHTML += `
590
<p>
591
${log.type}
592
-
593
${log.user}
594
</p>`;
595
 
596
});
597
 
598
}
599
 
600
// ======================
601
// ENTER
602
// ======================
603
 
604
document.addEventListener(
605
"keydown",
606
e => {
607
 
608
if (
609
e.key === "Enter"
610
) {
611
 
612
const loginVisible =
613
document
614
.getElementById(
615
"login-screen"
616
)
617
.style.display !==
618
"none";
619
 
620
if (loginVisible) {
621
 
622
login();
623
 
624
} else {
625
 
626
send();
627
 
628
}
629
 
630
}
631
 
632
}
633
);
