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
// ======================
13
// MOTS DE PASSE
14
// ======================
15
 
16
const USER_PASSWORD = "BenjaminAguacateAI2026#";
17
const ADMIN_PASSWORD = "sinonAnanasAIneserapascontent2026!";
18
const SUPREME_PASSWORD = "situestristeBenjaBabynepleurepas2026?";
19
 
20
// ======================
21
// STOCKAGE MEMOIRE
22
// ======================
23
 
24
const users = {};
25
const memories = {};
26
const conversations = {};
27
const adminLogs = [];
28
 
29
// ======================
30
// OPENROUTER
31
// ======================
32
 
33
const openai = new OpenAI({
34
apiKey: process.env.OPENAI_API_KEY,
35
baseURL: "https://openrouter.ai/api/v1"
36
});
37
 
38
// ======================
39
// UPLOAD
40
// ======================
41
 
42
const upload = multer({
43
limits: {
44
fileSize: 10 * 1024 * 1024
45
}
46
});
47
 
48
// ======================
49
// LOGIN
50
// ======================
51
 
52
app.post("/login", (req, res) => {
53
 
54
const { password, deviceId } = req.body;
55
 
56
if (
57
password !== USER_PASSWORD &&
58
password !== ADMIN_PASSWORD &&
59
password !== SUPREME_PASSWORD
60
) {
61
return res.json({
62
ok: false
63
});
64
}
65
 
66
let role = "user";
67
 
68
if (password === ADMIN_PASSWORD) {
69
role = "admin";
70
}
71
 
72
if (password === SUPREME_PASSWORD) {
73
role = "supreme";
74
}
75
 
76
let id = deviceId;
77
 
78
if (!id) {
79
id = Math.random()
80
.toString(36)
81
.substring(2, 6)
82
.toUpperCase();
83
}
84
 
85
if (!users[id]) {
86
 
87
users[id] = {
88
id,
89
role,
90
warnings: 0,
91
banned: false,
92
connected: true
93
};
94
 
95
}
96
 
97
users[id].connected = true;
98
 
99
return res.json({
100
ok: true,
101
role,
102
id
103
});
104
 
105
});
106
 
107
// ======================
108
// UTILISATEURS
109
// ======================
110
 
111
app.get("/users", (req, res) => {
112
 
113
res.json(
114
Object.values(users)
115
);
116
 
117
});
118
 
119
// ======================
120
// CONVERSATIONS
121
// ======================
122
 
123
app.post("/newConversation", (req, res) => {
124
 
125
const { user } = req.body;
126
 
127
const id = Date.now().toString();
128
 
129
if (!conversations[user]) {
130
conversations[user] = [];
131
}
132
 
133
conversations[user].push({
134
id,
135
title: "Nouvelle conversation",
136
messages: []
137
});
138
 
139
res.json({
140
ok: true,
141
id
142
});
143
 
144
});
145
 
146
// ======================
147
// LISTER CONVERSATIONS
148
// ======================
149
 
150
app.get("/conversations/:user", (req, res) => {
151
 
152
const user = req.params.user;
153
 
154
res.json(
155
conversations[user] || []
156
);
157
 
158
});
159
 
160
// ======================
161
// RENOMMER CONVERSATION
162
// ======================
163
 
164
app.post("/renameConversation", (req, res) => {
165
 
166
const {
167
user,
168
conversationId,
169
title
170
} = req.body;
171
 
172
if (!conversations[user]) {
173
return res.json({ ok: false });
174
}
175
 
176
const conv =
177
conversations[user].find(
178
c => c.id === conversationId
179
);
180
 
181
if (!conv) {
182
return res.json({ ok: false });
183
}
184
 
185
conv.title = title;
186
 
187
return res.json({
188
ok: true
189
});
190
 
191
});
192
 
193
// ======================
194
// WARN
195
// ======================
196
 
197
app.post("/warn", (req, res) => {
198
 
199
const { id } = req.body;
200
 
201
const user = users[id];
202
 
203
if (!user) {
204
return res.json({
205
ok: false
206
});
207
}
208
 
209
if (user.role === "supreme") {
210
return res.json({
211
ok: false
212
});
213
}
214
 
215
user.warnings++;
216
 
217
if (user.warnings >= 3) {
218
user.banned = true;
219
}
220
 
221
adminLogs.push({
222
type: "warning",
223
user: id,
224
date: Date.now()
225
});
226
 
227
res.json({
228
warnings: user.warnings,
229
banned: user.banned
230
});
231
 
232
});
233
 
234
// ======================
235
// RETIRER AVERTISSEMENT
236
// ======================
237
 
238
app.post("/unwarn", (req, res) => {
239
 
240
const user = users[req.body.id];
241
 
242
if (!user) {
243
return res.json({
244
ok: false
245
});
246
}
247
 
248
user.warnings = Math.max(
249
0,
250
user.warnings - 1
251
);
252
 
253
res.json({
254
warnings: user.warnings
255
});
256
 
257
});
258
 
259
// ======================
260
// BAN
261
// ======================
262
 
263
app.post("/ban", (req, res) => {
264
 
265
const user = users[req.body.id];
266
 
267
if (!user) {
268
return res.json({
269
ok: false
270
});
271
}
272
 
273
if (user.role === "supreme") {
274
return res.json({
275
ok: false
276
});
277
}
278
 
279
user.banned = true;
280
 
281
adminLogs.push({
282
type: "ban",
283
user: user.id,
284
date: Date.now()
285
});
286
 
287
res.json({
288
ok: true
289
});
290
 
291
});
292
 
293
// ======================
294
// DEBAN
295
// ======================
296
 
297
app.post("/unban", (req, res) => {
298
 
299
const user = users[req.body.id];
300
 
301
if (!user) {
302
return res.json({
303
ok: false
304
});
305
}
306
 
307
user.banned = false;
308
 
309
adminLogs.push({
310
type: "unban",
311
user: user.id,
312
date: Date.now()
313
});
314
 
315
res.json({
316
ok: true
317
});
318
 
319
});
320
 
321
// ======================
322
// MAILBOX ADMIN
323
// ======================
324
 
325
app.get("/adminlogs", (req, res) =>
