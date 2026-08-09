const express = require("express");
2
const OpenAI = require("openai");
3
const multer = require("multer");
4
 
5
const app = express();
6
 
7
app.use(express.json());
8
app.use(express.static("."));
9
 
10
const PORT = process.env.PORT || 3000;
11
 
12
// MOTS DE PASSE
13
 
14
const USER_PASSWORD = "BenjaminAguacateAI2026#";
15
const ADMIN_PASSWORD = "sinonAnanasAIneserapascontent2026!";
16
const SUPREME_PASSWORD = "situestristeBenjaBabynepleurepas2026?";
17
 
18
// DONNÉES
19
 
20
const users = {};
21
const memories = {};
22
const adminLogs = [];
23
 
24
// UPLOAD
25
 
26
const upload = multer({
27
limits: {
28
fileSize: 10 * 1024 * 1024
29
}
30
});
31
 
32
// OPENROUTER
33
 
34
const openai = new OpenAI({
35
apiKey: process.env.OPENAI_API_KEY,
36
baseURL: "https://openrouter.ai/api/v1"
37
});
38
 
39
// LOGIN
40
 
41
app.post("/login", (req, res) => {
42
 
43
const { password, deviceId } = req.body;
44
 
45
if (
46
password !== USER_PASSWORD &&
47
password !== ADMIN_PASSWORD &&
48
password !== SUPREME_PASSWORD
49
) {
50
return res.json({
51
ok: false
52
});
53
}
54
 
55
let role = "user";
56
 
57
if (password === ADMIN_PASSWORD) {
58
role = "admin";
59
}
60
 
61
if (password === SUPREME_PASSWORD) {
62
role = "supreme";
63
}
64
 
65
const id =
66
deviceId ||
67
Math.random()
68
.toString(36)
69
.substring(2, 6)
70
.toUpperCase();
71
 
72
if (!users[id]) {
73
 
74
users[id] = {
75
 
76
id,
77
 
78
role,
79
 
80
warnings: 0,
81
 
82
banned: false,
83
 
84
connected: true,
85
 
86
createdAt: Date.now()
87
 
88
};
89
 
90
}
91
 
92
users[id].connected = true;
93
 
94
return res.json({
95
 
96
ok: true,
97
 
98
role,
99
 
100
id
101
 
102
});
103
 
104
});
105
 
106
// LISTE UTILISATEURS
107
 
108
app.get("/users", (req, res) => {
109
 
110
res.json(
111
Object.values(users)
112
);
113
 
114
});
115
 
116
// AVERTISSEMENTS
117
 
118
app.post("/warn", (req, res) => {
119
 
120
const { id } = req.body;
121
 
122
const user = users[id];
123
 
124
if (!user) {
125
return res.json({
126
ok: false
127
});
128
}
129
 
130
if (user.role === "supreme") {
131
return res.json({
132
ok: false,
133
message: "Admin suprême protégé"
134
});
135
}
136
 
137
user.warnings++;
138
 
139
if (user.warnings >= 3) {
140
user.banned = true;
141
}
142
 
143
adminLogs.push({
144
 
145
type: "warning",
146
 
147
user: id,
148
 
149
date: Date.now()
150
 
151
});
152
 
153
res.json({
154
 
155
ok: true,
156
 
157
warnings: user.warnings,
158
 
159
banned: user.banned
160
 
161
});
162
 
163
});
164
 
165
// RETIRER AVERTISSEMENT
166
 
167
app.post("/unwarn", (req, res) => {
168
 
169
const user = users[req.body.id];
170
 
171
if (!user) {
172
return res.json({
173
ok: false
174
});
175
}
176
 
177
user.warnings = Math.max(
178
0,
179
user.warnings - 1
180
);
181
 
182
res.json({
183
warnings: user.warnings
184
});
185
 
186
});
187
 
188
// BANNIR
189
 
190
app.post("/ban", (req, res) => {
191
 
192
const user =
193
users[req.body.id];
194
 
195
if (!user) {
196
return res.json({
197
ok: false
198
});
199
}
200
 
201
if (user.role === "supreme") {
202
return res.json({
203
ok: false
204
});
205
}
206
 
207
user.banned = true;
208
 
209
adminLogs.push({
210
 
211
type: "ban",
212
 
213
user: user.id,
214
 
215
date: Date.now()
216
 
217
});
218
 
219
res.json({
220
ok: true
221
});
222
 
223
});
224
 
225
// DEBANNIR
226
 
227
app.post("/unban", (req, res) => {
228
 
229
const user =
230
users[req.body.id];
231
 
232
if (!user) {
233
return res.json({
234
ok: false
235
});
236
}
237
 
238
user.banned = false;
239
 
240
adminLogs.push({
241
 
242
type: "unban",
243
 
244
user: user.id,
245
 
246
date: Date.now()
247
 
248
});
249
 
250
res.json({
251
ok: true
252
});
253
 
254
});
255
 
256
// CHAT
257
 
258
app.post("/chat", async (req, res) => {
259
 
260
try {
261
 
262
const {
263
user,
264
message,
265
mode
266
} = req.body;
267
 
268
if (!memories[user]) {
269
memories[user] = [];
270
}
271
 
272
let systemPrompt =
273
"Tu es Aguacate AI.";
274
 
275
if (mode === "Kids") {
276
systemPrompt =
277
"Tu expliques simplement pour les enfants.";
278
}
279
 
280
if (mode === "Collégien") {
281
systemPrompt =
282
"Tu aides les collégiens et les étudiants.";
283
}
284
 
285
if (mode === "Professeur") {
286
systemPrompt =
287
"Tu aides à créer des cours, exercices et évaluations.";
288
}
289
 
290
memories[user].push({
291
role: "user",
292
content: message
293
});
294
 
295
const response =
296
await openai.chat.completions.create({
297
 
298
model: "openrouter/auto",
299
 
300
messages: [
301
{
302
role: "system",
303
content: systemPrompt
304
},
305
...memories[user].slice(-15)
306
]
307
 
308
});
309
 
310
const reply =
311
response.choices[0]
312
.message.content;
313
 
314
memories[user].push({
315
 
316
role: "assistant",
317
content: reply
318
 
319
});
320
 
321
return res.json({
322
reply
323
});
324
 
325
} catch (err) {
326
 
327
console.error(err);
328
 
329
return res.json({
330
reply: "🥑 Une erreur est survenue."
331
});
332
 
333
}
334
 
335
});
336
 
337
// UPLOAD PDF / IMAGE
338
 
339
app.post(
340
"/upload",
341
upload.single("file"),
342
async (req, res) => {
343
 
344
if (!req.file) {
345
return res.json({
346
ok: false
347
});
348
}
349
 
350
return res.json({
351
 
352
ok: true,
353
 
354
filename:
355
req.file.originalname
356
 
357
});
358
}
359
);
360
 
361
// LOGS ADMIN
362
 
363
app.get("/adminlogs", (req, res) => {
364
 
365
res.json(adminLogs);
366
 
367
});
368
 
369
// DÉMARRAGE
370
 
371
app.listen(PORT, () => {
372
 
373
console.log(
374
"🥑 Aguacate AI v3.5.0 ONLINE"
375
);
376
 
377
});
