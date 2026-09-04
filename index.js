// index.js - starts the express app from server.js
const app = require('./server');
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🥑 Aguacate AI listening on port ${PORT}`);
});
