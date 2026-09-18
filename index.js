const app = require('./server');

const PORT = Number(process.env.PORT || 10000);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🥑 Aguacate AI v4.0.0 listening on port ${PORT}`);
});
