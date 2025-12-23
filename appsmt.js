import express from 'express';
import cors from 'cors';
import path from 'path';
import mysql from 'mysql2';
import bodyParser from 'body-parser';

let __filename = new URL(import.meta.url).pathname;
let __dirname = path.dirname(__filename);

// import routes
import commonRoutes from './routes/common.route.js';
import adminRoutes from './routes/admin.route.js';
import agentRoutes from './routes/agent.route.js';

const app = express();
app.use(cors());
// allow-cors
app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, x-access-token");
  res.header('access-control-expose-headers', 'x-total-count');

  // allow preflight
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

 app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
 app.use(bodyParser.json({ limit: '50mb' }));

const port = process.env.PORT || 3009;

if (process.platform === 'win32') {
  __dirname = __dirname.replace(/^\/([A-Za-z]):/, '$1:'); // Remove the leading slash before the drive letter
}
app.use('/public', express.static(__dirname+'/public'));


// Connect to the database
const pool = mysql.createPool({
  host: '127.0.0.1',
   user: 'dbadmin',
   password: 'Satham021290',
  // user: 'root',
  // password: '',
  database: 'savemytrip',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 60000,
});

function connectWithRetry() {
  pool.getConnection((err, conn) => {
    if (err) {
      console.error('DB connect error:', err.code);
      return setTimeout(connectWithRetry, 2000);
    }
    console.log('DB connection (via pool) established.');
    conn.ping(pingErr => {
      conn.release();
      if (pingErr) {
        console.error('Ping failed:', pingErr.code);
        return setTimeout(connectWithRetry, 2000);
      }
    });
  });
}

// Initial ping
connectWithRetry();
// Ping regularly every minute
setInterval(connectWithRetry, 60000);

// 3. Global error handler
pool.on('error', err => {
  console.error('MySQL pool error:', err.code);
  //if (err.code === 'PROTOCOL_CONNECTION_LOST') {
  if (['PROTOCOL_CONNECTION_LOST','ECONNRESET'].includes(err.code)) {  
    console.log('Lost connection—re-pinging...');
    connectWithRetry();
  }
});


app.use((req, res, next) => {
  var url = req.protocol + '://' + req.headers.host + req.originalUrl;
  req.db = pool;
  next();
});

app.use('/common', commonRoutes);
app.use('/admin', adminRoutes);
app.use('/agent', agentRoutes);

app.get('/', (req, res) => {
  return res.end('Api working for Savemytrip');
})


// catch 404
app.use((req, res, next) => {
  res.status(404).send('<h2 align=center>Page Not Found!</h2>');
});

// start the server
app.listen(port, () => {
 console.log(`App Server Listening at ${port}`);
});

//app.listen(3000)