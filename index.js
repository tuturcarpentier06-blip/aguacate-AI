// =========================================================
// AGUACATE AI v4.0.0
// INDEX.JS
// =========================================================

const app = require('./app');

const PORT =
  Number(
    process.env.PORT || 10000
  );

app.listen(
  PORT,
  '0.0.0.0',
  () => {

    console.log(
      `🥑 Aguacate AI v4.0.0 listening on port ${PORT}`
    );

  }
);
