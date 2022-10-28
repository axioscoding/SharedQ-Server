let express = require('express');
let cors = require("cors");
let app = express();
let bodyParser = require('body-parser');

app.use(bodyParser.json());
app.use(cors({credentials: true, origin: true}))

module.exports = app;